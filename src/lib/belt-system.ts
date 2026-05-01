export type BeltSlot = {
  key: string
  label: string
  bg: string   // hex
  text: string // hex
}

export type BeltSystem = BeltSlot[]

export type SportType = 'bjj' | 'judo' | 'karate' | 'custom'

export const SPORT_PRESETS: Record<Exclude<SportType, 'custom'>, BeltSystem> = {
  bjj: [
    { key: 'white',  label: 'Weiß',    bg: '#f1f5f9', text: '#1e293b' },
    { key: 'blue',   label: 'Blau',    bg: '#1d4ed8', text: '#ffffff' },
    { key: 'purple', label: 'Lila',    bg: '#7c3aed', text: '#ffffff' },
    { key: 'brown',  label: 'Braun',   bg: '#92400e', text: '#ffffff' },
    { key: 'black',  label: 'Schwarz', bg: '#1e293b', text: '#f59e0b' },
  ],
  judo: [
    { key: 'white',  label: 'Weiß',   bg: '#f8fafc', text: '#1e293b' },
    { key: 'yellow', label: 'Gelb',   bg: '#fbbf24', text: '#1e293b' },
    { key: 'orange', label: 'Orange', bg: '#f97316', text: '#ffffff' },
    { key: 'green',  label: 'Grün',   bg: '#16a34a', text: '#ffffff' },
    { key: 'blue',   label: 'Blau',   bg: '#1d4ed8', text: '#ffffff' },
    { key: 'brown',  label: 'Braun',  bg: '#92400e', text: '#ffffff' },
    { key: 'black',  label: 'Schwarz',bg: '#1e293b', text: '#f8fafc' },
  ],
  karate: [
    { key: 'white',  label: 'Weiß',   bg: '#f8fafc', text: '#1e293b' },
    { key: 'yellow', label: 'Gelb',   bg: '#fbbf24', text: '#1e293b' },
    { key: 'orange', label: 'Orange', bg: '#f97316', text: '#ffffff' },
    { key: 'green',  label: 'Grün',   bg: '#16a34a', text: '#ffffff' },
    { key: 'blue',   label: 'Blau',   bg: '#1d4ed8', text: '#ffffff' },
    { key: 'purple', label: 'Lila',   bg: '#7c3aed', text: '#ffffff' },
    { key: 'brown',  label: 'Braun',  bg: '#92400e', text: '#ffffff' },
    { key: 'black',  label: 'Schwarz',bg: '#1e293b', text: '#f8fafc' },
  ],
}

export const DEFAULT_BELT_SYSTEM: BeltSystem = SPORT_PRESETS.bjj

export function resolveBeltSystem(raw: unknown): BeltSystem {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_BELT_SYSTEM
  return raw as BeltSystem
}

export function getBeltSlot(system: BeltSystem, key: string): BeltSlot {
  return system.find(s => s.key === key) ?? system[0]
}
