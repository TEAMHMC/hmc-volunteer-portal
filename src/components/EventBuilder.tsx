
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Opportunity, ServiceOffering } from '../types';
import { SERVICE_OFFERINGS, EVENT_CATEGORIES } from '../constants';
import { geminiService } from '../services/geminiService';
import { APP_CONFIG } from '../config';
import { X, Calendar, MapPin, Users, Plus, Trash2, Save, Loader2, CheckCircle, Package, Sparkles, Copy, Check, Image, Upload, AlertTriangle, ShieldCheck, Tent, Stethoscope, ClipboardList } from 'lucide-react';

// Equipment/resource catalog for event assembly
const EQUIPMENT_CATALOG = [
  { id: 'eq-tables', name: 'Folding Tables', category: 'Setup', defaultQty: 4 },
  { id: 'eq-chairs', name: 'Chairs', category: 'Setup', defaultQty: 20 },
  { id: 'eq-canopy', name: 'Pop-Up Canopy / Tent', category: 'Setup', defaultQty: 2 },
  { id: 'eq-signage', name: 'Event Signage & Banners', category: 'Setup', defaultQty: 3 },
  { id: 'eq-tablecloths', name: 'Tablecloths', category: 'Setup', defaultQty: 4 },
  { id: 'eq-generator', name: 'Portable Generator', category: 'Setup', defaultQty: 1 },
  { id: 'eq-cooler', name: 'Coolers (water/snacks)', category: 'Setup', defaultQty: 2 },
  { id: 'eq-gloves', name: 'Nitrile Gloves (box)', category: 'PPE', defaultQty: 4 },
  { id: 'eq-masks', name: 'Face Masks (box)', category: 'PPE', defaultQty: 2 },
  { id: 'eq-sanitizer', name: 'Hand Sanitizer', category: 'PPE', defaultQty: 6 },
  { id: 'eq-gowns', name: 'Disposable Gowns (pack)', category: 'PPE', defaultQty: 1 },
  { id: 'eq-bpcuff', name: 'Blood Pressure Cuffs', category: 'Medical', defaultQty: 4 },
  { id: 'eq-glucometer', name: 'Glucometers + Strips', category: 'Medical', defaultQty: 2 },
  { id: 'eq-pulseox', name: 'Pulse Oximeters', category: 'Medical', defaultQty: 2 },
  { id: 'eq-scale', name: 'Digital Scale', category: 'Medical', defaultQty: 1 },
  { id: 'eq-stadiometer', name: 'Height Measurement Tool', category: 'Medical', defaultQty: 1 },
  { id: 'eq-firstaid', name: 'First Aid Kit', category: 'Medical', defaultQty: 2 },
  { id: 'eq-sharps', name: 'Sharps Container', category: 'Medical', defaultQty: 1 },
  { id: 'eq-laptop', name: 'Laptops / Tablets', category: 'Tech', defaultQty: 3 },
  { id: 'eq-hotspot', name: 'Mobile Hotspot', category: 'Tech', defaultQty: 1 },
  { id: 'eq-speaker', name: 'Portable Speaker / PA', category: 'Tech', defaultQty: 1 },
  { id: 'eq-flyers', name: 'Event Flyers (stack)', category: 'Outreach', defaultQty: 200 },
  { id: 'eq-brochures', name: 'Health Education Brochures', category: 'Outreach', defaultQty: 100 },
  { id: 'eq-signin', name: 'Sign-In Sheets', category: 'Outreach', defaultQty: 10 },
  { id: 'eq-pens', name: 'Pens / Markers', category: 'Outreach', defaultQty: 20 },
  { id: 'eq-clipboards', name: 'Clipboards', category: 'Outreach', defaultQty: 10 },
  { id: 'eq-bags', name: 'Goodie Bags / Totes', category: 'Outreach', defaultQty: 50 },
];

interface EquipmentItem {
  equipmentId: string;
  name: string;
  quantity: number;
}

interface EventBuilderProps {
    onClose: () => void;
    onSave: (newEvent: Omit<Opportunity, 'id'>) => Promise<void>;
}

const EventBuilder: React.FC<EventBuilderProps> = ({ onClose, onSave }) => {
    const [eventData, setEventData] = useState<Partial<Omit<Opportunity, 'id'>> & { startTime?: string; endTime?: string }>({
        title: '',
        description: '',
        category: 'Health Fair',
        serviceLocation: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '14:00',
        serviceOfferingIds: [],
        staffingQuotas: [],
        isPublic: true,
        isPublicFacing: true,
        estimatedAttendees: 100,
        supplyList: '',
        flyerBase64: '',
    });
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem[]>([]);
    const [checklist, setChecklist] = useState<{ text: string; done: boolean }[]>([
        { text: 'Venue confirmed and reserved', done: false },
        { text: 'Flyer designed and approved', done: false },
        { text: 'All volunteer slots filled', done: false },
        { text: 'Clinical lead assigned (if screenings)', done: false },
        { text: 'Supplies packed and loaded', done: false },
        { text: 'Emergency contact list printed', done: false },
    ]);
    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isGeneratingSupplies, setIsGeneratingSupplies] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [flyerPreview, setFlyerPreview] = useState<string | null>(null);
    const [flyerFileName, setFlyerFileName] = useState<string>('');
    const flyerInputRef = useRef<HTMLInputElement>(null);

    const handleFlyerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setSaveError('Please upload an image file (PNG, JPG, etc.)');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setSaveError('File size must be less than 5MB');
            return;
        }

        setFlyerFileName(file.name);

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setFlyerPreview(base64);
            // Store just the base64 data without the data URL prefix for storage
            setEventData(prev => ({ ...prev, flyerBase64: base64 }));
        };
        reader.readAsDataURL(file);
    };

    const removeFlyerPreview = () => {
        setFlyerPreview(null);
        setFlyerFileName('');
        setEventData(prev => ({ ...prev, flyerBase64: '' }));
        if (flyerInputRef.current) {
            flyerInputRef.current.value = '';
        }
    };

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

    const [saveError, setSaveError] = useState('');

    // Format 24h time to 12h display: "14:00" -> "2:00 PM"
    const formatTime12h = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    const handleSaveEvent = async () => {
        setIsSaving(true);
        setSaveError('');
        try {
            // Build human-readable time string from startTime/endTime
            const start = eventData.startTime || '09:00';
            const end = eventData.endTime || '14:00';
            const timeDisplay = `${formatTime12h(start)} - ${formatTime12h(end)}`;

            const finalEventData = {
                ...eventData,
                time: timeDisplay,
                address: eventData.address || eventData.serviceLocation || '',
                slotsTotal: eventData.staffingQuotas?.reduce((sum, q) => sum + q.count, 0) || 0,
                slotsFilled: 0,
                urgency: 'medium',
                requiredSkills: [],
                tenantId: APP_CONFIG.TENANT_ID,
                approvalStatus: 'pending',
                createdAt: new Date().toISOString(),
                equipment: selectedEquipment,
                checklist: checklist.filter(c => c.text.trim()),
                requiresClinicalLead: hasClinicalService,
            };
            await onSave(finalEventData as Omit<Opportunity, 'id'>);
            setIsSuccess(true);
            setTimeout(onClose, 2000);
        } catch (error) {
            setSaveError(`Failed to save event: ${(error as Error).message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleGenerateSupplies = async () => {
        if (!eventData.estimatedAttendees || !eventData.serviceOfferingIds?.length) {
            setSaveError("Please estimate attendees and select at least one service.");
            return;
        }
        setIsGeneratingSupplies(true);
        try {
            const serviceNames = eventData.serviceOfferingIds.map(id => SERVICE_OFFERINGS.find(s => s.id === id)?.name || '').filter(Boolean);
            const list = await geminiService.generateSupplyList(serviceNames, eventData.estimatedAttendees);
            setEventData(prev => ({ ...prev, supplyList: list }));
        } catch(e) {
            console.error(e);
            setSaveError("Failed to generate supply list.");
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

    // Detect if clinical services are selected but no LMP in staffing
    const hasClinicalService = eventData.serviceOfferingIds?.some(id =>
        ['so-screening', 'so-vaccine', 'so-mental-health'].includes(id)
    );
    const hasLMP = eventData.staffingQuotas?.some(q =>
        q.role === 'Licensed Medical Professional' && q.count > 0
    );
    const clinicalWarning = hasClinicalService && !hasLMP;

    const handleToggleEquipment = (item: typeof EQUIPMENT_CATALOG[0]) => {
        setSelectedEquipment(prev => {
            const exists = prev.find(e => e.equipmentId === item.id);
            if (exists) return prev.filter(e => e.equipmentId !== item.id);
            return [...prev, { equipmentId: item.id, name: item.name, quantity: item.defaultQty }];
        });
    };

    const handleEquipmentQtyChange = (equipmentId: string, qty: number) => {
        setSelectedEquipment(prev => prev.map(e =>
            e.equipmentId === equipmentId ? { ...e, quantity: Math.max(0, qty) } : e
        ));
    };

    const handleToggleChecklist = (idx: number) => {
        setChecklist(prev => prev.map((item, i) => i === idx ? { ...item, done: !item.done } : item));
    };

    const handleAddChecklistItem = () => {
        setChecklist(prev => [...prev, { text: '', done: false }]);
    };

    const handleUpdateChecklistItem = (idx: number, text: string) => {
        setChecklist(prev => prev.map((item, i) => i === idx ? { ...item, text } : item));
    };

    const handleRemoveChecklistItem = (idx: number) => {
        setChecklist(prev => prev.filter((_, i) => i !== idx));
    };

    // Group equipment by category
    const equipmentByCategory = useMemo(() => {
        const groups: Record<string, typeof EQUIPMENT_CATALOG> = {};
        EQUIPMENT_CATALOG.forEach(item => {
            if (!groups[item.category]) groups[item.category] = [];
            groups[item.category].push(item);
        });
        return groups;
    }, []);

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
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1">Event Type</label>
                                <select value={eventData.category} onChange={e => setEventData({...eventData, category: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                                    {EVENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1">Location Name</label>
                                <input type="text" placeholder="e.g., East LA Library" value={eventData.serviceLocation || ''} onChange={e => setEventData({...eventData, serviceLocation: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-1">Full Address</label>
                            <input type="text" placeholder="e.g., 123 W. Manchester Blvd, Inglewood, CA 90301" value={(eventData as any).address || ''} onChange={e => setEventData({...eventData, address: e.target.value} as any)} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg"/>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1">Date</label>
                                <input type="date" value={eventData.date} onChange={e => setEventData({...eventData, date: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1">Start Time</label>
                                <input type="time" value={eventData.startTime || '09:00'} onChange={e => setEventData({...eventData, startTime: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1">End Time</label>
                                <input type="time" value={eventData.endTime || '14:00'} onChange={e => setEventData({...eventData, endTime: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg"/>
                            </div>
                        </div>

                        {/* Event Flyer Upload */}
                        <div className="mt-4">
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Event Flyer</label>
                            <input
                                ref={flyerInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFlyerUpload}
                                className="hidden"
                                id="flyer-upload"
                            />
                            {flyerPreview ? (
                                <div className="relative border-2 border-dashed border-zinc-300 rounded-xl p-4 bg-zinc-50">
                                    <div className="flex items-start gap-4">
                                        <img
                                            src={flyerPreview}
                                            alt="Event Flyer Preview"
                                            className="w-32 h-32 object-cover rounded-lg shadow-md"
                                        />
                                        <div className="flex-1">
                                            <p className="font-bold text-zinc-900">{flyerFileName}</p>
                                            <p className="text-xs text-zinc-500 mt-1">Flyer will be displayed on the event page</p>
                                            <div className="flex gap-2 mt-3">
                                                <label
                                                    htmlFor="flyer-upload"
                                                    className="px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-zinc-300 transition-colors"
                                                >
                                                    Replace
                                                </label>
                                                <button
                                                    onClick={removeFlyerPreview}
                                                    className="px-4 py-2 bg-rose-100 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-200 transition-colors flex items-center gap-1"
                                                >
                                                    <Trash2 size={12} /> Remove
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <label
                                    htmlFor="flyer-upload"
                                    className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-zinc-300 rounded-xl cursor-pointer bg-zinc-50 hover:bg-zinc-100 hover:border-[#233DFF]/50 transition-all group"
                                >
                                    <div className="flex flex-col items-center justify-center py-6">
                                        <div className="w-12 h-12 rounded-xl bg-zinc-200 group-hover:bg-[#233DFF]/10 flex items-center justify-center mb-3 transition-colors">
                                            <Upload size={24} className="text-zinc-400 group-hover:text-[#233DFF]" />
                                        </div>
                                        <p className="mb-1 text-sm font-bold text-zinc-600">
                                            <span className="text-[#233DFF]">Click to upload</span> event flyer
                                        </p>
                                        <p className="text-xs text-zinc-400">PNG, JPG up to 5MB</p>
                                    </div>
                                </label>
                            )}
                        </div>
                    </div>
                </section>

                {/* Service Offerings */}
                <section>
                     <h3 className="text-lg font-bold mb-4">2. Service Offerings</h3>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {SERVICE_OFFERINGS.map(service => (
                            <button key={service.id} onClick={() => handleServiceToggle(service.id)} className={`p-4 border-2 rounded-lg text-left ${eventData.serviceOfferingIds?.includes(service.id) ? 'border-[#233DFF] bg-[#233DFF]/5' : 'bg-white'}`}>
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
                
                {/* Clinical Lead Warning */}
                {clinicalWarning && (
                    <div className="flex items-start gap-4 p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl">
                        <AlertTriangle size={24} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-amber-800">Clinical Lead Required</p>
                            <p className="text-sm text-amber-700 mt-1">
                                This event includes clinical services (screenings, vaccinations, or mental health support).
                                At least one Licensed Medical Professional must be assigned before the event can proceed.
                                Add an LMP to staffing above or remove clinical services.
                            </p>
                        </div>
                    </div>
                )}

                {/* Equipment & Resources */}
                <section>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Package size={20} /> 4. Equipment & Resources
                    </h3>
                    <p className="text-sm text-zinc-500 mb-4">Select the equipment and resources needed for this event. Adjust quantities as needed.</p>
                    <div className="space-y-6">
                        {Object.entries(equipmentByCategory).map(([category, items]) => (
                            <div key={category}>
                                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">{category}</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {items.map(item => {
                                        const selected = selectedEquipment.find(e => e.equipmentId === item.id);
                                        return (
                                            <div key={item.id} className={`p-3 border-2 rounded-xl cursor-pointer transition-all ${
                                                selected ? 'border-[#233DFF] bg-[#233DFF]/5' : 'border-zinc-100 hover:border-zinc-300'
                                            }`}>
                                                <div className="flex items-center justify-between">
                                                    <button
                                                        onClick={() => handleToggleEquipment(item)}
                                                        className="flex-1 text-left"
                                                    >
                                                        <p className={`text-sm font-bold ${selected ? 'text-[#233DFF]' : 'text-zinc-700'}`}>{item.name}</p>
                                                    </button>
                                                    {selected && (
                                                        <input
                                                            type="number"
                                                            value={selected.quantity}
                                                            onChange={e => handleEquipmentQtyChange(item.id, parseInt(e.target.value) || 0)}
                                                            className="w-14 p-1 text-center text-sm border border-zinc-200 rounded-lg bg-white"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    {selectedEquipment.length > 0 && (
                        <div className="mt-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                            <p className="text-xs font-bold text-zinc-500 mb-2">{selectedEquipment.length} items selected</p>
                            <div className="flex flex-wrap gap-2">
                                {selectedEquipment.map(item => (
                                    <span key={item.equipmentId} className="px-3 py-1 bg-[#233DFF]/10 text-[#233DFF] rounded-full text-xs font-bold">
                                        {item.name} x{item.quantity}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* Event Checklist */}
                <section>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <ClipboardList size={20} /> 5. Pre-Event Checklist
                    </h3>
                    <div className="p-6 bg-zinc-50 rounded-lg border border-zinc-200 space-y-3">
                        {checklist.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 group">
                                <button
                                    onClick={() => handleToggleChecklist(idx)}
                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                                        item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 hover:border-[#233DFF]'
                                    }`}
                                >
                                    {item.done && <Check size={14} />}
                                </button>
                                <input
                                    value={item.text}
                                    onChange={e => handleUpdateChecklistItem(idx, e.target.value)}
                                    className={`flex-1 bg-transparent outline-none text-sm ${item.done ? 'line-through text-zinc-400' : 'text-zinc-700'}`}
                                    placeholder="Checklist item..."
                                />
                                <button
                                    onClick={() => handleRemoveChecklistItem(idx)}
                                    className="p-1 text-zinc-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={handleAddChecklistItem}
                            className="flex items-center gap-2 text-sm font-bold text-[#233DFF] hover:bg-[#233DFF]/5 px-3 py-2 rounded-lg mt-2"
                        >
                            <Plus size={14} /> Add Item
                        </button>
                    </div>
                </section>

                {/* Logistics & Supplies */}
                 <section>
                    <h3 className="text-lg font-bold mb-4">6. Logistics & Supplies</h3>
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
            <footer className="p-8 border-t border-zinc-100 space-y-4">
                {saveError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 font-medium flex items-center gap-2">
                        <AlertTriangle size={16} className="shrink-0" /> {saveError}
                    </div>
                )}
                <div className="flex justify-end">
                    <button onClick={handleSaveEvent} disabled={isSaving || !eventData.title} className="flex items-center gap-3 px-6 py-4 bg-[#233DFF] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg hover:bg-[#1a2fbf] disabled:opacity-50">
                        {isSaving ? <Loader2 className="animate-spin" size={16}/> : <><Save size={16}/> Save Event</>}
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default EventBuilder;
