
import React, { useState } from 'react';
import { Zap, Clock, Send, Gift, ShieldAlert, CheckCircle, Loader2 } from 'lucide-react';

const initialWorkflows = [
    { id: 'w1', title: 'Shift Reminder', description: 'Send an SMS reminder to volunteers 24 hours before their shift.', icon: Clock, enabled: true },
    { id: 'w2', title: 'Post-Shift Thank You', description: 'Send a thank-you email with an impact summary after a volunteer completes a shift.', icon: Send, enabled: true },
    { id: 'w3', title: 'New Opportunity Alert', description: 'Notify volunteers with matching skills when a new high-urgency opportunity is posted.', icon: Zap, enabled: false },
    { id: 'w4', title: 'Birthday Recognition', description: 'Award bonus Impact XP to volunteers on their birthday.', icon: Gift, enabled: true },
    { id: 'w5', title: 'Compliance Expiry Warning', description: 'Alert volunteers 30 days before their background check or other compliance items expire.', icon: ShieldAlert, enabled: true },
];

const AutomatedWorkflows: React.FC = () => {
    const [workflows, setWorkflows] = useState(initialWorkflows);
    const [isSaving, setIsSaving] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    
    const handleToggle = (id: string) => {
        setWorkflows(current => current.map(wf => wf.id === id ? { ...wf, enabled: !wf.enabled } : wf));
        setHasChanges(true);
    };
    
    const handleSaveChanges = () => {
        setIsSaving(true);
        // Simulate API call
        setTimeout(() => {
            setIsSaving(false);
            setHasChanges(false);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
            console.log("Saved Workflows:", workflows);
        }, 1500);
    };

    return (
        <div className="space-y-12 animate-in fade-in duration-700 pb-20">
            {showToast && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-10 py-6 rounded-full shadow-2xl flex items-center gap-4 z-[5000] animate-in slide-in-from-bottom-10">
                   <div className="p-2 rounded-lg bg-emerald-500"><CheckCircle size={16} /></div>
                   <span className="text-sm font-medium uppercase tracking-wide">Workflow settings updated.</span>
                </div>
            )}
            <header>
                <h1 className="text-5xl font-medium text-zinc-900 tracking-normal">Automated Workflows</h1>
                <p className="text-zinc-500 mt-2 font-medium text-lg">Set up automatic actions to save time and ensure a consistent volunteer experience.</p>
            </header>

            <div className="bg-white p-12 rounded-[48px] border border-zinc-100 shadow-sm">
                <h3 className="text-lg font-medium text-zinc-900 mb-8 tracking-wide">Active & Inactive Workflows</h3>
                <div className="divide-y divide-zinc-100">
                    {workflows.map(wf => (
                        <div key={wf.id} className="py-6 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${wf.enabled ? 'bg-[#233DFF]/5 text-[#233DFF]' : 'bg-zinc-100 text-zinc-400'}`}>
                                    <wf.icon size={24} />
                                </div>
                                <div>
                                    <h4 className="font-medium text-zinc-900">{wf.title}</h4>
                                    <p className="text-sm text-zinc-500">{wf.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                               <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={wf.enabled} onChange={() => handleToggle(wf.id)} className="sr-only peer" />
                                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#233DFF]"></div>
                               </label>
                            </div>
                        </div>
                    ))}
                </div>
                {hasChanges && (
                    <div className="mt-8 pt-8 border-t border-zinc-100 flex justify-end">
                        <button onClick={handleSaveChanges} disabled={isSaving} className="flex items-center gap-3 px-8 py-4 bg-[#233DFF] text-white rounded-full text-xs font-medium uppercase tracking-wide shadow-lg disabled:opacity-50">
                           {isSaving ? <Loader2 className="animate-spin" size={16} /> : "Save Changes"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AutomatedWorkflows;