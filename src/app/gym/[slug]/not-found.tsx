import Link from 'next/link'

export default function GymNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
      <p className="text-2xl font-black text-slate-900 mb-2">Gym nicht gefunden</p>
      <p className="text-slate-500 text-sm mb-8 max-w-xs">
        Diese Gym-Seite existiert nicht. Überprüfe den Link oder wende dich an den Gym-Betreiber.
      </p>
      <Link href="/"
        className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors">
        Zur Startseite
      </Link>
    </div>
  )
}
