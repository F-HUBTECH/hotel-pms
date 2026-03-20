'use client'

import { useState, useEffect, useCallback } from 'react'
import { getNightAuditLogs as getRecentAuditsAction, runNightAuditAction } from '@/lib/actions/night-audit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Moon, Play, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function NightAuditPage() {
    const [audits, setAudits] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0])

    const fetchAudits = useCallback(async () => {
        setLoading(true)
        const res = await getRecentAuditsAction()
        if (res.success && res.data) setAudits(res.data)
        setLoading(false)
    }, [])

    useEffect(() => { fetchAudits() }, [fetchAudits])

    const handleRunAudit = async () => {
        if (!confirm(`Are you sure you want to run the Night Audit for ${auditDate}? This action reduces available inventory and adds folio room charges.`)) return

        setRunning(true)
        const res = await runNightAuditAction(auditDate)
        setRunning(false)

        if (res.success) {
            toast.success(`Night audit completed successfully for ${auditDate}`)
            fetchAudits()
        } else {
            toast.error(res.error || 'Night audit failed to execute')
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Night Audit</h1>
                <p className="text-sm text-slate-500 mt-1">End of day routine to post room-charges and finalize business date.</p>
            </div>

            <Card className="border-indigo-100 shadow-sm">
                <CardHeader className="bg-indigo-50/50">
                    <CardTitle className="flex items-center gap-2 text-indigo-900"><Moon className="w-5 h-5 text-indigo-600" /> Run Night Audit</CardTitle>
                    <CardDescription>Post nightly room charges, record statistics, and close the business day.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <Alert className="bg-amber-50 border-amber-200">
                        <AlertTitle className="text-amber-800 font-semibold">Pre-Audit Checklist</AlertTitle>
                        <AlertDescription className="text-amber-700 mt-1 text-sm list-disc list-inside">
                            <li>All expected departures must be checked out or extended.</li>
                            <li>All expected arrivals must be checked in or marked no-show.</li>
                            <li>All miscellaneous charges must be posted to folios.</li>
                        </AlertDescription>
                    </Alert>

                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 bg-slate-50 p-4 rounded-lg border">
                        <div className="space-y-2 flex-grow">
                            <label className="text-sm font-medium text-slate-700">Audit Business Date</label>
                            <input
                                type="date"
                                value={auditDate}
                                onChange={(e) => setAuditDate(e.target.value)}
                                className="w-full sm:w-auto flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                            />
                        </div>
                        <Button
                            onClick={handleRunAudit}
                            disabled={running || loading}
                            size="lg"
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                        >
                            {running ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Running Audit...</>
                            ) : (
                                <><Play className="mr-2 h-5 w-5" /> Execute Audit</>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Recent Audit Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                    ) : audits.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">No night audits have been run yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="border-b bg-slate-50/50">
                                        <th className="p-3 font-medium text-slate-500">Business Date</th>
                                        <th className="p-3 font-medium text-slate-500">Run At</th>
                                        <th className="p-3 font-medium text-slate-500">Run By</th>
                                        <th className="p-3 font-medium text-slate-500">Status</th>
                                        <th className="p-3 font-medium text-slate-500">Metrics</th>
                                        <th className="p-3 font-medium text-slate-500">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {audits.map((a: any) => (
                                        <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50/50">
                                            <td className="p-3 font-medium">{new Date(a.audit_date).toLocaleDateString('en-GB')}</td>
                                            <td className="p-3 text-slate-500">{new Date(a.created_at).toLocaleString('en-GB')}</td>
                                            <td className="p-3 text-slate-600">{a.run_by_user?.first_name} {a.run_by_user?.last_name}</td>
                                            <td className="p-3">
                                                {a.status === 'completed' ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-xs font-medium"><CheckCircle2 className="w-3 h-3" />Success</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs font-medium"><XCircle className="w-3 h-3" />Failed</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="text-xs text-slate-500 space-y-1">
                                                    <div>Rooms: <span className="font-medium text-slate-700">{a.total_rooms_occupied || 0}</span></div>
                                                    <div>Rev: <span className="font-medium text-indigo-600">฿{Number(a.total_revenue || 0).toLocaleString()}</span></div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-xs text-slate-500 italic max-w-xs truncate">{a.notes || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
