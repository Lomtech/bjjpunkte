function Skeleton({ className }: { className: string }) {
  return <div className={`bg-slate-100 rounded-lg animate-pulse ${className}`} />
}

export default function SettingsLoading() {
  return (
    <div className="p-4 md:p-6 max-w-lg space-y-4">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  )
}
