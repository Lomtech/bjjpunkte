'use client'

import { useState, useEffect } from 'react'
import { MapPin, Navigation, Save, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { SectionHeader, sectionCls, sectionHeaderCls, saveBtnCls } from './SettingsUI'

type GpsSectionProps = {
  initialLat: number | null
  initialLng: number | null
  initialRadius: number | null | undefined
}

export function GpsSection({ initialLat, initialLng, initialRadius }: GpsSectionProps) {
  const { t } = useLanguage()
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [radius, setRadius] = useState(300)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialLat !== null) setLat(initialLat)
    if (initialLng !== null) setLng(initialLng)
    setRadius(initialRadius ?? 300)
  }, [initialLat, initialLng, initialRadius])

  function handleLocate() {
    setLocating(true); setError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setLocating(false)
      },
      err => { setError(err.message); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }

  async function handleSave() {
    if (lat === null || lng === null) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('gyms').update({
      latitude: lat, longitude: lng, gps_radius_meters: radius,
    }).eq('owner_id', user?.id ?? '')
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className={sectionCls}>
      <div className={sectionHeaderCls}>
        <SectionHeader icon={<MapPin size={12} />} title={t('settings', 'gpsSection')} />
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-zinc-500">
          {t('settings', 'gpsDesc')}
        </p>
        {lat !== null && lng !== null && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs font-mono">
            <MapPin size={12} className="shrink-0" />
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </div>
        )}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={handleLocate} disabled={locating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-60 transition-colors">
            <Navigation size={14} />
            {locating ? t('settings', 'detecting') : t('settings', 'detectLocationNow')}
          </button>
          {lat !== null && (
            <button type="button" onClick={handleSave} disabled={saving}
              className={saveBtnCls}>
              {saved ? <><Check size={14} /> {t('settings', 'locationSavedShort')}</> : <><Save size={14} /> {t('settings', 'saveLocation')}</>}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-600 whitespace-nowrap">{t('settings', 'radiusMeters')}</label>
          <input type="number" min={50} max={2000} step={50} value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            className="w-28 px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>
    </div>
  )
}
