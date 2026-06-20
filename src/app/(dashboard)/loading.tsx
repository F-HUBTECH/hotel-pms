export default function DashboardLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div>
                <div className="h-8 w-48 bg-slate-200 rounded mb-2" />
                <div className="h-4 w-64 bg-slate-100 rounded" />
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-6">
                        <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
                        <div className="h-8 w-16 bg-slate-200 rounded mb-2" />
                        <div className="h-3 w-32 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>

            {/* Room status grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-6">
                        <div className="h-4 w-20 bg-slate-200 rounded mb-3" />
                        <div className="h-8 w-12 bg-slate-200 rounded mb-2" />
                        <div className="h-3 w-28 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>

            {/* Quick actions */}
            <div>
                <div className="h-6 w-32 bg-slate-200 rounded mb-3" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
                            <div className="h-4 w-24 bg-slate-200 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
