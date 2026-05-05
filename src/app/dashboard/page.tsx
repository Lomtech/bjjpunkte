import { Suspense } from 'react'
import { fetchDashboardStats } from '@/lib/server/dashboard-stats'
import { DashboardView } from './_components/DashboardView'

async function DashboardContent() {
  const stats = await fetchDashboardStats()
  if (!stats) return null
  return <DashboardView initialData={stats} />
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 max-w-5xl animate-pulse">
      <div className="mb-6">
        <div className="h-3 w-32 bg-zinc-200 rounded mb-2" />
        <div className="h-7 w-40 bg-zinc-200 rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 mb-3" />
            <div className="h-7 w-16 bg-zinc-100 rounded mb-2" />
            <div className="h-3 w-24 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm h-48" />
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}
