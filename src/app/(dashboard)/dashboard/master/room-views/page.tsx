'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createBrowserClient } from '@supabase/ssr'

interface RoomView {
  id: string
  name: string
  description?: string
}

export default function RoomViewsPage() {
  const [roomViews, setRoomViews] = useState<RoomView[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingView, setEditingView] = useState<RoomView | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchRoomViews()
  }, [])

  const fetchRoomViews = async () => {
    setLoading(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase.from('room_views').select('*').order('name')
    setRoomViews(data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Room view name is required')
      return
    }
    setSaving(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    if (editingView) {
      const { error } = await supabase
        .from('room_views')
        .update({ name: formData.name, description: formData.description })
        .eq('id', editingView.id)
      if (error) toast.error(error.message)
      else { toast.success('Room view updated'); setDialogOpen(false); fetchRoomViews() }
    } else {
      const { error } = await supabase
        .from('room_views')
        .insert({ name: formData.name, description: formData.description })
      if (error) toast.error(error.message)
      else { toast.success('Room view created'); setDialogOpen(false); fetchRoomViews() }
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this room view?')) return
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error } = await supabase.from('room_views').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); fetchRoomViews() }
  }

  const openDialog = (view?: RoomView) => {
    if (view) { setEditingView(view); setFormData({ name: view.name, description: view.description || '' }) }
    else { setEditingView(null); setFormData({ name: '', description: '' }) }
    setDialogOpen(true)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Room Views</h1>
          <p className="text-slate-500">Manage room view types</p>
        </div>
        <Button onClick={() => openDialog()} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" /> Add Room View
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : roomViews.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-slate-400">No room views found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roomViews.map((view) => (
            <Card key={view.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{view.name}</p>
                    {view.description && <p className="text-sm text-slate-500">{view.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(view)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(view.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingView ? 'Edit Room View' : 'Add Room View'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Sea View, Pool View" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description" />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-indigo-600">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
