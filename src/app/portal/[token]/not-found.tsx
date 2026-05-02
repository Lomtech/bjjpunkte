export default function PortalNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
      <p className="text-2xl font-black text-slate-900 mb-2">Portal nicht gefunden</p>
      <p className="text-slate-500 text-sm max-w-xs">
        Dieser Link ist ungültig oder abgelaufen. Bitte wende dich an dein Gym.
      </p>
    </div>
  )
}
