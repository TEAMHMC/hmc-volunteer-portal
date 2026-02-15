import React, { useState } from 'react';
import { Volunteer, Shift, ClinicEvent, ClientRecord, ScreeningRecord, AuditLog } from '../types';
import { apiService } from '../services/apiService';
import { hasCompletedModule } from '../constants';
import { HeartPulse, Search, UserPlus, CheckCircle, Loader2, X, Plus, AlertTriangle } from 'lucide-react';
import { toastService } from '../services/toastService';

interface HealthScreeningsViewProps {
    user: Volunteer;
    shift: Shift;
    event?: ClinicEvent;
    onLog: (log: Omit<AuditLog, 'id' | 'timestamp' | 'actorUserId' | 'actorRole' | 'shiftId' | 'eventId'>) => void;
}

const HealthScreeningsView: React.FC<HealthScreeningsViewProps> = ({ user, shift, event, onLog }) => {
    const [view, setView] = useState<'search' | 'new_client' | 'screening'>('search');
    const [searchBy, setSearchBy] = useState<'phone' | 'email'>('phone');
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<ClientRecord | 'not_found' | null>(null);
    const [activeClient, setActiveClient] = useState<ClientRecord | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const resetState = () => {
        setView('search');
        setQuery('');
        setSearchResult(null);
        setActiveClient(null);
        setError('');
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) return;
        setIsSearching(true);
        setSearchResult(null);
        setError('');
        try {
            const result = await apiService.post('/api/clients/search', { [searchBy]: query });
            setSearchResult(result);
            onLog({ actionType: 'CLIENT_SEARCH', targetSystem: 'FIRESTORE', targetId: result.id, summary: `Searched for client by ${searchBy}. Found: ${result.firstName} ${result.lastName}` });
        } catch (err) {
            setSearchResult('not_found');
             onLog({ actionType: 'CLIENT_SEARCH', targetSystem: 'FIRESTORE', targetId: 'N/A', summary: `Searched for client by ${searchBy}. Result: Not Found.` });
        } finally {
            setIsSearching(false);
        }
    };

    const handleStartScreening = (client: ClientRecord) => {
        setActiveClient(client);
        setView('screening');
    };

    // Medical roles need clinical onboarding completed, others need core volunteer training
    const isMedicalRole = user.role?.includes('Medical') || user.role?.includes('Licensed');
    const LEAD_ROLES = ['Events Lead', 'Events Coordinator', 'Volunteer Lead', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Outreach & Engagement Lead'];
    const isLeadOrAdmin = user.isAdmin || LEAD_ROLES.includes(user.role);
    if (!isLeadOrAdmin) {
        if (isMedicalRole) {
            if (!user.clinicalOnboarding?.completed) {
                return <AccessGate requiredTraining="Clinical Onboarding (Training Academy)" />;
            }
        } else if (!user.coreVolunteerStatus && !hasCompletedModule(user.completedTrainingIds || [], 'survey_general')) {
            return <AccessGate requiredTraining="Core Volunteer Training (Training Academy)" />;
        }
    }

    return (
        <div className="animate-in fade-in duration-500">
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase mb-8">Health Screenings</h2>

            {view === 'search' && (
                <div className="max-w-xl mx-auto space-y-6">
                    <form onSubmit={handleSearch}>
                        <div className="flex bg-zinc-100 p-1 rounded-full">
                            <button type="button" onClick={() => setSearchBy('phone')} className={`flex-1 p-2 text-xs font-bold rounded-full ${searchBy === 'phone' ? 'bg-white shadow' : ''}`}>By Phone</button>
                            <button type="button" onClick={() => setSearchBy('email')} className={`flex-1 p-2 text-xs font-bold rounded-full ${searchBy === 'email' ? 'bg-white shadow' : ''}`}>By Email</button>
                        </div>
                        <div className="relative mt-4">
                            <input type={searchBy === 'phone' ? 'tel' : 'email'} value={query} onChange={e => setQuery(e.target.value)} placeholder={`Enter client ${searchBy}...`} className="w-full p-4 pr-28 bg-zinc-50 border-2 border-zinc-100 rounded-xl outline-none focus:border-brand font-bold" />
                            <button type="submit" disabled={isSearching} className="absolute right-2 top-2 h-12 px-6 bg-brand text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                {isSearching ? <Loader2 className="animate-spin" size={16} /> : <><Search size={16} /> Search</>}
                            </button>
                        </div>
                    </form>

                    {searchResult === 'not_found' && (
                        <div className="text-center p-8 bg-amber-50 rounded-2xl border border-amber-200">
                            <p className="font-bold text-amber-800">Client not found.</p>
                            <p className="text-sm text-amber-700">Please verify the information or register them as a new client.</p>
                            <button onClick={() => setView('new_client')} className="mt-4 px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold flex items-center gap-2 mx-auto"><UserPlus size={14} /> Register New Client</button>
                        </div>
                    )}

                    {searchResult && searchResult !== 'not_found' && (
                        <div className="p-8 bg-emerald-50 rounded-2xl border border-emerald-200">
                            <p className="text-xs font-bold text-emerald-800">Client Found</p>
                            <p className="text-xl font-bold text-emerald-900">{searchResult.firstName} {searchResult.lastName}</p>
                            <p className="text-sm text-emerald-800">DOB: {searchResult.dob}</p>
                            <button onClick={() => handleStartScreening(searchResult as ClientRecord)} className="mt-4 px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold flex items-center gap-2"><HeartPulse size={14}/> Start Screening</button>
                        </div>
                    )}
                </div>
            )}
            
            {view === 'new_client' && <NewClientForm setView={setView} setActiveClient={setActiveClient} onLog={onLog} />}
            
            {view === 'screening' && activeClient && <ScreeningForm client={activeClient} user={user} shift={shift} event={event} onLog={onLog} onComplete={resetState} />}
        </div>
    );
};

const NewClientForm: React.FC<{setView: Function, setActiveClient: Function, onLog: Function}> = ({ setView, setActiveClient, onLog }) => {
    const [client, setClient] = useState<Partial<ClientRecord>>({});
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const newClient = await apiService.post('/api/clients/create', { client });
            setActiveClient(newClient);
            setView('screening');
            onLog({ actionType: 'CREATE_CLIENT', targetSystem: 'FIRESTORE', targetId: newClient.id, summary: `Created new client: ${newClient.firstName} ${newClient.lastName}` });
        } catch(err) {
            toastService.error('Failed to save new client.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto space-y-6 animate-in fade-in">
            <h3 className="text-lg font-black text-zinc-900">Register New Client</h3>
            <form onSubmit={handleSave} className="space-y-4">
                <input required placeholder="First Name" onChange={e => setClient({...client, firstName: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl" />
                <input required placeholder="Last Name" onChange={e => setClient({...client, lastName: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl" />
                <input required type="date" placeholder="Date of Birth" onChange={e => setClient({...client, dob: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl" />
                <input required type="tel" pattern="[0-9]{10,15}" placeholder="Phone Number" onChange={e => setClient({...client, phone: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl" />
                <input type="email" placeholder="Email (Optional)" onChange={e => setClient({...client, email: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl" />
                <div className="flex gap-4">
                    <button type="button" onClick={() => setView('search')} className="flex-1 py-3 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded-lg text-sm font-bold">Cancel</button>
                    <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-brand text-white rounded-lg text-sm font-bold disabled:opacity-50">{isSaving ? 'Saving...' : 'Save and Continue'}</button>
                </div>
            </form>
        </div>
    );
};

// Vitals thresholds for flagging
const VITALS_FLAGS = {
    bloodPressure: {
        systolic: { normal: 120, elevated: 129, stage1: 139, stage2: 180 },
        diastolic: { normal: 80, elevated: 80, stage1: 89, stage2: 120 }
    },
    glucose: { normal: 140, prediabetes: 200, diabetes: 300 },
    heartRate: { low: 60, high: 100 },
    temperature: { low: 97, high: 99.5 }
};

const getBloodPressureFlag = (systolic: number, diastolic: number) => {
    if (systolic >= 180 || diastolic >= 120) return { level: 'critical', label: 'Hypertensive Crisis', color: 'rose' };
    if (systolic >= 140 || diastolic >= 90) return { level: 'high', label: 'Stage 2 Hypertension', color: 'orange' };
    if (systolic >= 130 || diastolic >= 80) return { level: 'medium', label: 'Stage 1 Hypertension', color: 'amber' };
    if (systolic >= 120) return { level: 'low', label: 'Elevated', color: 'yellow' };
    return { level: 'normal', label: 'Normal', color: 'emerald' };
};

const getGlucoseFlag = (value: number) => {
    if (value >= 300) return { level: 'critical', label: 'Critical - Seek Care', color: 'rose' };
    if (value >= 200) return { level: 'high', label: 'Diabetes Range', color: 'orange' };
    if (value >= 140) return { level: 'medium', label: 'Prediabetes Range', color: 'amber' };
    return { level: 'normal', label: 'Normal', color: 'emerald' };
};

const ScreeningForm: React.FC<{client: ClientRecord, user: Volunteer, shift: Shift, event?: ClinicEvent, onLog: Function, onComplete: Function}> = ({ client, user, shift, event, onLog, onComplete }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [vitals, setVitals] = useState({
        systolic: '',
        diastolic: '',
        heartRate: '',
        glucose: '',
        temperature: '',
        weight: '',
        height: '',
        oxygenSat: '',
        notes: '',
        followUpNeeded: false,
        followUpReason: ''
    });

    const bpFlag = vitals.systolic && vitals.diastolic
        ? getBloodPressureFlag(Number(vitals.systolic), Number(vitals.diastolic))
        : null;
    const glucoseFlag = vitals.glucose ? getGlucoseFlag(Number(vitals.glucose)) : null;

    const hasFlags = bpFlag?.level === 'critical' || bpFlag?.level === 'high' ||
                     glucoseFlag?.level === 'critical' || glucoseFlag?.level === 'high';

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const screening = {
                clientId: client.id,
                volunteerId: user.id,
                shiftId: shift?.id,
                eventId: event?.id,
                vitals: {
                    bloodPressure: { systolic: Number(vitals.systolic), diastolic: Number(vitals.diastolic) },
                    heartRate: Number(vitals.heartRate) || null,
                    glucose: Number(vitals.glucose) || null,
                    temperature: Number(vitals.temperature) || null,
                    weight: Number(vitals.weight) || null,
                    height: Number(vitals.height) || null,
                    oxygenSat: Number(vitals.oxygenSat) || null
                },
                flags: {
                    bloodPressure: bpFlag?.level !== 'normal' ? bpFlag : null,
                    glucose: glucoseFlag?.level !== 'normal' ? glucoseFlag : null
                },
                notes: vitals.notes,
                followUpNeeded: vitals.followUpNeeded || hasFlags,
                followUpReason: vitals.followUpReason || (hasFlags ? 'Abnormal vitals flagged' : ''),
                timestamp: new Date().toISOString()
            };

            await apiService.post('/api/screenings/create', screening);
            onLog({
                actionType: 'CREATE_SCREENING',
                targetSystem: 'FIRESTORE',
                targetId: client.id,
                summary: `Screening completed for ${client.firstName} ${client.lastName}. ${hasFlags ? '⚠️ FLAGS PRESENT' : 'No flags.'}`
            });
            onComplete();
        } catch(err) {
            toastService.error('Failed to save screening.');
        } finally {
            setIsSaving(false);
        }
    };

    const inputClass = "w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl outline-none focus:border-brand font-bold";
    const labelClass = "block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2";

    return (
        <div className="space-y-6 animate-in fade-in max-w-2xl mx-auto">
            <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-elevation-1 flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-zinc-500">Screening for:</p>
                    <p className="text-lg font-bold">{client.firstName} {client.lastName}</p>
                    <p className="text-sm text-zinc-500">DOB: {client.dob}</p>
                </div>
                <button onClick={() => onComplete()} className="p-2 hover:bg-zinc-200 rounded-lg"><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Blood Pressure */}
                <div className="p-6 bg-white border border-zinc-100 shadow-elevation-1 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-zinc-900">Blood Pressure</h4>
                        {bpFlag && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold bg-${bpFlag.color}-100 text-${bpFlag.color}-700 flex items-center gap-1`}>
                                {bpFlag.level !== 'normal' && <AlertTriangle size={12} />}
                                {bpFlag.label}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Systolic (top)</label>
                            <input type="number" placeholder="120" value={vitals.systolic} onChange={e => setVitals({...vitals, systolic: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Diastolic (bottom)</label>
                            <input type="number" placeholder="80" value={vitals.diastolic} onChange={e => setVitals({...vitals, diastolic: e.target.value})} className={inputClass} />
                        </div>
                    </div>
                    {bpFlag && bpFlag.level === 'critical' && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-bold">
                            ⚠️ <strong>Hypertensive Crisis Detected.</strong> Client should seek immediate medical attention. Do not discharge without clinical review.
                        </div>
                    )}
                </div>

                {/* Glucose */}
                <div className="p-6 bg-white border border-zinc-100 shadow-elevation-1 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-zinc-900">Blood Glucose</h4>
                        {glucoseFlag && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold bg-${glucoseFlag.color}-100 text-${glucoseFlag.color}-700 flex items-center gap-1`}>
                                {glucoseFlag.level !== 'normal' && <AlertTriangle size={12} />}
                                {glucoseFlag.label}
                            </span>
                        )}
                    </div>
                    <div>
                        <label className={labelClass}>Glucose (mg/dL)</label>
                        <input type="number" placeholder="100" value={vitals.glucose} onChange={e => setVitals({...vitals, glucose: e.target.value})} className={inputClass} />
                    </div>
                    {glucoseFlag && glucoseFlag.level === 'critical' && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-bold">
                            ⚠️ <strong>Critical Glucose Level.</strong> Client needs immediate evaluation. Check for diabetic emergency symptoms.
                        </div>
                    )}
                </div>

                {/* Other Vitals */}
                <div className="p-6 bg-white border border-zinc-100 shadow-elevation-1 rounded-2xl space-y-4">
                    <h4 className="font-bold text-zinc-900">Additional Vitals</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Heart Rate (BPM)</label>
                            <input type="number" placeholder="72" value={vitals.heartRate} onChange={e => setVitals({...vitals, heartRate: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Temperature (°F)</label>
                            <input type="number" step="0.1" placeholder="98.6" value={vitals.temperature} onChange={e => setVitals({...vitals, temperature: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Oxygen Saturation (%)</label>
                            <input type="number" placeholder="98" value={vitals.oxygenSat} onChange={e => setVitals({...vitals, oxygenSat: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Weight (lbs)</label>
                            <input type="number" placeholder="150" value={vitals.weight} onChange={e => setVitals({...vitals, weight: e.target.value})} className={inputClass} />
                        </div>
                    </div>
                </div>

                {/* Notes & Follow-up */}
                <div className="p-6 bg-white border border-zinc-100 shadow-elevation-1 rounded-2xl space-y-4">
                    <h4 className="font-bold text-zinc-900">Notes & Follow-up</h4>
                    <div>
                        <label className={labelClass}>Clinical Notes</label>
                        <textarea rows={3} placeholder="Any observations, client concerns, or recommendations..." value={vitals.notes} onChange={e => setVitals({...vitals, notes: e.target.value})} className={inputClass} />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={vitals.followUpNeeded || hasFlags} onChange={e => setVitals({...vitals, followUpNeeded: e.target.checked})} className="w-5 h-5 rounded" />
                        <span className="font-bold text-zinc-700">Follow-up needed</span>
                        {hasFlags && <span className="text-xs text-amber-600 font-bold">(Auto-flagged due to abnormal vitals)</span>}
                    </label>
                    {(vitals.followUpNeeded || hasFlags) && (
                        <input type="text" placeholder="Reason for follow-up..." value={vitals.followUpReason} onChange={e => setVitals({...vitals, followUpReason: e.target.value})} className={inputClass} />
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                    <button type="button" onClick={() => onComplete()} className="flex-1 py-4 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded-2xl text-sm font-bold">Cancel</button>
                    <button type="submit" disabled={isSaving || (!vitals.systolic && !vitals.glucose)} className="flex-1 py-4 bg-brand text-white rounded-2xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                        {isSaving ? <><Loader2 className="animate-spin" size={16} /> Saving...</> : <><CheckCircle size={16} /> Save Screening</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

const AccessGate: React.FC<{ requiredTraining: string }> = ({ requiredTraining }) => (
    <div className="flex flex-col items-center justify-center text-center p-8">
        <div className="p-6 bg-rose-100 rounded-full text-rose-600 mb-6 border-2 border-rose-200">
            <HeartPulse size={48} />
        </div>
        <h3 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Access Denied</h3>
        <p className="text-zinc-500 max-w-sm mt-2">Your current profile does not have the required training clearances for this station. Please complete the "{requiredTraining}" module in the Training Academy.</p>
    </div>
);


export default HealthScreeningsView;