function Skeleton({ className }: { className: string }) {
  return <div className={`bg-slate-100 rounded-lg animate-pulse ${className}`} />
}

export default function RevenueLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
            <Skeleton className="h-5 w-16 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
