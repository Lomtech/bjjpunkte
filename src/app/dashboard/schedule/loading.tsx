function Skeleton({ className }: { className: string }) {
  return <div className={`bg-slate-100 rounded-lg animate-pulse ${className}`} />
}

export default function ScheduleLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
      {[...Array(3)].map((_, d) => (
        <div key={d} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
