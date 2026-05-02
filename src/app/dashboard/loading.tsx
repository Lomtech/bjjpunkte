function Skeleton({ className }: { className: string }) {
  return <div className={`bg-slate-100 rounded-lg animate-pulse ${className}`} />
}

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-48" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      {/* Content rows */}
      <div className="grid md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
