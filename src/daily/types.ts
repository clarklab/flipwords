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

export type StoredSession = Omit<SessionResult, 'date' | 'dayNumber'> & {
  isDailyResult: true
}

export type DailyStorage = {
  schemaVersion: 1
  streak: StreakState
  sessions: { [date: EasternDate]: StoredSession }
  totals: {
    sessionsPlayed: number
    perfectSessions: number
  }
}
