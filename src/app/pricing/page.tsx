import Link from 'next/link'

const PLANS = [
  {
    name: 'Free',
    price: '0',
    period: '',
    members: '30 Mitglieder',
    color: 'border-slate-200',
    badge: '',
    features: [
      'Bis zu 30 Mitglieder',
      'Mitgliederverwaltung',
      'Belt-Tracking',
      'Anwesenheit & Kiosk',
      'Stundenplan',
      'Member-Portal (tokenbasiert)',
      '2% Plattformgebühr bei Zahlungen',
    ],
    cta: 'Kostenlos starten',
    ctaHref: '/register',
    ctaStyle: 'border border-slate-200 text-slate-700 hover:bg-slate-50',
  },
  {
    name: 'Starter',
    price: '29',
    period: '/Monat',
    members: '75 Mitglieder',
    color: 'border-slate-200',
    badge: '',
    features: [
      'Bis zu 75 Mitglieder',
      'Alles aus Free',
      'Zahlungserinnerungen (Auto)',
      'Geburtstags-E-Mails (Auto)',
      'Rechnungsgenerierung (PDF)',
      'Lead-Management',
      'Trainer-Accounts',
      '1,5% Plattformgebühr (statt 2%)',
    ],
    cta: 'Starter wählen',
    ctaHref: '/register?plan=starter',
    ctaStyle: 'bg-slate-900 text-white hover:bg-slate-800',
  },
  {
    name: 'Grow',
    price: '59',
    period: '/Monat',
    members: '200 Mitglieder',
    color: 'border-amber-300',
    badge: 'Beliebt',
    features: [
      'Bis zu 200 Mitglieder',
      'Alles aus Starter',
      'WhatsApp-Bulk-Kampagnen',
      'Öffentlicher Stundenplan (Embed)',
      'QR-Code Check-in',
      'CSV/iCal-Export',
      'Eltern-Kind-Verknüpfung',
      '1% Plattformgebühr',
    ],
    cta: 'Grow wählen',
    ctaHref: '/register?plan=grow',
    ctaStyle: 'bg-amber-500 text-white hover:bg-amber-400',
  },
  {
    name: 'Pro',
    price: '99',
    period: '/Monat',
    members: 'Unbegrenzt',
    color: 'border-slate-200',
    badge: '',
    features: [
      'Unbegrenzte Mitglieder',
      'Alles aus Grow',
      'Mehrere Trainer-Accounts',
      'Prioritäts-Support',
      'Frühzeitiger Zugang zu neuen Features',
      '0,5% Plattformgebühr',
      'Custom Branding (coming soon)',
    ],
    cta: 'Pro wählen',
    ctaHref: '/register?plan=pro',
    ctaStyle: 'bg-slate-900 text-white hover:bg-slate-800',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-5 py-16 text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <span className="text-[10px] font-black text-white italic">oss</span>
          </div>
          <span className="font-black text-xl italic text-white">Osss</span>
        </Link>
        <h1 className="text-4xl font-black mb-4">Einfache, faire Preise</h1>
        <p className="text-slate-300 text-lg max-w-lg mx-auto">
          Keine versteckten Gebühren. Starte kostenlos, zahle nur wenn du wächst.
        </p>
      </div>

      {/* Plans grid */}
      <div className="max-w-5xl mx-auto px-5 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(plan => (
            <div key={plan.name} className={`bg-white rounded-2xl border-2 ${plan.color} p-6 flex flex-col relative`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}
              <div className="mb-6">
                <p className="font-bold text-slate-900 text-lg">{plan.name}</p>
                <div className="flex items-end gap-0.5 mt-1">
                  <span className="text-3xl font-black text-slate-900">€{plan.price}</span>
                  <span className="text-slate-400 text-sm pb-1">{plan.period}</span>
                </div>
                <p className="text-slate-500 text-sm mt-1">{plan.members}</p>
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.ctaHref}
                className={`block text-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${plan.ctaStyle}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm">
            Alle Pläne beinhalten: DSGVO-konformes Datenschutz-Management, Stripe-Integration, kostenlose Updates.
          </p>
          <p className="text-slate-400 text-sm mt-2">
            Fragen? <a href="mailto:support@osss.app" className="text-amber-600 hover:underline">support@osss.app</a>
          </p>
        </div>
      </div>
    </div>
  )
}
