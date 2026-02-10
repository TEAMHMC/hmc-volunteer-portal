import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Volunteer, Opportunity, OrgCalendarEvent } from '../types';
import { apiService } from '../services/apiService';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Clock, MapPin,
  ExternalLink, Users, Filter, Video, Loader2, Check, Tag
} from 'lucide-react';

interface OrgCalendarProps {
  user: Volunteer;
  opportunities: Opportunity[];
}

const EVENT_COLORS: Record<string, { dot: string; bg: string; text: string; border: string; label: string }> = {
  'all-hands':       { dot: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200', label: 'All-Hands' },
  'committee':       { dot: 'bg-purple-500',  bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200', label: 'Committee' },
  'training':        { dot: 'bg-green-500',   bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200', label: 'Training' },
  'community-event': { dot: 'bg-indigo-500',  bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200', label: 'Community Event' },
  'board':           { dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200', label: 'Board' },
  'social':          { dot: 'bg-pink-500',    bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200', label: 'Social' },
  'other':           { dot: 'bg-zinc-500',    bg: 'bg-zinc-50',    text: 'text-zinc-700',    border: 'border-zinc-200', label: 'Other' },
};

const SOURCE_LABELS: Record<string, string> = {
  'board-meeting': 'Board Meeting',
  'event-finder': 'Event Finder',
  'org-calendar': 'Org Calendar',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const EVENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'all-hands', label: 'All-Hands' },
  { value: 'committee', label: 'Committee' },
  { value: 'training', label: 'Training' },
  { value: 'social', label: 'Social' },
  { value: 'community-event', label: 'Community Event' },
  { value: 'board', label: 'Board' },
  { value: 'other', label: 'Other' },
];

const getColor = (type: string) => EVENT_COLORS[type] || EVENT_COLORS['other'];

const OrgCalendar: React.FC<OrgCalendarProps> = ({ user, opportunities }) => {
  const [events, setEvents] = useState<OrgCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

  const isAdmin = user.isAdmin;
  const isCoordinatorOrLead = user.role.includes('Coordinator') || user.role.includes('Lead');
  const canCreateEvents = isAdmin || isCoordinatorOrLead;

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/api/org-calendar');
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth, currentYear]);

  // Map day numbers to events for dot display
  const eventsByDay = useMemo(() => {
    const map: Record<number, OrgCalendarEvent[]> = {};
    events.forEach(ev => {
      const d = new Date(ev.date + 'T00:00:00');
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(ev);
      }
    });
    return map;
  }, [events, currentMonth, currentYear]);

  // Filtered upcoming events
  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let filtered = events.filter(ev => ev.date >= today);
    if (selectedDay) {
      filtered = filtered.filter(ev => ev.date === selectedDay);
    }
    if (typeFilter) {
      filtered = filtered.filter(ev => ev.type === typeFilter);
    }
    return filtered.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [events, selectedDay, typeFilter]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDay(prev => prev === dateStr ? null : dateStr);
  };

  const handleRsvp = async (eventId: string, status: 'attending' | 'tentative' | 'declined') => {
    try {
      setRsvpLoading(eventId);
      await apiService.post(`/api/org-calendar/${eventId}/rsvp`, { status });
      await fetchEvents();
    } catch (err) {
      console.error('RSVP failed:', err);
    } finally {
      setRsvpLoading(null);
    }
  };

  const getUserRsvpStatus = (ev: OrgCalendarEvent): string | null => {
    const rsvp = ev.rsvps?.find(r => r.odId === user.id);
    return rsvp?.status || null;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayDate = new Date();
  const isCurrentMonth = currentMonth === todayDate.getMonth() && currentYear === todayDate.getFullYear();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight">Organization Calendar</h2>
          <p className="text-sm text-zinc-500 font-medium mt-1">Your central hub for meetings, events & training</p>
        </div>
        {canCreateEvents && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-[#233DFF] text-white rounded-xl font-bold text-sm hover:bg-[#1a2fbf] transition-colors shadow-lg shadow-[#233DFF]/20"
          >
            <Plus size={18} /> New Event
          </button>
        )}
      </div>

      {/* Calendar Grid + Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Monthly Calendar */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-zinc-200/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
              <ChevronLeft size={18} className="text-zinc-600" />
            </button>
            <h3 className="text-lg font-black text-zinc-900">{MONTHS[currentMonth]} {currentYear}</h3>
            <button onClick={nextMonth} className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
              <ChevronRight size={18} className="text-zinc-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider py-2">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px">
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={i} className="aspect-square" />;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = eventsByDay[day] || [];
              const isToday = isCurrentMonth && day === todayDate.getDate();
              const isSelected = selectedDay === dateStr;
              const uniqueTypes = [...new Set(dayEvents.map(e => e.type))];

              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(day)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all relative
                    ${isSelected ? 'bg-[#233DFF] text-white shadow-lg shadow-[#233DFF]/20' : isToday ? 'bg-zinc-100 font-black' : 'hover:bg-zinc-50'}
                  `}
                >
                  <span className={`text-sm font-semibold ${isSelected ? 'text-white' : isToday ? 'text-zinc-900' : 'text-zinc-700'}`}>
                    {day}
                  </span>
                  {uniqueTypes.length > 0 && (
                    <div className="flex gap-0.5">
                      {uniqueTypes.slice(0, 3).map((type, j) => (
                        <div key={j} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : getColor(type).dot}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <button
              onClick={() => setSelectedDay(null)}
              className="mt-4 text-xs font-bold text-[#233DFF] hover:underline"
            >
              Clear day filter
            </button>
          )}
        </div>

        {/* Filter Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200/60 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={16} className="text-zinc-400" />
              <h4 className="text-sm font-bold text-zinc-900">Filter by Type</h4>
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
            >
              {EVENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {/* Legend */}
            <div className="mt-6 space-y-2">
              {Object.entries(EVENT_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                  <span className="text-xs font-medium text-zinc-600">{color.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-3xl border border-zinc-200/60 shadow-sm p-6">
            <h4 className="text-sm font-bold text-zinc-900 mb-3">This Month</h4>
            <div className="text-3xl font-black text-zinc-900">
              {Object.values(eventsByDay).reduce((sum, arr) => sum + arr.length, 0)}
            </div>
            <p className="text-xs text-zinc-400 font-medium">events scheduled</p>
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <div>
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-6 px-2">
          {selectedDay
            ? `Events on ${new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
            : 'Upcoming Events'
          }
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-zinc-300" size={32} />
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="py-32 text-center bg-zinc-50 rounded-[56px] border border-dashed border-zinc-200">
            <CalendarDays className="mx-auto text-zinc-200 mb-6" size={64} strokeWidth={1.5} />
            <p className="text-lg font-bold text-zinc-400 italic">
              {selectedDay ? 'No events on this day.' : 'No upcoming events.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {upcomingEvents.map(ev => {
              const color = getColor(ev.type);
              const userRsvp = getUserRsvpStatus(ev);
              const attendingCount = ev.rsvps?.filter(r => r.status === 'attending').length || 0;
              const isSignedUpViaEventFinder = ev.source === 'event-finder' && user.rsvpedEventIds?.includes(ev.id);
              const isAttending = userRsvp === 'attending' || isSignedUpViaEventFinder;

              return (
                <div
                  key={`${ev.id}-${ev.source}`}
                  className={`bg-white rounded-[48px] border-2 transition-all duration-300 flex flex-col group relative overflow-hidden ${isAttending ? 'border-[#233DFF] shadow-2xl' : 'border-zinc-100 shadow-sm hover:border-zinc-200 hover:shadow-xl'}`}
                >
                  {isAttending && (
                    <div className="absolute top-0 right-0 px-6 py-2 bg-[#233DFF] text-white rounded-bl-2xl rounded-tr-[44px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <Check size={14} /> {isSignedUpViaEventFinder ? 'Signed Up' : 'Going'}
                    </div>
                  )}

                  <div className="p-10 flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${color.bg} ${color.text} ${color.border}`}>
                        {color.label}
                      </span>
                      {ev.source && ev.source !== 'org-calendar' && (
                        <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-zinc-50 text-zinc-400 border border-zinc-100 flex items-center gap-1">
                          <Tag size={10} /> {SOURCE_LABELS[ev.source] || ev.source}
                        </span>
                      )}
                    </div>

                    <h3 className="text-2xl font-black text-zinc-900 tracking-tighter leading-tight mb-3">{ev.title}</h3>

                    {ev.location && (
                      <div className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-6">
                        <MapPin size={14} className="text-zinc-300" /> {ev.location}
                      </div>
                    )}

                    {ev.description && (
                      <p className="text-sm text-zinc-500 font-medium leading-relaxed h-16 overflow-hidden">{ev.description.substring(0, 120)}{ev.description.length > 120 ? '...' : ''}</p>
                    )}

                    {attendingCount > 0 && (
                      <p className="text-xs text-zinc-400 mt-4 flex items-center gap-1.5">
                        <Users size={14} className="text-zinc-300" /> {attendingCount} attending
                      </p>
                    )}

                    {ev.isRecurring && ev.recurrenceNote && (
                      <p className="text-[10px] text-zinc-400 mt-2 italic">{ev.recurrenceNote}</p>
                    )}
                  </div>

                  <div className="bg-zinc-50/70 p-8 rounded-t-[32px] border-t-2 border-zinc-100 mt-auto">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-zinc-300 uppercase tracking-widest mb-2">Date & Time</p>
                        <p className="text-sm font-black text-zinc-900 tracking-tight flex items-center gap-2">
                          <CalendarDays size={14} className="text-[#233DFF] shrink-0" />
                          {new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-sm font-bold text-zinc-600 mt-1 flex items-center gap-2">
                          <Clock size={14} className="text-[#233DFF] shrink-0" />
                          {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {ev.meetLink && (
                          <a
                            href={ev.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-5 py-3 rounded-full bg-green-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg hover:bg-green-700 transition-colors"
                          >
                            <Video size={14} /> Join
                          </a>
                        )}

                        {ev.source !== 'event-finder' && (
                          <button
                            onClick={() => handleRsvp(ev.id, isAttending ? 'declined' : 'attending')}
                            disabled={rsvpLoading === ev.id}
                            className={`px-6 py-3 rounded-full border border-black font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                              isAttending ? 'bg-white text-rose-500' : 'bg-[#233DFF] text-white hover:opacity-95'
                            }`}
                          >
                            {rsvpLoading === ev.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : isAttending ? (
                              'Cancel'
                            ) : (
                              'RSVP'
                            )}
                          </button>
                        )}

                        {ev.source === 'event-finder' && (
                          <span className={`px-5 py-3 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 ${
                            isSignedUpViaEventFinder ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            {isSignedUpViaEventFinder ? <><Check size={14} /> Registered</> : 'Community'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && <CreateEventModal onClose={() => setShowCreateModal(false)} onCreated={fetchEvents} />}
    </div>
  );
};

// ========================================
// Create Event Modal
// ========================================

interface CreateEventModalProps {
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({ onClose, onCreated }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    type: 'all-hands' as OrgCalendarEvent['type'],
    location: '',
    meetLink: '',
    description: '',
    isRecurring: false,
    recurrenceNote: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.startTime) return;
    setError('');
    try {
      setSaving(true);
      await apiService.post('/api/org-calendar', form);
      await onCreated();
      onClose();
    } catch (err: any) {
      console.error('Failed to create event:', err);
      setError(err?.message || 'Failed to create event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-zinc-100">
          <h3 className="text-lg font-black text-zinc-900">New Event</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
            <X size={18} className="text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="e.g. Monthly All-Hands"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
              required
            />
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => updateField('date', e.target.value)}
                className="w-full px-3 py-3 rounded-xl border border-zinc-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Start *</label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => updateField('startTime', e.target.value)}
                className="w-full px-3 py-3 rounded-xl border border-zinc-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">End</label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => updateField('endTime', e.target.value)}
                className="w-full px-3 py-3 rounded-xl border border-zinc-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Type *</label>
            <select
              value={form.type}
              onChange={e => updateField('type', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
            >
              <option value="all-hands">All-Hands</option>
              <option value="committee">Committee</option>
              <option value="training">Training</option>
              <option value="social">Social</option>
              <option value="board">Board</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => updateField('location', e.target.value)}
              placeholder="e.g. Virtual, Office, Palmdale"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
            />
          </div>

          {/* Meet Link */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Meeting Link</label>
            <input
              type="url"
              value={form.meetLink}
              onChange={e => updateField('meetLink', e.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              rows={3}
              placeholder="Event details..."
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] resize-none"
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={e => updateField('isRecurring', e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-[#233DFF] focus:ring-[#233DFF]"
            />
            <label className="text-sm font-medium text-zinc-700">Recurring event</label>
          </div>
          {form.isRecurring && (
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Recurrence Note</label>
              <input
                type="text"
                value={form.recurrenceNote}
                onChange={e => updateField('recurrenceNote', e.target.value)}
                placeholder="e.g. Every 1st Monday"
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !form.title || !form.date || !form.startTime}
            className="w-full py-4 bg-[#233DFF] text-white rounded-xl font-bold text-sm hover:bg-[#1a2fbf] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {saving ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OrgCalendar;
