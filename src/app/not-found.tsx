import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-black text-slate-900 tracking-tight mb-2">404</p>
      <p className="text-slate-500 text-base mb-8">Diese Seite existiert nicht.</p>
      <Link href="/dashboard"
        className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors">
        Zum Dashboard
      </Link>
    </div>
  )
}
