'use client'

import { Check, Copy } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Shared form/section CSS classes used across settings sub-components.
export const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
export const saveBtnCls = 'w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2'
export const sectionCls = 'bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden'
export const sectionHeaderCls = 'px-5 py-3 border-b border-zinc-100 bg-zinc-50'

export function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className={sectionHeaderCls}>
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
        {icon} {title}
      </p>
    </div>
  )
}

export function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  const { t } = useLanguage()
  return (
    <div>
      {label && <p className="text-xs font-medium text-zinc-500 mb-1.5">{label}</p>}
      <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
        <code className="text-xs font-mono text-zinc-600 flex-1 truncate min-w-0">{value}</code>
        <button type="button" onClick={onCopy} className="flex-shrink-0 flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-600 transition-colors">
          {copied ? <><Check size={13} className="text-green-500" /><span className="text-green-600 font-medium">{t('settings', 'copiedBtn')}</span></> : <><Copy size={13} /><span>{t('settings', 'copyBtn')}</span></>}
        </button>
      </div>
    </div>
  )
}
