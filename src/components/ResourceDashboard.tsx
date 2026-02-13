
import React, { useState, useEffect, useRef } from 'react';
import { ReferralResource } from '../types';
import { apiService } from '../services/apiService';
import { Database, Plus, X, Loader2, Save, CheckCircle, UploadCloud } from 'lucide-react';

const ResourceDashboard: React.FC = () => {
    const [resources, setResources] = useState<ReferralResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);

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

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand" size={48} /></div>;
    if (error) return <div className="text-center text-rose-500 font-bold">{error}</div>;

    return (
        <div className="space-y-12 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-5xl font-black text-zinc-900 tracking-tighter">Resource Directory</h1>
                    <p className="text-zinc-500 mt-2 font-medium text-lg">Manage community referral resources.</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setShowBulkUploadModal(true)} className="flex items-center gap-3 px-6 py-4 bg-white border border-zinc-200 text-zinc-700 rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-1 hover:bg-zinc-50 transition-colors">
                        <UploadCloud size={16} /> Bulk Upload
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="flex items-center gap-3 px-6 py-4 bg-brand text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 hover:bg-brand/90 transition-colors">
                        <Plus size={16} /> Add Resource
                    </button>
                </div>
            </header>

            <div className="bg-white rounded-container border border-zinc-100 shadow-elevation-1 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-zinc-50/50">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Resource Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Service Category</th>
                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">SPA</th>
                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Contact</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {resources.map((r, i) => (
                            <tr key={i} className="hover:bg-zinc-50">
                                <td className="px-6 py-4 font-bold">{r['Resource Name']}</td>
                                <td className="px-6 py-4 text-sm text-zinc-600">{r['Service Category']}</td>
                                <td className="px-6 py-4 text-sm text-zinc-600">{r['SPA']}</td>
                                <td className="px-6 py-4 text-sm text-zinc-600">{r['Contact Phone'] || r['Contact Email']}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {resources.length === 0 && <div className="text-center p-20 text-zinc-400">No resources found.</div>}
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
    const [successCount, setSuccessCount] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files ? e.target.files[0] : null);
        setError('');
        setSuccessCount(null);
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
                    setSuccessCount(result.importedCount);
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
            <div className="bg-white max-w-2xl w-full rounded-container shadow-elevation-3 border border-zinc-100 p-10 space-y-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Bulk Upload Resources</h2>
                    <button onClick={onClose} className="p-2 bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900">
                        <X size={20} />
                    </button>
                </div>

                <p className="text-zinc-500">Upload a CSV file to import multiple referral resources at once.</p>

                <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl text-xs text-zinc-500">
                    <p className="font-bold mb-2">Required CSV Headers:</p>
                    <code className="font-mono text-[10px] block overflow-x-auto">Resource Name,Service Category,Key Offerings,Contact Phone,Contact Email,Address,Website,SPA,Operation Hours</code>
                </div>

                {successCount !== null ? (
                    <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                        <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
                        <h3 className="font-black text-emerald-800">Import Successful</h3>
                        <p className="text-emerald-700">{successCount} resources have been imported.</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg">Done</button>
                    </div>
                ) : (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand/5 file:text-brand hover:file:bg-brand/10"
                        />
                        {error && <p className="text-rose-500 text-sm text-center font-bold">{error}</p>}
                        <button
                            onClick={handleUpload}
                            disabled={isUploading || !file}
                            className="w-full py-4 bg-brand text-white rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-3 disabled:opacity-50"
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
        <div className="bg-white max-w-4xl w-full rounded-container shadow-elevation-3 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <header className="p-8 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Add New Resource</h2>
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
        <label className="text-xs font-bold text-zinc-500 mb-2 block">{label} {required && <span className="text-rose-500">*</span>}</label>
        {React.Children.map(children, child =>
            React.isValidElement(child)
                ? React.cloneElement(child as React.ReactElement<any>, {
                    className: `w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:border-brand ${(child.props as any).className || ''}`
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
            alert(`Error: ${(error as Error).message}`);
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
                <button type="submit" disabled={isSaving} className="flex items-center gap-3 px-6 py-3 bg-brand text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 hover:bg-brand/90 disabled:opacity-50">
                   {isSaving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Save Resource</>}
                </button>
             </div>
        </form>
    );
};

export default ResourceDashboard;
