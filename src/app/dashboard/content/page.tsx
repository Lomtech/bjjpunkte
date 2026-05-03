'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Eye, EyeOff, Trash2,
  ImagePlus, Save, X, Edit2, Globe, AlignLeft, Megaphone, Pin,
} from 'lucide-react'
import { BlockEditor, uid, type Block } from '@/components/BlockEditor'

interface Announcement {
  id:         string
  title:      string
  body:       string | null
  is_pinned:  boolean
  expires_at: string | null
  created_at: string
}

interface Post {
  id:           string
  title:        string
  cover_url:    string | null
  blocks:       Block[]
  published_at: string | null
  created_at:   string
  updated_at:   string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function uploadImage(file: File): Promise<string | null> {
  const headers = await getAuthHeaders()
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/gym/media', { method: 'POST', headers, body: form })
  if (!res.ok) return null
  const { url } = await res.json()
  return url ?? null
}

// ─── Post Editor Modal ────────────────────────────────────────────────────────

function PostEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: Partial<Post>
  onSave: (p: Post) => void
  onClose: () => void
}) {
  const [title,    setTitle]    = useState(initial.title ?? '')
  const [blocks,   setBlocks]   = useState<Block[]>(initial.blocks ?? [])
  const [coverUrl, setCoverUrl] = useState<string | null>(initial.cover_url ?? null)
  const [saving,   setSaving]   = useState(false)
  const [published, setPublished] = useState<boolean>(!!initial.published_at)
  const coverRef = useRef<HTMLInputElement>(null)
  const [coverUploading, setCoverUploading] = useState(false)

  async function handleCoverFile(file: File) {
    setCoverUploading(true)
    const url = await uploadImage(file)
    if (url) setCoverUrl(url)
    setCoverUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    const headers = await getAuthHeaders()
    const payload = {
      title,
      blocks,
      cover_url:    coverUrl,
      published_at: published ? (initial.published_at ?? new Date().toISOString()) : null,
    }

    let res: Response
    if (initial.id) {
      res = await fetch(`/api/posts/${initial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      })
    } else {
      res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      })
    }
    if (res.ok) {
      const data = await res.json()
      onSave(data)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-bold text-zinc-900 text-base">
            {initial.id ? 'Beitrag bearbeiten' : 'Neuer Beitrag'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Titel</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Beitragsüberschrift…"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-900 font-semibold text-base focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Titelbild</label>
            <input ref={coverRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverFile(f); e.target.value = '' }} />
            {coverUrl ? (
              <div className="relative rounded-xl overflow-hidden group/cover">
                <img src={coverUrl} alt="Cover" className="w-full h-40 object-cover" />
                <button type="button" onClick={() => coverRef.current?.click()}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-semibold">
                  Titelbild ändern
                </button>
                <button type="button" onClick={() => setCoverUrl(null)}
                  className="absolute top-2 right-2 bg-white/90 rounded-full p-1 hover:bg-red-50">
                  <X size={13} className="text-red-500" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => coverRef.current?.click()} disabled={coverUploading}
                className="w-full h-28 border-2 border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-amber-300 hover:text-amber-500 transition-colors">
                <ImagePlus size={22} />
                <span className="text-xs">{coverUploading ? 'Wird hochgeladen…' : 'Titelbild hochladen'}</span>
              </button>
            )}
          </div>

          {/* Blocks */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Inhalt</label>
            <BlockEditor blocks={blocks} onChange={setBlocks} />
          </div>

          {/* Publish toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
            <div>
              <p className="text-sm font-semibold text-zinc-800">{published ? 'Veröffentlicht' : 'Entwurf'}</p>
              <p className="text-xs text-zinc-400">{published ? 'Sichtbar auf deiner Gym-Seite' : 'Nur du siehst diesen Beitrag'}</p>
            </div>
            <button type="button" onClick={() => setPublished(v => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors ${published ? 'bg-amber-500' : 'bg-zinc-200'}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${published ? 'translate-x-4' : ''}`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button type="button" onClick={handleSave} disabled={saving || !title.trim()}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
            <Save size={15} />
            {saving ? 'Wird gespeichert…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, onEdit, onDelete, onTogglePublish }: {
  post: Post
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: () => void
}) {
  const isPublished = !!post.published_at && new Date(post.published_at) <= new Date()
  const blockCount = post.blocks.length
  const imageCount = post.blocks.filter(b => b.type === 'image').length

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      {post.cover_url && (
        <div className="h-40 overflow-hidden">
          <img src={post.cover_url} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-zinc-900 text-sm leading-snug line-clamp-2 flex-1">{post.title || 'Kein Titel'}</h3>
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isPublished ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}>
            {isPublished ? <><Globe size={9} /> Live</> : 'Entwurf'}
          </span>
        </div>
        <p className="text-xs text-zinc-400 mb-3">
          {blockCount} {blockCount === 1 ? 'Block' : 'Blöcke'}{imageCount > 0 ? ` · ${imageCount} Bild${imageCount > 1 ? 'er' : ''}` : ''}
          {' · '}{new Date(post.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-zinc-700 transition-colors">
            <Edit2 size={12} /> Bearbeiten
          </button>
          <button type="button" onClick={onTogglePublish}
            className={`flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${isPublished ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700' : 'bg-amber-100 hover:bg-amber-200 text-amber-700'}`}>
            {isPublished ? <EyeOff size={12} /> : <Eye size={12} />}
            {isPublished ? 'Verstecken' : 'Veröffentlichen'}
          </button>
          <button type="button" onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<'posts' | 'announcements'>('posts')

  // ── Posts ──────────────────────────────────────────────────────────────────
  const [posts,      setPosts]      = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [editorPost, setEditorPost] = useState<Partial<Post> | null>(null)

  // ── Announcements ──────────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [annoLoading,   setAnnoLoading]   = useState(true)
  const [gymId,         setGymId]         = useState<string | null>(null)
  const [annoFormOpen,  setAnnoFormOpen]  = useState(false)
  const [annoSaving,    setAnnoSaving]    = useState(false)
  const [annoForm, setAnnoForm] = useState({ title: '', body: '', isPinned: false, expiresAt: '' })

  useEffect(() => {
    loadPosts()
    loadAnnouncements()
  }, [])

  async function loadPosts() {
    setPostsLoading(true)
    const headers = await getAuthHeaders()
    const res = await fetch('/api/posts', { headers })
    if (res.ok) setPosts(await res.json())
    setPostsLoading(false)
  }

  async function loadAnnouncements() {
    setAnnoLoading(true)
    const supabase = createClient()
    const { data: gym } = await supabase.from('gyms').select('id').single()
    if (!gym) { setAnnoLoading(false); return }
    setGymId(gym.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('gym_announcements') as any)
      .select('*').eq('gym_id', gym.id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
    if (data) setAnnouncements(data)
    setAnnoLoading(false)
  }

  async function handleAnnoSave() {
    if (!annoForm.title.trim() || !gymId) return
    setAnnoSaving(true)
    const supabase = createClient()
    const payload = {
      gym_id: gymId, title: annoForm.title.trim(), body: annoForm.body || null,
      is_pinned: annoForm.isPinned,
      expires_at: annoForm.expiresAt ? new Date(annoForm.expiresAt).toISOString() : null,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('gym_announcements') as any).insert(payload).select().single()
    if (data) setAnnouncements(prev => [data, ...prev])
    setAnnoForm({ title: '', body: '', isPinned: false, expiresAt: '' })
    setAnnoFormOpen(false); setAnnoSaving(false)
  }

  async function handleAnnoDelete(id: string) {
    if (!confirm('Ankündigung wirklich löschen?')) return
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('gym_announcements') as any).delete().eq('id', id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
  }

  async function handleTogglePublish(post: Post) {
    const headers = await getAuthHeaders()
    const published_at = post.published_at ? null : new Date().toISOString()
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ published_at }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPosts(ps => ps.map(p => p.id === updated.id ? updated : p))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Beitrag wirklich löschen?')) return
    const headers = await getAuthHeaders()
    await fetch(`/api/posts/${id}`, { method: 'DELETE', headers })
    setPosts(ps => ps.filter(p => p.id !== id))
  }

  function handleSaved(post: Post) {
    setPosts(ps => {
      const exists = ps.find(p => p.id === post.id)
      return exists ? ps.map(p => p.id === post.id ? post : p) : [post, ...ps]
    })
    setEditorPost(null)
  }

  const published = posts.filter(p => p.published_at && new Date(p.published_at) <= new Date())
  const drafts    = posts.filter(p => !p.published_at || new Date(p.published_at) > new Date())

  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all'

  return (
    <div className="p-4 md:p-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Inhalte</h1>
          <p className="text-zinc-400 text-xs mt-0.5">Beiträge & Ankündigungen für deine Mitglieder</p>
        </div>
        {activeTab === 'posts' && (
          <button type="button" onClick={() => setEditorPost({})}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm transition-colors shadow-sm shadow-amber-200">
            <Plus size={16} /> Neuer Beitrag
          </button>
        )}
        {activeTab === 'announcements' && !annoFormOpen && (
          <button type="button" onClick={() => setAnnoFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm transition-colors shadow-sm shadow-amber-200">
            <Plus size={16} /> Neue Ankündigung
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 mb-6 w-fit">
        {([
          { id: 'posts',         label: 'Beiträge',      icon: AlignLeft  },
          { id: 'announcements', label: 'Ankündigungen', icon: Megaphone  },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Beiträge ── */}
      {activeTab === 'posts' && (
        postsLoading ? (
          <div className="text-zinc-400 text-sm py-12 text-center">Wird geladen…</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4">
              <AlignLeft size={24} className="text-zinc-300" />
            </div>
            <p className="font-semibold text-zinc-700 mb-1">Noch keine Beiträge</p>
            <p className="text-zinc-400 text-sm mb-5">Eventinfos, Neuigkeiten oder Ankündigungen für deine Mitglieder und Besucher.</p>
            <button type="button" onClick={() => setEditorPost({})}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm transition-colors">
              <Plus size={15} /> Ersten Beitrag erstellen
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {published.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Veröffentlicht ({published.length})</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {published.map(post => (
                    <PostCard key={post.id} post={post}
                      onEdit={() => setEditorPost(post)}
                      onDelete={() => handleDelete(post.id)}
                      onTogglePublish={() => handleTogglePublish(post)} />
                  ))}
                </div>
              </div>
            )}
            {drafts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Entwürfe ({drafts.length})</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {drafts.map(post => (
                    <PostCard key={post.id} post={post}
                      onEdit={() => setEditorPost(post)}
                      onDelete={() => handleDelete(post.id)}
                      onTogglePublish={() => handleTogglePublish(post)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Tab: Ankündigungen ── */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-400">
            Ankündigungen erscheinen im Mitglieder-Portal. Gepinnte Beiträge erscheinen immer ganz oben.
          </p>

          {/* New announcement form */}
          {annoFormOpen && (
            <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-3 shadow-sm">
              <p className="text-sm font-bold text-zinc-900">Neue Ankündigung</p>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Titel *</label>
                <input value={annoForm.title} onChange={e => setAnnoForm(a => ({ ...a, title: e.target.value }))}
                  placeholder="z.B. Neue Öffnungszeiten ab März" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Text (optional)</label>
                <textarea value={annoForm.body} onChange={e => setAnnoForm(a => ({ ...a, body: e.target.value }))}
                  rows={3} placeholder="Detailliertere Informationen…"
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-y" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Läuft ab am</label>
                  <input type="date" value={annoForm.expiresAt} onChange={e => setAnnoForm(a => ({ ...a, expiresAt: e.target.value }))}
                    className={inputCls} />
                </div>
                <div className="flex items-center justify-between gap-3 pt-4">
                  <div>
                    <p className="text-xs font-medium text-zinc-700">Gepinnt</p>
                    <p className="text-[10px] text-zinc-400">Immer oben</p>
                  </div>
                  <button type="button" onClick={() => setAnnoForm(a => ({ ...a, isPinned: !a.isPinned }))}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${annoForm.isPinned ? 'bg-amber-500' : 'bg-zinc-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${annoForm.isPinned ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setAnnoFormOpen(false); setAnnoForm({ title: '', body: '', isPinned: false, expiresAt: '' }) }}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 transition-colors">
                  Abbrechen
                </button>
                <button type="button" onClick={handleAnnoSave} disabled={annoSaving || !annoForm.title.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold text-sm transition-colors">
                  {annoSaving ? 'Wird gespeichert…' : 'Veröffentlichen'}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {annoLoading ? (
            <div className="text-zinc-400 text-sm py-8 text-center">Wird geladen…</div>
          ) : announcements.length === 0 && !annoFormOpen ? (
            <div className="text-center py-16 px-6">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4">
                <Megaphone size={24} className="text-zinc-300" />
              </div>
              <p className="font-semibold text-zinc-700 mb-1">Noch keine Ankündigungen</p>
              <p className="text-zinc-400 text-sm mb-5">Informiere deine Mitglieder über Änderungen, Events oder Neuigkeiten.</p>
              <button type="button" onClick={() => setAnnoFormOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm transition-colors">
                <Plus size={15} /> Erste Ankündigung
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {announcements.map(a => (
                <div key={a.id} className={`flex items-start gap-3 p-4 rounded-2xl border bg-white shadow-sm ${a.is_pinned ? 'border-amber-200' : 'border-zinc-100'}`}>
                  <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50">
                    {a.is_pinned
                      ? <Pin size={13} className="text-amber-500" />
                      : <Megaphone size={13} className="text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">{a.title}</p>
                    {a.body && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{a.body}</p>}
                    <p className="text-[10px] text-zinc-400 mt-1.5">
                      {new Date(a.created_at).toLocaleDateString('de-DE')}
                      {a.expires_at && ` · läuft ab ${new Date(a.expires_at).toLocaleDateString('de-DE')}`}
                      {a.is_pinned && <span className="ml-1.5 text-amber-500 font-medium">· Gepinnt</span>}
                    </p>
                  </div>
                  <button type="button" onClick={() => handleAnnoDelete(a.id)}
                    className="flex-shrink-0 p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editorPost !== null && (
        <PostEditor
          initial={editorPost}
          onSave={handleSaved}
          onClose={() => setEditorPost(null)}
        />
      )}
    </div>
  )
}
