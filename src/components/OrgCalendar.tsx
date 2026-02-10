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

      {/* Upcoming Events List */}
      <div>
        <h3 className="text-xl font-black text-zinc-900 mb-4">
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
          <div className="bg-white rounded-3xl border border-zinc-200/60 p-12 text-center">
            <CalendarDays size={40} className="mx-auto text-zinc-200 mb-3" />
            <p className="text-sm font-medium text-zinc-400">
              {selectedDay ? 'No events on this day' : 'No upcoming events'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map(ev => {
              const color = getColor(ev.type);
              const userRsvp = getUserRsvpStatus(ev);
              const attendingCount = ev.rsvps?.filter(r => r.status === 'attending').length || 0;

              return (
                <div
                  key={`${ev.id}-${ev.source}`}
                  className={`bg-white rounded-2xl border ${color.border} p-5 hover:shadow-md transition-all`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                        <h4 className="font-bold text-zinc-900 text-sm">{ev.title}</h4>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
                          {color.label}
                        </span>
                        {ev.source && ev.source !== 'org-calendar' && (
                          <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Tag size={8} /> {SOURCE_LABELS[ev.source] || ev.source}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mt-2">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={12} />
                          {new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {ev.startTime}{ev.endTime ? ` - ${ev.endTime}` : ''}
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {ev.location}
                          </span>
                        )}
                        {attendingCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Users size={12} /> {attendingCount} attending
                          </span>
                        )}
                      </div>

                      {ev.description && (
                        <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{ev.description}</p>
                      )}

                      {ev.isRecurring && ev.recurrenceNote && (
                        <p className="text-[10px] text-zinc-400 mt-1 italic">{ev.recurrenceNote}</p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {ev.meetLink && (
                        <a
                          href={ev.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors"
                        >
                          <Video size={14} /> Join
                        </a>
                      )}

                      {ev.source !== 'event-finder' && (
                        <div className="flex items-center gap-1">
                          {(['attending', 'tentative', 'declined'] as const).map(status => (
                            <button
                              key={status}
                              onClick={() => handleRsvp(ev.id, status)}
                              disabled={rsvpLoading === ev.id}
                              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                userRsvp === status
                                  ? status === 'attending' ? 'bg-emerald-500 text-white' : status === 'tentative' ? 'bg-amber-500 text-white' : 'bg-zinc-500 text-white'
                                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                              }`}
                            >
                              {rsvpLoading === ev.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                status === 'attending' ? 'Going' : status === 'tentative' ? 'Maybe' : 'No'
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      {ev.source === 'event-finder' && (
                        <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-3 py-2 rounded-lg">
                          Community Event
                        </span>
                      )}
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
  onCreated: () => void;
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({ onClose, onCreated }) => {
  const [saving, setSaving] = useState(false);
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
    try {
      setSaving(true);
      await apiService.post('/api/org-calendar', form);
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create event:', err);
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
