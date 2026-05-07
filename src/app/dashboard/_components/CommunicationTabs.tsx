'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mail, FileText } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

/**
 * Sub-Tabs der konsolidierten Sektion „Kommunikation".
 * Wird oben auf BEIDEN Pages eingehängt — `/dashboard/communication`
 * (Mails) und `/dashboard/content` (Inhalte) — damit der User zwischen
 * den beiden Modi nahtlos wechseln kann, ohne den Sidebar zu nutzen.
 *
 * Pragmatik: Statt einen großen Refactor (eine Page, zwei Tabs intern)
 * lassen wir die Pages technisch getrennt, aber visuell verbunden.
 * Das ist deutlich risikoärmer und behält die gewachsene Struktur.
 */
export function CommunicationTabs() {
  const pathname = usePathname()
  const { t, lang } = useLanguage()

  // Zwei Sub-Bereiche
  const tabs = [
    {
      href:  '/dashboard/communication',
      label: lang === 'en' ? 'Mail' : 'Mail',
      hint:  lang === 'en' ? 'Send announcements and posts to members & leads' : 'Ankündigungen und Beiträge an Mitglieder & Leads versenden',
      icon:  Mail,
      isActive: pathname.startsWith('/dashboard/communication'),
    },
    {
      href:  '/dashboard/content',
      label: lang === 'en' ? 'Content' : 'Inhalte',
      hint:  lang === 'en' ? 'Posts and pinned announcements on website / portal' : 'Beiträge und Pinnwand-Ankündigungen auf Website / Portal',
      icon:  FileText,
      isActive: pathname.startsWith('/dashboard/content'),
    },
  ]

  return (
    <div className="mb-5">
      <div className="mb-3">
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight">
          {t('nav', 'communication')}
        </h1>
      </div>
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              title={tab.hint}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab.isActive
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
