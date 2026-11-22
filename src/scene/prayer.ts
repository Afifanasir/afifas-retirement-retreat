import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan'

// Bengaluru, Karachi method, Hanafi Asr (common convention in India)
const BLR = new Coordinates(12.9716, 77.5946)
const params = CalculationMethod.Karachi()
params.madhab = Madhab.Hanafi
const WINDOW_MIN = 15

// true while "now" is within WINDOW_MIN minutes after any of the five prayers. ?prayer=1 forces it for testing.
export function isPrayerTime(now = new Date()): boolean {
  const q = new URLSearchParams(location.search).get('prayer')
  if (q !== null) return q === '1'
  const p = new PrayerTimes(BLR, now, params)
  return [p.fajr, p.dhuhr, p.asr, p.maghrib, p.isha].some((t) => now >= t && +now - +t < WINDOW_MIN * 60000)
}

// night = between isha and fajr (used as the default mode on load)
export function isNightNow(now = new Date()): boolean {
  const p = new PrayerTimes(BLR, now, params)
  return now < p.fajr || now >= p.isha
}
