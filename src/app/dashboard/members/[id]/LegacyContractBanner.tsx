'use client'

// Sprint 2026-05-27: Banner im Member-Detail wenn der aktive Vertrag
// via Excel-Import (is_legacy=true) angelegt wurde. Owner wird ermutigt,
// Member zur freiwilligen Neusignatur im Portal einzuladen.

import { useState, useEffect } from 'react'
import { FileWarning, Send, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'

interface Props {
  memberId: string
}

interface LegacyContract {
  id: string
  imported_at: string | null
  legacy_source: string | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function LegacyContractBanner({ memberId }: Props) {
  const toast = useToast()
  const [contract, setContract] = useState<LegacyContract | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    (async () => {
      const sb = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb.from('member_contracts') as any)
        .select('id, imported_at, legacy_source')
        .eq('member_id', memberId)
        .eq('is_legacy', true)
        .in('status', ['active', 'paused'])
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setContract(data as LegacyContract)
    })()
  }, [memberId])

  async function sendInvite() {
    setSending(true)
    const sb = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: member } = await (sb.from('members') as any)
      .select('email, portal_token, first_name').eq('id', memberId).maybeSingle()
    if (!member?.email || !member?.portal_token) {
      toast.error('Mitglied hat keine Email oder Portal-Token')
      setSending(false)
      return
    }
    // Portal-Link mit "confirmed=0&renew_contract=1" Hash für UI-Hinweis
    const portalUrl = `${window.location.origin}/portal/${member.portal_token}?renew=1`
    toast.success(
      `Portal-Link für ${member.first_name}: ${portalUrl} (manuell weitergeben — Auto-Mail folgt im UI-Sprint)`
    )
    // TODO: dedicated POST /api/members/[id]/send-legacy-invite mit Resend
    setSending(false)
  }

  if (!contract || dismissed) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <FileWarning size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-amber-900 mb-1">
            Legacy-Vertrag — keine eIDAS-Signatur im Portal
          </h3>
          <p className="text-xs text-amber-800 leading-relaxed">
            Dieser Vertrag wurde am <strong>{fmtDate(contract.imported_at)}</strong> via{' '}
            <span className="font-mono">{contract.legacy_source ?? 'Import'}</span> migriert.
            Original-Vertrag bleibt rechtsgültig, aber für saubere digitale Beweisführung
            empfiehlt sich eine freiwillige Neusignatur über das Mitglieder-Portal.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={sendInvite}
              disabled={sending}
              className="text-xs px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50">
              <Send size={11} />
              {sending ? 'Lade…' : 'Portal-Link zeigen'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs px-3 py-1.5 rounded-md text-amber-700 hover:bg-amber-100 flex items-center gap-1">
              <X size={11} /> Hinweis ausblenden
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
