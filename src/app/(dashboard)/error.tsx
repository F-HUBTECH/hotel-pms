'use client'

import { useEffect } from 'react'

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Dashboard error:', error)
    }, [error])

    return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center max-w-md mx-auto p-8">
                <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Page Error</h2>
                <p className="text-sm text-slate-500 mb-6">
                    Something went wrong loading this page.
                </p>
                <button
                    onClick={reset}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    Try Again
                </button>
            </div>
        </div>
    )
}
