
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
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-bottom-4">
            <Check size={16} className="text-emerald-400" />
            {toastMsg}
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
        <div className="space-y-8">
            {Object.keys(groupedByDate).length === 0 && (
                <div className="text-center py-20 text-zinc-400">
                    <Calendar size={48} className="mx-auto opacity-50 mb-4"/>
                    <p className="font-bold">No shifts found.</p>
                    <p className="text-sm">{activeTab === 'available' ? "Check back later for new opportunities." : "You are not scheduled for any upcoming missions."}</p>
                </div>
            )}
            {Object.entries(groupedByDate).map(([date, shiftsOnDate]: [string, Shift[]]) => (
                <div key={date}>
                    <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest pb-2 mb-4 border-b border-zinc-100">{date}</h3>
                    <div className="space-y-4">
                        {shiftsOnDate.map(shift => {
                            const opp = getOpp(shift.opportunityId);
                            if (!opp) return null;
                            const isRegistered = user.assignedShiftIds?.includes(shift.id);
                            return (
                                <div key={shift.id} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-blue-600">{opp.category}</p>
                                        <h4 className="font-black text-xl text-zinc-800 group-hover:text-blue-600 transition-colors">{opp.title}</h4>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 mt-2">
                                            <span className="flex items-center gap-1.5"><MapPin size={14}/> {opp.serviceLocation}</span>
                                            <span className="flex items-center gap-1.5"><Clock size={14}/> {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({calculateDuration(shift.startTime, shift.endTime)})</span>
                                            <span className="flex items-center gap-1.5"><Users size={14}/> {shift.roleType} ({shift.slotsFilled}/{shift.slotsTotal})</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        {userMode === 'volunteer' && (
                                            <button onClick={() => handleToggleRegistration(shift.id)} className={`px-6 py-3 rounded-full font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all ${isRegistered ? 'bg-zinc-100 text-zinc-600 hover:bg-rose-100 hover:text-rose-600' : 'bg-zinc-900 text-white hover:bg-blue-600'}`}>
                                                {isRegistered ? <><XCircle size={14}/> Unregister</> : <><UserPlus size={14}/> Sign Up</>}
                                            </button>
                                        )}
                                         {userMode === 'admin' && activeTab === 'my-schedule' && (
                                            <button onClick={() => setSelectedShiftId(shift.id)} className="px-6 py-3 rounded-full font-bold text-xs uppercase tracking-widest bg-blue-600 text-white flex items-center gap-2">
                                               Launch Ops Mode <ChevronRight size={14}/>
                                            </button>
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
  );
};

export default ShiftsComponent;
