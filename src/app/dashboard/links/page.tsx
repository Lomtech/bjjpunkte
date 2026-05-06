'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, ExternalLink, QrCode, UserPlus, Dumbbell, Printer, Download } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'

// Opens a print window with the poster HTML
function openPrintWindow(opts: {
  url: string
  title: string
  description: string
  gymName: string
  accentHex: string
  svgString: string
}) {
  const { url, title, description, gymName, accentHex, svgString } = opts
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    width: 210mm; min-height: 297mm;
    background: #fff;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 20mm;
    gap: 10mm;
  }
  .gym   { font-size: 11px; color: #71717a; letter-spacing: 0.15em; text-transform: uppercase; }
  h1     { font-size: 32px; font-weight: 900; color: #09090b; text-align: center; line-height: 1.15; }
  .desc  { font-size: 14px; color: #52525b; text-align: center; max-width: 140mm; line-height: 1.6; }
  .qr    { padding: 8mm; background: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7; }
  .url   { font-size: 11px; color: #a1a1aa; text-align: center; word-break: break-all; max-width: 160mm; }
  .bar   { width: 40px; height: 4px; border-radius: 2px; background: ${accentHex}; margin-top: 4mm; }
</style>
</head>
<body>
<p class="gym">${gymName}</p>
<h1>${title}</h1>
${description ? `<p class="desc">${description}</p>` : ''}
<div class="qr">${svgString}</div>
<p class="url">${url}</p>
<div class="bar"></div>
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=800,height=900')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

// ── QR Card ───────────────────────────────────────────────────────────────────

interface QrCardProps {
  icon: React.ReactNode
  accentBg: string
  accentText: string
  accentHex: string
  defaultTitle: string
  defaultDescription: string
  url: string | null
  gymName: string
  emptyText: string
  copied: boolean
  onCopy: () => void
}

function QrCard({
  icon, accentBg, accentText, accentHex,
  defaultTitle, defaultDescription,
  url, gymName, emptyText, copied, onCopy,
}: QrCardProps) {
  const { t } = useLanguage()
  const [title, setTitle]       = useState(defaultTitle)
  const [description, setDescription] = useState(defaultDescription)
  const svgRef  = useRef<HTMLDivElement>(null)

  // Sync title/description when language changes (only if not manually edited)
  const prevDefaultTitle = useRef(defaultTitle)
  const prevDefaultDesc  = useRef(defaultDescription)
  useEffect(() => {
    if (title === prevDefaultTitle.current)       setTitle(defaultTitle)
    if (description === prevDefaultDesc.current)  setDescription(defaultDescription)
    prevDefaultTitle.current = defaultTitle
    prevDefaultDesc.current  = defaultDescription
  }, [defaultTitle, defaultDescription])
  const canvasId = `qr-dl-${defaultTitle.replace(/\s+/g, '')}`

  function handlePrint() {
    if (!url || !svgRef.current) return
    const svgEl = svgRef.current.querySelector('svg')
    if (!svgEl) return
    const svgString = new XMLSerializer().serializeToString(svgEl)
    openPrintWindow({ url, title, description, gymName, accentHex, svgString })
  }

  function handleDownload() {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-${title.toLowerCase().replace(/\s+/g, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  if (!url) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 text-center">
        <QrCode size={28} className="text-zinc-200 mx-auto mb-2" />
        <p className="text-zinc-400 text-sm">{emptyText}</p>
      </div>
    )
  }

  const btnBg = accentHex === '#f59e0b' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-zinc-800 hover:bg-zinc-700'

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-zinc-100">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${accentBg}`}>
          <span className={accentText}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-zinc-900 text-sm">{defaultTitle}</p>
          <p className="text-zinc-400 text-xs font-mono break-all mt-0.5 truncate max-w-xs">{url}</p>
        </div>
      </div>

      <div className="p-5 flex flex-col sm:flex-row gap-6">
        {/* QR + actions */}
        <div className="flex-shrink-0 flex flex-col items-center gap-3">
          {/* Visible SVG (used for print) */}
          <div ref={svgRef} className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50">
            <QRCodeSVG value={url} size={160} fgColor="#09090b" bgColor="transparent" level="M" />
          </div>
          {/* Hidden canvas for PNG download */}
          <div className="sr-only">
            <QRCodeCanvas id={canvasId} value={url} size={600} level="M" />
          </div>
          <div className="flex gap-2 w-full justify-center">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-xs font-medium transition-colors"
            >
              <Download size={12} /> PNG
            </button>
            <button
              onClick={handlePrint}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors text-white ${btnBg}`}
            >
              <Printer size={12} /> {t('links', 'printPoster')}
            </button>
          </div>
        </div>

        {/* Customisation */}
        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">{t('links', 'posterTitle')}</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-zinc-900 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">{t('links', 'posterDesc')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder={t('links', 'posterDescPlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-zinc-900 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white resize-none"
            />
          </div>
          <button
            onClick={onCopy}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-zinc-950 hover:bg-zinc-800 text-white'
            }`}
          >
            {copied ? <><Check size={14} /> {t('links', 'copied')}</> : <><Copy size={14} /> {t('links', 'copyLink')}</>}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-xs font-medium transition-colors"
          >
            <ExternalLink size={12} /> {t('links', 'open')}
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LinksPage() {
  const { t, lang } = useLanguage()
  const [signupUrl,    setSignupUrl]   = useState<string | null>(null)
  const [trialUrl,     setTrialUrl]    = useState<string | null>(null)
  const [gymName,      setGymName]     = useState('')
  const [loading,      setLoading]     = useState(true)
  const [copiedSignup, setCopiedSignup] = useState(false)
  const [copiedTrial,  setCopiedTrial]  = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: gym } = await supabase
        .from('gyms')
        .select('signup_token, slug, name')
        .eq('owner_id', user.id)
        .maybeSingle()

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://osss.pro'
      if (gym?.signup_token) setSignupUrl(`${origin}/signup/${gym.signup_token}`)
      if ((gym as any)?.slug)  setTrialUrl(`${origin}/trial/${(gym as any).slug}`)
      setGymName((gym as any)?.name ?? '')
      setLoading(false)
    }
    load()
  }, [])

  function copy(url: string, which: 'signup' | 'trial') {
    navigator.clipboard.writeText(url)
    if (which === 'signup') {
      setCopiedSignup(true)
      setTimeout(() => setCopiedSignup(false), 2000)
    } else {
      setCopiedTrial(true)
      setTimeout(() => setCopiedTrial(false), 2000)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-zinc-400 text-sm">{t('common', 'loading')}</div>
  }

  const signupDefaultTitle = lang === 'en' ? 'Become a member' : 'Jetzt Mitglied werden'
  const signupDefaultDesc  = lang === 'en'
    ? 'Sign up directly online — fast, easy, and without paperwork.'
    : 'Direkt online anmelden — schnell, einfach und ohne Papierkram.'
  const trialDefaultTitle  = lang === 'en' ? 'Book a free trial class' : 'Kostenloses Probetraining buchen'
  const trialDefaultDesc   = lang === 'en'
    ? 'Come by, try it out — no commitment, no membership needed.'
    : 'Komm vorbei und probier es aus — kostenlos und unverbindlich.'

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight">{t('links', 'title')}</h1>
        <p className="text-zinc-400 text-xs mt-0.5 font-medium">{t('links', 'subtitle')}</p>
      </div>

      <div className="space-y-5">
        <QrCard
          icon={<UserPlus size={17} />}
          accentBg="bg-amber-50"
          accentText="text-amber-600"
          accentHex="#f59e0b"
          defaultTitle={signupDefaultTitle}
          defaultDescription={signupDefaultDesc}
          url={signupUrl}
          gymName={gymName}
          emptyText={t('links', 'noLink')}
          copied={copiedSignup}
          onCopy={() => signupUrl && copy(signupUrl, 'signup')}
        />

        <QrCard
          icon={<Dumbbell size={17} />}
          accentBg="bg-zinc-100"
          accentText="text-zinc-600"
          accentHex="#52525b"
          defaultTitle={trialDefaultTitle}
          defaultDescription={trialDefaultDesc}
          url={trialUrl}
          gymName={gymName}
          emptyText={t('links', 'noSlug')}
          copied={copiedTrial}
          onCopy={() => trialUrl && copy(trialUrl, 'trial')}
        />
      </div>
    </div>
  )
}
