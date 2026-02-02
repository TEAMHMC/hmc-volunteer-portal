
import React, { useState } from 'react';
import { Opportunity, Shift, Volunteer } from '../types';
import { analyticsService } from '../services/analyticsService';
import { Clock, Check, Calendar, MapPin, Search, ChevronLeft, ChevronRight, UserPlus, XCircle, Mail, Sparkles, Info, Plus, Users } from 'lucide-react';
import EventOpsMode from './EventOpsMode';
import EventBuilder from './EventBuilder';
import StaffingSuggestions from './StaffingSuggestions';
import { apiService } from '../services/apiService';

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
      // API call creates the opportunity and returns the full object with ID
      const newOpp = await apiService.post('/api/opportunities', { opportunity: newEventData });
      setOpportunities(prev => [...prev, newOpp]);
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

  const shiftsToDisplay = activeTab === 'available'
    ? shifts.filter(s => !user.assignedShiftIds?.includes(s.id))
    : shifts.filter(s => user.assignedShiftIds?.includes(s.id));

  const filteredShifts = shiftsToDisplay.filter(s => {
    const opp = getOpp(s.opportunityId);
    return opp && (opp.title.toLowerCase().includes(searchQuery.toLowerCase()) || opp.serviceLocation.toLowerCase().includes(searchQuery.toLowerCase()));
  });
  
  const groupedByDate = filteredShifts.reduce((acc, shift) => {
    const date = new Date(shift.startTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

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
           <button onClick={() => setShowEventBuilder(true)} className="w-full flex items-center justify-center gap-3 px-6 py-6 bg-zinc-900 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg hover:bg-zinc-800 transition-colors mb-8">
                <Plus size={16} /> Create New Event
            </button>
            <div className="space-y-4">
              {opportunities.map(opp => (
                 <div key={opp.id} className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                    <h3 className="font-bold">{opp.title}</h3>
                    <p className="text-xs text-zinc-400">{opp.date} • {opp.serviceLocation}</p>
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
            {Object.keys(groupedByDate).length === 0 && (
                <div className="py-32 text-center bg-zinc-50 rounded-[56px] border border-dashed border-zinc-200">
                    <Calendar className="mx-auto text-zinc-200 mb-6" size={64} strokeWidth={1.5}/>
                    <p className="text-lg font-bold text-zinc-400 italic">
                      {activeTab === 'my-schedule' ? "You have no upcoming shifts." : "No available missions found."}
                    </p>
                    <p className="text-sm text-zinc-300 mt-2">{activeTab === 'available' ? "Check back later for new opportunities." : "Browse available missions to get started."}</p>
                </div>
            )}
            {Object.entries(groupedByDate).map(([date, shiftsOnDate]: [string, Shift[]]) => (
                <div key={date}>
                    <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-6 px-4">{date}</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                        {shiftsOnDate.map(shift => {
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
                                              {isRegistered ? <><XCircle size={14} /> Cancel</> : <><UserPlus size={14} /> Sign Up</>}
                                            </button>
                                          )}
                                          {userMode === 'admin' && (
                                            <button onClick={() => setSelectedShiftId(shift.id)} className="px-6 py-4 rounded-full border border-black font-black text-[10px] uppercase tracking-widest bg-zinc-900 text-white flex items-center gap-2 shadow-lg active:scale-95">
                                               Ops Mode <ChevronRight size={14}/>
                                            </button>
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
