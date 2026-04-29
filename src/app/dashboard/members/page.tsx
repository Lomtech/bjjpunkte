import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'

const SUB_COLORS: Record<string, string> = {
  active:    'bg-green-50 text-green-700 border border-green-200',
  trial:     'bg-blue-50 text-blue-700 border border-blue-200',
  past_due:  'bg-red-50 text-red-700 border border-red-200',
  cancelled: 'bg-slate-100 text-slate-500',
  none:      'bg-slate-100 text-slate-400',
}
const SUB_LABELS: Record<string, string> = {
  active: 'Aktiv', trial: 'Testphase', past_due: 'Überfällig', cancelled: 'Gekündigt', none: '–',
}

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: gym } = await supabase.from('gyms').select('id').single()
  if (!gym) return null

  const { data: members } = await supabase
    .from('members')
    .select('*')
    .eq('gym_id', gym.id)
    .order('last_name')

  const active = members?.filter(m => m.is_active) ?? []
  const inactive = members?.filter(m => !m.is_active) ?? []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mitglieder</h1>
          <p className="text-slate-500 text-sm mt-1">{active.length} aktiv · {inactive.length} inaktiv</p>
        </div>
        <Link
          href="/dashboard/members/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          <Plus size={16} />
          Mitglied hinzufügen
        </Link>
      </div>

      {members && members.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Belt</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Mitglied seit</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Beitrag</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{member.first_name} {member.last_name}</div>
                    {member.email && <div className="text-xs text-slate-400 mt-0.5">{member.email}</div>}
                  </td>
                  <td className="px-5 py-4">
                    <BeltBadge belt={member.belt as Belt} stripes={member.stripes} />
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-sm hidden md:table-cell">
                    {new Date(member.join_date).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SUB_COLORS[member.subscription_status ?? 'none']}`}>
                      {SUB_LABELS[member.subscription_status ?? 'none']}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      member.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {member.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/dashboard/members/${member.id}`}
                      className="text-amber-600 hover:text-amber-500 text-sm font-medium"
                    >
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-amber-500" />
          </div>
          <p className="text-slate-900 font-semibold mb-2">Noch keine Mitglieder</p>
          <p className="text-slate-400 text-sm mb-6">Füge dein erstes Mitglied hinzu.</p>
          <Link
            href="/dashboard/members/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <Plus size={16} />
            Mitglied hinzufügen
          </Link>
        </div>
      )}
    </div>
  )
}
