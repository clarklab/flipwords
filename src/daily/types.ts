/** Eastern date string in YYYY-MM-DD form. */
export type EasternDate = string

export type SessionMode = 'daily' | 'archive' | 'practice'

export type PuzzleResult = {
  attempts: number
  hints: number
  durationMs: number
  stars: 1 | 2 | 3
}

export type SessionResult = {
  date: EasternDate
  dayNumber: number
  completedAt: number
  stars: 1 | 2 | 3
  perPuzzle: PuzzleResult[]
  totalDurationMs: number
}

export type StreakState = {
  current: number
  best: number
  lastCompletedDate: EasternDate | null
}

/** How a completed session was earned. Daily = played on its calendar day. */
export type RecordMode = 'daily' | 'makeup'

export type StoredSession = Omit<SessionResult, 'date' | 'dayNumber'> & {
  mode: RecordMode
}

/** A daily/makeup session that has been started but not finished. */
export type InProgressSession = {
  date: EasternDate
  mode: RecordMode
  /** Results for puzzles ALREADY completed — never includes the one underway. */
  puzzlesDone: PuzzleResult[]
  /** Index of the puzzle being played. Invariant: === puzzlesDone.length. */
  currentIdx: number
  /** Session-timer snapshot (visible-time ms). */
  elapsedMs: number
  startedAt: number
  updatedAt: number
}

export type DailyStorage = {
  schemaVersion: 2
  streak: StreakState
  sessions: { [date: EasternDate]: StoredSession }
  totals: {
    sessionsPlayed: number
    perfectSessions: number
  }
  inProgress: InProgressSession | null
}
