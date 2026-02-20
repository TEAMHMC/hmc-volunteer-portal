
import React, { useState, useEffect, useRef } from 'react';
import { ReferralResource } from '../types';
import { apiService } from '../services/apiService';
import { Database, Plus, X, Loader2, Save, CheckCircle, UploadCloud, Search, ChevronDown, ChevronUp, Phone, Mail, MapPin, Globe, Clock, Trash2 } from 'lucide-react';
import { toastService } from '../services/toastService';

const ResourceDashboard: React.FC = () => {
    const [resources, setResources] = useState<ReferralResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [isClearing, setIsClearing] = useState(false);

    const fetchResources = async () => {
        try {
            setLoading(true);
            const data = await apiService.get('/api/resources');
            setResources(data);
        } catch (err) {
            setError('Failed to load resources.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResources();
    }, []);

    const handleClearAll = async () => {
        if (!window.confirm(`Delete all ${resources.length} resources? This cannot be undone.`)) return;
        setIsClearing(true);
        try {
            await apiService.delete('/api/resources/clear-all');
            toastService.success('All resources cleared successfully.');
            fetchResources();
        } catch (err) {
            toastService.error('Failed to clear resources.');
        } finally {
            setIsClearing(false);
        }
    };

    // Derive unique categories
    const categories = [...new Set(resources.map(r => r['Service Category']).filter(Boolean))].sort();

    // Filter resources
    const filtered = resources.filter(r => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            (r['Resource Name'] || '').toLowerCase().includes(q) ||
            (r['Service Category'] || '').toLowerCase().includes(q) ||
            (r['Key Offerings'] || '').toLowerCase().includes(q) ||
            (r['Address'] || '').toLowerCase().includes(q);
        const matchesCategory = !categoryFilter || r['Service Category'] === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand" size={48} /></div>;
    if (error) return <div className="text-center text-rose-500 font-bold">{error}</div>;

    const ResourceDetail: React.FC<{ r: ReferralResource }> = ({ r }) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-zinc-50 rounded-2xl text-sm animate-in fade-in slide-in-from-top-2 duration-300">
            {r['Key Offerings'] && <div className="sm:col-span-2"><span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Key Offerings</span><p className="text-zinc-700 text-xs leading-relaxed">{r['Key Offerings']}</p></div>}
            {r['Address'] && <div className="flex items-start gap-2"><MapPin size={14} className="text-zinc-400 shrink-0 mt-0.5" /><span className="text-zinc-700 text-xs">{r['Address']}</span></div>}
            {r['Contact Phone'] && <div className="flex items-center gap-2"><Phone size={14} className="text-zinc-400 shrink-0" /><a href={`tel:${r['Contact Phone']}`} className="text-brand text-xs font-bold hover:underline">{r['Contact Phone']}</a></div>}
            {r['Contact Email'] && <div className="flex items-center gap-2"><Mail size={14} className="text-zinc-400 shrink-0" /><a href={`mailto:${r['Contact Email']}`} className="text-brand text-xs font-bold hover:underline truncate">{r['Contact Email']}</a></div>}
            {r['Website'] && <div className="flex items-center gap-2"><Globe size={14} className="text-zinc-400 shrink-0" /><a href={r['Website']} target="_blank" rel="noopener noreferrer" className="text-brand text-xs font-bold hover:underline truncate">{r['Website']}</a></div>}
            {r['Operation Hours'] && <div className="flex items-start gap-2"><Clock size={14} className="text-zinc-400 shrink-0 mt-0.5" /><span className="text-zinc-700 text-xs">{r['Operation Hours']}</span></div>}
            {r['Eligibility Criteria'] && <div className="sm:col-span-2"><span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Eligibility</span><p className="text-zinc-700 text-xs leading-relaxed">{r['Eligibility Criteria']}</p></div>}
            {r['Target Population'] && <div><span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Target Population</span><p className="text-zinc-700 text-xs">{r['Target Population']}</p></div>}
            {r['Languages Spoken'] && <div><span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Languages</span><p className="text-zinc-700 text-xs">{r['Languages Spoken']}</p></div>}
        </div>
    );

    return (
        <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Resource Directory</h1>
                    <p className="text-sm md:text-lg font-medium text-zinc-500 mt-1 md:mt-2">{resources.length} resources {filtered.length !== resources.length && `(${filtered.length} shown)`}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {resources.length > 0 && (
                        <button onClick={handleClearAll} disabled={isClearing} className="flex items-center gap-2 px-4 py-3 bg-white border border-rose-200 text-rose-500 rounded-full text-[10px] font-bold uppercase tracking-wide hover:bg-rose-50 transition-colors min-h-[44px]">
                            {isClearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Clear All
                        </button>
                    )}
                    <button onClick={() => setShowBulkUploadModal(true)} className="flex items-center gap-2 px-4 py-3 bg-white border border-black text-zinc-700 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-elevation-1 hover:bg-zinc-50 transition-colors min-h-[44px]">
                        <UploadCloud size={14} /> Upload CSV
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-3 bg-brand border border-black text-white rounded-full text-[10px] font-bold uppercase tracking-wide shadow-elevation-2 hover:bg-brand/90 transition-colors min-h-[44px]">
                        <Plus size={14} /> Add
                    </button>
                </div>
            </header>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search resources by name, category, offerings..."
                        className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-medium outline-none focus:border-brand/30 focus:ring-2 focus:ring-brand/10"
                    />
                </div>
                {categories.length > 1 && (
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="px-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold text-zinc-700 outline-none focus:border-brand/30 min-h-[44px] appearance-none"
                    >
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                )}
            </div>

            {/* Resource List — scrollable */}
            <div className="bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm overflow-hidden">
                <div className="max-h-[60vh] overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="text-center py-16 text-zinc-400 font-bold text-sm">
                            {resources.length === 0 ? 'No resources yet. Upload a CSV or add one manually.' : 'No resources match your search.'}
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100">
                            {filtered.map((r, i) => {
                                const rid = r.id || `r-${i}`;
                                const isExpanded = expandedId === rid;
                                return (
                                    <div key={rid}>
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : rid)}
                                            className="w-full text-left px-4 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 hover:bg-zinc-50 transition-colors min-h-[56px]"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-zinc-900 truncate">{r['Resource Name'] || '(unnamed)'}</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    {r['Service Category'] && <span className="inline-block px-2.5 py-0.5 bg-brand/5 text-brand text-[10px] font-bold rounded-full border border-brand/10 truncate max-w-[150px]">{r['Service Category']}</span>}
                                                    {r['SPA'] && <span className="text-[10px] font-bold text-zinc-400">SPA {r['SPA']}</span>}
                                                    {r['Contact Phone'] && <span className="hidden sm:inline text-[10px] text-zinc-400">{r['Contact Phone']}</span>}
                                                </div>
                                            </div>
                                            {isExpanded ? <ChevronUp size={16} className="text-zinc-400 shrink-0" /> : <ChevronDown size={16} className="text-zinc-400 shrink-0" />}
                                        </button>
                                        {isExpanded && (
                                            <div className="px-4 md:px-6 pb-4">
                                                <ResourceDetail r={r} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {showAddModal && <NewResourceModal onClose={() => setShowAddModal(false)} onComplete={fetchResources} />}
            {showBulkUploadModal && <BulkUploadResourceModal onClose={() => setShowBulkUploadModal(false)} onComplete={fetchResources} />}
        </div>
    );
};

const BulkUploadResourceModal: React.FC<{ onClose: () => void, onComplete: () => void }> = ({ onClose, onComplete }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [importResult, setImportResult] = useState<{ importedCount: number; updatedCount: number; skippedCount: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files ? e.target.files[0] : null);
        setError('');
        setImportResult(null);
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a CSV file to upload.');
            return;
        }
        setIsUploading(true);
        setError('');
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const csvContent = e.target?.result as string;
                    const base64Data = btoa(unescape(encodeURIComponent(csvContent)));
                    const result = await apiService.post('/api/resources/bulk-import', { csvData: base64Data });
                    setImportResult({ importedCount: result.importedCount, updatedCount: result.updatedCount || 0, skippedCount: result.skippedCount || 0 });
                    onComplete();
                } catch (err) {
                    setError((err as Error).message || 'Failed to import resources');
                } finally {
                    setIsUploading(false);
                }
            };
            reader.readAsText(file);
        } catch (err) {
            setError((err as Error).message);
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-8 animate-in fade-in" onClick={onClose}>
            <div className="bg-white max-w-2xl w-full rounded-modal shadow-elevation-3 border border-zinc-100 p-8 space-y-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black tracking-tight text-zinc-900">Bulk Upload Resources</h2>
                    <button onClick={onClose} className="p-2 bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900">
                        <X size={20} />
                    </button>
                </div>

                <p className="text-sm text-zinc-600">Upload a CSV file to import multiple referral resources at once. Duplicates are automatically detected by Resource Name + Address and merged.</p>

                <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-3xl text-xs text-zinc-500 space-y-2">
                    <p className="font-bold">Expected CSV Headers:</p>
                    <code className="font-mono text-[10px] block overflow-x-auto whitespace-nowrap">Resource Name, Service Category, Key Offerings, Resource Type, Data type, Eligibility Criteria, Languages Spoken, Target Population, Operation Hours, Contact Person Name, Contact Phone, AI Contact Phone, Contact Email, AI Contact Email, Address, AI Address, Contact Info Notes, Intake / Referral Process Notes, SLA / Typical Response Time, Active / Inactive, Date Added, Linked Clients, Website, Core Business Summary, Contact Info Verification, Feedback Database, Service Received (from Feedback Database), Satisfaction Rating (from Feedback Database), Average Rating, Number of Feedbacks, Feedback Comments (from Feedback Database), Feedback Summary, SPA, Source, Last Updated, Last Modified By, Partner Agency, Referred Service Feedback</code>
                    <p className="text-[10px] text-zinc-400">Only "Resource Name" is required. All other columns are optional and will be mapped automatically.</p>
                </div>

                {importResult !== null ? (
                    <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-3xl text-center space-y-3">
                        <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
                        <h3 className="font-black text-emerald-800">Import Complete</h3>
                        <div className="flex justify-center gap-6 text-sm">
                            <div><span className="text-2xl font-black text-emerald-900">{importResult.importedCount}</span> <span className="text-emerald-700">new</span></div>
                            <div><span className="text-2xl font-black text-amber-900">{importResult.updatedCount}</span> <span className="text-amber-700">updated</span></div>
                            <div><span className="text-2xl font-black text-zinc-500">{importResult.skippedCount}</span> <span className="text-zinc-400">skipped</span></div>
                        </div>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-brand border border-black text-white text-xs font-bold rounded-full uppercase tracking-wide">Done</button>
                    </div>
                ) : (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-brand/5 file:text-brand hover:file:bg-brand/10"
                        />
                        {error && <p className="text-rose-500 text-sm text-center font-bold">{error}</p>}
                        <button
                            onClick={handleUpload}
                            disabled={isUploading || !file}
                            className="w-full py-4 bg-brand border border-black text-white rounded-full font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isUploading ? <Loader2 className="animate-spin" size={18} /> : <><UploadCloud size={18} /> Import Resources</>}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

const NewResourceModal: React.FC<{ onClose: () => void, onComplete: () => void }> = ({ onClose, onComplete }) => (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-8" onClick={onClose}>
        <div className="bg-white max-w-4xl w-full rounded-modal shadow-elevation-3 flex flex-col max-h-[90vh] border border-zinc-100" onClick={e => e.stopPropagation()}>
            <header className="p-8 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight text-zinc-900">Add New Resource</h2>
                <button onClick={onClose} className="p-3 bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-800"><X size={20} /></button>
            </header>
            <main className="p-8 overflow-y-auto">
                <NewResourceForm onComplete={() => { onComplete(); onClose(); }} />
            </main>
        </div>
    </div>
);

const FormField: React.FC<React.PropsWithChildren<{ label: string, required?: boolean }>> = ({ label, required, children }) => (
    <div>
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">{label} {required && <span className="text-rose-500">*</span>}</label>
        {React.Children.map(children, child =>
            React.isValidElement(child)
                ? React.cloneElement(child as React.ReactElement<any>, {
                    className: `w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm ${(child.props as any).className || ''}`
                })
                : child
        )}
    </div>
);

const NewResourceForm: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [formData, setFormData] = useState<Partial<ReferralResource>>({ 'Active / Inactive': 'checked' });
    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    
    const handleChange = (field: keyof ReferralResource, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await apiService.post('/api/resources/create', { resource: formData });
            setIsSuccess(true);
            setTimeout(() => onComplete(), 2000);
        } catch (error) {
            toastService.error(`Error: ${(error as Error).message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isSuccess) {
        return <div className="text-center py-20 animate-in fade-in"><CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" /><h3 className="font-bold text-lg">Resource Added!</h3></div>;
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField label="Resource Name" required><input type="text" value={formData['Resource Name'] || ''} onChange={e => handleChange('Resource Name', e.target.value)} required /></FormField>
                <FormField label="Service Category"><input type="text" value={formData['Service Category'] || ''} onChange={e => handleChange('Service Category', e.target.value)} placeholder="e.g., Housing, Food Assistance" /></FormField>
             </div>
             <FormField label="Website"><input type="url" value={formData['Website'] || ''} onChange={e => handleChange('Website', e.target.value)} placeholder="https://example.com" /></FormField>
             <FormField label="Key Offerings"><textarea value={formData['Key Offerings'] || ''} onChange={e => handleChange('Key Offerings', e.target.value)} className="h-24" /></FormField>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField label="Contact Phone"><input type="tel" value={formData['Contact Phone'] || ''} onChange={e => handleChange('Contact Phone', e.target.value)} /></FormField>
                <FormField label="Contact Email"><input type="email" value={formData['Contact Email'] || ''} onChange={e => handleChange('Contact Email', e.target.value)} /></FormField>
             </div>
             <FormField label="Address"><input type="text" value={formData['Address'] || ''} onChange={e => handleChange('Address', e.target.value)} /></FormField>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField label="Operation Hours"><input type="text" value={formData['Operation Hours'] || ''} onChange={e => handleChange('Operation Hours', e.target.value)} /></FormField>
                <FormField label="SPA (Service Planning Area)"><input type="text" value={formData['SPA'] || ''} onChange={e => handleChange('SPA', e.target.value)} /></FormField>
             </div>
             <div className="flex justify-end pt-6 border-t border-zinc-100">
                <button type="submit" disabled={isSaving} className="flex items-center gap-3 px-6 py-3 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 hover:bg-brand/90 disabled:opacity-50">
                   {isSaving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Save Resource</>}
                </button>
             </div>
        </form>
    );
};

export default ResourceDashboard;
