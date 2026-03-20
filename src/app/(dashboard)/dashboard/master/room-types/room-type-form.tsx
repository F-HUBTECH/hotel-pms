'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import type { RoomType } from '@/lib/types/database'

interface RoomTypeFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: { code: string; name: string; description: string; base_price: number }) => Promise<{ success: boolean; error?: string }>
    initialData?: RoomType | null
    mode: 'create' | 'edit'
}

export function RoomTypeForm({ open, onOpenChange, onSubmit, initialData, mode }: RoomTypeFormProps) {
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [basePrice, setBasePrice] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (initialData && mode === 'edit') {
            setCode(initialData.code)
            setName(initialData.name)
            setDescription(initialData.description || '')
            setBasePrice(String(initialData.base_price))
        } else {
            setCode('')
            setName('')
            setDescription('')
            setBasePrice('')
        }
        setError('')
    }, [initialData, mode, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        const result = await onSubmit({
            code: code.toUpperCase(),
            name,
            description,
            base_price: parseFloat(basePrice) || 0,
        })

        setIsLoading(false)

        if (!result.success) {
            setError(result.error || 'An error occurred')
        } else {
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Create Room Type' : 'Edit Room Type'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Code <span className="text-red-500">*</span></Label>
                            <Input
                                id="code"
                                placeholder="e.g. DLX"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                required
                                maxLength={10}
                                className="uppercase"
                            />
                            <p className="text-xs text-slate-400">Uppercase letters & numbers</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="base_price">Base Price <span className="text-red-500">*</span></Label>
                            <Input
                                id="base_price"
                                type="number"
                                placeholder="0.00"
                                value={basePrice}
                                onChange={(e) => setBasePrice(e.target.value)}
                                required
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            placeholder="e.g. Deluxe Room"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            maxLength={100}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Room type description..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            maxLength={500}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {mode === 'create' ? 'Create' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
