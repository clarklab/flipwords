import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import {
  DEFAULT_EDITION,
  EDITIONS,
  EDITION_BY_HOST,
  EDITION_IDS,
  editionForHost,
  isEdition,
} from './editions'
import type { Edition, EditionConfig } from './types'

/** Where the chosen edition is remembered between visits. */
export const EDITION_STORAGE_KEY = 'game_edition_v1'

/** Query param that pins an edition, e.g. `/play?edition=flipwords`. */
export const EDITION_QUERY_PARAM = 'edition'

/** Where the fork-in-the-road game chooser lives. */
export const GAME_SELECT_PATH = '/choose'

/**
 * Which editions have at least one COMPLETED session on this device. Key
 * existence is not enough: merely glancing at an edition's title screen
 * writes a fresh empty blob (the settle-streak save), so the signal is a
 * non-empty `sessions` map — days actually played.
 *
 * This exists for players who predate the game chooser: they never wrote
 * `game_edition_v1`, but months of daily sessions are a louder answer to
 * "which game do you play?" than any fork screen. Unreadable or corrupt
 * blobs count as no evidence — `loadStorage` deals with backing those up.
 */
export function editionsWithPlay(): Edition[] {
  if (typeof window === 'undefined') return []
  const played: Edition[] = []
  for (const id of EDITION_IDS) {
    try {
      const raw = window.localStorage.getItem(EDITIONS[id].storageKey)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { sessions?: Record<string, unknown> }
      if (
        parsed?.sessions &&
        typeof parsed.sessions === 'object' &&
        Object.keys(parsed.sessions).length > 0
      ) {
        played.push(id)
      }
    } catch {
      // Blocked storage or malformed JSON — not evidence of play.
    }
  }
  return played
}

/**
 * Resolve the edition: explicit URL param wins, then the remembered choice,
 * then a play history that names exactly one edition, then the host pin,
 * then the default. Kept in sync with the inline boot script in
 * `editionBootScript()` — if you change the precedence here, change it there.
 */
export function resolveEdition(): Edition {
  if (typeof window === 'undefined') return DEFAULT_EDITION
  let fromUrl: string | null = null
  try {
    fromUrl = new URLSearchParams(window.location.search).get(
      EDITION_QUERY_PARAM
    )
  } catch {
    // Malformed URL — fall through to storage.
  }
  if (isEdition(fromUrl)) return fromUrl
  try {
    const stored = window.localStorage.getItem(EDITION_STORAGE_KEY)
    if (isEdition(stored)) return stored
  } catch {
    // Private mode / blocked storage — fall through.
  }
  const played = editionsWithPlay()
  if (played.length === 1) return played[0]
  return editionForHost(window.location.hostname) ?? DEFAULT_EDITION
}

/**
 * Has the visitor picked a game — explicitly (fork screen, or an `?edition=`
 * deep link that got persisted) or implicitly, by having a play history in
 * exactly one edition? Distinct from `resolveEdition()`, which always answers
 * something — host mapping and the default are fallbacks, not choices. Used
 * to decide whether the fork in the road has been passed.
 */
export function hasChosenEdition(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (isEdition(window.localStorage.getItem(EDITION_STORAGE_KEY))) {
      return true
    }
  } catch {
    // Blocked storage: fall through to the play-history read, which guards
    // itself — an in-memory session may still have readable evidence.
  }
  return editionsWithPlay().length === 1
}

/**
 * Runs before first paint so the correct palette is on `<html>` immediately —
 * and, on a first visit to the front door, swaps the whole page for the game
 * chooser before the title screen can flash.
 *
 * The URL read and the storage read are wrapped SEPARATELY on purpose: a
 * single try/catch meant that a throwing `localStorage` (Safari private mode,
 * blocked cookies) skipped the attribute write entirely, so even an explicit
 * `?edition=…` was ignored. Mirrors `resolveEdition()`; keep the two in step.
 *
 * The redirect fires only for `/` with NO choice — explicit (URL param,
 * stored value) or implicit (a play history naming exactly one edition; see
 * `editionsWithPlay()`). The implicit branch is what keeps players who
 * predate the chooser out of the fork: someone with a months-long streak
 * already answered the question by playing, and bouncing them through a
 * "pick your game" screen risks a wrong tap that hides their progress and
 * costs them that day's streak. Their inferred edition is persisted as the
 * choice so every later load takes the fast path. A host-pinned origin still
 * shows the fork on a genuine first visit — the pin decides branding
 * fallbacks, not the visitor's answer. Blocked storage degrades gracefully:
 * the chooser reappears on the next full load, but in-app navigation
 * (`/choose` → `/`) is client-side routing and never re-runs this script, so
 * nobody loops.
 */
export function editionBootScript(): string {
  const storageKeyById = Object.fromEntries(
    EDITION_IDS.map((id) => [id, EDITIONS[id].storageKey])
  )
  return `(function(){
var K=${JSON.stringify(EDITION_STORAGE_KEY)},P=${JSON.stringify(EDITION_QUERY_PARAM)},D=${JSON.stringify(DEFAULT_EDITION)};
function ok(v){return v==='flipwords'||v==='texas'}
var e=null,chosen=false;
try{var q=new URLSearchParams(location.search).get(P);if(ok(q)){e=q;chosen=true}}catch(_){}
if(!e){try{var s=localStorage.getItem(K);if(ok(s)){e=s;chosen=true}}catch(_){}}
if(!e){var M=${JSON.stringify(storageKeyById)},w=[];
for(var k in M){try{var d=JSON.parse(localStorage.getItem(M[k])||'null');if(d&&d.sessions&&typeof d.sessions==='object'){for(var i in d.sessions){w.push(k);break}}}catch(_){}}
if(w.length===1){e=w[0];chosen=true;try{localStorage.setItem(K,e)}catch(_){}}}
if(!e){try{var h=${JSON.stringify(EDITION_BY_HOST)}[location.hostname];if(ok(h))e=h}catch(_){}}
try{document.documentElement.setAttribute('data-edition',e||D)}catch(_){}
if(!chosen&&location.pathname==='/'){try{location.replace(${JSON.stringify(GAME_SELECT_PATH)})}catch(_){}}
})();`
}

/**
 * Module-level store behind `useSyncExternalStore`.
 *
 * This exists so the FIRST client render already has the right edition.
 * Resolving in an effect instead meant one commit ran against the default
 * edition — long enough for `play.tsx` to lazily seed state from, and
 * `TitleScreen` to write a settled streak into, the *other* edition's
 * localStorage key. That silently corrupted real progress.
 */
let cached: Edition | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function getSnapshot(): Edition {
  if (cached === null) cached = resolveEdition()
  return cached
}

/** SSR renders the default; the boot script has already painted the truth. */
function getServerSnapshot(): Edition {
  return DEFAULT_EDITION
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  const onStorage = (e: StorageEvent) => {
    // Another tab switched editions (or storage was cleared).
    if (e.key !== EDITION_STORAGE_KEY && e.key !== null) return
    const next = resolveEdition()
    if (next !== cached) {
      cached = next
      emit()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function writeEdition(next: Edition) {
  cached = next
  try {
    window.localStorage.setItem(EDITION_STORAGE_KEY, next)
  } catch {
    // Non-fatal: the choice just won't survive a reload.
  }
  emit()
}

/** Test/preview seam — lets a test start from a known edition. */
export function __setEditionForTests(next: Edition | null) {
  cached = next
  emit()
}

type EditionContextValue = {
  edition: Edition
  config: EditionConfig
  setEdition: (next: Edition) => void
}

const EditionContext = createContext<EditionContextValue | null>(null)

export function EditionProvider({
  children,
  /** Force an edition, bypassing URL/storage. Used by tests and previews. */
  value,
}: {
  children: ReactNode
  value?: Edition
}) {
  const stored = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )
  const edition = value ?? stored

  const setEdition = useCallback(
    (next: Edition) => {
      if (value) return // pinned by prop; ignore
      writeEdition(next)
    },
    [value]
  )

  const ctx = useMemo<EditionContextValue>(
    () => ({
      edition,
      config: EDITIONS[edition],
      setEdition,
    }),
    [edition, setEdition]
  )

  // Reflect onto <html> AFTER commit, never during render.
  //
  // Doing this in the render phase mutated the DOM during hydration, when
  // `useSyncExternalStore` is still serving `getServerSnapshot()` — so on a
  // host whose edition differs from the default it wrote the default back onto
  // <html> and then flipped, reintroducing exactly the flash the pre-paint
  // boot script exists to prevent. The boot script's value now stands
  // untouched until React has settled on the real edition.
  useEffect(() => {
    document.documentElement.setAttribute('data-edition', edition)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', EDITIONS[edition].themeColor)
  }, [edition])

  return (
    <EditionContext.Provider value={ctx}>{children}</EditionContext.Provider>
  )
}

export function useEdition(): EditionContextValue {
  const ctx = useContext(EditionContext)
  if (!ctx) {
    throw new Error('useEdition must be used inside <EditionProvider>')
  }
  return ctx
}
