export default function DashboardHomeLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            <div>
                <div className="h-8 w-48 bg-slate-200 rounded mb-2" />
                <div className="h-4 w-72 bg-slate-100 rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-6">
                        <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
                        <div className="h-8 w-16 bg-slate-200 rounded mb-2" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-6">
                        <div className="h-4 w-20 bg-slate-200 rounded mb-3" />
                        <div className="h-8 w-12 bg-slate-200 rounded" />
                    </div>
                ))}
            </div>
        </div>
    )
}
