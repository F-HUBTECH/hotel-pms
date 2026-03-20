'use client'

import { useState, useEffect } from 'react'
import { Search, User, Phone, Mail, Calendar, Clock, MapPin, FileText, Loader2, CreditCard, Edit } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Guest, Reservation } from '@/lib/types/database'
import { createBrowserClient } from '@supabase/ssr'

interface GuestProfileProps {
  guestId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface GuestVisit {
  id: string
  reservation_number: string
  check_in_date: string
  check_out_date: string
  status: string
  room: { room_number: string }
  rate: number
}

export function GuestProfile({ guestId, open, onOpenChange }: GuestProfileProps) {
  const [guest, setGuest] = useState<Guest | null>(null)
  const [visits, setVisits] = useState<GuestVisit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !guestId) return

    const fetchData = async () => {
      setLoading(true)
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Fetch guest
      const { data: guestData } = await supabase
        .from('guests')
        .select('*')
        .eq('id', guestId)
        .single()
      setGuest(guestData)

      // Fetch visit history
      const { data: visitData } = await supabase
        .from('reservations')
        .select('id, reservation_number, check_in_date, check_out_date, status, rate, room_number')
        .eq('guest_id', guestId)
        .order('check_in_date', { ascending: false })
        .limit(20)
      
      // Transform data to match GuestVisit type
      const transformedVisits = (visitData || []).map((v: any) => ({
        ...v,
        room: { room_number: v.room_number || '' }
      }))
      setVisits(transformedVisits)
      setLoading(false)
    }

    fetchData()
  }, [guestId, open])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <User className="w-5 h-5" />
            Guest Profile
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : guest ? (
          <div className="flex-1 overflow-y-auto">
            {/* Guest Info Card */}
            <Card className="mb-4">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                      <User className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">
                        {guest.first_name} {guest.last_name}
                      </h2>
                      <div className="mt-3 space-y-1 text-sm text-slate-600">
                        {guest.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-400" />
                            {guest.phone}
                          </div>
                        )}
                        {guest.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-400" />
                            {guest.email}
                          </div>
                        )}
                        {guest.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            {guest.address}
                          </div>
                        )}
                        {guest.nationality && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            {typeof guest.nationality === 'object' ? guest.nationality.name : guest.nationality}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Visit History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Visit History ({visits.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {visits.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    No visit history found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visits.map((visit) => (
                      <div
                        key={visit.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-white border flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-slate-400" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">
                              Room {visit.room?.room_number || '-'}
                            </div>
                            <div className="text-sm text-slate-500">
                              {visit.check_in_date && new Date(visit.check_in_date).toLocaleDateString('en-GB')} 
                              {' → '}
                              {visit.check_out_date && new Date(visit.check_out_date).toLocaleDateString('en-GB')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={
                            visit.status === 'checked_in' ? 'bg-emerald-100 text-emerald-700' :
                            visit.status === 'checked_out' ? 'bg-slate-100 text-slate-600' :
                            'bg-amber-100 text-amber-700'
                          }>
                            {visit.status?.replace('_', ' ')}
                          </Badge>
                          <div className="text-sm font-medium text-slate-600 mt-1">
                            ฿{Number(visit.rate || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            Guest not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GuestProfile
