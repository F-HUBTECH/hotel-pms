'use client'

import { useState, useEffect } from 'react'
import { Repeat, Star, Calendar, Home } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { createBrowserClient } from '@supabase/ssr'

interface ReturnGuestBadgeProps {
  guestId: string
  showDetails?: boolean
  size?: 'sm' | 'md' | 'lg'
}

interface GuestSummary {
  is_return: boolean
  total_visits: number
  total_room_nights: number
  first_stay: string | null
  last_stay: string | null
}

export function ReturnGuestBadge({ guestId, showDetails = false, size = 'sm' }: ReturnGuestBadgeProps) {
  const [summary, setSummary] = useState<GuestSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!guestId) {
      setLoading(false)
      return
    }

    const fetchSummary = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data } = await supabase.rpc('is_return_guest', { p_guest_id: guestId })
      
      if (data && data.length > 0) {
        setSummary(data[0])
      } else {
        setSummary({ is_return: false, total_visits: 0, total_room_nights: 0, first_stay: null, last_stay: null })
      }
      setLoading(false)
    }

    fetchSummary()
  }, [guestId])

  if (loading) return null

  if (!summary?.is_return) return null

  if (showDetails && size === 'lg') {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Repeat className="w-4 h-4 text-amber-600" />
          <span className="font-bold text-amber-800 text-sm">RETURNED GUEST</span>
          <Star className="w-3 h-3 text-amber-500" />
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="bg-white/60 rounded p-2 text-center">
            <div className="font-bold text-amber-700">{summary.total_visits}</div>
            <div className="text-amber-600">visits</div>
          </div>
          <div className="bg-white/60 rounded p-2 text-center">
            <div className="font-bold text-amber-700">{summary.total_room_nights}</div>
            <div className="text-amber-600">room nights</div>
          </div>
          <div className="bg-white/60 rounded p-2 text-center col-span-2">
            <div className="font-bold text-amber-700">
              {summary.last_stay ? new Date(summary.last_stay).toLocaleDateString('en-GB') : '-'}
            </div>
            <div className="text-amber-600">last stay</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 gap-1">
      <Repeat className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`} />
      {size !== 'sm' && (
        <>
          Return Guest
          <span className="ml-1 font-normal">
            ({summary.total_visits}x)
          </span>
        </>
      )}
    </Badge>
  )
}

export default ReturnGuestBadge
