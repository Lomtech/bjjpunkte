import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ClassType {
  value: string
  label: string
  color: string
}

export const DEFAULT_CLASS_TYPES: ClassType[] = [
  { value: 'gi',          label: 'Gi',          color: 'bg-blue-50 text-blue-700' },
  { value: 'no-gi',       label: 'No-Gi',       color: 'bg-slate-100 text-slate-600' },
  { value: 'open mat',    label: 'Open Mat',    color: 'bg-amber-50 text-amber-700' },
  { value: 'kids',        label: 'Kids',        color: 'bg-green-50 text-green-700' },
  { value: 'competition', label: 'Competition', color: 'bg-red-50 text-red-700' },
]

const COLOR_POOL = [
  'bg-blue-50 text-blue-700',
  'bg-slate-100 text-slate-600',
  'bg-amber-50 text-amber-700',
  'bg-green-50 text-green-700',
  'bg-red-50 text-red-700',
  'bg-purple-50 text-purple-700',
  'bg-indigo-50 text-indigo-700',
  'bg-pink-50 text-pink-700',
]

export function useClassTypes() {
  const [classTypes, setClassTypes] = useState<ClassType[]>(DEFAULT_CLASS_TYPES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('gyms').select('class_types').single().then(({ data }) => {
      const raw = (data as any)?.class_types
      if (Array.isArray(raw) && raw.length > 0) {
        const types: ClassType[] = raw.map((v: string, i: number) => {
          const existing = DEFAULT_CLASS_TYPES.find(d => d.value === v)
          return existing ?? {
            value: v,
            label: v.charAt(0).toUpperCase() + v.slice(1),
            color: COLOR_POOL[i % COLOR_POOL.length],
          }
        })
        setClassTypes(types)
      }
      setLoading(false)
    })
  }, [])

  return { classTypes, loading }
}

export function getClassLabel(value: string, types: ClassType[] = DEFAULT_CLASS_TYPES): string {
  return types.find(t => t.value === value)?.label ?? value
}

export function getClassColor(value: string, types: ClassType[] = DEFAULT_CLASS_TYPES): string {
  return types.find(t => t.value === value)?.color ?? 'bg-slate-100 text-slate-600'
}
