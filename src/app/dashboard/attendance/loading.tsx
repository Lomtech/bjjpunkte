function Skeleton({ className }: { className: string }) {
  return <div className={`bg-slate-100 rounded-lg animate-pulse ${className}`} />
}

export default function AttendanceLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
