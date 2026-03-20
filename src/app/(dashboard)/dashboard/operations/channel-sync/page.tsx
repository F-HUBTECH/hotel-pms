import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Webhook, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'

export default async function ChannelSyncDashboardPage() {
    const supabase = await createClient()

    const { data: channelReservations, error } = await supabase
        .from('channel_reservations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

    if (error) {
        return <div>Error loading channel reservations: {error.message}</div>
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'mapped': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            case 'failed': return <XCircle className="w-5 h-5 text-rose-500" />
            case 'pending': return <Clock className="w-5 h-5 text-amber-500" />
            default: return null
        }
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'mapped': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            case 'failed': return 'bg-rose-100 text-rose-700 border-rose-200'
            case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200'
            default: return 'bg-slate-100 text-slate-700'
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Webhook className="w-6 h-6 text-indigo-500" />
                        OTA Channel Manager Sync
                    </h1>
                    <p className="text-slate-500 mt-1">Monitor incoming reservation payloads from connected OTAs (Agoda, Booking.com, Expedia)</p>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium">Received At</th>
                                <th className="px-6 py-4 font-medium">Channel / OTA</th>
                                <th className="px-6 py-4 font-medium">OTA Resv ID</th>
                                <th className="px-6 py-4 font-medium">PMS Match</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {channelReservations?.map((res) => (
                                <tr key={res.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(res.status)}
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border uppercase ${getStatusStyle(res.status)}`}>
                                                {res.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs">
                                        {format(new Date(res.created_at), 'MMM dd, yyyy HH:mm:ss')}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900 capitalize">
                                        {res.channel_name}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-600 text-xs">
                                        {res.ota_reservation_id}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {res.pms_reservation_id ? (
                                            <Link href={`/dashboard/reservations/${res.pms_reservation_id}`} className="text-indigo-600 font-mono hover:underline">
                                                ID: {res.pms_reservation_id.substring(0, 8)}...
                                            </Link>
                                        ) : (
                                            <span className="text-slate-400 italic">
                                                {res.status === 'failed' ? res.error_message || 'Mapping Error' : 'Pending...'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {res.status === 'failed' && (
                                            <form action={async () => {
                                                'use server'
                                                // Stub manual retry
                                                console.log("Retrying webhook:", res.id)
                                                // await processOTAWebhookPayload(res.raw_payload)
                                                revalidatePath('/dashboard/operations/channel-sync')
                                            }}>
                                                <button type="submit" className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium ml-auto">
                                                    <RefreshCw className="w-3 h-3" /> Retry Sync
                                                </button>
                                            </form>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {channelReservations?.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <Webhook className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                        No OTA payloads received yet. Map your Channel Manager to `/api/webhooks/ota`.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
