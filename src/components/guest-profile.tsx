'use client'

import { useState, useEffect } from 'react'
import { Search, User, Phone, Mail, Calendar, Clock, MapPin, FileText, Loader2, CreditCard, Edit, Star, Home, Repeat } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import type { Guest, Reservation } from '@/lib/types/database'
import { createBrowserClient } from '@supabase/ssr'

interface GuestProfileProps {
  guestId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuestUpdate?: (guest: Guest) => void
}

interface GuestSummary {
  is_return: boolean
  total_visits: number
  total_room_nights: number
  first_stay: string | null
  last_stay: string | null
}

interface GuestVisit {
  id: string
  reservation_number: string
  check_in_date: string
  check_out_date: string
  status: string
  room_number: string
  room_type_name: string
  rate: number
  total_charges: number
}

export function GuestProfile({ guestId, open, onOpenChange, onGuestUpdate }: GuestProfileProps) {
  const [guest, setGuest] = useState<Guest | null>(null)
  const [summary, setSummary] = useState<GuestSummary | null>(null)
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

      const [guestRes, summaryRes, historyRes] = await Promise.all([
        supabase.from('guests').select('*').eq('id', guestId).single(),
        supabase.rpc('is_return_guest', { p_guest_id: guestId }),
        supabase.rpc('get_guest_visit_history', { p_guest_id: guestId })
      ])

      setGuest(guestRes.data)
      
      if (summaryRes.data && summaryRes.data.length > 0) {
        setSummary(summaryRes.data[0])
      } else {
        setSummary({ is_return: false, total_visits: 0, total_room_nights: 0, first_stay: null, last_stay: null })
      }

      if (historyRes.data) {
        setVisits(historyRes.data)
      }

      setLoading(false)
    }

    fetchData()
  }, [guestId, open])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
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
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Return Guest Banner */}
            {summary?.is_return && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Repeat className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-amber-800">RETURNED GUEST</div>
                  <div className="text-sm text-amber-600">
                    {summary.total_visits} visits • {summary.total_room_nights} room nights
                    {summary.first_stay && ` • First stay: ${new Date(summary.first_stay).toLocaleDateString('en-GB')}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">
                    <Star className="w-3 h-3 mr-1" />
                    VIP Return
                  </Badge>
                </div>
              </div>
            )}

            {/* Guest Info Card */}
            <Card>
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
                      <div className="mt-1 flex items-center gap-2">
                        {guest.vip && <Badge className="bg-amber-100 text-amber-700">VIP</Badge>}
                        {guest.birthday && (
                          <span className="text-xs text-slate-500">
                            Birthday: {new Date(guest.birthday).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </div>
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

            {/* Stats Summary for Return Guests */}
            {summary?.is_return && (
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
                  <CardContent className="p-4 text-center">
                    <Repeat className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                    <div className="text-2xl font-bold text-blue-700">{summary.total_visits}</div>
                    <div className="text-xs text-blue-600">Total Visits</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
                  <CardContent className="p-4 text-center">
                    <Home className="w-6 h-6 mx-auto text-green-500 mb-2" />
                    <div className="text-2xl font-bold text-green-700">{summary.total_room_nights}</div>
                    <div className="text-xs text-green-600">Room Nights</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
                  <CardContent className="p-4 text-center">
                    <Calendar className="w-6 h-6 mx-auto text-purple-500 mb-2" />
                    <div className="text-lg font-bold text-purple-700">
                      {summary.first_stay ? new Date(summary.first_stay).toLocaleDateString('en-GB') : '-'}
                    </div>
                    <div className="text-xs text-purple-600">First Stay</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-amber-50">
                  <CardContent className="p-4 text-center">
                    <Clock className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                    <div className="text-lg font-bold text-orange-700">
                      {summary.last_stay ? new Date(summary.last_stay).toLocaleDateString('en-GB') : '-'}
                    </div>
                    <div className="text-xs text-orange-600">Last Stay</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Visit History */}
            <Tabs defaultValue="history" className="flex-1">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="history">Visit History</TabsTrigger>
                <TabsTrigger value="details">Guest Details</TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="space-y-4 mt-4">
                {visits.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-slate-400">
                      No visit history found
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {visits.map((visit) => (
                      <Card key={visit.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-lg bg-slate-100 border flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-slate-500" />
                              </div>
                              <div>
                                <div className="font-medium text-slate-800">
                                  Room {visit.room_number || '-'} 
                                  <span className="text-slate-500 text-sm ml-2">
                                    ({visit.room_type_name || 'N/A'})
                                  </span>
                                </div>
                                <div className="text-sm text-slate-500">
                                  {visit.check_in_date && new Date(visit.check_in_date).toLocaleDateString('en-GB')}
                                  {visit.check_out_date && ` → ${new Date(visit.check_out_date).toLocaleDateString('en-GB')}`}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  Res: {visit.reservation_number}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge className={
                                visit.status === 'checked_out' ? 'bg-emerald-100 text-emerald-700' :
                                visit.status === 'checked_in' ? 'bg-blue-100 text-blue-700' :
                                visit.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }>
                                {visit.status?.replace('_', ' ')}
                              </Badge>
                              <div className="text-sm font-medium text-slate-600 mt-1">
                                ฿{Number(visit.rate || 0).toLocaleString()}/night
                              </div>
                              {visit.total_charges > 0 && (
                                <div className="text-xs text-slate-400">
                                  Total: ฿{Number(visit.total_charges).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="details" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {guest.id_type && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">ID Type</span>
                        <span className="font-medium">{guest.id_type}</span>
                      </div>
                    )}
                    {guest.id_number && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">ID Number</span>
                        <span className="font-medium">{guest.id_number}</span>
                      </div>
                    )}
                    {guest.company && (
                      <>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-slate-500">Company</span>
                          <span className="font-medium">{guest.company}</span>
                        </div>
                      </>
                    )}
                    {guest.tax_id && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tax ID</span>
                        <span className="font-medium">{guest.tax_id}</span>
                      </div>
                    )}
                    {guest.remark && (
                      <>
                        <Separator />
                        <div>
                          <span className="text-slate-500">Remark</span>
                          <p className="font-medium mt-1">{guest.remark}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
