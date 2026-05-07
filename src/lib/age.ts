/**
 * Helper für Alters-Berechnung und Volljährigkeits-Check (DACH: 18 Jahre).
 *
 * Wir speichern KEIN `is_minor`-Feld in der DB — Alter wird dynamisch
 * berechnet aus `date_of_birth`. Vorteile:
 *  ✓ DSGVO-Minimierung (1 Feld statt 2)
 *  ✓ Automatisch korrekt (kein 18-Jährig-Cron-Update nötig)
 *  ✓ Konsistenz: gleiche Logik client + server
 */

export function calculateAge(dateOfBirth: string | Date | null | undefined): number | null {
  if (!dateOfBirth) return null
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth
  if (Number.isNaN(dob.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

export function isMinor(dateOfBirth: string | Date | null | undefined): boolean {
  const age = calculateAge(dateOfBirth)
  return age !== null && age < 18
}

export function isOfAge(dateOfBirth: string | Date | null | undefined): boolean {
  const age = calculateAge(dateOfBirth)
  return age !== null && age >= 18
}
