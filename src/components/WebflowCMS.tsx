import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { Loader2, Plus, Pencil, Trash2, Globe, X, Save, FileText, ShoppingBag, Calendar, BookOpen, Mic, Wrench } from 'lucide-react';
import { toastService } from '../services/toastService';

const COLLECTION_META: Record<string, { label: string; icon: any; fields: { key: string; label: string; type: 'text' | 'richtext' | 'switch' | 'option'; required?: boolean; options?: string[] }[] }> = {
  'blog-posts': {
    label: 'Blog Posts',
    icon: FileText,
    fields: [
      { key: 'name', label: 'Title', type: 'text', required: true },
      { key: 'post-summary', label: 'Summary', type: 'text' },
      { key: 'rich-text', label: 'Post Body', type: 'richtext' },
      { key: 'author-name', label: 'Author', type: 'text' },
      { key: 'author-activity', label: 'Author Role', type: 'text' },
      { key: 'featured', label: 'Featured', type: 'switch' },
    ],
  },
  'products': {
    label: 'Products',
    icon: ShoppingBag,
    fields: [
      { key: 'name', label: 'Product Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'short-description', label: 'Short Description', type: 'text' },
      { key: 'shippable', label: 'Requires Shipping', type: 'switch' },
    ],
  },
  'events': {
    label: 'Events',
    icon: Calendar,
    fields: [
      { key: 'name', label: 'Event Name', type: 'text', required: true },
    ],
  },
  'programs': {
    label: 'Programs',
    icon: BookOpen,
    fields: [
      { key: 'name', label: 'Program Name', type: 'text', required: true },
    ],
  },
  'podcasts': {
    label: 'Podcasts',
    icon: Mic,
    fields: [
      { key: 'name', label: 'Episode Title', type: 'text', required: true },
    ],
  },
  'resources': {
    label: 'Tools & Resources',
    icon: Wrench,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'resource-description', label: 'Description', type: 'richtext' },
      { key: 'focus-area', label: 'Focus Area', type: 'text' },
      { key: 'resource-type', label: 'Type', type: 'text' },
    ],
  },
};

const WebflowCMS: React.FC = () => {
  const [activeCollection, setActiveCollection] = useState<string>('blog-posts');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const loadItems = async (slug: string) => {
    setLoading(true);
    try {
      const result = await apiService.get(`/api/admin/webflow/collections/${slug}/items`);
      setItems(result.items || []);
    } catch (e: any) {
      toastService.error(`Failed to load: ${e.message}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(activeCollection);
  }, [activeCollection]);

  const handleCreate = () => {
    setEditingItem(null);
    setFormData({});
    setShowEditor(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData(item.fieldData || {});
    setShowEditor(true);
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    try {
      await apiService.delete(`/api/admin/webflow/collections/${activeCollection}/items/${itemId}`);
      setItems(prev => prev.filter(i => i.id !== itemId));
      toastService.success('Item deleted');
    } catch (e: any) {
      toastService.error(`Failed to delete: ${e.message}`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingItem) {
        const result = await apiService.put(`/api/admin/webflow/collections/${activeCollection}/items/${editingItem.id}`, { fieldData: formData });
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, fieldData: { ...i.fieldData, ...formData } } : i));
        toastService.success('Item updated');
      } else {
        const result = await apiService.post(`/api/admin/webflow/collections/${activeCollection}/items`, { fieldData: formData, isDraft: true });
        await loadItems(activeCollection);
        toastService.success('Item created as draft');
      }
      setShowEditor(false);
    } catch (e: any) {
      toastService.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm('Publish all changes to the live website?')) return;
    setPublishing(true);
    try {
      await apiService.post('/api/admin/webflow/publish', {});
      toastService.success('Website published!');
    } catch (e: any) {
      toastService.error(`Publish failed: ${e.message}`);
    } finally {
      setPublishing(false);
    }
  };

  const meta = COLLECTION_META[activeCollection];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Website CMS</h2>
          <p className="text-zinc-500 mt-4 font-medium text-sm md:text-lg">Manage content on healthmatters.clinic</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleCreate} className="px-6 py-3 min-h-[44px] bg-brand text-white border border-black rounded-full font-bold text-sm uppercase tracking-wide flex items-center gap-2 shadow-elevation-2 active:scale-95">
            <Plus size={16} /> New {meta?.label?.replace(/s$/, '') || 'Item'}
          </button>
          <button onClick={handlePublish} disabled={publishing} className="px-6 py-3 min-h-[44px] bg-emerald-500 text-white border border-black rounded-full font-bold text-sm uppercase tracking-wide flex items-center gap-2 shadow-elevation-2 active:scale-95 disabled:opacity-50">
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />} Publish
          </button>
        </div>
      </div>

      {/* Collection Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
        {Object.entries(COLLECTION_META).map(([slug, meta]) => (
          <button
            key={slug}
            onClick={() => setActiveCollection(slug)}
            className={`px-4 md:px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap flex items-center gap-2 transition-all min-h-[44px] ${
              activeCollection === slug ? 'bg-brand text-white shadow-elevation-2' : 'bg-white text-zinc-400 border border-zinc-100 hover:text-zinc-600'
            }`}
          >
            <meta.icon size={14} /> {meta.label}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-brand" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-32 text-center bg-zinc-50 rounded-2xl md:rounded-[40px] border border-dashed border-zinc-200">
          <p className="text-zinc-400 font-bold">No items in {meta?.label || 'this collection'}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {items.map(item => {
            const fd = item.fieldData || {};
            return (
              <div key={item.id} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow flex flex-col">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${item.isDraft ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {item.isDraft ? 'Draft' : 'Published'}
                    </span>
                    {item.lastUpdated && (
                      <span className="text-[10px] text-zinc-300 font-bold">
                        {new Date(item.lastUpdated).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-zinc-900 mb-1 line-clamp-2">{fd.name || 'Untitled'}</h3>
                  {fd['post-summary'] && <p className="text-sm text-zinc-500 line-clamp-2">{fd['post-summary']}</p>}
                  {fd.description && <p className="text-sm text-zinc-500 line-clamp-2">{fd.description}</p>}
                  {fd['short-description'] && <p className="text-sm text-zinc-500 line-clamp-2">{fd['short-description']}</p>}
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-100">
                  <button onClick={() => handleEdit(item)} className="flex-1 py-2 min-h-[44px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-full text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2">
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="py-2 px-4 min-h-[44px] bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-full text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && meta && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-2xl md:rounded-[40px] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-elevation-3 border border-zinc-100" onClick={e => e.stopPropagation()}>
            <div className="p-6 md:p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-zinc-900">{editingItem ? 'Edit' : 'New'} {meta.label.replace(/s$/, '')}</h3>
              <button onClick={() => setShowEditor(false)} className="p-2 rounded-full hover:bg-zinc-100"><X size={20} /></button>
            </div>
            <div className="p-6 md:p-8 space-y-5">
              {meta.fields.map(field => (
                <div key={field.key}>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">
                    {field.label} {field.required && '*'}
                  </label>
                  {field.type === 'switch' ? (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData[field.key] || false}
                        onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.checked }))}
                        className="w-5 h-5 rounded border-2 border-zinc-300 text-brand focus:ring-brand"
                      />
                      <span className="text-sm font-bold text-zinc-700">{field.label}</span>
                    </label>
                  ) : field.type === 'richtext' ? (
                    <textarea
                      value={formData[field.key] || ''}
                      onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      rows={6}
                      className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand focus:bg-brand/5 outline-none transition-all resize-none"
                      placeholder={`Enter ${field.label.toLowerCase()}... (supports HTML)`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[field.key] || ''}
                      onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      required={field.required}
                      className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand focus:bg-brand/5 outline-none transition-all"
                      placeholder={field.label}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="p-6 md:p-8 border-t border-zinc-100 flex gap-3">
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 min-h-[44px] bg-brand text-white border border-black rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Draft'}
              </button>
              <button onClick={() => setShowEditor(false)} className="py-3 px-6 min-h-[44px] bg-zinc-100 text-zinc-700 rounded-full font-bold text-sm uppercase tracking-wide">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebflowCMS;
