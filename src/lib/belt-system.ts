import type { Belt } from '@/types/database'

export type BeltSlot = {
  key: Belt
  label: string
  bg: string   // hex
  text: string // hex
}

export type BeltSystem = BeltSlot[]

export const DEFAULT_BELT_SYSTEM: BeltSystem = [
  { key: 'white',  label: 'Weiß',    bg: '#f1f5f9', text: '#1e293b' },
  { key: 'blue',   label: 'Blau',    bg: '#1d4ed8', text: '#ffffff' },
  { key: 'purple', label: 'Lila',    bg: '#7c3aed', text: '#ffffff' },
  { key: 'brown',  label: 'Braun',   bg: '#92400e', text: '#ffffff' },
  { key: 'black',  label: 'Schwarz', bg: '#1e293b', text: '#f59e0b' },
]

export function resolveBeltSystem(raw: unknown): BeltSystem {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_BELT_SYSTEM
  return raw as BeltSystem
}

export function getBeltSlot(system: BeltSystem, key: string): BeltSlot {
  return system.find(s => s.key === key) ?? DEFAULT_BELT_SYSTEM.find(s => s.key === key) ?? DEFAULT_BELT_SYSTEM[0]
}
