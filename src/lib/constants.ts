export function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day))
  r.setHours(0, 0, 0, 0)
  return r
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export const CLASS_LABELS: Record<string, string> = {
  gi: 'Gi',
  'no-gi': 'No-Gi',
  'open mat': 'Open Mat',
  kids: 'Kids',
  competition: 'Competition',
}
