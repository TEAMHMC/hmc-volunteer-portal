
import React, { useState, useRef, useEffect } from 'react';
import { Opportunity, Shift, Volunteer } from '../types';
import { analyticsService } from '../services/analyticsService';
import { Clock, Check, Calendar, MapPin, ChevronRight, UserPlus, XCircle, Mail, Plus, Users, Upload, X, FileText, Loader2, Download, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { EVENT_CATEGORIES } from '../constants';
import { APP_CONFIG } from '../config';
import EventOpsMode from './EventOpsMode';
import EventBuilder from './EventBuilder';
import StaffingSuggestions from './StaffingSuggestions';
import { apiService } from '../services/apiService';

// Normalize event category for consistent display
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
  if (lower.includes('wellness')) return 'Wellness';
  return cat || 'Other';
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl">
        <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-zinc-900">Bulk Import Events</h2>
            <p className="text-sm text-zinc-500 mt-1">Upload a CSV file to create multiple events at once</p>
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
              <p className="text-zinc-500">
                Successfully imported <span className="font-bold text-emerald-600">{result.importedCount}</span> events
                with <span className="font-bold text-[#233DFF]">{result.shiftsCreated}</span> volunteer shifts.
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-8 py-3 bg-zinc-900 text-white rounded-full font-bold text-sm"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <Download size={18} />
                <span className="font-bold text-sm">Download CSV Template</span>
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
                      className="font-bold text-[#233DFF] hover:underline"
                    >
                      Click to upload
                    </button>
                    <span className="text-zinc-400"> or drag and drop</span>
                    <p className="text-xs text-zinc-400 mt-2">CSV files only</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm">
                  {error}
                </div>
              )}

              <div className="bg-zinc-50 p-4 rounded-xl">
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
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#233DFF] text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Importing Events...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
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
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const slotsTotal = quotas.reduce((sum, q) => sum + q.count, 0);
      // Build a readable time string like "10:00 AM - 2:00 PM"
      const fmt = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
      };
      const time = `${fmt(startTime)} - ${fmt(endTime)}`;
      await onSave({ title, description, date, serviceLocation: location, category, startTime, endTime, time, estimatedAttendees, staffingQuotas: quotas, slotsTotal });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-zinc-900">Edit Event</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X size={18} className="text-zinc-400" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-20 p-3 bg-zinc-50 border border-zinc-200 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Event Type</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                {EVENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Location</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Estimated Attendees</label>
            <input type="number" value={estimatedAttendees} onChange={e => setEstimatedAttendees(parseInt(e.target.value) || 0)} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg" />
          </div>

          {/* Staffing Quotas */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-2">Volunteer Staffing</label>
            <div className="space-y-2">
              {quotas.map((q, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={q.role}
                    onChange={e => handleQuotaChange(idx, 'role', e.target.value)}
                    className="flex-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm"
                  >
                    {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input
                    type="number"
                    min={Math.max(q.filled, 0)}
                    value={q.count}
                    onChange={e => handleQuotaChange(idx, 'count', e.target.value)}
                    className="w-20 p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-center"
                  />
                  <span className="text-xs text-zinc-400 shrink-0">slots</span>
                  {q.filled > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 shrink-0">{q.filled} filled</span>
                  )}
                  <button
                    onClick={() => handleRemoveQuota(idx)}
                    className="p-1.5 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                    title={q.filled > 0 ? 'Has assigned volunteers' : 'Remove role'}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleAddQuota}
              className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#233DFF] hover:text-[#1a2fbf] transition-colors"
            >
              <Plus size={14} /> Add Role
            </button>
          </div>
        </div>
        <div className="p-6 border-t border-zinc-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-bold text-sm">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 bg-[#233DFF] text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save Changes
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
}

const ShiftsComponent: React.FC<ShiftsProps> = ({ userMode, user, shifts, setShifts, onUpdate, opportunities, setOpportunities, allVolunteers, setAllVolunteers }) => {
  const canManageEvents = userMode === 'admin' || userMode === 'coordinator';
  const [activeTab, setActiveTab] = useState<'available' | 'my-schedule' | 'manage'>(canManageEvents ? 'manage' : 'my-schedule');
  const [searchQuery, setSearchQuery] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [showEventBuilder, setShowEventBuilder] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showStaffingModal, setShowStaffingModal] = useState<{ role: string; eventDate: string; eventId: string; eventTitle: string; eventLocation: string } | null>(null);
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

  const handleToggleRegistration = async (shiftId: string) => {
    const isRegistered = user.assignedShiftIds?.includes(shiftId);
    let updatedIds: string[];

    if (isRegistered) {
      updatedIds = user.assignedShiftIds?.filter(id => id !== shiftId) || [];
      setToastMsg('You have unregistered from the shift.');
    } else {
      updatedIds = [...(user.assignedShiftIds || []), shiftId];
      setToastMsg('Successfully registered for the shift!');
    }
    
    const originalUser = { ...user };
    onUpdate({ ...user, assignedShiftIds: updatedIds });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);

    try {
      await apiService.put('/api/volunteer', { ...user, assignedShiftIds: updatedIds });
      analyticsService.logEvent(isRegistered ? 'shift_unregister' : 'shift_register', { shiftId, userId: user.id });
    } catch (error) {
      console.error("Failed to update shift registration:", error);
      onUpdate(originalUser); // Rollback on failure
      setToastMsg('Failed to update registration. Please try again.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };
  
  const handleSaveEvent = async (newEventData: Omit<Opportunity, 'id'>) => {
      // API call creates the opportunity and associated shifts
      const result = await apiService.post('/api/opportunities', { opportunity: newEventData });
      setOpportunities(prev => [...prev, { id: result.id, ...newEventData }]);

      // Also add the created shifts to state so volunteers can see them immediately
      if (result.shifts && result.shifts.length > 0) {
        setShifts(prev => [...prev, ...result.shifts]);
      }
  };

  const handleAssignVolunteer = async (volunteerId: string) => {
    if (!showStaffingModal) return;
    const { role, eventId, eventDate, eventTitle, eventLocation } = showStaffingModal;

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
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (e: any) {
      console.error('Failed to assign volunteer:', e);
      setToastMsg(e.message || 'Failed to assign volunteer.');
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
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch (e: any) {
      setToastMsg(e.message || 'Sync failed');
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
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (e) {
      console.error('Failed to delete event', e);
      setToastMsg('Failed to delete event.');
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
      // Sync shifts: replace all shifts for this opportunity with the ones from the server
      if (returnedShifts?.length) {
        setShifts(prev => {
          const otherShifts = prev.filter(s => s.opportunityId !== editingEvent.id);
          return [...otherShifts, ...returnedShifts];
        });
      }
      setEditingEvent(null);
      setToastMsg('Event updated successfully.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (e) {
      console.error('Failed to update event', e);
      setToastMsg('Failed to update event.');
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

  if (selectedShiftId && selectedShift && selectedOpp) {
    return <EventOpsMode shift={selectedShift} opportunity={selectedOpp} user={user} onBack={() => setSelectedShiftId(null)} onUpdateUser={onUpdate} />;
  }

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
        return !user.assignedShiftIds?.includes(s.id) && opp && !isPastEvent(opp.date);
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
    return opp && (opp.title.toLowerCase().includes(searchQuery.toLowerCase()) || opp.serviceLocation.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Filter rsvped opportunities by search query
  const filteredRsvpedOpps = rsvpedOppsWithoutShifts.filter(o =>
    o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.serviceLocation.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const tabs = [
    ...(canManageEvents ? [{ id: 'manage', label: 'Manage Events' }] : []),
    { id: 'available', label: 'Available Missions' },
    { id: 'my-schedule', label: 'My Schedule' },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-32">
       {showToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-10 py-6 rounded-full shadow-2xl flex items-center gap-4 z-[5000] animate-in slide-in-from-bottom-10">
           <div className="p-2 bg-emerald-500 rounded-lg"><Mail size={16} /></div>
           <span className="text-sm font-black uppercase tracking-widest">{toastMsg}</span>
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
             setShowToast(true);
             setTimeout(() => setShowToast(false), 3000);
           }}
         />
       )}
       {showStaffingModal && <StaffingSuggestions role={showStaffingModal.role} eventDate={showStaffingModal.eventDate} eventId={showStaffingModal.eventId} eventTitle={showStaffingModal.eventTitle} allVolunteers={allVolunteers} assignedVolunteerIds={shifts.find(s => s.opportunityId === showStaffingModal.eventId && s.roleType === showStaffingModal.role)?.assignedVolunteerIds || []} onClose={() => setShowStaffingModal(null)} onAssign={handleAssignVolunteer} />}
       {editingEvent && <EditEventModal event={editingEvent} shifts={shifts} onClose={() => setEditingEvent(null)} onSave={handleUpdateEvent} />}
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="max-w-xl">
          <h2 className="text-5xl font-black text-zinc-900 tracking-tighter uppercase leading-none">My Missions</h2>
          <p className="text-zinc-500 mt-4 font-medium text-lg leading-relaxed">Find, join, and manage community health events.</p>
        </div>
        <div className="flex bg-white border border-zinc-100 p-2 rounded-full shadow-sm shrink-0">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-10 py-4 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-[#233DFF] text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {activeTab === 'manage' && canManageEvents && (
        <div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
             <button onClick={() => setShowEventBuilder(true)} className="flex items-center justify-center gap-3 px-6 py-6 bg-zinc-900 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg hover:bg-zinc-800 transition-colors">
                  <Plus size={16} /> Create New Event
              </button>
              <button onClick={handleSyncFromFinder} disabled={isSyncing} className="flex items-center justify-center gap-3 px-6 py-6 bg-[#233DFF] text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50">
                  {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} {isSyncing ? 'Syncing...' : 'Sync from Event Finder'}
              </button>
              <button onClick={() => setShowBulkUploadModal(true)} className="flex items-center justify-center gap-3 px-6 py-6 bg-white border-2 border-zinc-200 text-zinc-700 rounded-2xl text-sm font-black uppercase tracking-widest shadow-sm hover:border-zinc-300 transition-colors">
                  <Upload size={16} /> Bulk Import CSV
              </button>
           </div>

           {/* Pending Approval Section */}
           {opportunities.filter(o => o.approvalStatus === 'pending').length > 0 && (
             <div className="mb-8">
               <h3 className="text-sm font-black text-amber-600 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
                 <Clock size={14} /> Pending Approval ({opportunities.filter(o => o.approvalStatus === 'pending').length})
               </h3>
               <div className="space-y-4">
                 {opportunities.filter(o => o.approvalStatus === 'pending').map(opp => (
                   <div key={opp.id} className="bg-amber-50 p-6 rounded-2xl border-2 border-amber-200">
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
                             } catch (e) { console.error('Failed to approve', e); }
                           }}
                           className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-600"
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
                             } catch (e) { console.error('Failed to reject', e); }
                           }}
                           className="px-4 py-2 bg-rose-100 text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-rose-200"
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
           <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-6 px-2">All Events</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...opportunities].filter(o => o.approvalStatus !== 'pending').sort((a, b) => {
                const dateA = new Date(a.date + 'T00:00:00').getTime();
                const dateB = new Date(b.date + 'T00:00:00').getTime();
                return dateA - dateB;
              }).map(opp => (
                 <div key={opp.id} className={`bg-white p-6 rounded-2xl border shadow-sm flex flex-col ${opp.approvalStatus === 'rejected' ? 'border-rose-200 opacity-60' : 'border-zinc-100'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-bold truncate">{opp.title}</h3>
                        <p className="text-xs text-zinc-400">{new Date(opp.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}{opp.time && opp.time !== 'TBD' ? ` • ${opp.time}` : ''} • {opp.serviceLocation}</p>
                        <p className="text-[10px] text-zinc-300 font-bold mt-1">{normalizeCategory(opp.category)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                        opp.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        opp.approvalStatus === 'rejected' ? 'bg-rose-100 text-rose-600' :
                        'bg-zinc-100 text-zinc-500'
                      }`}>
                        {opp.approvalStatus || 'Published'}
                      </span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-zinc-100 space-y-3 flex-1">
                      {(opp.staffingQuotas || []).map(q => {
                        const matchingShift = shifts.find(s => s.opportunityId === opp.id && s.roleType === q.role);
                        const assignedIds = [...new Set(matchingShift?.assignedVolunteerIds || [])];
                        const assignedVols = assignedIds.map(id => allVolunteers.find(v => v.id === id)).filter(Boolean) as Volunteer[];
                        return (
                          <div key={q.role}>
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-bold">{q.role}</span>
                              <div className="flex items-center gap-2">
                                <span className={`${q.filled < q.count ? 'text-rose-500' : 'text-emerald-500'}`}>{q.filled} / {q.count} Filled</span>
                                {q.filled < q.count && <button onClick={() => setShowStaffingModal({ role: q.role, eventDate: opp.date, eventId: opp.id, eventTitle: opp.title, eventLocation: opp.serviceLocation })} className="text-xs font-bold bg-[#233DFF]/10 text-[#233DFF] px-2 py-1 rounded-full">Find Volunteer</button>}
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
                                          setShifts(prev => prev.map(s => s.id === matchingShift.id ? { ...s, slotsFilled: s.slotsFilled - 1, assignedVolunteerIds: s.assignedVolunteerIds.filter(id => id !== v.id) } : s));
                                          setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, staffingQuotas: (o.staffingQuotas || []).map(sq => sq.role === q.role ? { ...sq, filled: Math.max(0, (sq.filled || 0) - 1) } : sq) } : o));
                                          if (setAllVolunteers) {
                                            setAllVolunteers(prev => prev.map(vol => vol.id === v.id ? { ...vol, rsvpedEventIds: (vol.rsvpedEventIds || []).filter(id => id !== opp.id), assignedShiftIds: (vol.assignedShiftIds || []).filter(id => id !== matchingShift.id) } : vol));
                                          }
                                        } catch (e) { console.error('Failed to unassign', e); }
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
                      })}
                    </div>
                    {/* RSVP'd volunteers not assigned to a specific shift */}
                    {(() => {
                      const allAssignedIds = shifts.filter(s => s.opportunityId === opp.id).flatMap(s => s.assignedVolunteerIds || []);
                      const rsvpOnly = allVolunteers.filter(v => v.rsvpedEventIds?.includes(opp.id) && !allAssignedIds.includes(v.id));
                      if (rsvpOnly.length === 0) return null;
                      return (
                        <div className="mt-3 pt-3 border-t border-zinc-100">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">RSVP'd ({rsvpOnly.length})</p>
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
                                    } catch (e) { console.error('Failed to remove RSVP', e); }
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
                    <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center gap-2">
                      <button onClick={() => setEditingEvent(opp)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-bold transition-colors">
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => handleDeleteEvent(opp.id)} className="flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg text-xs font-bold transition-colors">
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
            {(Object.keys(groupedByDate).length === 0 || Object.values(groupedByDate).every(d => d.shifts.length === 0 && d.opportunities.length === 0)) && (
                <div className="py-32 text-center bg-zinc-50 rounded-[56px] border border-dashed border-zinc-200">
                    <Calendar className="mx-auto text-zinc-200 mb-6" size={64} strokeWidth={1.5}/>
                    <p className="text-lg font-bold text-zinc-400 italic">
                      {activeTab === 'my-schedule' ? "You have no upcoming missions." : "No available missions found."}
                    </p>
                    <p className="text-sm text-zinc-300 mt-2">{activeTab === 'available' ? "Check back later for new opportunities." : "Browse available missions to get started."}</p>
                </div>
            )}
            {Object.entries(groupedByDate).map(([date, dateData]: [string, { shifts: Shift[], opportunities: Opportunity[] }]) => (
                <div key={date}>
                    <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-6 px-4">{date}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {/* Render shifts */}
                        {dateData.shifts.map(shift => {
                            const opp = getOpp(shift.opportunityId);
                            if (!opp) return null;
                            const isRegistered = user.assignedShiftIds?.includes(shift.id);
                            const slotsLeft = shift.slotsTotal - shift.slotsFilled;

                            return (
                                <div key={shift.id} className={`bg-white rounded-[48px] border-2 transition-all duration-300 flex flex-col group relative overflow-hidden ${isRegistered ? 'border-[#233DFF] shadow-2xl' : 'border-zinc-100 shadow-sm hover:border-zinc-200 hover:shadow-xl'}`}>
                                    {isRegistered && (
                                       <div className="absolute top-0 right-0 px-6 py-2 bg-[#233DFF] text-white rounded-bl-2xl rounded-tr-[44px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                          <Check size={14} /> Confirmed
                                       </div>
                                    )}
                                    <div className="p-10 flex-1">
                                      <div className="flex justify-between items-start mb-6">
                                        {(() => {
                                          const rawUrgency = (opp.urgency || 'medium').toLowerCase().replace(/_/g, ' ');
                                          const urgencyLabel = rawUrgency === 'save the date' ? 'Upcoming' : rawUrgency === 'high' ? 'High' : rawUrgency === 'low' ? 'Low' : 'Medium';
                                          const isHigh = urgencyLabel === 'High';
                                          return (
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${isHigh ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}>
                                              {urgencyLabel}
                                            </span>
                                          );
                                        })()}
                                         <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${slotsLeft === 0 ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                            {slotsLeft === 0 ? 'Full' : `${slotsLeft} ${slotsLeft === 1 ? 'Spot' : 'Spots'} Left`}
                                         </div>
                                      </div>

                                      <p className="text-xs font-bold text-[#233DFF] mb-2">{normalizeCategory(opp.category)}</p>
                                      <h3 className="text-2xl font-black text-zinc-900 tracking-tighter leading-tight mb-3">{opp.title}</h3>
                                      <div className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-6">
                                        <MapPin size={14} className="text-zinc-300" /> {opp.serviceLocation}
                                      </div>
                                      <p className="text-sm text-zinc-500 font-medium leading-relaxed h-16 overflow-hidden">{opp.description?.substring(0, 120)}...</p>
                                    </div>

                                    <div className="bg-zinc-50/70 p-8 rounded-t-[32px] border-t-2 border-zinc-100 mt-auto">
                                       <div className="flex items-center justify-between gap-4">
                                          <div className="min-w-0">
                                            <p className="text-[9px] font-black text-zinc-300 uppercase tracking-widest mb-2">Time</p>
                                            <p className="text-sm font-black text-zinc-900 tracking-tight flex items-center gap-2">
                                              <Clock size={14} className="text-[#233DFF] shrink-0" />
                                              {opp.time && opp.time !== 'TBD' ? opp.time : `${new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                            </p>
                                          </div>
                                          {userMode === 'volunteer' && (
                                            <button
                                              onClick={() => handleToggleRegistration(shift.id)}
                                              disabled={slotsLeft === 0 && !isRegistered}
                                              className={`px-6 py-4 rounded-full border border-black font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 ${isRegistered ? 'bg-white text-rose-500' : 'bg-[#233DFF] text-white hover:opacity-95'}`}
                                            >
                                              {isRegistered ? <><XCircle size={14} /> Cancel</> : <><UserPlus size={14} /> Register</>}
                                            </button>
                                          )}
                                          {canManageEvents && (
                                            (() => {
                                              const eventDate = new Date(opp.date + 'T00:00:00');
                                              const today = new Date();
                                              const daysUntilEvent = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                              const isWithinWeek = daysUntilEvent >= 0 && daysUntilEvent <= 7;
                                              const isRegistered = user.assignedShiftIds?.includes(shift.id);

                                              return isWithinWeek ? (
                                                <button onClick={() => setSelectedShiftId(shift.id)} className="px-6 py-4 rounded-full border border-black font-black text-[10px] uppercase tracking-widest bg-zinc-900 text-white flex items-center gap-2 shadow-lg active:scale-95">
                                                   Ops Mode <ChevronRight size={14}/>
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={() => handleToggleRegistration(shift.id)}
                                                  disabled={slotsLeft === 0 && !isRegistered}
                                                  className={`px-6 py-4 rounded-full border border-black font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 ${isRegistered ? 'bg-white text-rose-500' : 'bg-[#233DFF] text-white hover:opacity-95'}`}
                                                >
                                                  {isRegistered ? <><XCircle size={14} /> Cancel</> : <><UserPlus size={14} /> Register</>}
                                                </button>
                                              );
                                            })()
                                          )}
                                       </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Render rsvped opportunities without shifts (from EventExplorer signups) */}
                        {dateData.opportunities.map(opp => {
                            const isRsvped = user.rsvpedEventIds?.includes(opp.id);
                            const slotsLeft = opp.slotsTotal - (opp.slotsFilled || 0);

                            return (
                                <div key={`opp-${opp.id}`} className={`bg-white rounded-[48px] border-2 transition-all duration-300 flex flex-col group relative overflow-hidden ${isRsvped ? 'border-[#233DFF] shadow-2xl' : 'border-zinc-100 shadow-sm hover:border-zinc-200 hover:shadow-xl'}`}>
                                    {isRsvped && (
                                       <div className="absolute top-0 right-0 px-6 py-2 bg-[#233DFF] text-white rounded-bl-2xl rounded-tr-[44px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                          <Check size={14} /> Confirmed
                                       </div>
                                    )}
                                    <div className="p-10 flex-1">
                                      <div className="flex justify-between items-start mb-6">
                                        {(() => {
                                          const rawUrgency = (opp.urgency || 'medium').toLowerCase().replace(/_/g, ' ');
                                          const urgencyLabel = rawUrgency === 'save the date' ? 'Upcoming' : rawUrgency === 'high' ? 'High' : rawUrgency === 'low' ? 'Low' : 'Medium';
                                          const isHigh = urgencyLabel === 'High';
                                          return (
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${isHigh ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}>
                                              {urgencyLabel}
                                            </span>
                                          );
                                        })()}
                                         <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${slotsLeft === 0 ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                            {slotsLeft === 0 ? 'Full' : `${slotsLeft} ${slotsLeft === 1 ? 'Spot' : 'Spots'} Left`}
                                         </div>
                                      </div>

                                      <p className="text-xs font-bold text-[#233DFF] mb-2">{normalizeCategory(opp.category)}</p>
                                      <h3 className="text-2xl font-black text-zinc-900 tracking-tighter leading-tight mb-3">{opp.title}</h3>
                                      <div className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-6">
                                        <MapPin size={14} className="text-zinc-300" /> {opp.serviceLocation}
                                      </div>
                                      <p className="text-sm text-zinc-500 font-medium leading-relaxed h-16 overflow-hidden">{opp.description?.substring(0, 120)}...</p>
                                    </div>

                                    <div className="bg-zinc-50/70 p-8 rounded-t-[32px] border-t-2 border-zinc-100 mt-auto">
                                       <div className="flex items-center justify-between gap-4">
                                          <div className="min-w-0">
                                            <p className="text-[9px] font-black text-zinc-300 uppercase tracking-widest mb-2">Event Date</p>
                                            <p className="text-sm font-black text-zinc-900 tracking-tight flex items-center gap-2">
                                              <Calendar size={14} className="text-[#233DFF] shrink-0" />
                                              {new Date(opp.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                          </div>
                                          {userMode === 'volunteer' && isRsvped && (
                                            <span className="px-6 py-4 rounded-full bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                                              <Check size={14} /> Registered
                                            </span>
                                          )}
                                       </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Past Events Section - Only show on my-schedule tab */}
            {activeTab === 'my-schedule' && hasPastEvents && (
              <div className="mt-16 pt-8 border-t-2 border-zinc-100">
                <h3 className="text-lg font-black text-zinc-300 uppercase tracking-widest mb-8 px-4 flex items-center gap-3">
                  <Clock size={20} /> Past Events
                </h3>
                {Object.entries(pastGroupedByDate).map(([date, dateData]: [string, { shifts: Shift[], opportunities: Opportunity[] }]) => (
                  <div key={`past-${date}`} className="mb-8">
                    <h4 className="text-sm font-black text-zinc-300 uppercase tracking-widest mb-4 px-4">{date}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {dateData.shifts.map(shift => {
                        const opp = getOpp(shift.opportunityId);
                        if (!opp) return null;
                        return (
                          <div key={`past-shift-${shift.id}`} className="bg-zinc-50 rounded-[32px] border border-zinc-200 p-8 opacity-60">
                            <span className="px-3 py-1 bg-zinc-200 text-zinc-500 rounded-full text-[9px] font-black uppercase tracking-widest mb-4 inline-block">Past Event</span>
                            <p className="text-xs font-bold text-zinc-400 mb-1">{normalizeCategory(opp.category)}</p>
                            <h4 className="text-lg font-black text-zinc-600 mb-2">{opp.title}</h4>
                            <p className="text-sm text-zinc-400 flex items-center gap-2"><MapPin size={12} /> {opp.serviceLocation}</p>
                          </div>
                        );
                      })}
                      {dateData.opportunities.map(opp => (
                        <div key={`past-opp-${opp.id}`} className="bg-zinc-50 rounded-[32px] border border-zinc-200 p-8 opacity-60">
                          <span className="px-3 py-1 bg-zinc-200 text-zinc-500 rounded-full text-[9px] font-black uppercase tracking-widest mb-4 inline-block">Past Event</span>
                          <p className="text-xs font-bold text-zinc-400 mb-1">{normalizeCategory(opp.category)}</p>
                          <h4 className="text-lg font-black text-zinc-600 mb-2">{opp.title}</h4>
                          <p className="text-sm text-zinc-400 flex items-center gap-2"><MapPin size={12} /> {opp.serviceLocation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default ShiftsComponent;
