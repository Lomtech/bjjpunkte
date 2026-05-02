export default function LeadPortalNotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center mb-5">
        <span className="text-[14px] font-black text-white italic">oss</span>
      </div>
      <p className="text-2xl font-black text-zinc-900 mb-2">Link ungültig</p>
      <p className="text-zinc-500 text-sm max-w-xs">
        Dieser Link ist ungültig oder abgelaufen. Bitte wende dich an dein Gym.
      </p>
    </div>
  )
}
