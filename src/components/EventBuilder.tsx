
import React, { useState, useEffect, useMemo } from 'react';
import { Opportunity, ServiceOffering } from '../types';
import { SERVICE_OFFERINGS } from '../constants';
import { geminiService } from '../services/geminiService';
import { APP_CONFIG } from '../config';
import { X, Calendar, MapPin, Users, Plus, Trash2, Save, Loader2, CheckCircle, Package, Sparkles, Copy, Check } from 'lucide-react';

interface EventBuilderProps {
    onClose: () => void;
    onSave: (newEvent: Omit<Opportunity, 'id'>) => Promise<void>;
}

const EventBuilder: React.FC<EventBuilderProps> = ({ onClose, onSave }) => {
    const [eventData, setEventData] = useState<Partial<Omit<Opportunity, 'id'>>>({
        title: '',
        description: '',
        category: 'Health Fair',
        serviceLocation: '',
        date: new Date().toISOString().split('T')[0],
        serviceOfferingIds: [],
        staffingQuotas: [],
        isPublic: true,
        isPublicFacing: true,
        estimatedAttendees: 100,
        supplyList: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isGeneratingSupplies, setIsGeneratingSupplies] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        const calculateQuotas = () => {
            const quotas: { [key: string]: number } = {};
            eventData.serviceOfferingIds?.forEach(serviceId => {
                const service = SERVICE_OFFERINGS.find(s => s.id === serviceId);
                service?.requiredRoles.forEach(req => {
                    quotas[req.role] = (quotas[req.role] || 0) + req.count;
                });
            });

            const newQuotas = Object.entries(quotas).map(([role, count]) => ({
                role,
                count,
                filled: 0
            }));

            setEventData(prev => ({ ...prev, staffingQuotas: newQuotas }));
        };
        calculateQuotas();
    }, [eventData.serviceOfferingIds]);

    const handleServiceToggle = (serviceId: string) => {
        setEventData(prev => {
            const currentIds = prev.serviceOfferingIds || [];
            const newIds = currentIds.includes(serviceId)
                ? currentIds.filter(id => id !== serviceId)
                : [...currentIds, serviceId];
            return { ...prev, serviceOfferingIds: newIds };
        });
    };
    
    const handleQuotaChange = (role: string, newCount: number) => {
        setEventData(prev => ({
            ...prev,
            staffingQuotas: prev.staffingQuotas?.map(q => q.role === role ? { ...q, count: Math.max(0, newCount) } : q)
        }));
    };

    const handleSaveEvent = async () => {
        setIsSaving(true);
        try {
            const finalEventData = {
                ...eventData,
                slotsTotal: eventData.staffingQuotas?.reduce((sum, q) => sum + q.count, 0) || 0,
                slotsFilled: 0,
                urgency: 'medium', // Default
                requiredSkills: [], // Default
                tenantId: APP_CONFIG.TENANT_ID,
            };
            await onSave(finalEventData as Omit<Opportunity, 'id'>);
            setIsSuccess(true);
            setTimeout(onClose, 2000);
        } catch (error) {
            alert(`Failed to save event: ${(error as Error).message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleGenerateSupplies = async () => {
        if (!eventData.estimatedAttendees || !eventData.serviceOfferingIds?.length) {
            alert("Please estimate attendees and select at least one service.");
            return;
        }
        setIsGeneratingSupplies(true);
        try {
            const serviceNames = eventData.serviceOfferingIds.map(id => SERVICE_OFFERINGS.find(s => s.id === id)?.name || '').filter(Boolean);
            const list = await geminiService.generateSupplyList(serviceNames, eventData.estimatedAttendees);
            setEventData(prev => ({ ...prev, supplyList: list }));
        } catch(e) {
            console.error(e);
            alert("Failed to generate supply list.");
        } finally {
            setIsGeneratingSupplies(false);
        }
    };

    const handleCopyList = () => {
        if(!eventData.supplyList) return;
        navigator.clipboard.writeText(eventData.supplyList);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }

    if(isSuccess) {
        return (
             <div className="fixed inset-0 bg-white z-[2000] flex items-center justify-center animate-in fade-in">
                <div className="text-center">
                    <CheckCircle size={64} className="mx-auto text-emerald-500" />
                    <h2 className="text-2xl font-bold mt-4">Event Created!</h2>
                    <p className="text-zinc-500">Automated workflows have been triggered.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-white z-[2000] flex flex-col animate-in fade-in">
            <header className="p-8 border-b border-zinc-100 flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Create New Event</h2>
                <button onClick={onClose} className="p-3 bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-800"><X size={20} /></button>
            </header>
            <main className="flex-1 p-8 md:p-12 overflow-y-auto space-y-10">
                {/* Basic Details */}
                <section>
                    <h3 className="text-lg font-bold mb-4">1. Event Details</h3>
                    <div className="space-y-4">
                        <input type="text" placeholder="Event Title" value={eventData.title} onChange={e => setEventData({...eventData, title: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg"/>
                        <textarea placeholder="Description" value={eventData.description} onChange={e => setEventData({...eventData, description: e.target.value})} className="w-full h-24 p-3 bg-zinc-50 border border-zinc-200 rounded-lg"/>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="date" value={eventData.date} onChange={e => setEventData({...eventData, date: e.target.value})} className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg"/>
                            <input type="text" placeholder="Location (e.g., East LA Library)" value={eventData.serviceLocation || ''} onChange={e => setEventData({...eventData, serviceLocation: e.target.value})} className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg"/>
                        </div>
                    </div>
                </section>

                {/* Service Offerings */}
                <section>
                     <h3 className="text-lg font-bold mb-4">2. Service Offerings</h3>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {SERVICE_OFFERINGS.map(service => (
                            <button key={service.id} onClick={() => handleServiceToggle(service.id)} className={`p-4 border-2 rounded-lg text-left ${eventData.serviceOfferingIds?.includes(service.id) ? 'border-blue-500 bg-blue-50' : 'bg-white'}`}>
                                <h4 className="font-bold">{service.name}</h4>
                                <p className="text-xs text-zinc-500">{service.description}</p>
                            </button>
                        ))}
                     </div>
                </section>
                
                {/* Staffing Quotas */}
                <section>
                    <h3 className="text-lg font-bold mb-4">3. Required Staffing</h3>
                    <div className="p-6 bg-zinc-50 rounded-lg border border-zinc-200 space-y-4">
                        {eventData.staffingQuotas?.length === 0 && <p className="text-center text-zinc-400">Select services to automatically add staffing requirements.</p>}
                        {eventData.staffingQuotas?.map(quota => (
                            <div key={quota.role} className="flex items-center justify-between">
                                <p className="font-bold">{quota.role}</p>
                                <div className="flex items-center gap-2">
                                    <input type="number" value={quota.count} onChange={e => handleQuotaChange(quota.role, parseInt(e.target.value, 10))} className="w-16 p-2 text-center bg-white border rounded-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                
                {/* Logistics & Supplies */}
                 <section>
                    <h3 className="text-lg font-bold mb-4">4. Logistics & Supplies</h3>
                    <div className="p-6 bg-zinc-50 rounded-lg border border-zinc-200 space-y-4">
                        <input type="number" placeholder="Estimated Attendees" value={eventData.estimatedAttendees || ''} onChange={e => setEventData({...eventData, estimatedAttendees: parseInt(e.target.value, 10) || 0})} className="w-full p-3 bg-white border border-zinc-200 rounded-lg"/>
                        <button onClick={handleGenerateSupplies} disabled={isGeneratingSupplies} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border border-zinc-200 text-zinc-700 rounded-full text-xs font-black uppercase tracking-widest shadow-sm hover:bg-zinc-100 disabled:opacity-50">
                            {isGeneratingSupplies ? <Loader2 className="animate-spin" size={16}/> : <><Sparkles size={16}/> Generate Supply Suggestions</>}
                        </button>
                        {(isGeneratingSupplies || eventData.supplyList) && (
                            <div className="pt-4">
                                <textarea value={eventData.supplyList} onChange={e => setEventData({...eventData, supplyList: e.target.value})} className="w-full h-64 p-4 bg-white border border-zinc-200 rounded-lg font-mono text-xs" placeholder="Generating supply list..."/>
                                <button onClick={handleCopyList} className="mt-2 flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-900">
                                  {isCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy List</>}
                                </button>
                            </div>
                        )}
                    </div>
                </section>

            </main>
            <footer className="p-8 border-t border-zinc-100 flex justify-end">
                <button onClick={handleSaveEvent} disabled={isSaving || !eventData.title} className="flex items-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 disabled:opacity-50">
                    {isSaving ? <Loader2 className="animate-spin" size={16}/> : <><Save size={16}/> Save Event</>}
                </button>
            </footer>
        </div>
    );
};

export default EventBuilder;
