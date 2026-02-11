
import React, { useState, useMemo, useEffect } from 'react';
import { ClinicEvent, Volunteer, Opportunity, Shift } from '../types';
import { MapPin, Search, Calendar, Clock, X, CheckCircle2, Navigation, Loader2 } from 'lucide-react';
import { apiService } from '../services/apiService';

// Normalize similar program/category names to canonical labels
const normalizeProgram = (program: string): string => {
  const lower = (program || '').toLowerCase().replace(/[^\w\s&]/g, '').trim();
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

const PROGRAM_COLORS: { [key: string]: string } = {
  'Workshop': '#8b5cf6',
  'Community Run & Walk': '#059669',
  'Health Fair': '#ea580c',
  'Wellness': '#db2777',
  'Wellness Education': '#db2777',
  'Community Outreach': '#0891b2',
  'Street Medicine': '#be123c',
  'Tabling': '#0d9488',
  'Survey Collection': '#6366f1',
  'Other': '#4b5563',
  'default': '#4b5563'
};

// Helper to extract city from address string
const extractCityFromAddress = (address: string): string => {
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
        const cityPart = parts[parts.length - 2] || parts[1];
        return cityPart.replace(/\d+/g, '').replace(/\b[A-Z]{2}\b/g, '').trim() || 'Los Angeles';
    }
    return 'Los Angeles';
};

// Helper to convert Opportunity to ClinicEvent for display
const mapOpportunityToEvent = (opp: Opportunity): ClinicEvent => {
    return {
        id: opp.id,
        title: opp.title,
        program: normalizeProgram(opp.category),
        lat: opp.locationCoordinates?.lat || 34.0522,
        lng: opp.locationCoordinates?.lng || -118.2437,
        address: opp.serviceLocation,
        city: extractCityFromAddress(opp.serviceLocation),
        dateDisplay: opp.dateDisplay || new Date(opp.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        date: opp.date,
        time: opp.time || 'TBD',
        surveyKitId: opp.surveyKitId
    };
}

interface EventExplorerProps {
  user: Volunteer;
  opportunities: Opportunity[];
  setOpportunities?: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  onUpdate: (u: Volunteer) => void;
  canSignUp?: boolean;
  shifts?: Shift[];
  setShifts?: React.Dispatch<React.SetStateAction<Shift[]>>;
}

// Generate ICS calendar file content
const generateICS = (event: ClinicEvent): string => {
  const datePart = (event.date || '').split('T')[0].replace(/-/g, '');
  // Parse time like "10:00 AM" or "10:00 AM - 2:00 PM"
  const parseTime = (timeStr: string): { start: string; end: string } => {
    const parts = timeStr.split(/\s*[-–]\s*/);
    const toHHMM = (t: string): string => {
      const match = t.trim().match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
      if (!match) return '0900';
      let h = parseInt(match[1]);
      const m = match[2] || '00';
      const ampm = (match[3] || '').toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return `${h.toString().padStart(2, '0')}${m}`;
    };
    const startTime = toHHMM(parts[0]);
    const endTime = parts[1] ? toHHMM(parts[1]) : `${(parseInt(startTime.slice(0, 2)) + 2).toString().padStart(2, '0')}${startTime.slice(2)}`;
    return { start: startTime, end: endTime };
  };
  const times = event.time && event.time !== 'TBD' ? parseTime(event.time) : { start: '0900', end: '1700' };
  const dtStart = `${datePart}T${times.start}00`;
  const dtEnd = `${datePart}T${times.end}00`;
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HMC Volunteer Portal//EN',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.address || ''}`,
    `DESCRIPTION:Health Matters Clinic volunteer event`,
    `DTSTAMP:${now}`,
    `UID:${event.id}@hmcportal`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};

const downloadICS = (event: ClinicEvent) => {
  const ics = generateICS(event);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const EventExplorer: React.FC<EventExplorerProps> = ({ user, opportunities, setOpportunities, onUpdate, canSignUp = true, shifts = [], setShifts }) => {
  const [selectedEvent, setSelectedEvent] = useState<ClinicEvent | null>(null);
  const [search, setSearch] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);
  const [deepLinkProcessed, setDeepLinkProcessed] = useState(false);
  const [justRsvped, setJustRsvped] = useState(false);

  // Helper to check if event is in the past
  const isPastEvent = (dateStr: string) => {
    const datePart = (dateStr || '').split('T')[0];
    if (!datePart) return false;
    const eventDate = new Date(datePart + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate < today;
  };

  // Deep linking: parse ?event=<id> from URL to auto-select an event
  useEffect(() => {
    if (deepLinkProcessed || opportunities.length === 0) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const eventParam = params.get('event') || params.get('eventId');
      if (eventParam) {
        const opp = opportunities.find(o => o.id === eventParam);
        if (opp) {
          const mapped = mapOpportunityToEvent(opp);
          setSelectedEvent(mapped);
        }
      }
    } catch (_) { /* ignore parse errors */ }
    setDeepLinkProcessed(true);
  }, [opportunities, deepLinkProcessed]);

  // Convert live opportunities to events (approved or legacy status)
  const allApprovedOpportunities = useMemo(() =>
    opportunities.filter(o =>
      o.approvalStatus === 'approved' || !o.approvalStatus
    ),
    [opportunities]
  );
  const allEvents = useMemo(() => allApprovedOpportunities.map(mapOpportunityToEvent), [allApprovedOpportunities]);

  // Default view: only upcoming events. When searching: include past events so results aren't empty.
  const upcomingEvents = useMemo(() => allEvents.filter(e => !isPastEvent(e.date)), [allEvents]);

  const filtered = useMemo(() => {
    if (!search.trim()) return upcomingEvents;
    const searchLower = search.toLowerCase().trim();
    return allEvents.filter(e =>
      e.title.toLowerCase().includes(searchLower) ||
      e.address.toLowerCase().includes(searchLower) ||
      e.city.toLowerCase().includes(searchLower) ||
      e.program.toLowerCase().includes(searchLower)
    );
  }, [search, upcomingEvents, allEvents]);

  const handleSignUp = async (eventId: string) => {
    const alreadySignedUp = user.rsvpedEventIds?.includes(eventId);
    setIsSigningUp(true);

    try {
      if (alreadySignedUp) {
        const eventShifts = shifts.filter(s => s.opportunityId === eventId);
        const assignedShift = eventShifts.find(s => user.assignedShiftIds?.includes(s.id));

        await apiService.post('/api/events/unregister', {
          volunteerId: user.id,
          eventId,
          shiftId: assignedShift?.id || null,
        });

        const shiftIdsToRemove = eventShifts.map(s => s.id);
        const updatedUser = {
          ...user,
          rsvpedEventIds: (user.rsvpedEventIds || []).filter(id => id !== eventId),
          assignedShiftIds: (user.assignedShiftIds || []).filter(id => !shiftIdsToRemove.includes(id)),
        };
        onUpdate(updatedUser);

        if (setShifts && assignedShift) {
          setShifts(prev => prev.map(s => s.id === assignedShift.id ? { ...s, slotsFilled: Math.max(0, s.slotsFilled - 1), assignedVolunteerIds: s.assignedVolunteerIds.filter(id => id !== user.id) } : s));
        }
        if (setOpportunities && assignedShift) {
          setOpportunities(prev => prev.map(o => o.id === eventId ? { ...o, slotsFilled: Math.max(0, (o.slotsFilled || 0) - 1) } : o));
        }

        setToastMessage('You have been unregistered from this event.');
      } else {
        const eventShifts = shifts.filter(s => s.opportunityId === eventId && s.slotsFilled < s.slotsTotal);
        const opportunity = opportunities.find(o => o.id === eventId);

        let shiftToAssign = eventShifts.find(s => s.roleType === 'Core Volunteer') || eventShifts[0];

        const updatedRsvpIds = [...(user.rsvpedEventIds || []), eventId];
        const updatedShiftIds = shiftToAssign
          ? [...(user.assignedShiftIds || []), shiftToAssign.id]
          : (user.assignedShiftIds || []);

        const updatedUser = {
          ...user,
          rsvpedEventIds: updatedRsvpIds,
          assignedShiftIds: updatedShiftIds
        };

        await apiService.post('/api/events/register', {
          volunteerId: user.id,
          eventId: eventId,
          shiftId: shiftToAssign?.id,
          eventTitle: opportunity?.title,
          eventDate: opportunity?.date,
          eventLocation: opportunity?.serviceLocation,
          volunteerEmail: user.email,
          volunteerName: user.name
        });

        onUpdate(updatedUser);

        if (setShifts && shiftToAssign) {
          setShifts(prev => prev.map(s =>
            s.id === shiftToAssign!.id
              ? { ...s, slotsFilled: s.slotsFilled + 1, assignedVolunteerIds: [...s.assignedVolunteerIds, user.id] }
              : s
          ));
        }

        if (setOpportunities && shiftToAssign) {
          setOpportunities(prev => prev.map(opp => {
            if (opp.id === eventId) {
              const updatedQuotas = (opp.staffingQuotas || []).map(q => {
                if (q.role === shiftToAssign!.roleType) {
                  return { ...q, filled: (q.filled || 0) + 1 };
                }
                return q;
              });
              return { ...opp, staffingQuotas: updatedQuotas, slotsFilled: (opp.slotsFilled || 0) + 1 };
            }
            return opp;
          }));
        }

        setToastMessage('You are registered! Check your email for confirmation.');
        setJustRsvped(true);
      }

      setToastIsError(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch (error) {
      console.error('Failed to register for event:', error);
      setToastMessage('Registration failed. Please try again.');
      setToastIsError(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 relative">
      {/* Toast notification */}
      {showToast && (
        <div className="fixed bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-4 rounded-full shadow-elevation-3 flex items-center gap-3 z-[5000] animate-in slide-in-from-bottom-10 max-w-[90vw]">
          <CheckCircle2 size={18} className={toastIsError ? 'text-rose-400' : 'text-emerald-400'} />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl md:text-2xl font-medium text-zinc-900 tracking-normal">Volunteer Opportunities</h2>
          <p className="text-zinc-500 text-sm font-normal">Find and sign up for upcoming community health events.</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#233DFF] transition-colors" size={18} />
        <input
          type="text"
          placeholder="Search by location, event name, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-[#e8e6e3] rounded-2xl py-3 pl-11 pr-4 text-sm font-normal outline-none focus:ring-4 focus:ring-[#233DFF]/5 focus:border-[#233DFF]/30 transition-all"
        />
      </div>

      {/* Event card grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center bg-zinc-50 rounded-2xl border border-[#e8e6e3]">
          <Calendar size={32} className="mx-auto text-zinc-300 mb-3" />
          <p className="text-zinc-400 font-medium text-sm">No events found.</p>
          {search && <p className="text-zinc-400 text-xs mt-1">Try a different search term.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(event => {
            const isSignedUp = user.rsvpedEventIds?.includes(event.id);
            return (
              <button
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className={`bg-white rounded-2xl p-5 border text-left transition-all hover:shadow-elevation-1 group ${isSignedUp ? 'border-[#233DFF]/30 shadow-elevation-1' : 'border-[#e8e6e3] hover:border-zinc-300'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: PROGRAM_COLORS[event.program] || PROGRAM_COLORS['default'] }}
                  >
                    {event.program}
                  </span>
                  {isSignedUp && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle2 size={10} /> Signed up
                    </span>
                  )}
                </div>
                <h3 className="text-base font-medium text-zinc-900 mb-2 group-hover:text-[#233DFF] transition-colors leading-snug">{event.title}</h3>
                <div className="space-y-1.5 text-xs text-zinc-500">
                  <p className="flex items-center gap-1.5"><MapPin size={13} className="text-zinc-400 shrink-0" /> {event.address}</p>
                  <p className="flex items-center gap-1.5"><Calendar size={13} className="text-zinc-400 shrink-0" /> {event.dateDisplay}</p>
                  <p className="flex items-center gap-1.5"><Clock size={13} className="text-zinc-400 shrink-0" /> {event.time}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Event detail modal */}
      {selectedEvent && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000]" onClick={() => { setSelectedEvent(null); setJustRsvped(false); }} />
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-elevation-3 flex flex-col max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 space-y-5">
                <div className="flex justify-between items-start">
                  <span
                    className="px-3 py-1.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: PROGRAM_COLORS[selectedEvent.program] || PROGRAM_COLORS['default'] }}
                  >
                    {selectedEvent.program}
                  </span>
                  <button onClick={() => { setSelectedEvent(null); setJustRsvped(false); }} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-zinc-900 leading-tight mb-2">{selectedEvent.title}</h3>
                  <p className="text-zinc-500 text-xs flex items-center gap-1.5">
                    <MapPin size={13} /> {selectedEvent.address}, {selectedEvent.city}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-50 p-4 rounded-xl border border-[#e8e6e3]">
                    <Calendar className="text-[#233DFF] mb-1.5" size={16} />
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">Date</p>
                    <p className="text-sm font-medium text-zinc-900">{selectedEvent.dateDisplay}</p>
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-xl border border-[#e8e6e3]">
                    <Clock className="text-[#233DFF] mb-1.5" size={16} />
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">Time</p>
                    <p className="text-sm font-medium text-zinc-900">{selectedEvent.time}</p>
                  </div>
                </div>

                {/* Get Directions is available in EventOps mode during missions */}

                <div className="space-y-3">
                  {justRsvped && user.rsvpedEventIds?.includes(selectedEvent.id) ? (
                    <>
                      <div className="w-full py-5 px-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                        <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2" />
                        <p className="font-medium text-emerald-800 text-sm">You're signed up!</p>
                        <p className="text-emerald-600 text-xs mt-1">A confirmation email has been sent to you.</p>
                      </div>
                      <button
                        onClick={() => downloadICS(selectedEvent)}
                        className="w-full py-4 rounded-full font-normal text-base transition-all shadow-elevation-2 flex items-center justify-center gap-2 bg-[#233dff] text-white border border-[#233dff] hover:opacity-95"
                      >
                        <Calendar size={16} /> Save to Calendar (.ics)
                      </button>
                      <button
                        onClick={() => setJustRsvped(false)}
                        className="w-full py-3 rounded-full font-normal text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
                      >
                        Dismiss
                      </button>
                    </>
                  ) : canSignUp ? (
                    <>
                      <button
                        onClick={() => handleSignUp(selectedEvent.id)}
                        disabled={isSigningUp}
                        className={`w-full py-4 rounded-full font-normal text-base transition-all shadow-elevation-2 flex items-center justify-center gap-2 disabled:opacity-60 ${
                          user.rsvpedEventIds?.includes(selectedEvent.id)
                            ? 'bg-white text-[#1a1a1a] border border-[#0f0f0f]'
                            : 'bg-[#233dff] text-white border border-[#233dff] hover:opacity-95'
                        }`}
                      >
                        {isSigningUp ? (
                          <><Loader2 size={18} className="animate-spin" /> Processing...</>
                        ) : user.rsvpedEventIds?.includes(selectedEvent.id) ? (
                          <><span className="w-2 h-2 rounded-full bg-[#0f0f0f]" /> Signed up — click to cancel</>
                        ) : (
                          <><span className="w-2 h-2 rounded-full bg-white" /> Sign up</>
                        )}
                      </button>
                      {user.rsvpedEventIds?.includes(selectedEvent.id) && (
                        <button
                          onClick={() => downloadICS(selectedEvent)}
                          className="w-full py-3 rounded-full font-normal text-sm text-[#233dff] hover:bg-[#233dff]/5 border border-[#233dff]/20 transition-all flex items-center justify-center gap-2"
                        >
                          <Calendar size={14} /> Save to Calendar
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="w-full py-4 px-4 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                      <p className="font-medium text-amber-800 text-sm">Complete required training to sign up</p>
                      <p className="text-amber-600 text-xs mt-1">Visit Training Academy to complete your orientation modules</p>
                    </div>
                  )}
                  <p className="text-center text-[10px] text-zinc-400 font-normal">Earn impact points for participating in community events.</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* My Confirmed Events */}
      {user.rsvpedEventIds && user.rsvpedEventIds.length > 0 && (
        <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-elevation-2 relative overflow-hidden group">
          <Calendar className="absolute -bottom-8 -right-8 w-36 h-36 text-white/5 rotate-12 group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <h4 className="text-[10px] font-medium text-indigo-400 uppercase tracking-wide mb-4">My Confirmed Events</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {user.rsvpedEventIds.map(id => {
                const event = allEvents.find(e => e.id === id);
                if (!event) return null;
                return (
                  <div key={id} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <p className="text-[10px] font-normal text-indigo-300">{event.dateDisplay}</p>
                    </div>
                    <button
                      onClick={() => downloadICS(event)}
                      className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                      title="Save to Calendar"
                    >
                      <Calendar size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventExplorer;
