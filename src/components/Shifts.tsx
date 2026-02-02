
import React, { useState, useRef } from 'react';
import { Opportunity, Shift, Volunteer } from '../types';
import { analyticsService } from '../services/analyticsService';
import { Clock, Check, Calendar, MapPin, Search, ChevronLeft, ChevronRight, UserPlus, XCircle, Mail, Sparkles, Info, Plus, Users, Upload, X, FileText, Loader2, Download } from 'lucide-react';
import EventOpsMode from './EventOpsMode';
import EventBuilder from './EventBuilder';
import StaffingSuggestions from './StaffingSuggestions';
import { apiService } from '../services/apiService';

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
                with <span className="font-bold text-blue-600">{result.shiftsCreated}</span> volunteer shifts.
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

interface ShiftsProps {
  userMode: 'volunteer' | 'admin';
  user: Volunteer;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  onUpdate: (u: Volunteer) => void;
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  allVolunteers: Volunteer[];
}

const ShiftsComponent: React.FC<ShiftsProps> = ({ userMode, user, shifts, setShifts, onUpdate, opportunities, setOpportunities, allVolunteers }) => {
  const [activeTab, setActiveTab] = useState<'available' | 'my-schedule' | 'manage'>(userMode === 'admin' ? 'manage' : 'my-schedule');
  const [searchQuery, setSearchQuery] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [showEventBuilder, setShowEventBuilder] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showStaffingModal, setShowStaffingModal] = useState<{ role: string; eventDate: string } | null>(null);
  
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
    // In a real app, you would find the specific shift and update it.
    alert(`Assigned volunteer ${volunteerId} to the ${showStaffingModal.role} shift.`);
    setShowStaffingModal(null);
  };
  
  if (selectedShiftId) {
    const selectedShift = shifts.find(s => s.id === selectedShiftId);
    const opportunity = getOpp(selectedShift?.opportunityId || '');
    if (!selectedShift || !opportunity) {
        setSelectedShiftId(null);
        return null;
    }
    return <EventOpsMode shift={selectedShift} opportunity={opportunity} user={user} onBack={() => setSelectedShiftId(null)} onUpdateUser={onUpdate} />;
  }

  // For "my-schedule", include both assigned shifts AND rsvped events (opportunities)
  const shiftsToDisplay = activeTab === 'available'
    ? shifts.filter(s => !user.assignedShiftIds?.includes(s.id))
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
  
  // Group shifts by date
  const groupedByDate = filteredShifts.reduce((acc, shift) => {
    const date = new Date(shift.startTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[date]) acc[date] = { shifts: [], opportunities: [] };
    acc[date].shifts.push(shift);
    return acc;
  }, {} as Record<string, { shifts: Shift[], opportunities: Opportunity[] }>);

  // Add rsvped opportunities without shifts to the grouped data
  filteredRsvpedOpps.forEach(opp => {
    const date = new Date(opp.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!groupedByDate[date]) groupedByDate[date] = { shifts: [], opportunities: [] };
    groupedByDate[date].opportunities.push(opp);
  });

  const tabs = [
    ...(userMode === 'admin' ? [{ id: 'manage', label: 'Manage Events' }] : []),
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
       {showStaffingModal && <StaffingSuggestions {...showStaffingModal} allVolunteers={allVolunteers} assignedVolunteerIds={[]} onClose={() => setShowStaffingModal(null)} onAssign={handleAssignVolunteer} />}
      
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
      
      {activeTab === 'manage' && userMode === 'admin' && (
        <div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
             <button onClick={() => setShowEventBuilder(true)} className="flex items-center justify-center gap-3 px-6 py-6 bg-zinc-900 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg hover:bg-zinc-800 transition-colors">
                  <Plus size={16} /> Create New Event
              </button>
              <button onClick={() => setShowBulkUploadModal(true)} className="flex items-center justify-center gap-3 px-6 py-6 bg-[#233DFF] text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity">
                  <Upload size={16} /> Bulk Import Events
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
           <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-4 px-2">All Events</h3>
            <div className="space-y-4">
              {opportunities.filter(o => o.approvalStatus !== 'pending').map(opp => (
                 <div key={opp.id} className={`bg-white p-6 rounded-2xl border shadow-sm ${opp.approvalStatus === 'rejected' ? 'border-rose-200 opacity-60' : 'border-zinc-100'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold">{opp.title}</h3>
                        <p className="text-xs text-zinc-400">{opp.date} • {opp.serviceLocation}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                        opp.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        opp.approvalStatus === 'rejected' ? 'bg-rose-100 text-rose-600' :
                        'bg-zinc-100 text-zinc-500'
                      }`}>
                        {opp.approvalStatus || 'Published'}
                      </span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-zinc-100 space-y-2">
                      {opp.staffingQuotas.map(q => (
                        <div key={q.role} className="flex justify-between items-center text-sm">
                          <span className="font-bold">{q.role}</span>
                          <div className="flex items-center gap-2">
                             <span className={`${q.filled < q.count ? 'text-rose-500' : 'text-emerald-500'}`}>{q.filled} / {q.count} Filled</span>
                             {q.filled < q.count && <button onClick={() => setShowStaffingModal({ role: q.role, eventDate: opp.date })} className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">Find Volunteer</button>}
                          </div>
                        </div>
                      ))}
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
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
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                            opp.urgency === 'high' ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-zinc-50 text-zinc-400 border-zinc-100'
                                          }`}>{opp.urgency || 'medium'} Urgency
                                        </span>
                                         <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${slotsLeft === 0 ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                            {slotsLeft === 0 ? 'Full' : `${slotsLeft} Spots Left`}
                                         </div>
                                      </div>

                                      <p className="text-xs font-bold text-[#233DFF] mb-2">{opp.category}</p>
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
                                              {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                          {userMode === 'admin' && (
                                            (() => {
                                              const eventDate = new Date(opp.date);
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
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                            opp.urgency === 'high' ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-zinc-50 text-zinc-400 border-zinc-100'
                                          }`}>{opp.urgency || 'medium'} Urgency
                                        </span>
                                         <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${slotsLeft === 0 ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                            {slotsLeft === 0 ? 'Full' : `${slotsLeft} Spots Left`}
                                         </div>
                                      </div>

                                      <p className="text-xs font-bold text-[#233DFF] mb-2">{opp.category}</p>
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
                                              {new Date(opp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
        </div>
      )}
    </div>
  );
};

export default ShiftsComponent;
