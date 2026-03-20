'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, User, Phone, Mail, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Guest } from '@/lib/types/database'
import { createBrowserClient } from '@supabase/ssr'

interface GuestSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (guest: Guest) => void
}

export function GuestSelector({ open, onOpenChange, onSelect }: GuestSelectorProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)

  const searchGuests = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase
      .from('guests')
      .select('*')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(20)
    setResults(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchGuests(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, searchGuests])

  const handleSelect = (guest: Guest) => {
    setSelectedGuest(guest)
    onSelect(guest)
    onOpenChange(false)
    setSearch('')
    setResults([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Guest</DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-lg"
            autoFocus
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setResults([]) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        )}

        {!loading && results.length === 0 && search.length >= 2 && (
          <div className="text-center py-8 text-slate-400">
            No guests found matching "{search}"
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-2 mt-4">
            {results.map((guest) => (
              <button
                key={guest.id}
                onClick={() => handleSelect(guest)}
                className="w-full p-4 text-left rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="w-6 h-6 text-slate-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-800">
                    {guest.first_name} {guest.last_name}
                  </div>
                  <div className="text-sm text-slate-500 flex items-center gap-4 mt-1">
                    {guest.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {guest.phone}
                      </span>
                    )}
                    {guest.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {guest.email}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GuestSelector
