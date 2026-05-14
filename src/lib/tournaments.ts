/**
 * Tournament-Tracking — Konstanten + Helpers für die member_tournaments-Tabelle.
 *
 * Single-source-of-truth für Disziplin-/Ergebnis-Listen — UI-Komponenten
 * importieren von hier, damit Validierungs-Logic im API-Route, im
 * Create-Modal und in der Stats-Aggregation IDENTISCH bleibt.
 *
 * Server-Side-Constraints sind in supabase/migrations/0012_member_tournaments.sql
 * als CHECK-Constraints fixiert — beide Quellen müssen synchron bleiben.
 */

export const TOURNAMENT_DISCIPLINES = [
  { value: 'bjj-gi',                label: 'BJJ Gi' },
  { value: 'bjj-nogi',              label: 'BJJ NoGi' },
  { value: 'submission-grappling',  label: 'Submission Grappling' },
  { value: 'judo',                  label: 'Judo' },
  { value: 'mma',                   label: 'MMA (Profi)' },
  { value: 'mma-amateur',           label: 'MMA (Amateur)' },
  { value: 'kickboxen',             label: 'Kickboxen' },
  { value: 'muay-thai',             label: 'Muay Thai' },
  { value: 'boxen',                 label: 'Boxen' },
  { value: 'karate',                label: 'Karate' },
  { value: 'taekwondo',             label: 'Taekwondo' },
  { value: 'wrestling',             label: 'Ringen' },
  { value: 'other',                 label: 'Andere' },
] as const

export type TournamentDiscipline = typeof TOURNAMENT_DISCIPLINES[number]['value']

export const TOURNAMENT_RESULTS = [
  { value: 'gold',            label: '🥇 Gold',           podium: true,  rank: 1 },
  { value: 'silver',          label: '🥈 Silber',         podium: true,  rank: 2 },
  { value: 'bronze',          label: '🥉 Bronze',         podium: true,  rank: 3 },
  { value: 'finalist',        label: 'Finalist',         podium: false, rank: 2 },
  { value: 'semifinalist',    label: 'Halbfinale',       podium: false, rank: 4 },
  { value: 'quarterfinalist', label: 'Viertelfinale',    podium: false, rank: 8 },
  { value: 'top-8',           label: 'Top 8',            podium: false, rank: 8 },
  { value: 'top-16',          label: 'Top 16',           podium: false, rank: 16 },
  { value: 'participation',   label: 'Teilnahme',        podium: false, rank: null as number | null },
  { value: 'dnf',             label: 'DNF',              podium: false, rank: null as number | null },
  { value: 'dq',              label: 'DQ',               podium: false, rank: null as number | null },
  { value: 'withdrew',        label: 'Zurückgezogen',    podium: false, rank: null as number | null },
] as const

export type TournamentResult = typeof TOURNAMENT_RESULTS[number]['value']

export function disciplineLabel(value: string): string {
  return TOURNAMENT_DISCIPLINES.find(d => d.value === value)?.label ?? value
}

export function resultLabel(value: string): string {
  return TOURNAMENT_RESULTS.find(r => r.value === value)?.label ?? value
}

export function isPodium(value: string): boolean {
  return TOURNAMENT_RESULTS.find(r => r.value === value)?.podium === true
}

/** Was über das Public-Roll-of-Honor anzeigen — nur Podium + nur public_visible. */
export interface MemberTournament {
  id: string
  member_id: string
  gym_id: string
  name: string
  event_date: string
  location: string | null
  discipline: TournamentDiscipline
  weight_class: string | null
  age_division: string | null
  belt_at_event: string | null
  result: TournamentResult
  matches_won: number | null
  matches_lost: number | null
  notes: string | null
  smoothcomp_url: string | null
  public_visible: boolean
  created_at: string
  created_by_user_id: string | null
  updated_at: string
}
