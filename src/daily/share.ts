const SITE_URL = 'flipwords.superfun.games'

export type ShareInput = {
  dayNumber: number
  stars: 1 | 2 | 3
  totalDurationMs: number
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function padNumber(n: number): string {
  // 1–3 digits get zero-padded to 3; bigger numbers print as-is.
  return n < 1000 ? n.toString().padStart(3, '0') : n.toString()
}

function starString(stars: 1 | 2 | 3): string {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars)
}

export function formatShareString(input: ShareInput): string {
  return `FlipWords No. ${padNumber(input.dayNumber)}\n${starString(input.stars)} — ${formatTime(input.totalDurationMs)}\n${SITE_URL}`
}

/**
 * Share via the Web Share API if available, falling back to clipboard.
 * Returns the method used so the caller can show appropriate UI feedback.
 */
export async function shareSession(input: ShareInput): Promise<'native' | 'clipboard' | 'failed'> {
  const text = formatShareString(input)
  if (typeof navigator === 'undefined') return 'failed'
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'native'
    } catch {
      // User canceled or share rejected — fall through to clipboard.
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return 'clipboard'
    } catch {
      return 'failed'
    }
  }
  return 'failed'
}
