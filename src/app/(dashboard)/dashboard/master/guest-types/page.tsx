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

interface GuestType {
  id: string
  name: string
  color?: string
  description?: string
}

export default function GuestTypesPage() {
  const [guestTypes, setGuestTypes] = useState<GuestType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<GuestType | null>(null)
  const [formData, setFormData] = useState({ name: '', color: '#6366f1', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchGuestTypes()
  }, [])

  const fetchGuestTypes = async () => {
    setLoading(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase.from('guest_types').select('*').order('name')
    setGuestTypes(data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Guest type name is required')
      return
    }
    setSaving(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    if (editingType) {
      const { error } = await supabase
        .from('guest_types')
        .update({ name: formData.name, color: formData.color, description: formData.description })
        .eq('id', editingType.id)
      if (error) toast.error(error.message)
      else { toast.success('Guest type updated'); setDialogOpen(false); fetchGuestTypes() }
    } else {
      const { error } = await supabase
        .from('guest_types')
        .insert({ name: formData.name, color: formData.color, description: formData.description })
      if (error) toast.error(error.message)
      else { toast.success('Guest type created'); setDialogOpen(false); fetchGuestTypes() }
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this guest type?')) return
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error } = await supabase.from('guest_types').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); fetchGuestTypes() }
  }

  const openDialog = (type?: GuestType) => {
    if (type) { setEditingType(type); setFormData({ name: type.name, color: type.color || '#6366f1', description: type.description || '' }) }
    else { setEditingType(null); setFormData({ name: '', color: '#6366f1', description: '' }) }
    setDialogOpen(true)
  }

  const colorOptions = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6b7280', '#84cc16']

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Guest Types</h1>
          <p className="text-slate-500">Manage guest type categories</p>
        </div>
        <Button onClick={() => openDialog()} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" /> Add Guest Type
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : guestTypes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-slate-400">No guest types found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {guestTypes.map((type) => (
            <Card key={type.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: type.color || '#6366f1' }} />
                    <div>
                      <p className="font-medium text-slate-800">{type.name}</p>
                      {type.description && <p className="text-sm text-slate-500">{type.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(type)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(type.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingType ? 'Edit Guest Type' : 'Add Guest Type'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., VIP, Corporate" />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {colorOptions.map((color) => (
                  <button key={color} onClick={() => setFormData({ ...formData, color })} className={`w-8 h-8 rounded-full ${formData.color === color ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`} style={{ backgroundColor: color }} />
                ))}
              </div>
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
