import React, { useState, useEffect, useMemo } from 'react';
import { ReferralRecord, Volunteer, ClientRecord, ReferralResource } from '../types';
import { apiService } from '../services/apiService';
import { REFERRAL_RESOURCES } from '../referralResources';
import { Send, Plus, X, Search, ChevronDown, Clock, AlertTriangle, CheckCircle, Sparkles, Loader2, Save, User } from 'lucide-react';
import { toastService } from '../services/toastService';

// TODO: CONSOLIDATION — Ensure this is only accessible from within a shift (EventOpsMode), not as a standalone tab.

// --- HELPER FUNCTIONS ---
const getSlaStatus = (referral: ReferralRecord): { status: ReferralRecord['slaComplianceStatus'], color: string } => {
    if (referral.slaComplianceStatus === 'Excluded') return { status: 'Excluded', color: 'bg-zinc-400' };
    if (referral.outcome) return { status: 'Compliant', color: 'bg-emerald-500' };

    const created = new Date(referral.createdAt);
    const now = new Date();
    let diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    
    // Simple business day calculation (Mon-Fri)
    let weekends = 0;
    for (let d = new Date(created.getTime()); d <= now; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day === 0 || day === 6) weekends++;
    }
    diffHours -= weekends * 24;

    if (diffHours > 72) return { status: 'Non-Compliant', color: 'bg-rose-500' };
    return { status: 'On Track', color: 'bg-brand' };
};


// --- MAIN COMPONENT ---
const ReferralsDashboard: React.FC<{ user: Volunteer, allVolunteers: Volunteer[] }> = ({ user, allVolunteers }) => {
    const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedReferral, setSelectedReferral] = useState<ReferralRecord | 'new' | null>(null);

    useEffect(() => {
        const fetchReferrals = async () => {
            try {
                const data = await apiService.get('/api/referrals');
                setReferrals(data);
            } catch (err) {
                setError('Failed to load referrals.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchReferrals();
    }, []);

    const handleSaveReferral = async (referral: ReferralRecord) => {
        try {
            if (referral.id) {
                // Update
                const updated = await apiService.put(`/api/referrals/${referral.id}`, { referral });
                setReferrals(prev => prev.map(r => r.id === updated.id ? updated : r));
            } else {
                // Create
                const newReferral = await apiService.post('/api/referrals/create', { referral });
                setReferrals(prev => [newReferral, ...prev]);
            }
            setSelectedReferral(null);
        } catch (err) {
            toastService.error(`Failed to save referral: ${(err as Error).message}`);
        }
    };
    
    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand" size={48} /></div>;
    if (error) return <div className="text-center text-rose-500 font-bold">{error}</div>;

    return (
        <div className="space-y-6 md:space-y-12 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Referral Dashboard</h1>
                    <p className="text-sm md:text-lg font-medium text-zinc-500 mt-2">Manage and track all client referrals and SLA compliance.</p>
                </div>
                <button onClick={() => setSelectedReferral('new')} className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-3 px-6 py-4 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 hover:bg-brand/90 transition-colors">
                    <Plus size={16} /> New Referral
                </button>
            </header>

            <div className="bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-zinc-50/50">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Client</th>
                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Service Needed</th>
                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Urgency</th>
                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Assigned To</th>
                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">SLA</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {referrals.map(r => {
                            const sla = getSlaStatus(r);
                            const assigned = allVolunteers.find(v => v.id === r.referredBy);
                            return (
                                <tr key={r.id} onClick={() => setSelectedReferral(r)} className="hover:bg-zinc-50 cursor-pointer">
                                    <td className="px-6 py-4 font-bold">{r.clientName}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">{r.serviceNeeded}</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 text-xs font-bold rounded bg-zinc-100 text-zinc-600">{r.status}</span></td>
                                    <td className="px-6 py-4"><span className={`font-bold text-sm ${r.urgency === 'Urgent' ? 'text-amber-600' : r.urgency === 'Emergency' ? 'text-rose-600' : 'text-zinc-600'}`}>{r.urgency}</span></td>
                                    <td className="px-6 py-4 text-sm">{assigned?.name || 'Unassigned'}</td>
                                    <td className="px-6 py-4"><div className="flex items-center gap-2 text-xs font-bold"><div className={`w-2 h-2 rounded-full ${sla.color}`} />{sla.status}</div></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                </div>
                 {referrals.length === 0 && <div className="text-center p-10 md:p-20 text-zinc-400 font-bold text-sm">No referrals found.</div>}
            </div>

            {selectedReferral && <ReferralDetailModal referral={selectedReferral} user={user} onClose={() => setSelectedReferral(null)} onSave={handleSaveReferral} />}
        </div>
    );
};

// --- MODAL & FORM COMPONENT ---

interface ReferralDetailModalProps {
    referral: ReferralRecord | 'new';
    user: Volunteer;
    onClose: () => void;
    onSave: (referral: ReferralRecord) => Promise<void>;
}

const ReferralDetailModal: React.FC<ReferralDetailModalProps> = ({ referral, user, onClose, onSave }) => {
    const isNew = referral === 'new';
    const [formData, setFormData] = useState<Partial<ReferralRecord>>(
        isNew 
        ? { status: 'Pending', urgency: 'Standard', referralDate: new Date().toISOString().split('T')[0], referredBy: user.id, createdAt: new Date().toISOString() } 
        : referral
    );
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        setIsSaving(true);
        await onSave(formData as ReferralRecord);
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 md:p-8" onClick={onClose}>
            <div className="bg-white max-w-4xl w-full rounded-modal shadow-elevation-3 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <header className="p-4 md:p-8 border-b border-zinc-100 flex items-center justify-between">
                    <h2 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">{isNew ? 'New Referral' : `Referral for ${formData.clientName}`}</h2>
                    <button onClick={onClose} className="p-3 bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-800"><X size={20} /></button>
                </header>
                <main className="p-4 md:p-8 space-y-4 md:space-y-6 overflow-y-auto">
                    {/* Client Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                         <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Client</label><input value={formData.clientName || ''} onChange={e => setFormData({...formData, clientName: e.target.value, clientId: ''})} placeholder="Search or Type Client Name..." className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"/></div>
                         <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Referral Date</label><input type="date" value={formData.referralDate?.split('T')[0] || ''} onChange={e => setFormData({...formData, referralDate: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"/></div>
                    </div>
                     {/* Status & Urgency */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                         <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Status</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm"><option>Pending</option><option>In Progress</option><option>Completed</option><option>Withdrawn</option></select></div>
                         <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Urgency</label><select value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value as any})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm"><option>Standard</option><option>Urgent</option><option>Emergency</option></select></div>
                     </div>
                      {/* Service Needed */}
                     <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Service Needed</label><textarea value={formData.serviceNeeded || ''} onChange={e => setFormData({...formData, serviceNeeded: e.target.value})} placeholder="Describe client's need... (e.g. 'unhoused veteran seeking mental health support')" className="w-full p-4 h-20 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"/></div>
                     
                     {/* AI Matching */}
                     <AIResourceMatcher serviceNeed={formData.serviceNeeded || ''} onSelect={(resource) => setFormData({...formData, referredTo: resource['Resource Name']})} />
                     
                     {/* Final Resource & Notes */}
                     <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Referred To</label><input value={formData.referredTo || ''} onChange={e => setFormData({...formData, referredTo: e.target.value})} placeholder="Final selected resource..." className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"/></div>
                     <div><label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Notes</label><textarea value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-4 h-24 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"/></div>

                </main>
                <footer className="p-4 md:p-8 border-t border-zinc-100 flex justify-end">
                    <button onClick={handleSubmit} disabled={isSaving} className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-3 px-6 py-3 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 hover:bg-brand/90 disabled:opacity-50">
                        {isSaving ? <Loader2 className="animate-spin" size={16}/> : <><Save size={16}/> Save Referral</>}
                    </button>
                </footer>
            </div>
        </div>
    );
};

const AIResourceMatcher: React.FC<{ serviceNeed: string, onSelect: (resource: ReferralResource) => void }> = ({ serviceNeed, onSelect }) => {
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleFindMatch = async () => {
        if (!serviceNeed) return;
        setIsLoading(true);
        setRecommendations([]);
        try {
            const result = await apiService.post('/api/gemini/find-referral-match', { clientNeed: serviceNeed });
            setRecommendations(result.recommendations);
        } catch(e) { toastService.error("AI Match failed."); }
        finally { setIsLoading(false); }
    };
    
    return (
        <div className="p-4 bg-brand/5 rounded-3xl border border-brand/10 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-brand uppercase flex items-center gap-2"><Sparkles size={14}/> AI Matching Assistant</h4>
                <button onClick={handleFindMatch} disabled={!serviceNeed || isLoading} className="px-3 py-1 bg-white border border-black text-brand text-xs font-bold rounded-full uppercase tracking-wide disabled:opacity-50">
                    {isLoading ? <Loader2 size={14} className="animate-spin"/> : 'Find Matches'}
                </button>
            </div>
            {recommendations.length > 0 && (
                <div className="space-y-2">
                    {recommendations.map((rec, i) => {
                         const resource = REFERRAL_RESOURCES.find(r => r["Resource Name"] === rec["Resource Name"]);
                         if (!resource) return null;
                         return (
                             <div key={i} className="p-3 bg-white/50 rounded-2xl border border-brand/10">
                                 <h5 className="font-bold text-sm text-zinc-800">{rec["Resource Name"]}</h5>
                                 <p className="text-xs italic text-zinc-500 my-1">"{rec.reasoning}"</p>
                                 <button onClick={() => onSelect(resource)} className="text-xs font-bold text-brand hover:underline">Select</button>
                             </div>
                         )
                    })}
                </div>
            )}
        </div>
    );
};

export default ReferralsDashboard;