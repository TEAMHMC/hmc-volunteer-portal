
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Opportunity, Shift, Volunteer } from '../types';
import { analyticsService } from '../services/analyticsService';
import { Clock, Check, Calendar, MapPin, ChevronRight, UserPlus, XCircle, Mail, Plus, Users, Upload, X, FileText, Loader2, Download, Pencil, Trash2, RefreshCw, Package, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import { EVENT_CATEGORIES, SERVICE_OFFERINGS, TIER_1_IDS, TIER_2_CORE_IDS, PROGRAM_TRAINING_REQUIREMENTS, hasCompletedAllModules, ALL_TRAINING_MODULES } from '../constants';
import { APP_CONFIG } from '../config';
import EventOpsMode from './EventOpsMode';
import EventBuilder from './EventBuilder';
import StaffingSuggestions from './StaffingSuggestions';
import { apiService } from '../services/apiService';
import { toastService } from '../services/toastService';
import { AlertTriangle } from 'lucide-react';

// Map event category to program training requirement key
const getCategoryProgram = (category: string): string | null => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('street medicine') || cat.includes('smo')) return 'street_medicine';
  if (cat.includes('clinic') || cat.includes('clinical')) return 'clinical';
  if (cat.includes('wellness') || cat.includes('unstoppable') || cat.includes('workshop')) return 'community_wellness';
  if (cat.includes('outreach') || cat.includes('health fair') || cat.includes('pop-up') || cat.includes('tabling')) return 'community_health_outreach';
  return null;
};

// Get missing program training names for display
const getMissingProgramTraining = (completedIds: string[], program: string): string[] => {
  const requiredIds = PROGRAM_TRAINING_REQUIREMENTS[program] || [];
  const missingIds = requiredIds.filter(id => !completedIds.includes(id));
  return missingIds.map(id => {
    const mod = ALL_TRAINING_MODULES.find(m => m.id === id);
    return mod ? mod.title : id;
  });
};

const PROGRAM_LABELS: Record<string, string> = {
  street_medicine: 'Street Medicine',
  clinical: 'Clinical Services',
  community_wellness: 'Community Wellness',
  community_health_outreach: 'Community Health Outreach',
};

// Normalize event category for consistent display (shared logic with EventExplorer)
const normalizeCategory = (cat: string): string => {
  const lower = (cat || '').toLowerCase().replace(/[^\w\s&]/g, '').trim();
  if (!lower) return 'Other';
  if (lower.includes('walk') && lower.includes('run')) return 'Community Run & Walk';
  if (lower.includes('5k')) return 'Community Run & Walk';
  if (lower.includes('workshop')) return 'Workshop';
  if (lower.includes('fair')) return 'Health Fair';
  if (lower.includes('street medicine')) return 'Street Medicine';
  if (lower.includes('survey')) return 'Survey Collection';
  if (lower.includes('tabling')) return 'Tabling';
  if (lower.includes('outreach')) return 'Community Outreach';
  if (lower.includes('education')) return 'Wellness Education';
  if (lower.includes('wellness meetup') || lower.includes('unstoppable wellness')) return 'Wellness';
  if (lower.includes('wellness')) return 'Wellness';
  return 'Other';
};

// Event Day Check-in Panel — shows public RSVP stats and allows manual check-in
const EventDayCheckin: React.FC<{ eventId: string; eventDate: string }> = ({ eventId, eventDate }) => {
  const [stats, setStats] = useState<any>(null);
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Only show for events today or in the past (event day or post-event)
  const today = new Date().toISOString().split('T')[0];
  const isEventDayOrPast = eventDate <= today;

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await apiService.get(`/api/events/${eventId}/rsvp-stats`);
      setStats(data);
    } catch {
      // No public RSVPs for this event — that's ok
    }
    try {
      const data = await apiService.get(`/api/events/${eventId}/public-rsvps`);
      if (Array.isArray(data)) setRsvps(data);
    } catch {
      // Endpoint may not exist yet — graceful
    }
    setLoading(false);
  };

  const handleManualCheckin = async (rsvpId: string) => {
    try {
      await apiService.post(`/api/events/${eventId}/manual-checkin`, { rsvpId });
      setRsvps(prev => prev.map(r => r.id === rsvpId ? { ...r, checkedIn: true, checkedInAt: new Date().toISOString() } : r));
      if (stats) setStats({ ...stats, checkedInCount: (stats.checkedInCount || 0) + 1 });
    } catch (err) {
      console.error('Manual check-in failed:', err);
      toastService.error('Check-in failed. Please try again.');
    }
  };

  // Auto-refresh check-in stats when panel is expanded
  useEffect(() => {
    if (!expanded) return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [expanded, eventId]);

  if (!isEventDayOrPast) return null;

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100">
      <button
        onClick={() => { setExpanded(!expanded); if (!expanded) fetchStats(); }}
        className="flex items-center gap-2 text-[10px] font-black text-brand uppercase tracking-[0.2em] hover:underline"
      >
        <ClipboardList size={12} />
        {expanded ? 'Hide' : 'Show'} Event Day Check-in
        {stats && <span className="text-zinc-400 normal-case">({stats.checkedInCount || 0}/{stats.totalRsvps || 0} checked in)</span>}
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 size={14} className="animate-spin" /> Loading...</div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-50 p-2 rounded-2xl text-center border border-zinc-100 shadow-elevation-1">
                  <p className="text-lg font-bold text-blue-700">{stats.totalRsvps || 0}</p>
                  <p className="text-[9px] text-blue-500 font-bold uppercase">RSVPs</p>
                </div>
                <div className="bg-emerald-50 p-2 rounded-2xl text-center border border-zinc-100 shadow-elevation-1">
                  <p className="text-lg font-bold text-emerald-700">{stats.checkedInCount || 0}</p>
                  <p className="text-[9px] text-emerald-500 font-bold uppercase">Checked In</p>
                </div>
                <div className="bg-amber-50 p-2 rounded-2xl text-center border border-zinc-100 shadow-elevation-1">
                  <p className="text-lg font-bold text-amber-700">{stats.totalExpectedAttendees || 0}</p>
                  <p className="text-[9px] text-amber-500 font-bold uppercase">Expected</p>
                </div>
              </div>
              {rsvps.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {rsvps.map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-xs">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${r.checkedIn ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                        {r.checkedIn ? <Check size={10} /> : r.name?.charAt(0) || '?'}
                      </div>
                      <span className={`flex-1 truncate ${r.checkedIn ? 'text-zinc-400 line-through' : 'text-zinc-700'}`}>{r.name}</span>
                      {r.guests > 0 && <span className="text-[9px] text-zinc-400">+{r.guests}</span>}
                      {!r.checkedIn && (
                        <button
                          onClick={() => handleManualCheckin(r.id)}
                          className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold hover:bg-emerald-200"
                        >
                          Check In
                        </button>
                      )}
                      {r.checkedIn && <span className="text-[9px] text-emerald-500 font-bold">Done</span>}
                    </div>
                  ))}
                </div>
              )}
              {rsvps.length === 0 && stats.totalRsvps > 0 && (
                <p className="text-xs text-zinc-400 italic">RSVP details loading...</p>
              )}
            </>
          ) : (
            <p className="text-xs text-zinc-400 italic">No public RSVPs for this event.</p>
          )}
        </div>
      )}
    </div>
  );
};

// Bulk Upload Modal for Events
const BulkUploadEventsModal: React.FC<{
  onClose: () => void;
  onComplete: (events: Opportunity[], shifts: Shift[]) => void;
}> = ({ onClose, onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ importedCount: number; shiftsCreated: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Please upload a CSV file');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvContent = e.target?.result as string;
          const base64 = btoa(unescape(encodeURIComponent(csvContent)));

          const response = await apiService.post('/api/events/bulk-import', { csvData: base64 });

          setResult({
            importedCount: response.importedCount,
            shiftsCreated: response.shiftsCreated
          });

          // Pass the new events and shifts back to parent
          if (response.events && response.shifts) {
            onComplete(response.events, response.shifts);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to import events');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      setError(err.message || 'Failed to read file');
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `title,date,location,category,description,slotsTotal,estimatedAttendees,staffingQuotas,urgency
"Spring Health Fair",2026-03-15,"East LA Community Center","Health Fair","Annual community health screening and wellness event",15,200,"Core Volunteer:10;Licensed Medical Professional:3;Medical Admin:2",high
"Wellness Workshop",2026-03-22,"Downtown Library","Wellness Education","Educational workshop on nutrition and exercise",5,50,"Core Volunteer:5",medium
"Street Medicine Outreach",2026-04-01,"Skid Row","Street Medicine","Mobile health services for underserved communities",8,30,"Core Volunteer:4;Licensed Medical Professional:2;Outreach Specialist:2",high`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'events_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-modal max-w-xl w-full shadow-elevation-3 border border-zinc-100">
        <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Bulk Import Events</h2>
            <p className="text-sm text-zinc-600 mt-1">Upload a CSV file to create multiple events at once</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {result ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Import Complete!</h3>
              <p className="text-sm text-zinc-600">
                Successfully imported <span className="font-bold text-emerald-600">{result.importedCount}</span> events
                with <span className="font-bold text-brand">{result.shiftsCreated}</span> volunteer shifts.
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-8 py-3 font-bold text-base bg-brand text-white border border-black rounded-full uppercase tracking-wide shadow-elevation-2 flex items-center justify-center gap-2 mx-auto"
              >
                <span className="w-2 h-2 rounded-full bg-white" /> Done
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 font-bold text-base bg-white text-zinc-900 border border-black rounded-full uppercase tracking-wide shadow-elevation-1 hover:opacity-80 transition-opacity"
              >
                <span className="w-2 h-2 rounded-full bg-zinc-950" />
                Download CSV Template
              </button>

              <div
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                  file ? 'border-emerald-300 bg-emerald-50' : 'border-zinc-200 hover:border-zinc-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText size={24} className="text-emerald-600" />
                    <span className="font-bold text-zinc-900">{file.name}</span>
                    <button
                      onClick={() => setFile(null)}
                      className="p-1 hover:bg-zinc-200 rounded-full"
                    >
                      <X size={16} className="text-zinc-400" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload size={40} className="mx-auto text-zinc-300 mb-4" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="font-bold text-brand hover:underline"
                    >
                      Click to upload
                    </button>
                    <span className="text-zinc-400"> or drag and drop</span>
                    <p className="text-xs text-zinc-400 mt-2">CSV files only</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-3xl text-rose-600 text-sm">
                  {error}
                </div>
              )}

              <div className="bg-zinc-50 p-4 rounded-3xl border border-zinc-100">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">CSV Format</p>
                <p className="text-xs text-zinc-500">
                  Required columns: <span className="font-mono">title, date, location</span><br />
                  Optional: <span className="font-mono">category, description, slotsTotal, estimatedAttendees, staffingQuotas, urgency</span><br />
                  Staffing format: <span className="font-mono">"Role:Count;Role:Count"</span>
                </p>
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 font-bold text-base bg-brand text-white border border-black rounded-full uppercase tracking-wide shadow-elevation-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Importing Events...
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white" />
                    Import Events
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Parse time from opp.time string like "5:00 PM - 7:00 PM" or shift startTime/endTime
const parseTimeForEdit = (opp: Opportunity, shifts: Shift[]): { start: string; end: string } => {
  // Try to parse from shift data first (most reliable — ISO format)
  const oppShift = shifts.find(s => s.opportunityId === opp.id);
  if (oppShift?.startTime && oppShift?.endTime) {
    const sTime = oppShift.startTime.split('T')[1];
    const eTime = oppShift.endTime.split('T')[1];
    if (sTime && eTime) return { start: sTime.substring(0, 5), end: eTime.substring(0, 5) };
  }
  // Try to parse from opp.time string like "5:00 PM - 7:00 PM"
  if (opp.time && opp.time !== 'TBD') {
    const rangeMatch = opp.time.match(/(\d{1,2}:\d{2})\s*(AM|PM)?\s*[-–]\s*(\d{1,2}:\d{2})\s*(AM|PM)?/i);
    if (rangeMatch) {
      let sH = parseInt(rangeMatch[1].split(':')[0]);
      const sM = rangeMatch[1].split(':')[1];
      if (rangeMatch[2]?.toUpperCase() === 'PM' && sH !== 12) sH += 12;
      if (rangeMatch[2]?.toUpperCase() === 'AM' && sH === 12) sH = 0;
      let eH = parseInt(rangeMatch[3].split(':')[0]);
      const eM = rangeMatch[3].split(':')[1];
      if (rangeMatch[4]?.toUpperCase() === 'PM' && eH !== 12) eH += 12;
      if (rangeMatch[4]?.toUpperCase() === 'AM' && eH === 12) eH = 0;
      return { start: `${String(sH).padStart(2,'0')}:${sM}`, end: `${String(eH).padStart(2,'0')}:${eM}` };
    }
    const singleMatch = opp.time.match(/(\d{1,2}:\d{2})\s*(AM|PM)?/i);
    if (singleMatch) {
      let h = parseInt(singleMatch[1].split(':')[0]);
      const m = singleMatch[1].split(':')[1];
      if (singleMatch[2]?.toUpperCase() === 'PM' && h !== 12) h += 12;
      if (singleMatch[2]?.toUpperCase() === 'AM' && h === 12) h = 0;
      return { start: `${String(h).padStart(2,'0')}:${m}`, end: `${String(Math.min(h+3,23)).padStart(2,'0')}:${m}` };
    }
  }
  return { start: '09:00', end: '14:00' };
};

// Edit Event Modal
// Equipment catalog for event editing
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

const equipmentByCategory: Record<string, typeof EQUIPMENT_CATALOG> = {};
EQUIPMENT_CATALOG.forEach(item => {
  if (!equipmentByCategory[item.category]) equipmentByCategory[item.category] = [];
  equipmentByCategory[item.category].push(item);
});

const EditEventModal: React.FC<{
  event: Opportunity;
  shifts: Shift[];
  onClose: () => void;
  onSave: (updates: Partial<Opportunity> & { startTime?: string; endTime?: string }) => void;
}> = ({ event, shifts, onClose, onSave }) => {
  const parsedTime = parseTimeForEdit(event, shifts);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [date, setDate] = useState(event.date);
  const [location, setLocation] = useState(event.serviceLocation);
  const [category, setCategory] = useState(event.category);
  const [startTime, setStartTime] = useState(parsedTime.start);
  const [endTime, setEndTime] = useState(parsedTime.end);
  const [estimatedAttendees, setEstimatedAttendees] = useState(event.estimatedAttendees || 100);
  const [quotas, setQuotas] = useState<{ role: string; count: number; filled: number }[]>(
    event.staffingQuotas?.length ? event.staffingQuotas.map(q => ({ ...q })) : []
  );
  const [serviceOfferingIds, setServiceOfferingIds] = useState<string[]>(event.serviceOfferingIds || []);
  const [selectedEquipment, setSelectedEquipment] = useState<{ equipmentId: string; name: string; quantity: number }[]>(event.equipment || []);
  const [checklist, setChecklist] = useState<{ text: string; done: boolean }[]>(
    event.checklist?.length ? event.checklist.map(c => ({ ...c })) : []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  const roleOptions = APP_CONFIG.HMC_ROLES.map(r => r.label);

  const handleAddQuota = () => {
    const usedRoles = quotas.map(q => q.role);
    const nextRole = roleOptions.find(r => !usedRoles.includes(r)) || roleOptions[0];
    setQuotas(prev => [...prev, { role: nextRole, count: 1, filled: 0 }]);
  };

  const handleRemoveQuota = (idx: number) => {
    setQuotas(prev => prev.filter((_, i) => i !== idx));
  };

  const handleQuotaChange = (idx: number, field: 'role' | 'count', value: string | number) => {
    setQuotas(prev => prev.map((q, i) => i === idx ? { ...q, [field]: field === 'count' ? Math.max(q.filled || 0, Number(value)) : value } : q));
  };

  const handleServiceToggle = (serviceId: string) => {
    setServiceOfferingIds(prev =>
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const slotsTotal = quotas.reduce((sum, q) => sum + q.count, 0);
      const fmt = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
      };
      const time = `${fmt(startTime)} - ${fmt(endTime)}`;
      const hasClinicalService = serviceOfferingIds?.some((id: string) =>
        ['so-screening', 'so-vaccine', 'so-mental-health'].includes(id)
      );
      await onSave({
        title, description, date, serviceLocation: location, category, startTime, endTime, time,
        estimatedAttendees, staffingQuotas: quotas, slotsTotal, serviceOfferingIds,
        equipment: selectedEquipment,
        checklist: checklist.filter(c => c.text.trim()),
        requiresClinicalLead: hasClinicalService || false,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-modal max-w-2xl w-full shadow-elevation-3 border border-zinc-100">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900">Edit Event</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X size={18} className="text-zinc-400" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-20 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Event Type</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm">
                {EVENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Location</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Estimated Attendees</label>
            <input type="number" value={estimatedAttendees} onChange={e => setEstimatedAttendees(parseInt(e.target.value) || 0)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
          </div>

          {/* Staffing Quotas */}
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Volunteer Staffing</label>
            <div className="space-y-2">
              {quotas.map((q, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={q.role}
                    onChange={e => handleQuotaChange(idx, 'role', e.target.value)}
                    className="flex-1 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm"
                  >
                    {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input
                    type="number"
                    min={Math.max(q.filled, 0)}
                    value={q.count}
                    onChange={e => handleQuotaChange(idx, 'count', e.target.value)}
                    className="w-20 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm text-center"
                  />
                  <span className="text-xs text-zinc-400 shrink-0">slots</span>
                  {q.filled > 0 && (
                    <span className="text-[10px] font-black text-emerald-600 shrink-0">{q.filled} filled</span>
                  )}
                  <button
                    onClick={() => handleRemoveQuota(idx)}
                    className="p-1.5 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors shrink-0"
                    title={q.filled > 0 ? 'Has assigned volunteers' : 'Remove role'}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleAddQuota}
              className="mt-2 flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-hover transition-colors"
            >
              <Plus size={14} /> Add Role
            </button>
          </div>

          {/* Service Offerings (collapsible) */}
          <div className="border border-zinc-200 rounded-3xl overflow-hidden">
            <button onClick={() => setShowServices(!showServices)} className="w-full flex items-center justify-between p-4 bg-zinc-50 hover:bg-zinc-100 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold text-zinc-700"><Users size={16} /> Service Offerings {serviceOfferingIds.length > 0 && <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full">{serviceOfferingIds.length} selected</span>}</span>
              {showServices ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
            </button>
            {showServices && (
              <div className="p-4 grid grid-cols-2 gap-2">
                {SERVICE_OFFERINGS.map(service => (
                  <button key={service.id} onClick={() => handleServiceToggle(service.id)} className={`p-3 border-2 rounded-2xl text-left transition-colors ${serviceOfferingIds.includes(service.id) ? 'border-brand bg-brand/5' : 'border-zinc-100 hover:border-zinc-300'}`}>
                    <p className="text-sm font-bold">{service.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{service.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Equipment & Resources (collapsible) */}
          <div className="border border-zinc-200 rounded-3xl overflow-hidden">
            <button onClick={() => setShowEquipment(!showEquipment)} className="w-full flex items-center justify-between p-4 bg-zinc-50 hover:bg-zinc-100 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold text-zinc-700"><Package size={16} /> Equipment & Resources {selectedEquipment.length > 0 && <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full">{selectedEquipment.length} items</span>}</span>
              {showEquipment ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
            </button>
            {showEquipment && (
              <div className="p-4 space-y-4">
                {Object.entries(equipmentByCategory).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">{cat}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {items.map(item => {
                        const selected = selectedEquipment.find(e => e.equipmentId === item.id);
                        return (
                          <div key={item.id} className={`p-2.5 border-2 rounded-2xl cursor-pointer transition-all ${selected ? 'border-brand bg-brand/5' : 'border-zinc-100 hover:border-zinc-300'}`}>
                            <div className="flex items-center justify-between">
                              <button onClick={() => handleToggleEquipment(item)} className="flex-1 text-left">
                                <p className={`text-xs font-bold ${selected ? 'text-brand' : 'text-zinc-700'}`}>{item.name}</p>
                              </button>
                              {selected && (
                                <input type="number" value={selected.quantity} onChange={e => handleEquipmentQtyChange(item.id, parseInt(e.target.value) || 0)} className="w-12 p-1 text-center text-xs border-2 border-zinc-100 rounded-2xl bg-zinc-50 font-bold" onClick={e => e.stopPropagation()} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pre-Event Checklist (collapsible) */}
          <div className="border border-zinc-200 rounded-3xl overflow-hidden">
            <button onClick={() => setShowChecklist(!showChecklist)} className="w-full flex items-center justify-between p-4 bg-zinc-50 hover:bg-zinc-100 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold text-zinc-700"><ClipboardList size={16} /> Pre-Event Checklist {checklist.length > 0 && <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full">{checklist.filter(c => c.done).length}/{checklist.length} done</span>}</span>
              {showChecklist ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
            </button>
            {showChecklist && (
              <div className="p-4 space-y-2">
                {checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 group">
                    <button
                      onClick={() => setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, done: !c.done } : c))}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 hover:border-brand'}`}
                    >
                      {item.done && <Check size={12} />}
                    </button>
                    <input
                      value={item.text}
                      onChange={e => setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, text: e.target.value } : c))}
                      className={`flex-1 bg-transparent outline-none text-sm ${item.done ? 'line-through text-zinc-400' : 'text-zinc-700'}`}
                      placeholder="Checklist item..."
                    />
                    <button
                      onClick={() => setChecklist(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-zinc-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setChecklist(prev => [...prev, { text: '', done: false }])}
                  className="flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-hover transition-colors mt-2"
                >
                  <Plus size={14} /> Add Item
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 border-t border-zinc-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 font-bold text-base bg-white text-zinc-900 border border-black rounded-full uppercase tracking-wide shadow-elevation-1 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-zinc-950" /> Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 font-bold text-base bg-brand text-white border border-black rounded-full uppercase tracking-wide shadow-elevation-2 flex items-center gap-2 disabled:opacity-50">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <span className="w-2 h-2 rounded-full bg-white" />} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

interface ShiftsProps {
  userMode: 'volunteer' | 'admin' | 'coordinator';
  user: Volunteer;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  onUpdate: (u: Volunteer) => void;
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  allVolunteers: Volunteer[];
  setAllVolunteers?: React.Dispatch<React.SetStateAction<Volunteer[]>>;
  manageOnly?: boolean;
}

const ShiftsComponent: React.FC<ShiftsProps> = ({ userMode, user, shifts, setShifts, onUpdate, opportunities, setOpportunities, allVolunteers, setAllVolunteers, manageOnly }) => {
  const canManageEvents = userMode === 'admin' || userMode === 'coordinator';
  const [activeTab, setActiveTab] = useState<'available' | 'my-schedule' | 'manage'>(manageOnly ? 'manage' : 'my-schedule');
  const [searchQuery, setSearchQuery] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastError, setToastError] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [showEventBuilder, setShowEventBuilder] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showEventDetail, setShowEventDetail] = useState<Opportunity | null>(null);
  const [showStaffingModal, setShowStaffingModal] = useState<{ role: string; eventDate: string; eventId: string; eventTitle: string; eventLocation: string; eventType?: string } | null>(null);
  const [editingEvent, setEditingEvent] = useState<Opportunity | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const getOpp = (id: string) => opportunities.find(o => o.id === id);

  const calculateDuration = (startStr: string, endStr: string): string => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'N/A';
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return `${parseFloat(diffHours.toFixed(1))} hour${diffHours !== 1 ? 's' : ''}`;
  };

  const [registeringShiftIds, setRegisteringShiftIds] = useState<Set<string>>(new Set());

  // Check training eligibility for registration
  const getRegistrationStatus = (opp: Opportunity | undefined) => {
    const completedIds = user.completedTrainingIds || [];
    const tier1Done = hasCompletedAllModules(completedIds, TIER_1_IDS);
    const tier2Done = hasCompletedAllModules(completedIds, TIER_2_CORE_IDS);
    const basicTrainingDone = tier1Done && tier2Done;

    if (!basicTrainingDone) {
      return {
        canRegister: false,
        isPending: false,
        message: !tier1Done
          ? 'Complete Orientation training in Training Academy to register for missions.'
          : 'Complete Baseline Training in Training Academy to register for missions.',
      };
    }

    // Basic training done — check program-specific clearance
    if (opp) {
      const program = getCategoryProgram(opp.category);
      if (program) {
        const requiredIds = PROGRAM_TRAINING_REQUIREMENTS[program] || [];
        const hasClearance = hasCompletedAllModules(completedIds, requiredIds);
        if (!hasClearance) {
          const missing = getMissingProgramTraining(completedIds, program);
          const label = PROGRAM_LABELS[program] || program;
          return {
            canRegister: true,
            isPending: true,
            message: `Pending — complete ${label} training to confirm registration`,
            missingTraining: missing,
            program: label,
          };
        }
      }
    }

    return { canRegister: true, isPending: false, message: '' };
  };

  const handleToggleRegistration = async (shiftId: string) => {
    if (registeringShiftIds.has(shiftId)) return; // Prevent double-click on same shift
    setRegisteringShiftIds(prev => new Set([...prev, shiftId]));
    const isRegistered = user.assignedShiftIds?.includes(shiftId);
    const shift = shifts.find(s => s.id === shiftId);
    const opp = shift ? getOpp(shift.opportunityId) : null;

    // Check training eligibility before allowing registration
    if (!isRegistered && opp) {
      const status = getRegistrationStatus(opp);
      if (!status.canRegister) {
        setToastMsg(status.message);
        setToastError(true);
        setRegisteringShiftIds(prev => { const next = new Set(prev); next.delete(shiftId); return next; });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
        return;
      }
    }

    try {
      if (isRegistered) {
        // Unregister via proper endpoint
        await apiService.post('/api/events/unregister', {
          volunteerId: user.id,
          eventId: shift?.opportunityId,
          shiftId,
        });
        // Update local state
        onUpdate({
          ...user,
          assignedShiftIds: (user.assignedShiftIds || []).filter(id => id !== shiftId),
          rsvpedEventIds: (user.rsvpedEventIds || []).filter(id => id !== shift?.opportunityId),
        });
        if (shift) {
          setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, slotsFilled: Math.max(0, s.slotsFilled - 1), assignedVolunteerIds: s.assignedVolunteerIds.filter(id => id !== user.id) } : s));
        }
        if (opp) {
          setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, slotsFilled: Math.max(0, (o.slotsFilled || 0) - 1) } : o));
        }
        setToastMsg('You have unregistered from the shift.');
        setToastError(false);
      } else {
        const regStatus = opp ? getRegistrationStatus(opp) : { isPending: false };

        // Register via proper endpoint
        await apiService.post('/api/events/register', {
          volunteerId: user.id,
          eventId: shift?.opportunityId,
          shiftId,
          eventTitle: opp?.title || '',
          eventDate: opp?.date || '',
          eventLocation: opp?.serviceLocation || '',
          volunteerEmail: user.email || '',
          volunteerName: user.name || '',
          eventType: opp?.type || '',
          status: regStatus.isPending ? 'pending_training' : 'confirmed',
        });
        // Update local state
        onUpdate({
          ...user,
          assignedShiftIds: [...new Set([...(user.assignedShiftIds || []), shiftId])],
          rsvpedEventIds: [...new Set([...(user.rsvpedEventIds || []), shift?.opportunityId || ''])],
        });
        if (shift) {
          setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, slotsFilled: s.slotsFilled + 1, assignedVolunteerIds: [...s.assignedVolunteerIds, user.id] } : s));
        }
        if (opp) {
          setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, slotsFilled: (o.slotsFilled || 0) + 1 } : o));
        }
        if (regStatus.isPending) {
          setToastMsg(`Registered — pending ${(regStatus as any).program} training completion`);
          setToastError(false);
        } else {
          setToastMsg('Successfully registered for the shift!');
          setToastError(false);
        }
      }
      analyticsService.logEvent(isRegistered ? 'shift_unregister' : 'shift_register', { shiftId, userId: user.id });
    } catch (error: any) {
      console.error("Failed to update shift registration:", error);
      setToastMsg(error?.message || 'Failed to update registration. Please try again.');
      setToastError(true);
    } finally {
      setRegisteringShiftIds(prev => { const next = new Set(prev); next.delete(shiftId); return next; });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };
  
  const handleSaveEvent = async (newEventData: Omit<Opportunity, 'id'>) => {
      // API call creates the opportunity and associated shifts (server auto-approves for admin/coordinator)
      const result = await apiService.post('/api/opportunities', { opportunity: newEventData });
      setOpportunities(prev => [...prev, { id: result.id, ...newEventData, approvalStatus: result.approvalStatus || newEventData.approvalStatus }]);

      // Also add the created shifts to state so volunteers can see them immediately
      if (result.shifts && result.shifts.length > 0) {
        setShifts(prev => [...prev, ...result.shifts]);
      }
  };

  const handleAssignVolunteer = async (volunteerId: string) => {
    if (!showStaffingModal) return;
    const { role, eventId, eventDate, eventTitle, eventLocation, eventType } = showStaffingModal;

    // Find the matching shift for this event + role
    const matchingShift = shifts.find(s => s.opportunityId === eventId && s.roleType === role);
    const volunteer = allVolunteers.find(v => v.id === volunteerId);

    try {
      await apiService.post('/api/events/register', {
        volunteerId,
        eventId,
        shiftId: matchingShift?.id || null,
        eventTitle,
        eventDate,
        eventLocation,
        eventType: eventType || '',
        volunteerEmail: volunteer?.email || '',
        volunteerName: volunteer?.name || '',
      });

      // Update local shift state
      if (matchingShift) {
        setShifts(prev => prev.map(s => s.id === matchingShift.id ? {
          ...s,
          slotsFilled: s.slotsFilled + 1,
          assignedVolunteerIds: [...s.assignedVolunteerIds, volunteerId],
        } : s));
      }

      // Update local opportunity staffing quotas
      setOpportunities(prev => prev.map(o => o.id === eventId ? {
        ...o,
        staffingQuotas: (o.staffingQuotas || []).map(q => q.role === role ? { ...q, filled: (q.filled || 0) + 1 } : q),
      } : o));

      setShowStaffingModal(null);
      setToastMsg(`${volunteer?.name || 'Volunteer'} assigned to ${role} shift.`);
      setToastError(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (e: any) {
      console.error('Failed to assign volunteer:', e);
      setToastMsg(e.message || 'Failed to assign volunteer.');
      setToastError(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleSyncFromFinder = async () => {
    setIsSyncing(true);
    try {
      const result = await apiService.post('/api/events/sync-from-finder', {});
      // After sync, reload all data from server to get updated times, deduped events, etc.
      const [oppsData, shiftsData] = await Promise.all([
        apiService.get('/api/opportunities'),
        apiService.get('/api/shifts'),
      ]);
      if (Array.isArray(oppsData)) setOpportunities(oppsData);
      if (Array.isArray(shiftsData)) setShifts(shiftsData);
      setToastMsg(`Synced ${result.synced} new, ${result.updated} updated, ${result.skipped} unchanged`);
      setToastError(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch (e: any) {
      setToastMsg(e.message || 'Sync failed');
      setToastError(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteEvent = async (oppId: string) => {
    if (!confirm('Are you sure you want to delete this event? This will also delete all associated shifts.')) return;
    try {
      await apiService.delete(`/api/opportunities/${oppId}`);
      setOpportunities(prev => prev.filter(o => o.id !== oppId));
      setShifts(prev => prev.filter(s => s.opportunityId !== oppId));
      setToastMsg('Event deleted successfully.');
      setToastError(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (e) {
      console.error('Failed to delete event', e);
      setToastMsg('Failed to delete event.');
      setToastError(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleUpdateEvent = async (updates: Partial<Opportunity> & { startTime?: string; endTime?: string }) => {
    if (!editingEvent) return;
    try {
      const result = await apiService.put(`/api/opportunities/${editingEvent.id}`, updates);
      const { shifts: returnedShifts, ...oppData } = result;
      setOpportunities(prev => prev.map(o => o.id === editingEvent.id ? { ...o, ...oppData } : o));
      if (returnedShifts?.length) {
        setShifts(prev => {
          const otherShifts = prev.filter(s => s.opportunityId !== editingEvent.id);
          return [...otherShifts, ...returnedShifts];
        });
      }
      setEditingEvent(null);
      setToastMsg('Event updated successfully.');
      setToastError(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (e) {
      console.error('Failed to update event', e);
      setToastMsg('Failed to update event.');
      setToastError(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };
  
  // Clear stale selectedShiftId in an effect (not during render)
  const selectedShift = selectedShiftId ? shifts.find(s => s.id === selectedShiftId) : null;
  const selectedOpp = selectedShift ? getOpp(selectedShift.opportunityId) : null;
  useEffect(() => {
    if (selectedShiftId && (!selectedShift || !selectedOpp)) {
      setSelectedShiftId(null);
    }
  }, [selectedShiftId, selectedShift, selectedOpp]);

  // Helper to check if a date is in the past
  const isPastEvent = (dateStr: string) => {
    const eventDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate < today;
  };

  // For "my-schedule", include both assigned shifts AND rsvped events (opportunities)
  // For "available", only show upcoming events (not past)
  const shiftsToDisplay = activeTab === 'available'
    ? shifts.filter(s => {
        const opp = getOpp(s.opportunityId);
        return !user.assignedShiftIds?.includes(s.id) && opp && !isPastEvent(opp.date)
          && (opp.approvalStatus === 'approved' || !opp.approvalStatus);
      })
    : shifts.filter(s => user.assignedShiftIds?.includes(s.id));

  // Get rsvped opportunities that may not have corresponding assigned shifts
  const rsvpedOppIds = user.rsvpedEventIds || [];
  const assignedOppIds = shiftsToDisplay.map(s => s.opportunityId);
  const rsvpedOppsWithoutShifts = activeTab === 'my-schedule'
    ? opportunities.filter(o => rsvpedOppIds.includes(o.id) && !assignedOppIds.includes(o.id))
    : [];

  const filteredShifts = shiftsToDisplay.filter(s => {
    const opp = getOpp(s.opportunityId);
    if (!opp) return false;
    const matchesSearch = opp.title.toLowerCase().includes(searchQuery.toLowerCase()) || opp.serviceLocation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || normalizeCategory(opp.category) === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filter rsvped opportunities by search query and category
  const filteredRsvpedOpps = rsvpedOppsWithoutShifts.filter(o => {
    const matchesSearch = o.title.toLowerCase().includes(searchQuery.toLowerCase()) || o.serviceLocation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || normalizeCategory(o.category) === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Separate upcoming and past for my-schedule tab
  const upcomingShifts = filteredShifts.filter(s => {
    const opp = getOpp(s.opportunityId);
    return opp && !isPastEvent(opp.date);
  });
  const pastShifts = filteredShifts.filter(s => {
    const opp = getOpp(s.opportunityId);
    return opp && isPastEvent(opp.date);
  });
  const upcomingRsvpedOpps = filteredRsvpedOpps.filter(o => !isPastEvent(o.date));
  const pastRsvpedOpps = filteredRsvpedOpps.filter(o => isPastEvent(o.date));

  // Use upcoming for display (available tab already filters, my-schedule shows upcoming first)
  const rawDisplayShifts = activeTab === 'available' ? filteredShifts : upcomingShifts;
  const displayRsvpedOpps = activeTab === 'available' ? filteredRsvpedOpps : upcomingRsvpedOpps;

  // Deduplicate: show one card per opportunity (pick shift with most available slots)
  const displayShifts = rawDisplayShifts.filter((shift, _index, arr) => {
    const dupes = arr.filter(s => s.opportunityId === shift.opportunityId);
    if (dupes.length <= 1) return true;
    // Pick the one with the most available slots (or first if tied)
    const best = dupes.reduce((a, b) => (b.slotsTotal - b.slotsFilled) > (a.slotsTotal - a.slotsFilled) ? b : a);
    return shift.id === best.id;
  });

  // Group shifts by date
  const groupedByDate = displayShifts.reduce((acc, shift) => {
    const date = new Date(shift.startTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[date]) acc[date] = { shifts: [], opportunities: [] };
    acc[date].shifts.push(shift);
    return acc;
  }, {} as Record<string, { shifts: Shift[], opportunities: Opportunity[] }>);

  // Add rsvped opportunities without shifts to the grouped data
  displayRsvpedOpps.forEach(opp => {
    const date = new Date(opp.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!groupedByDate[date]) groupedByDate[date] = { shifts: [], opportunities: [] };
    groupedByDate[date].opportunities.push(opp);
  });

  // Group past events separately for my-schedule
  const pastGroupedByDate = activeTab === 'my-schedule' ? pastShifts.reduce((acc, shift) => {
    const date = new Date(shift.startTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[date]) acc[date] = { shifts: [], opportunities: [] };
    acc[date].shifts.push(shift);
    return acc;
  }, {} as Record<string, { shifts: Shift[], opportunities: Opportunity[] }>) : {};

  // Add past rsvped opportunities
  if (activeTab === 'my-schedule') {
    pastRsvpedOpps.forEach(opp => {
      const date = new Date(opp.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!pastGroupedByDate[date]) pastGroupedByDate[date] = { shifts: [], opportunities: [] };
      pastGroupedByDate[date].opportunities.push(opp);
    });
  }

  const hasPastEvents = Object.keys(pastGroupedByDate).length > 0;

  // For my-schedule: build a flat sorted list of all missions (upcoming first by nearest date, then past)
  const myScheduleCards = useMemo(() => {
    if (activeTab !== 'my-schedule') return [];
    type CardItem = { type: 'shift'; shift: Shift; opp: Opportunity; isPast: boolean; sortDate: number } | { type: 'rsvp'; opp: Opportunity; isPast: boolean; sortDate: number };
    const cards: CardItem[] = [];

    // Add upcoming + past shifts
    [...upcomingShifts, ...pastShifts].forEach(shift => {
      const opp = getOpp(shift.opportunityId);
      if (!opp) return;
      // Deduplicate: only keep one shift per opportunity (best slots)
      if (cards.some(c => c.type === 'shift' && c.opp.id === opp.id)) return;
      const past = isPastEvent(opp.date);
      cards.push({ type: 'shift', shift, opp, isPast: past, sortDate: new Date(opp.date + 'T00:00:00').getTime() });
    });

    // Add rsvped opps without shifts
    [...upcomingRsvpedOpps, ...pastRsvpedOpps].forEach(opp => {
      if (cards.some(c => c.opp.id === opp.id)) return;
      const past = isPastEvent(opp.date);
      cards.push({ type: 'rsvp', opp, isPast: past, sortDate: new Date(opp.date + 'T00:00:00').getTime() });
    });

    // Sort: upcoming first (nearest date), then past (most recent first)
    const now = Date.now();
    cards.sort((a, b) => {
      if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
      if (!a.isPast) return a.sortDate - b.sortDate; // upcoming: nearest first
      return b.sortDate - a.sortDate; // past: most recent first
    });

    return cards;
  }, [activeTab, upcomingShifts, pastShifts, upcomingRsvpedOpps, pastRsvpedOpps]);

  const tabs = [
    ...(manageOnly ? [{ id: 'manage', label: 'Manage Events' }] : []),
    ...(!manageOnly ? [{ id: 'available', label: 'Available Missions' }] : []),
    ...(!manageOnly ? [{ id: 'my-schedule', label: 'My Schedule' }] : []),
  ];

  // EventOps early return — placed after all hooks to satisfy Rules of Hooks
  if (selectedShiftId && selectedShift && selectedOpp) {
    const eventShifts = shifts.filter(s => s.opportunityId === selectedOpp.id);
    return (
      <>
        <EventOpsMode shift={selectedShift} opportunity={selectedOpp} user={user} onBack={() => setSelectedShiftId(null)} onUpdateUser={onUpdate} allVolunteers={allVolunteers} eventShifts={eventShifts} setOpportunities={setOpportunities} canEdit={canManageEvents} onEditEvent={(opp) => setEditingEvent(opp)} />
        {editingEvent && <EditEventModal event={editingEvent} shifts={shifts} onClose={() => setEditingEvent(null)} onSave={handleUpdateEvent} />}
      </>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
       {showToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-brand text-white px-10 py-6 rounded-full shadow-elevation-3 flex items-center gap-4 z-[5000] animate-in slide-in-from-bottom-10">
           <div className={`p-2 rounded-lg ${toastError ? 'bg-rose-500' : 'bg-emerald-500'}`}>{toastError ? <XCircle size={16} /> : <Check size={16} />}</div>
           <span className="text-sm font-bold uppercase tracking-wide">{toastMsg}</span>
        </div>
      )}
       {showEventBuilder && <EventBuilder onClose={() => setShowEventBuilder(false)} onSave={handleSaveEvent} />}
       {showBulkUploadModal && (
         <BulkUploadEventsModal
           onClose={() => setShowBulkUploadModal(false)}
           onComplete={(newEvents, newShifts) => {
             setOpportunities(prev => [...prev, ...newEvents]);
             setShifts(prev => [...prev, ...newShifts]);
             setToastMsg(`Successfully imported ${newEvents.length} events!`);
             setToastError(false);
             setShowToast(true);
             setTimeout(() => setShowToast(false), 3000);
           }}
         />
       )}
       {showStaffingModal && <StaffingSuggestions role={showStaffingModal.role} eventDate={showStaffingModal.eventDate} eventId={showStaffingModal.eventId} eventTitle={showStaffingModal.eventTitle} allVolunteers={allVolunteers} assignedVolunteerIds={shifts.find(s => s.opportunityId === showStaffingModal.eventId && s.roleType === showStaffingModal.role)?.assignedVolunteerIds || []} onClose={() => setShowStaffingModal(null)} onAssign={handleAssignVolunteer} />}
       {editingEvent && <EditEventModal event={editingEvent} shifts={shifts} onClose={() => setEditingEvent(null)} onSave={handleUpdateEvent} />}

       {/* Event Detail Modal */}
       {showEventDetail && (
         <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowEventDetail(null)}>
           <div className="bg-white rounded-modal max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-elevation-3 border border-zinc-100" onClick={(e) => e.stopPropagation()}>
             <div className="p-8">
               <div className="flex justify-between items-start mb-6">
                 <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-brand/10 text-brand">{normalizeCategory(showEventDetail.category)}</span>
                 <button onClick={() => setShowEventDetail(null)} className="p-2 rounded-3xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"><X size={20} /></button>
               </div>
               <h3 className="text-2xl font-black text-zinc-900 tracking-tight mb-4">{showEventDetail.title}</h3>
               <div className="space-y-3 text-sm text-zinc-600">
                 <p className="flex items-center gap-3"><Calendar size={16} className="text-brand shrink-0" /> {new Date(showEventDetail.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                 <p className="flex items-center gap-3"><Clock size={16} className="text-brand shrink-0" /> {showEventDetail.time || 'TBD'}</p>
                 <p className="flex items-center gap-3"><MapPin size={16} className="text-brand shrink-0" /> {showEventDetail.serviceLocation}</p>
                 {showEventDetail.address && showEventDetail.address !== showEventDetail.serviceLocation && (
                   <p className="ml-7 text-zinc-400">{showEventDetail.address}</p>
                 )}
               </div>
               {showEventDetail.description && (
                 <div className="mt-6 pt-6 border-t border-zinc-100">
                   <p className="text-sm text-zinc-600 leading-relaxed">{showEventDetail.description}</p>
                 </div>
               )}
               <div className="mt-6 pt-6 border-t border-zinc-100 flex flex-col gap-3">
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-zinc-400 font-bold">Capacity</span>
                   <span className="font-bold text-zinc-700">{showEventDetail.slotsFilled || 0} / {showEventDetail.slotsTotal} filled</span>
                 </div>
                 {showEventDetail.serviceLocation && (
                   <a
                     href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(showEventDetail.address || showEventDetail.serviceLocation)}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="w-full py-3 font-bold text-base bg-white text-zinc-900 border border-zinc-950 rounded-full transition-all flex items-center justify-center gap-2 hover:opacity-80"
                   >
                     <span className="w-2 h-2 rounded-full bg-zinc-950" /> Get Directions
                   </a>
                 )}
               </div>
             </div>
           </div>
         </div>
       )}
      
      {!manageOnly && (
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="max-w-xl">
          <h2 className="text-5xl font-black tracking-tighter uppercase italic">My Missions</h2>
          <p className="text-zinc-500 mt-4 font-medium text-lg leading-relaxed">Find, join, and manage community health events.</p>
        </div>
        <div className="flex bg-white border border-zinc-100 p-1.5 md:p-2 rounded-full shadow-elevation-1 shrink-0 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 md:px-10 py-3 md:py-4 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-brand text-white shadow-elevation-2' : 'text-zinc-400 hover:text-zinc-600'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      )}
      
      {activeTab === 'manage' && canManageEvents && (
        <div>
           <div className={`grid grid-cols-1 ${manageOnly ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 mb-8`}>
             {!manageOnly && (
             <button onClick={() => setShowEventBuilder(true)} className="flex items-center justify-center gap-3 px-6 py-6 font-bold text-base bg-brand text-white border border-black rounded-full uppercase tracking-wide shadow-elevation-2 hover:opacity-90 transition-opacity">
                  <span className="w-2 h-2 rounded-full bg-white" /> Create New Event
              </button>
             )}
              <button onClick={handleSyncFromFinder} disabled={isSyncing} className="flex items-center justify-center gap-3 px-6 py-6 font-bold text-base bg-brand text-white border border-black rounded-full uppercase tracking-wide shadow-elevation-2 hover:opacity-90 transition-opacity disabled:opacity-50">
                  {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <span className="w-2 h-2 rounded-full bg-white" />} {isSyncing ? 'Syncing...' : 'Sync from Event Finder'}
              </button>
              <button onClick={() => setShowBulkUploadModal(true)} className="flex items-center justify-center gap-3 px-6 py-6 font-bold text-base bg-white text-zinc-900 border border-black rounded-full uppercase tracking-wide shadow-elevation-1 hover:opacity-80 transition-opacity">
                  <span className="w-2 h-2 rounded-full bg-zinc-950" /> Bulk Import CSV
              </button>
           </div>

           {/* Pending Approval Section */}
           {opportunities.filter(o => o.approvalStatus === 'pending').length > 0 && (
             <div className="mb-8">
               <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wide mb-4 px-2 flex items-center gap-2">
                 <Clock size={14} /> Pending Approval ({opportunities.filter(o => o.approvalStatus === 'pending').length})
               </h3>
               <div className="space-y-4">
                 {opportunities.filter(o => o.approvalStatus === 'pending').map(opp => (
                   <div key={opp.id} className="bg-amber-50 p-8 rounded-[40px] border border-amber-200 shadow-sm hover:shadow-2xl transition-shadow">
                     <div className="flex items-start justify-between gap-4">
                       <div>
                         <h3 className="font-bold text-zinc-900">{opp.title}</h3>
                         <p className="text-xs text-zinc-500">{opp.date} • {opp.serviceLocation}</p>
                       </div>
                       <div className="flex items-center gap-2">
                         <button
                           onClick={async () => {
                             try {
                               await apiService.put(`/api/opportunities/${opp.id}`, { approvalStatus: 'approved', approvedBy: user.id, approvedAt: new Date().toISOString() });
                               setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, approvalStatus: 'approved' } : o));
                               setToastMsg('Event approved and now visible to all volunteers!');
                               setShowToast(true);
                               setTimeout(() => setShowToast(false), 3000);
                             } catch (e) { console.error('Failed to approve', e); toastService.error('Failed to approve registration. Please try again.'); }
                           }}
                           className="px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1 hover:bg-brand/90"
                         >
                           <Check size={14} /> Approve
                         </button>
                         <button
                           onClick={async () => {
                             try {
                               await apiService.put(`/api/opportunities/${opp.id}`, { approvalStatus: 'rejected' });
                               setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, approvalStatus: 'rejected' } : o));
                               setToastMsg('Event rejected.');
                               setShowToast(true);
                               setTimeout(() => setShowToast(false), 3000);
                             } catch (e) { console.error('Failed to reject', e); toastService.error('Failed to reject registration. Please try again.'); }
                           }}
                           className="px-4 py-2 bg-rose-100 text-rose-600 border border-black rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1 hover:bg-rose-200"
                         >
                           <XCircle size={14} /> Reject
                         </button>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* All Events */}
           <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-6 px-2">All Events</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...opportunities].filter(o => o.approvalStatus !== 'pending').sort((a, b) => {
                const dateA = new Date(a.date + 'T00:00:00').getTime();
                const dateB = new Date(b.date + 'T00:00:00').getTime();
                return dateA - dateB;
              }).map(opp => (
                 <div key={opp.id} className={`bg-white p-8 rounded-[40px] border shadow-sm hover:shadow-2xl transition-shadow flex flex-col ${opp.approvalStatus === 'rejected' ? 'border-rose-200 opacity-60' : 'border-zinc-100'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-bold truncate">{opp.title}</h3>
                        <p className="text-xs text-zinc-400">{new Date(opp.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}{opp.time && opp.time !== 'TBD' ? ` • ${opp.time}` : ''} • {opp.serviceLocation}</p>
                        <p className="text-[10px] text-zinc-300 font-black mt-1">{normalizeCategory(opp.category)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase shrink-0 ${
                        opp.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        opp.approvalStatus === 'rejected' ? 'bg-rose-100 text-rose-600' :
                        'bg-zinc-100 text-zinc-500'
                      }`}>
                        {opp.approvalStatus || 'Published'}
                      </span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-zinc-100 space-y-3 flex-1">
                      {(opp.staffingQuotas || []).length > 0 ? (opp.staffingQuotas || []).map(q => {
                        const matchingShift = shifts.find(s => s.opportunityId === opp.id && s.roleType === q.role);
                        const assignedIds = [...new Set(matchingShift?.assignedVolunteerIds || [])];
                        const assignedVols = assignedIds.map(id => allVolunteers.find(v => v.id === id)).filter(Boolean) as Volunteer[];
                        // Derive filled count from actual assigned volunteers, not stored q.filled (can desync)
                        const actualFilled = assignedVols.length;
                        return (
                          <div key={q.role}>
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-bold">{q.role}</span>
                              <div className="flex items-center gap-2">
                                <span className={`${actualFilled < q.count ? 'text-rose-500' : 'text-emerald-500'}`}>{actualFilled} / {q.count} Filled</span>
                                {actualFilled < q.count && <button onClick={() => setShowStaffingModal({ role: q.role, eventDate: opp.date, eventId: opp.id, eventTitle: opp.title, eventLocation: opp.serviceLocation, eventType: opp.type })} className="text-xs font-bold bg-brand/10 text-brand px-2 py-1 rounded-full">Find Volunteer</button>}
                              </div>
                            </div>
                            {assignedVols.length > 0 && (
                              <div className="mt-1.5 ml-1 space-y-1">
                                {assignedVols.map(v => (
                                  <div key={v.id} className="flex items-center gap-2 group">
                                    <div className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center text-[9px] font-bold shrink-0">{v.name.charAt(0)}</div>
                                    <span className="text-xs text-zinc-600 truncate">{v.name}</span>
                                    <button
                                      onClick={async () => {
                                        if (!matchingShift) return;
                                        try {
                                          await apiService.post('/api/events/unregister', { volunteerId: v.id, eventId: opp.id, shiftId: matchingShift.id });
                                          setShifts(prev => prev.map(s => s.id === matchingShift.id ? { ...s, slotsFilled: Math.max(0, s.slotsFilled - 1), assignedVolunteerIds: s.assignedVolunteerIds.filter(id => id !== v.id) } : s));
                                          setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, slotsFilled: Math.max(0, (o.slotsFilled || 0) - 1), staffingQuotas: (o.staffingQuotas || []).map(sq => sq.role === q.role ? { ...sq, filled: Math.max(0, (sq.filled || 0) - 1) } : sq) } : o));
                                          if (setAllVolunteers) {
                                            setAllVolunteers(prev => prev.map(vol => vol.id === v.id ? { ...vol, rsvpedEventIds: (vol.rsvpedEventIds || []).filter(id => id !== opp.id), assignedShiftIds: (vol.assignedShiftIds || []).filter(id => id !== matchingShift.id) } : vol));
                                          }
                                        } catch (e) { console.error('Failed to unassign', e); toastService.error('Failed to unassign volunteer. Please try again.'); }
                                      }}
                                      className="ml-auto p-1 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors shrink-0"
                                      title="Remove volunteer"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }) : (
                        <div className="space-y-2">
                          <p className="text-xs text-zinc-400 italic">No staffing roles configured for this event.</p>
                          <button onClick={() => setShowStaffingModal({ role: 'Volunteer', eventDate: opp.date, eventId: opp.id, eventTitle: opp.title, eventLocation: opp.serviceLocation, eventType: opp.type })} className="flex items-center gap-2 text-xs font-bold bg-brand/10 text-brand px-3 py-2 rounded-full hover:bg-brand/20 transition-colors">
                            <UserPlus size={14} /> Assign / Invite Volunteer
                          </button>
                        </div>
                      )}
                    </div>
                    {/* RSVP'd volunteers not assigned to a specific shift */}
                    {(() => {
                      const allAssignedIds = shifts.filter(s => s.opportunityId === opp.id).flatMap(s => s.assignedVolunteerIds || []);
                      const rsvpOnly = allVolunteers.filter(v => v.rsvpedEventIds?.includes(opp.id) && !allAssignedIds.includes(v.id));
                      if (rsvpOnly.length === 0) return null;
                      return (
                        <div className="mt-3 pt-3 border-t border-zinc-100">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">RSVP'd ({rsvpOnly.length})</p>
                          <div className="space-y-1">
                            {rsvpOnly.map(v => (
                              <div key={v.id} className="flex items-center gap-2 group">
                                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[9px] font-bold shrink-0">{v.name.charAt(0)}</div>
                                <span className="text-xs text-zinc-600 truncate">{v.name}</span>
                                <button
                                  onClick={async () => {
                                    try {
                                      await apiService.post('/api/events/unregister', { volunteerId: v.id, eventId: opp.id });
                                      if (setAllVolunteers) {
                                        setAllVolunteers(prev => prev.map(vol => vol.id === v.id ? { ...vol, rsvpedEventIds: (vol.rsvpedEventIds || []).filter(id => id !== opp.id) } : vol));
                                      }
                                    } catch (e) { console.error('Failed to remove RSVP', e); toastService.error('Failed to remove RSVP. Please try again.'); }
                                  }}
                                  className="ml-auto p-1 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors shrink-0"
                                  title="Remove RSVP"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Event Day Check-in Panel */}
                    <EventDayCheckin eventId={opp.id} eventDate={opp.date} />
                    <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center gap-2">
                      <button onClick={() => setEditingEvent(opp)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-black rounded-full text-xs font-bold uppercase tracking-wide transition-colors">
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => handleDeleteEvent(opp.id)} className="flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-500 border border-black rounded-full text-xs font-bold uppercase tracking-wide transition-colors">
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                 </div>
              ))}
            </div>
        </div>
      )}

      { (activeTab === 'available' || activeTab === 'my-schedule') && (
        <div className="space-y-10">
          {/* Search and category filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search events by name or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-brand/30 transition-all"
              />
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 text-sm font-bold text-zinc-700 outline-none focus:border-brand/30 min-w-[180px]"
            >
              <option value="all">All Categories</option>
              {EVENT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* MY SCHEDULE — flat sorted grid with date on card */}
          {activeTab === 'my-schedule' && (
            <>
              {myScheduleCards.length === 0 && (
                <div className="py-32 text-center bg-zinc-50 rounded-[40px] border border-dashed border-zinc-200">
                    <Calendar className="mx-auto text-zinc-200 mb-6" size={64} strokeWidth={1.5}/>
                    <p className="text-zinc-400 font-bold text-sm">You have no upcoming missions.</p>
                    <p className="text-sm text-zinc-300 mt-2">Browse available missions to get started.</p>
                </div>
              )}
              {myScheduleCards.length > 0 && (() => {
                const firstPastIdx = myScheduleCards.findIndex(c => c.isPast);
                const upcomingCards = firstPastIdx === -1 ? myScheduleCards : myScheduleCards.slice(0, firstPastIdx);
                const pastCards = firstPastIdx === -1 ? [] : myScheduleCards.slice(firstPastIdx);
                return (
                  <>
                    {upcomingCards.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {upcomingCards.map(card => {
                          const opp = card.opp;
                          const dateLabel = new Date(opp.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                          if (card.type === 'shift') {
                            const shift = card.shift;
                            const isRegistered = user.assignedShiftIds?.includes(shift.id);
                            const slotsLeft = shift.slotsTotal - shift.slotsFilled;
                            const regStatus = getRegistrationStatus(opp);
                            const isPendingTraining = isRegistered && regStatus.isPending;
                            return (
                              <div key={shift.id} className={`bg-white rounded-[40px] border transition-all duration-300 flex flex-col group relative overflow-hidden ${isPendingTraining ? 'border-amber-400 shadow-sm hover:shadow-2xl transition-shadow' : isRegistered ? 'border-brand shadow-elevation-3' : 'border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow'}`}>
                                {isRegistered && (
                                  <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-2xl rounded-tr-[44px] text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isPendingTraining ? 'bg-amber-500 text-white' : 'bg-brand text-white'}`}>
                                    {isPendingTraining ? <><AlertTriangle size={12} /> Pending Approval</> : <><Check size={14} /> Confirmed</>}
                                  </div>
                                )}
                                {isPendingTraining && (
                                  <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start gap-3">
                                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-bold text-amber-800">Complete {regStatus.program} training to confirm</p>
                                      <p className="text-[11px] text-amber-600 mt-0.5">Go to Training Academy to finish the remaining modules.</p>
                                    </div>
                                  </div>
                                )}
                                <div className="p-6 md:p-8 flex-1">
                                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-700 mb-4">
                                    <Calendar size={14} className="text-brand shrink-0" />
                                    {dateLabel}
                                  </div>
                                  <div className="flex justify-between items-start mb-4">
                                    {(() => {
                                      const rawUrgency = (opp.urgency || 'medium').toLowerCase().replace(/_/g, ' ');
                                      const urgencyLabel = rawUrgency === 'save the date' ? 'Upcoming' : rawUrgency === 'high' ? 'High' : rawUrgency === 'low' ? 'Low' : 'Medium';
                                      const isHigh = urgencyLabel === 'High';
                                      return (
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${isHigh ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}>
                                          {urgencyLabel}
                                        </span>
                                      );
                                    })()}
                                    <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${slotsLeft === 0 ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                      {slotsLeft === 0 ? 'Full' : `${slotsLeft} ${slotsLeft === 1 ? 'Spot' : 'Spots'} Left`}
                                    </div>
                                  </div>
                                  <p className="text-xs font-bold text-brand mb-2">{normalizeCategory(opp.category)}</p>
                                  <h3 className="text-xl font-bold text-zinc-900 leading-tight mb-2 cursor-pointer hover:text-brand transition-colors" onClick={() => setShowEventDetail(opp)}>{opp.title}</h3>
                                  <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400 uppercase tracking-wide mb-4">
                                    <MapPin size={14} className="text-zinc-300" /> {opp.serviceLocation}
                                  </div>
                                  <p className="text-sm text-zinc-500 font-bold leading-relaxed line-clamp-2">{opp.description ? (opp.description.length > 100 ? opp.description.substring(0, 100) + '...' : opp.description) : ''}</p>
                                </div>
                                <div className="bg-zinc-50/70 p-4 md:p-6 rounded-t-2xl border-t-2 border-zinc-100 mt-auto">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                        <Clock size={14} className="text-brand shrink-0" />
                                        {opp.time && opp.time !== 'TBD' ? opp.time : `${new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                      </p>
                                    </div>
                                    {userMode === 'volunteer' && (() => {
                                      const volRegStatus = getRegistrationStatus(opp);
                                      if (!volRegStatus.canRegister && !isRegistered) {
                                        return <p className="text-[10px] text-zinc-400 font-bold leading-tight text-right max-w-[200px]">{volRegStatus.message}</p>;
                                      }
                                      return (
                                        <button
                                          onClick={() => handleToggleRegistration(shift.id)}
                                          disabled={registeringShiftIds.has(shift.id) || (slotsLeft === 0 && !isRegistered)}
                                          className={`px-6 py-3 rounded-full font-bold text-sm transition-all shadow-elevation-2 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 ${isPendingTraining ? 'bg-amber-500 text-white border border-amber-500' : isRegistered ? 'bg-white text-zinc-900 border border-zinc-950' : 'bg-brand text-white border border-brand hover:opacity-95'}`}
                                        >
                                          {registeringShiftIds.has(shift.id) ? <><Loader2 size={14} className="animate-spin" /> Working...</> : isRegistered ? <><span className={`w-2 h-2 rounded-full ${isPendingTraining ? 'bg-white' : 'bg-zinc-950'}`} /> Unregister</> : <><span className="w-2 h-2 rounded-full bg-white" /> Register</>}
                                        </button>
                                      );
                                    })()}
                                    {canManageEvents && (() => {
                                      const eventDate = new Date(opp.date + 'T00:00:00');
                                      const today = new Date();
                                      const daysUntilEvent = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                      const isWithinWeek = daysUntilEvent >= 0 && daysUntilEvent <= 7;
                                      const isReg = user.assignedShiftIds?.includes(shift.id);
                                      return isWithinWeek ? (
                                        <button onClick={() => setSelectedShiftId(shift.id)} className="px-6 py-3 rounded-full font-bold text-sm bg-brand text-white border border-brand flex items-center gap-2 shadow-elevation-2 active:scale-95">
                                          <span className="w-2 h-2 rounded-full bg-white" /> Ops Mode <ChevronRight size={14}/>
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleToggleRegistration(shift.id)}
                                          disabled={slotsLeft === 0 && !isReg}
                                          className={`px-6 py-3 rounded-full font-bold text-sm transition-all shadow-elevation-2 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 ${isReg ? 'bg-white text-zinc-900 border border-zinc-950' : 'bg-brand text-white border border-brand hover:opacity-95'}`}
                                        >
                                          {isReg ? <><span className="w-2 h-2 rounded-full bg-zinc-950" /> Cancel</> : <><span className="w-2 h-2 rounded-full bg-white" /> Register</>}
                                        </button>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            const isRsvped = user.rsvpedEventIds?.includes(opp.id);
                            return (
                              <div key={`opp-${opp.id}`} className={`bg-white rounded-[40px] border transition-all duration-300 flex flex-col group relative overflow-hidden ${isRsvped ? 'border-brand shadow-elevation-3' : 'border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow'}`}>
                                {isRsvped && (
                                  <div className="absolute top-0 right-0 px-6 py-2 bg-brand text-white rounded-bl-2xl rounded-tr-[44px] text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Check size={14} /> Confirmed
                                  </div>
                                )}
                                <div className="p-6 md:p-8 flex-1">
                                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-700 mb-4">
                                    <Calendar size={14} className="text-brand shrink-0" />
                                    {dateLabel}
                                  </div>
                                  <p className="text-xs font-bold text-brand mb-2">{normalizeCategory(opp.category)}</p>
                                  <h3 className="text-xl font-bold text-zinc-900 leading-tight mb-2 cursor-pointer hover:text-brand transition-colors" onClick={() => setShowEventDetail(opp)}>{opp.title}</h3>
                                  <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400 uppercase tracking-wide mb-4">
                                    <MapPin size={14} className="text-zinc-300" /> {opp.serviceLocation}
                                  </div>
                                  <p className="text-sm text-zinc-500 font-bold leading-relaxed line-clamp-2">{opp.description ? (opp.description.length > 100 ? opp.description.substring(0, 100) + '...' : opp.description) : ''}</p>
                                </div>
                                <div className="bg-zinc-50/70 p-4 md:p-6 rounded-t-2xl border-t-2 border-zinc-100 mt-auto">
                                  <div className="flex items-center justify-between gap-4">
                                    <p className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                      <Calendar size={14} className="text-brand shrink-0" />
                                      {new Date(opp.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                    {userMode === 'volunteer' && isRsvped && (
                                      <span className="px-6 py-3 rounded-full font-bold text-sm bg-white text-zinc-900 border border-zinc-950 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-zinc-950" /> Registered
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>
                    )}

                    {/* Past events — greyed out but clickable */}
                    {pastCards.length > 0 && (
                      <div className="mt-10 pt-8 border-t-2 border-zinc-100">
                        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wide mb-6 px-4 flex items-center gap-2">
                          <Clock size={16} /> Past Events
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {pastCards.map(card => {
                            const opp = card.opp;
                            const dateLabel = new Date(opp.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            const shift = card.type === 'shift' ? card.shift : null;
                            return (
                              <div
                                key={card.type === 'shift' ? `past-${shift!.id}` : `past-opp-${opp.id}`}
                                className="bg-zinc-50 rounded-[40px] border border-zinc-200 transition-all duration-300 flex flex-col overflow-hidden opacity-50 hover:opacity-75 cursor-pointer"
                                onClick={() => setShowEventDetail(opp)}
                              >
                                <div className="p-6 md:p-8 flex-1">
                                  <span className="px-3 py-1 bg-zinc-200 text-zinc-500 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 inline-block">Past</span>
                                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-500 mb-3">
                                    <Calendar size={14} className="text-zinc-400 shrink-0" />
                                    {dateLabel}
                                  </div>
                                  <p className="text-xs font-bold text-zinc-400 mb-1">{normalizeCategory(opp.category)}</p>
                                  <h3 className="text-lg font-bold text-zinc-600 leading-tight mb-2">{opp.title}</h3>
                                  <p className="text-sm text-zinc-400 flex items-center gap-2"><MapPin size={12} /> {opp.serviceLocation}</p>
                                </div>
                                {shift && (
                                  <div className="bg-zinc-100/50 p-4 md:p-6 border-t border-zinc-200 mt-auto">
                                    <p className="text-sm font-bold text-zinc-500 flex items-center gap-2">
                                      <Clock size={14} className="text-zinc-400 shrink-0" />
                                      {opp.time && opp.time !== 'TBD' ? opp.time : `${new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}

          {/* AVAILABLE TAB — flat grid matching My Schedule layout */}
          {activeTab === 'available' && (
            <>
            {(Object.keys(groupedByDate).length === 0 || Object.values(groupedByDate).every(d => d.shifts.length === 0 && d.opportunities.length === 0)) && (
                <div className="py-32 text-center bg-zinc-50 rounded-[40px] border border-dashed border-zinc-200">
                    <Calendar className="mx-auto text-zinc-200 mb-6" size={64} strokeWidth={1.5}/>
                    <p className="text-zinc-400 font-bold text-sm">No available missions found.</p>
                    <p className="text-sm text-zinc-300 mt-2">Check back later for new opportunities.</p>
                </div>
            )}
            {Object.values(groupedByDate).some(d => d.shifts.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Object.entries(groupedByDate).flatMap(([, dateData]: [string, { shifts: Shift[], opportunities: Opportunity[] }]) =>
                        dateData.shifts.map(shift => {
                            const opp = getOpp(shift.opportunityId);
                            if (!opp) return null;
                            const isRegistered = user.assignedShiftIds?.includes(shift.id);
                            const slotsLeft = shift.slotsTotal - shift.slotsFilled;

                            const regStatus = getRegistrationStatus(opp);
                            const isPendingTraining = isRegistered && regStatus.isPending;

                            return (
                                <div key={shift.id} className={`bg-white rounded-[40px] border transition-all duration-300 flex flex-col group relative overflow-hidden ${isPendingTraining ? 'border-amber-400 shadow-sm hover:shadow-2xl transition-shadow' : isRegistered ? 'border-brand shadow-elevation-3' : 'border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow'}`}>
                                    {isRegistered && (
                                       <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-2xl rounded-tr-[44px] text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isPendingTraining ? 'bg-amber-500 text-white' : 'bg-brand text-white'}`}>
                                          {isPendingTraining ? <><AlertTriangle size={12} /> Pending Approval</> : <><Check size={14} /> Confirmed</>}
                                       </div>
                                    )}
                                    {isPendingTraining && (
                                      <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start gap-3">
                                        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                          <p className="text-xs font-bold text-amber-800">Complete {regStatus.program} training to confirm</p>
                                          <p className="text-[11px] text-amber-600 mt-0.5">Go to Training Academy to finish the remaining modules.</p>
                                        </div>
                                      </div>
                                    )}
                                    <div className="p-6 md:p-8 flex-1">
                                      <div className="flex items-center gap-2 text-sm font-bold text-zinc-700 mb-4">
                                        <Calendar size={14} className="text-brand shrink-0" />
                                        {new Date(opp.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                      </div>
                                      <div className="flex justify-between items-start mb-4">
                                        {(() => {
                                          const rawUrgency = (opp.urgency || 'medium').toLowerCase().replace(/_/g, ' ');
                                          const urgencyLabel = rawUrgency === 'save the date' ? 'Upcoming' : rawUrgency === 'high' ? 'High' : rawUrgency === 'low' ? 'Low' : 'Medium';
                                          const isHigh = urgencyLabel === 'High';
                                          return (
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${isHigh ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}>
                                              {urgencyLabel}
                                            </span>
                                          );
                                        })()}
                                         <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${slotsLeft === 0 ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                            {slotsLeft === 0 ? 'Full' : `${slotsLeft} ${slotsLeft === 1 ? 'Spot' : 'Spots'} Left`}
                                         </div>
                                      </div>

                                      <p className="text-xs font-bold text-brand mb-2">{normalizeCategory(opp.category)}</p>
                                      <h3 className="text-xl font-bold text-zinc-900 leading-tight mb-2 cursor-pointer hover:text-brand transition-colors" onClick={() => setShowEventDetail(opp)}>{opp.title}</h3>
                                      <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400 uppercase tracking-wide mb-6">
                                        <MapPin size={14} className="text-zinc-300" /> {opp.serviceLocation}
                                      </div>
                                      <p className="text-sm text-zinc-500 font-bold leading-relaxed line-clamp-2">{opp.description ? (opp.description.length > 100 ? opp.description.substring(0, 100) + '...' : opp.description) : ''}</p>
                                    </div>

                                    <div className="bg-zinc-50/70 p-4 md:p-6 rounded-t-2xl border-t-2 border-zinc-100 mt-auto">
                                       <div className="flex items-center justify-between gap-4">
                                          <div className="min-w-0">
                                            <p className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                              <Clock size={14} className="text-brand shrink-0" />
                                              {opp.time && opp.time !== 'TBD' ? opp.time : `${new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                            </p>
                                          </div>
                                          {userMode === 'volunteer' && (() => {
                                            const volRegStatus = getRegistrationStatus(opp);
                                            if (!volRegStatus.canRegister && !isRegistered) {
                                              return (
                                                <div className="text-right max-w-[200px]">
                                                  <p className="text-[10px] text-zinc-400 font-bold leading-tight">{volRegStatus.message}</p>
                                                </div>
                                              );
                                            }
                                            return (
                                              <button
                                                onClick={() => handleToggleRegistration(shift.id)}
                                                disabled={registeringShiftIds.has(shift.id) || (slotsLeft === 0 && !isRegistered)}
                                                className={`px-6 py-3 rounded-full font-bold text-sm transition-all shadow-elevation-2 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 ${isPendingTraining ? 'bg-amber-500 text-white border border-amber-500' : isRegistered ? 'bg-white text-zinc-900 border border-zinc-950' : 'bg-brand text-white border border-brand hover:opacity-95'}`}
                                              >
                                                {registeringShiftIds.has(shift.id) ? <><Loader2 size={14} className="animate-spin" /> Working...</> : isRegistered ? <><span className={`w-2 h-2 rounded-full ${isPendingTraining ? 'bg-white' : 'bg-zinc-950'}`} /> Unregister</> : <><span className="w-2 h-2 rounded-full bg-white" /> Register</>}
                                              </button>
                                            );
                                          })()}
                                          {canManageEvents && !user.assignedShiftIds?.includes(shift.id) && (
                                            (() => {
                                              const isRegistered = user.assignedShiftIds?.includes(shift.id);
                                              return (
                                                <button
                                                  onClick={() => handleToggleRegistration(shift.id)}
                                                  disabled={slotsLeft === 0 && !isRegistered}
                                                  className={`px-6 py-3 rounded-full font-bold text-sm transition-all shadow-elevation-2 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 ${isRegistered ? 'bg-white text-zinc-900 border border-zinc-950' : 'bg-brand text-white border border-brand hover:opacity-95'}`}
                                                >
                                                  {isRegistered ? <><span className="w-2 h-2 rounded-full bg-zinc-950" /> Cancel</> : <><span className="w-2 h-2 rounded-full bg-white" /> Register</>}
                                                </button>
                                              );
                                            })()
                                          )}
                                       </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ShiftsComponent;
