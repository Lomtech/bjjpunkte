'use client'

import { useRef, useState } from 'react'
import {
  ChevronUp, ChevronDown, Trash2, ImagePlus, Type, AlignLeft, Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockType = 'heading' | 'paragraph' | 'image'

export interface Block {
  id:       string
  type:     BlockType
  text?:    string
  url?:     string
  caption?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function uid() { return Math.random().toString(36).slice(2) }

async function uploadImage(file: File): Promise<string | null> {
  const { data: { session } } = await createClient().auth.getSession()
  const headers: HeadersInit = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {}
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/gym/media', { method: 'POST', headers, body: form })
  if (!res.ok) return null
  const { url } = await res.json()
  return url ?? null
}

// ─── BlockItem ────────────────────────────────────────────────────────────────

function BlockItem({
  block, index, total, onChange, onDelete, onMove,
}: {
  block: Block
  index: number
  total: number
  onChange: (b: Block) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const imgRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    const url = await uploadImage(file)
    if (url) onChange({ ...block, url })
    setUploading(false)
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-zinc-50 border-b border-zinc-100">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mr-auto">
          {block.type === 'heading' ? 'Überschrift' : block.type === 'paragraph' ? 'Text' : 'Bild'}
        </span>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
          className="p-1 rounded hover:bg-zinc-200 disabled:opacity-30 transition-colors">
          <ChevronUp size={13} />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
          className="p-1 rounded hover:bg-zinc-200 disabled:opacity-30 transition-colors">
          <ChevronDown size={13} />
        </button>
        <button type="button" onClick={onDelete}
          className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors ml-1">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        {block.type === 'heading' && (
          <input
            value={block.text ?? ''}
            onChange={e => onChange({ ...block, text: e.target.value })}
            placeholder="Überschrift eingeben…"
            className="w-full text-lg font-black text-zinc-900 bg-transparent border-none outline-none placeholder-zinc-300"
          />
        )}

        {block.type === 'paragraph' && (
          <textarea
            value={block.text ?? ''}
            onChange={e => onChange({ ...block, text: e.target.value })}
            placeholder="Text eingeben…"
            rows={4}
            className="w-full text-sm text-zinc-700 leading-relaxed bg-transparent border-none outline-none placeholder-zinc-300 resize-y"
          />
        )}

        {block.type === 'image' && (
          <div className="space-y-2">
            <input ref={imgRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
            {block.url ? (
              <div className="relative group/img rounded-lg overflow-hidden">
                <img src={block.url} alt={block.caption ?? ''} className="w-full max-h-64 object-contain bg-zinc-50 rounded-lg" />
                <button type="button" onClick={() => imgRef.current?.click()}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-semibold">
                  Bild ersetzen
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => imgRef.current?.click()} disabled={uploading}
                className="w-full h-32 border-2 border-dashed border-zinc-200 rounded-lg flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-amber-300 hover:text-amber-500 transition-colors">
                <ImagePlus size={22} />
                <span className="text-xs">{uploading ? 'Wird hochgeladen…' : 'Bild hochladen'}</span>
              </button>
            )}
            <input
              value={block.caption ?? ''}
              onChange={e => onChange({ ...block, caption: e.target.value })}
              placeholder="Bildunterschrift (optional)"
              className="w-full text-xs text-zinc-500 bg-transparent border-none outline-none placeholder-zinc-300"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── BlockEditor ──────────────────────────────────────────────────────────────

export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
}) {
  function addBlock(type: BlockType) {
    onChange([...blocks, { id: uid(), type }])
  }

  function updateBlock(index: number, block: Block) {
    onChange(blocks.map((b, i) => i === index ? block : b))
  }

  function deleteBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index))
  }

  function moveBlock(index: number, dir: -1 | 1) {
    const next = [...blocks]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <BlockItem
          key={block.id}
          block={block}
          index={i}
          total={blocks.length}
          onChange={b => updateBlock(i, b)}
          onDelete={() => deleteBlock(i)}
          onMove={dir => moveBlock(i, dir)}
        />
      ))}

      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={() => addBlock('heading')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-500 hover:border-amber-300 hover:text-amber-600 transition-colors">
          <Type size={13} /> Überschrift
        </button>
        <button type="button" onClick={() => addBlock('paragraph')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-500 hover:border-amber-300 hover:text-amber-600 transition-colors">
          <AlignLeft size={13} /> Text
        </button>
        <button type="button" onClick={() => addBlock('image')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-500 hover:border-amber-300 hover:text-amber-600 transition-colors">
          <ImagePlus size={13} /> Bild
        </button>
      </div>
    </div>
  )
}
