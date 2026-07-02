import type {
  DailyStorage,
  EasternDate,
  InProgressSession,
  PuzzleResult,
  RecordMode,
} from './types'

export type ProgressUpdate = {
  puzzlesDone: PuzzleResult[]
  currentIdx: number
  elapsedMs: number
}

/**
 * Record (or update) the single in-progress session. Latest write wins;
 * startedAt survives updates to the same date+mode so "when did they start"
 * stays truthful across reloads.
 */
export function writeProgress(
  s: DailyStorage,
  date: EasternDate,
  mode: RecordMode,
  update: ProgressUpdate,
  now: number = Date.now()
): DailyStorage {
  const prior = s.inProgress
  const startedAt =
    prior && prior.date === date && prior.mode === mode ? prior.startedAt : now
  return {
    ...s,
    inProgress: { date, mode, ...update, startedAt, updatedAt: now },
  }
}

export function clearProgress(s: DailyStorage): DailyStorage {
  return s.inProgress === null ? s : { ...s, inProgress: null }
}

const isValidResult = (r: PuzzleResult): boolean =>
  typeof r === 'object' &&
  r !== null &&
  typeof r.attempts === 'number' &&
  typeof r.hints === 'number' &&
  typeof r.durationMs === 'number' &&
  (r.stars === 1 || r.stars === 2 || r.stars === 3)

/**
 * The inProgress record for this date+mode, or null if absent, stale, or
 * malformed. Malformed records are treated as absent — the next write
 * overwrites them, so no repair pass is needed.
 */
export function readProgress(
  s: DailyStorage,
  date: EasternDate,
  mode: RecordMode
): InProgressSession | null {
  const p = s.inProgress
  if (!p || p.date !== date || p.mode !== mode) return null
  if (s.sessions[date]) return null // already completed — progress is stale
  if (!Number.isInteger(p.currentIdx) || p.currentIdx < 0 || p.currentIdx > 4)
    return null
  if (!Array.isArray(p.puzzlesDone) || p.puzzlesDone.length !== p.currentIdx)
    return null
  if (typeof p.elapsedMs !== 'number' || !(p.elapsedMs >= 0)) return null
  if (!p.puzzlesDone.every(isValidResult)) return null
  return p
}
