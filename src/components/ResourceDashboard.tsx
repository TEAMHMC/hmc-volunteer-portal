
import React, { useState, useEffect } from 'react';
import { ReferralResource } from '../types';
import { apiService } from '../services/apiService';
import { Database, Plus, X, Loader2, Save, CheckCircle } from 'lucide-react';

const ResourceDashboard: React.FC = () => {
    const [resources, setResources] = useState<ReferralResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

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

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;
    if (error) return <div className="text-center text-rose-500 font-bold">{error}</div>;

    return (
        <div className="space-y-12 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-5xl font-black text-zinc-900 tracking-tighter">Resource Directory</h1>
                    <p className="text-zinc-500 mt-2 font-medium text-lg">Manage community referral resources.</p>
                </div>
                <button onClick={() => setShowAddModal(true)} className="flex items-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-colors">
                    <Plus size={16} /> Add New Resource
                </button>
            </header>

            <div className="bg-white rounded-[48px] border border-zinc-100 shadow-sm overflow-hidden">
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
        </div>
    );
};

const NewResourceModal: React.FC<{ onClose: () => void, onComplete: () => void }> = ({ onClose, onComplete }) => (
    <div className="fixed inset-0 bg-zinc-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-8" onClick={onClose}>
        <div className="bg-white max-w-4xl w-full rounded-[40px] shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
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
                    className: `w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:border-blue-500 ${(child.props as any).className || ''}`
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
                <button type="submit" disabled={isSaving} className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 disabled:opacity-50">
                   {isSaving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Save Resource</>}
                </button>
             </div>
        </form>
    );
};

export default ResourceDashboard;
