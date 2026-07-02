import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEasternDate } from '@/daily/useEasternDate'

describe('useEasternDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the current Eastern date', () => {
    // 2026-07-02 12:00 EDT == 16:00 UTC
    vi.setSystemTime(new Date('2026-07-02T16:00:00Z'))
    const { result } = renderHook(() => useEasternDate())
    expect(result.current).toBe('2026-07-02')
  })

  it('flips to the next date when Eastern midnight passes', () => {
    // 23:59:30 EDT on Jul 2 == 03:59:30 UTC Jul 3
    vi.setSystemTime(new Date('2026-07-03T03:59:30Z'))
    const { result } = renderHook(() => useEasternDate())
    expect(result.current).toBe('2026-07-02')
    act(() => {
      vi.advanceTimersByTime(31_000) // past midnight + the 250ms cushion
    })
    expect(result.current).toBe('2026-07-03')
  })

  it('re-checks when the tab becomes visible again', () => {
    vi.setSystemTime(new Date('2026-07-03T03:59:30Z'))
    const { result } = renderHook(() => useEasternDate())
    expect(result.current).toBe('2026-07-02')
    // Simulate the device sleeping through midnight: jump the clock without
    // letting the timeout fire, then fire visibilitychange.
    vi.setSystemTime(new Date('2026-07-03T05:00:00Z'))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe('2026-07-03')
  })
})
