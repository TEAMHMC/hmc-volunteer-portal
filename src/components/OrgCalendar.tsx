import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Volunteer, Opportunity, OrgCalendarEvent } from '../types';
import { apiService } from '../services/apiService';
import { ORG_CALENDAR_ROLES } from '../constants';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Clock, MapPin,
  ExternalLink, Users, Filter, Video, Loader2, Check, Tag, Trash2, Edit3, Navigation
} from 'lucide-react';
import { toastService } from '../services/toastService';

interface OrgCalendarProps {
  user: Volunteer;
  opportunities: Opportunity[];
}

const EVENT_COLORS: Record<string, { dot: string; bg: string; text: string; border: string; label: string }> = {
  'wellness':        { dot: 'bg-emerald-500',  bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200', label: 'Wellness' },
  'outreach':        { dot: 'bg-orange-500',   bg: 'bg-orange-50',   text: 'text-orange-700',   border: 'border-orange-200', label: 'Community Outreach' },
  'workshop':        { dot: 'bg-violet-500',   bg: 'bg-violet-50',   text: 'text-violet-700',   border: 'border-violet-200', label: 'Workshop' },
  'street-medicine': { dot: 'bg-rose-500',     bg: 'bg-rose-50',     text: 'text-rose-700',     border: 'border-rose-200', label: 'Street Medicine' },
  'health-fair':     { dot: 'bg-sky-500',      bg: 'bg-sky-50',      text: 'text-sky-700',      border: 'border-sky-200', label: 'Health Fair' },
  'training':        { dot: 'bg-green-500',    bg: 'bg-green-50',    text: 'text-green-700',    border: 'border-green-200', label: 'Training' },
  'all-hands':       { dot: 'bg-blue-500',     bg: 'bg-blue-50',     text: 'text-blue-700',     border: 'border-blue-200', label: 'All-Hands' },
  'committee':       { dot: 'bg-purple-500',   bg: 'bg-purple-50',   text: 'text-purple-700',   border: 'border-purple-200', label: 'Committee' },
  'community-event': { dot: 'bg-indigo-500',   bg: 'bg-indigo-50',   text: 'text-indigo-700',   border: 'border-indigo-200', label: 'Community Event' },
  'board':           { dot: 'bg-amber-500',    bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200', label: 'Board' },
  'social':          { dot: 'bg-pink-500',     bg: 'bg-pink-50',     text: 'text-pink-700',     border: 'border-pink-200', label: 'Social' },
  'other':           { dot: 'bg-zinc-500',     bg: 'bg-zinc-50',     text: 'text-zinc-700',     border: 'border-zinc-100', label: 'Other' },
};

const SOURCE_LABELS: Record<string, string> = {
  'board-meeting': 'Board Meeting',
  'event-finder': 'Event Finder',
  'shift': 'Mission Shift',
  'org-calendar': 'Org Calendar',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const EVENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'community-event', label: 'Community Event' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'outreach', label: 'Community Outreach' },
  { value: 'training', label: 'Training' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'street-medicine', label: 'Street Medicine' },
  { value: 'health-fair', label: 'Health Fair' },
  { value: 'all-hands', label: 'All-Hands' },
  { value: 'committee', label: 'Committee' },
  { value: 'board', label: 'Board' },
  { value: 'social', label: 'Social' },
  { value: 'other', label: 'Other' },
];

const getColor = (type: string) => EVENT_COLORS[type] || EVENT_COLORS['other'];

// Normalize time display: convert 24h "14:00" to "2:00 PM", pass through "5:30 PM PT" as-is
const formatTimeDisplay = (t: string): string => {
  if (!t) return '';
  // Already in 12h format (contains AM/PM)
  if (/[ap]m/i.test(t)) return t;
  // 24h format like "14:00"
  const match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const h = parseInt(match[1]);
    const m = match[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }
  return t;
};

// TODO: CONSOLIDATION — Create Event form duplicates EventBuilder. Consider linking to EventBuilder instead.

const OrgCalendar: React.FC<OrgCalendarProps> = ({ user, opportunities }) => {
  const [events, setEvents] = useState<OrgCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<OrgCalendarEvent | null>(null);
  const [showDetailEvent, setShowDetailEvent] = useState<OrgCalendarEvent | null>(null);

  const isAdmin = user.isAdmin;
  const canCreateEvents = isAdmin || ORG_CALENDAR_ROLES.includes(user.role);

  // Convert opportunities prop to calendar event format as fallback
  const opportunityEvents = useMemo((): OrgCalendarEvent[] => {
    return opportunities.filter(o => o.date).map(o => {
      const cat = (o.category || '').toLowerCase();
      let type: OrgCalendarEvent['type'] = 'community-event';
      if (cat.includes('wellness') || cat.includes('community run') || cat.includes('walk')) type = 'wellness';
      else if (cat.includes('outreach') || cat.includes('tabling') || cat.includes('survey')) type = 'outreach';
      else if (cat.includes('workshop') || cat.includes('education')) type = 'workshop';
      else if (cat.includes('street medicine')) type = 'street-medicine';
      else if (cat.includes('health fair')) type = 'health-fair';
      else if (cat.includes('training')) type = 'training';
      return {
        id: o.id,
        title: o.title,
        description: o.description || '',
        date: o.date.includes('T') ? o.date.split('T')[0] : o.date,
        startTime: o.time || '',
        type,
        location: o.serviceLocation || '',
        source: 'event-finder' as const,
        rsvps: [],
      } as OrgCalendarEvent;
    });
  }, [opportunities]);

  const fetchEvents = useCallback(async (soft = false) => {
    try {
      if (!soft) setLoading(true);
      const data = await apiService.get('/api/org-calendar');
      const fetched = Array.isArray(data) ? data : [];
      if (soft) {
        // Merge: keep any optimistically-added events that the server hasn't indexed yet
        setEvents(prev => {
          const fetchedIds = new Set(fetched.map((e: any) => e.id));
          const optimistic = prev.filter(e => !fetchedIds.has(e.id) && (e as any)._optimistic);
          return [...fetched, ...optimistic].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        });
      } else {
        // Merge fetched events with opportunity-derived events (dedup by ID)
        const fetchedIds = new Set(fetched.map((e: any) => e.id));
        const missingOpps = opportunityEvents.filter(o => !fetchedIds.has(o.id));
        setEvents([...fetched, ...missingOpps].sort((a, b) => (a.date || '').localeCompare(b.date || '')));
      }
    } catch (error) {
      console.error('[OrgCalendar] Failed to fetch events:', error);
      // Fallback to opportunities prop data instead of empty
      if (!soft) setEvents(opportunityEvents);
    } finally {
      setLoading(false);
    }
  }, [opportunityEvents]);

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
      if (!ev.date) return;
      const d = new Date(ev.date + 'T00:00:00');
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(ev);
      }
    });
    return map;
  }, [events, currentMonth, currentYear]);

  // Filtered events — show all events for a selected day, otherwise upcoming only
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let filtered = selectedDay
      ? events.filter(ev => ev.date === selectedDay) // Show all events for selected day (past or future)
      : events.filter(ev => ev.date >= today);       // Default to upcoming
    if (typeFilter) {
      filtered = filtered.filter(ev => ev.type === typeFilter);
    }
    return filtered.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
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
      toastService.error('RSVP failed. Please try again.');
    } finally {
      setRsvpLoading(null);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event? This cannot be undone.')) return;
    try {
      await apiService.delete(`/api/org-calendar/${eventId}`);
      setShowDetailEvent(null);
      await fetchEvents();
    } catch (err) {
      console.error('Delete failed:', err);
      toastService.error('Failed to delete event. Please try again.');
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
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Calendar</h2>
          <p className="text-zinc-500 mt-2 md:mt-4 font-medium text-sm md:text-lg leading-relaxed">Meetings, events & training</p>
        </div>
        {canCreateEvents && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-3 font-bold text-base bg-brand text-white border border-black rounded-full hover:bg-brand-hover transition-colors shadow-elevation-2 uppercase tracking-wide"
          >
            <span className="w-2 h-2 rounded-full bg-white" /> New Event
          </button>
        )}
      </div>

      {/* Calendar Grid + Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Monthly Calendar */}
        <div className="lg:col-span-2 bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow p-3 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
              <ChevronLeft size={18} className="text-zinc-600" />
            </button>
            <h3 className="text-xl font-bold text-zinc-900">{MONTHS[currentMonth]} {currentYear}</h3>
            <button onClick={nextMonth} className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
              <ChevronRight size={18} className="text-zinc-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] py-2">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px">
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={i} className="min-h-[72px] md:min-h-[90px]" />;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = eventsByDay[day] || [];
              const isToday = isCurrentMonth && day === todayDate.getDate();
              const isSelected = selectedDay === dateStr;
              const maxVisible = 2;
              const overflowCount = dayEvents.length - maxVisible;

              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(day)}
                  className={`min-h-[72px] md:min-h-[90px] rounded-xl flex flex-col items-start p-1.5 md:p-2 transition-all relative text-left
                    ${isSelected ? 'bg-brand text-white shadow-elevation-2' : isToday ? 'bg-zinc-100 font-black' : 'hover:bg-zinc-50'}
                  `}
                >
                  <span className={`text-xs md:text-sm font-bold mb-0.5 ${isSelected ? 'text-white' : isToday ? 'text-zinc-900' : 'text-zinc-700'}`}>
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="w-full space-y-0.5 overflow-hidden flex-1 min-w-0">
                      {dayEvents.slice(0, maxVisible).map((ev, j) => {
                        const color = getColor(ev.type);
                        return (
                          <div
                            key={j}
                            className={`w-full rounded px-1 py-px truncate text-[8px] md:text-[10px] font-bold leading-tight ${
                              isSelected ? 'bg-white/20 text-white' : `${color.bg} ${color.text}`
                            }`}
                            title={`${ev.startTime ? formatTimeDisplay(ev.startTime) + ' ' : ''}${ev.title}`}
                          >
                            <span className="hidden md:inline">{ev.startTime ? formatTimeDisplay(ev.startTime).replace(/ [AP]M/, '') + ' ' : ''}</span>{ev.title}
                          </div>
                        );
                      })}
                      {overflowCount > 0 && (
                        <div className={`text-[8px] md:text-[10px] font-bold px-1 ${isSelected ? 'text-white/70' : 'text-zinc-400'}`}>
                          +{overflowCount} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDay && (() => {
            const dayNum = parseInt(selectedDay.split('-')[2]);
            const dayEvts = eventsByDay[dayNum] || [];
            const formattedDate = new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            return (
              <div className="mt-6 p-5 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-zinc-900">{formattedDate}</h4>
                  <div className="flex items-center gap-2">
                    {canCreateEvents && (
                      <button
                        onClick={() => { setShowCreateModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-full text-[10px] font-bold uppercase tracking-wide hover:opacity-90 transition-opacity"
                      >
                        <Plus size={12} /> Add Event
                      </button>
                    )}
                    <button onClick={() => setSelectedDay(null)} className="text-zinc-400 hover:text-zinc-600">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                {dayEvts.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">No events scheduled this day.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dayEvts.map(ev => {
                      const color = getColor(ev.type);
                      return (
                        <button key={ev.id} onClick={() => setShowDetailEvent(ev)} className="w-full text-left p-3 bg-white rounded-2xl border border-zinc-100 hover:border-brand/30 hover:shadow-sm transition-all flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${color.dot} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-zinc-800 truncate">{ev.title}</p>
                            <p className="text-[10px] text-zinc-400 font-bold">
                              {ev.startTime ? formatTimeDisplay(ev.startTime) : 'All day'}
                              {ev.location ? ` · ${ev.location}` : ''}
                            </p>
                          </div>
                          <ChevronRight size={14} className="text-zinc-300 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Filter Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow p-8">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={16} className="text-zinc-400" />
              <h4 className="text-sm font-bold text-zinc-900">Filter by Type</h4>
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full p-4 rounded-2xl border-2 border-zinc-100 text-sm font-bold text-zinc-700 bg-zinc-50 focus:outline-none focus:border-brand/30"
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
                  <span className="text-xs font-bold text-zinc-600">{color.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow p-5 md:p-8">
            <h4 className="text-sm font-bold text-zinc-900 mb-3">This Month</h4>
            <div className="text-3xl font-black text-zinc-900">
              {Object.values(eventsByDay).reduce((sum, arr) => sum + arr.length, 0)}
            </div>
            <p className="text-sm font-bold text-zinc-400">events scheduled</p>
          </div>
        </div>
      </div>

      {/* Day Detail — shows only when a day is clicked on the calendar */}
      {selectedDay && (
        <div>
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
              {`Events on ${new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
            </h3>
            <button onClick={() => setSelectedDay(null)} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors">
              <X size={14} className="text-zinc-400" />
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="py-12 text-center bg-zinc-50 rounded-2xl md:rounded-3xl border border-dashed border-zinc-100">
              <p className="text-zinc-400 font-bold text-sm">No events on this day.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map(ev => {
                const color = getColor(ev.type);
                const userRsvp = getUserRsvpStatus(ev);
                const attendingCount = ev.rsvps?.filter(r => r.status === 'attending').length || 0;
                const isSignedUpExternally = (ev.source === 'event-finder' || ev.source === 'shift') && user.rsvpedEventIds?.includes(ev.id);
                const isAssignedToShift = ev.source === 'shift' && user.assignedShiftIds?.includes(ev.id);
                const isAttending = userRsvp === 'attending' || isSignedUpExternally || isAssignedToShift;

                return (
                  <div
                    key={`${ev.id}-${ev.source}`}
                    className={`bg-white rounded-2xl border p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-6 cursor-pointer hover:shadow-lg transition-all ${isAttending ? 'border-brand/30 bg-brand/[0.02]' : 'border-zinc-100'}`}
                    onClick={() => setShowDetailEvent(ev)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-zinc-900 truncate">{ev.title}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                          <span className="flex items-center gap-1"><Clock size={10} /> {formatTimeDisplay(ev.startTime)}{ev.endTime ? ` – ${formatTimeDisplay(ev.endTime)}` : ''}</span>
                          {ev.location && <span className="flex items-center gap-1 truncate"><MapPin size={10} /> {ev.location}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide border ${color.bg} ${color.text} ${color.border}`}>
                        {color.label}
                      </span>
                      {isAttending && (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black text-brand bg-brand/10 flex items-center gap-1">
                          <Check size={10} /> Going
                        </span>
                      )}
                      {attendingCount > 0 && (
                        <span className="text-[10px] text-zinc-400 font-bold"><Users size={10} className="inline" /> {attendingCount}</span>
                      )}
                      {ev.meetLink && (
                        <a
                          href={ev.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="px-3 py-1.5 rounded-full bg-brand text-white font-bold text-[10px] border border-brand flex items-center gap-1 shadow-sm hover:bg-brand-hover transition-colors"
                        >
                          <Video size={10} /> Join
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Event Modal */}
      {showCreateModal && (
        <CreateEventModal
          onClose={() => { setShowCreateModal(false); setEditingEvent(null); }}
          onCreated={(newEvent) => {
            if (newEvent && newEvent.id) {
              // Optimistic: add immediately so event appears in UI (marked for merge protection)
              setEvents(prev => [...prev, { ...newEvent, _optimistic: true }].sort((a, b) => (a.date || '').localeCompare(b.date || '')));
            }
            // Soft re-fetch after delay — gives Firestore time to index the new doc
            // Two retries: 2s and 5s to handle slow indexing
            setTimeout(() => fetchEvents(true), 2000);
            setTimeout(() => fetchEvents(true), 5000);
          }}
          editingEvent={editingEvent}
        />
      )}

      {/* Event Detail Modal */}
      {showDetailEvent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowDetailEvent(null)}>
          <div className="bg-white rounded-modal w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-elevation-3 border border-zinc-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-zinc-100">
              <span className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${getColor(showDetailEvent.type).bg} ${getColor(showDetailEvent.type).text} ${getColor(showDetailEvent.type).border}`}>
                {getColor(showDetailEvent.type).label}
              </span>
              <button onClick={() => setShowDetailEvent(null)} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
                <X size={18} className="text-zinc-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{showDetailEvent.title}</h3>

              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <CalendarDays size={16} className="text-brand" />
                {new Date(showDetailEvent.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>

              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Clock size={16} className="text-brand" />
                {formatTimeDisplay(showDetailEvent.startTime)}{showDetailEvent.endTime ? ` – ${formatTimeDisplay(showDetailEvent.endTime)}` : ''}
              </div>

              {showDetailEvent.location && (
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <MapPin size={16} className="text-brand" />
                  {showDetailEvent.location}
                </div>
              )}

              {showDetailEvent.description && (
                <p className="text-sm text-zinc-500 leading-relaxed pt-2 border-t border-zinc-100">{showDetailEvent.description}</p>
              )}

              {showDetailEvent.rsvps && showDetailEvent.rsvps.length > 0 && (
                <div className="pt-2 border-t border-zinc-100">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">
                    <Users size={14} className="inline mr-1" /> {showDetailEvent.rsvps.filter(r => r.status === 'attending').length} attending
                  </p>
                </div>
              )}

              {showDetailEvent.isRecurring && showDetailEvent.recurrenceNote && (
                <p className="text-xs text-zinc-400 italic">{showDetailEvent.recurrenceNote}</p>
              )}

              <div className="flex gap-3 pt-4">
                {showDetailEvent.meetLink && (
                  <a
                    href={showDetailEvent.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 rounded-full bg-brand text-white font-bold text-base border border-brand flex items-center justify-center gap-2 hover:bg-brand-hover transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-white" /> <Video size={16} /> Join Meeting
                  </a>
                )}
                {showDetailEvent.location && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(showDetailEvent.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 rounded-full font-bold text-base bg-white text-zinc-900 border border-zinc-950 flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-zinc-950" /> <Navigation size={16} /> Get Directions
                  </a>
                )}
              </div>

              {/* RSVP Buttons */}
              {(() => {
                const detailUserRsvp = getUserRsvpStatus(showDetailEvent);
                const detailIsAttending = detailUserRsvp === 'attending' || user.rsvpedEventIds?.includes(showDetailEvent.id) || user.assignedShiftIds?.includes(showDetailEvent.id);
                return (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleRsvp(showDetailEvent.id, detailIsAttending ? 'declined' : 'attending')}
                      disabled={rsvpLoading === showDetailEvent.id}
                      className={`flex-1 py-3 rounded-full font-bold text-base flex items-center justify-center gap-2 transition-all uppercase tracking-wide ${
                        detailIsAttending ? 'bg-rose-50 text-rose-600 border border-rose-300 hover:bg-rose-100' : 'bg-brand text-white border border-black hover:bg-brand-hover'
                      }`}
                    >
                      {rsvpLoading === showDetailEvent.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : detailIsAttending ? (
                        <><span className="w-2 h-2 rounded-full bg-rose-600" /> Cancel RSVP</>
                      ) : (
                        <><span className="w-2 h-2 rounded-full bg-white" /> RSVP — I'm Going</>
                      )}
                    </button>
                    {!detailIsAttending && detailUserRsvp !== 'tentative' && (
                      <button
                        onClick={() => handleRsvp(showDetailEvent.id, 'tentative')}
                        disabled={rsvpLoading === showDetailEvent.id}
                        className="py-3 px-5 rounded-full font-bold text-base bg-white text-zinc-600 border border-zinc-950 flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors uppercase tracking-wide"
                      >
                        <span className="w-2 h-2 rounded-full bg-zinc-950" /> Maybe
                      </button>
                    )}
                    {detailUserRsvp === 'tentative' && (
                      <span className="py-3 px-5 rounded-full font-bold text-[10px] uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center gap-2">
                        <Check size={14} /> Tentative
                      </span>
                    )}
                  </div>
                );
              })()}

              {canCreateEvents && showDetailEvent.source === 'org-calendar' && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setEditingEvent(showDetailEvent); setShowDetailEvent(null); setShowCreateModal(true); }}
                    className="flex-1 py-3 rounded-full font-bold text-base bg-white text-zinc-900 border border-zinc-950 flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors uppercase tracking-wide"
                  >
                    <span className="w-2 h-2 rounded-full bg-zinc-950" /> <Edit3 size={16} /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(showDetailEvent.id)}
                    className="flex-1 py-3 rounded-full font-bold text-base bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-300 flex items-center justify-center gap-2 transition-colors uppercase tracking-wide"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-600" /> <Trash2 size={16} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================
// Create Event Modal
// ========================================

interface CreateEventModalProps {
  onClose: () => void;
  onCreated: (newEvent?: OrgCalendarEvent) => void;
  editingEvent?: OrgCalendarEvent | null;
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({ onClose, onCreated, editingEvent }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: editingEvent?.title || '',
    date: editingEvent?.date || '',
    startTime: editingEvent?.startTime || '',
    endTime: editingEvent?.endTime || '',
    type: (editingEvent?.type || 'community-event') as OrgCalendarEvent['type'],
    location: editingEvent?.location || '',
    meetLink: editingEvent?.meetLink || '',
    description: editingEvent?.description || '',
    isRecurring: editingEvent?.isRecurring || false,
    recurrenceNote: editingEvent?.recurrenceNote || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.startTime) return;
    setError('');
    try {
      setSaving(true);
      if (editingEvent) {
        await apiService.put(`/api/org-calendar/${editingEvent.id}`, form);
        onCreated();
      } else {
        const created = await apiService.post('/api/org-calendar', form);
        onCreated(created);
      }
      onClose();
    } catch (err: any) {
      console.error(`Failed to ${editingEvent ? 'update' : 'create'} event:`, err);
      setError(err?.message || `Failed to ${editingEvent ? 'update' : 'create'} event. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-modal w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-elevation-3 border border-zinc-100" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-zinc-100">
          <h3 className="text-xl font-bold text-zinc-900">{editingEvent ? 'Edit Event' : 'New Event'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
            <X size={18} className="text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="e.g. Monthly All-Hands"
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              required
            />
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => updateField('date', e.target.value)}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Start *</label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => updateField('startTime', e.target.value)}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">End</label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => updateField('endTime', e.target.value)}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Type *</label>
            <select
              value={form.type}
              onChange={e => updateField('type', e.target.value)}
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm"
            >
              <option value="community-event">Community Event</option>
              <option value="wellness">Wellness</option>
              <option value="outreach">Community Outreach</option>
              <option value="training">Training</option>
              <option value="workshop">Workshop</option>
              <option value="street-medicine">Street Medicine</option>
              <option value="health-fair">Health Fair</option>
              <option value="all-hands">All-Hands</option>
              <option value="committee">Committee</option>
              <option value="board">Board</option>
              <option value="social">Social</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => updateField('location', e.target.value)}
              placeholder="e.g. Virtual, Office, Palmdale"
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
            />
          </div>

          {/* Meet Link */}
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Meeting Link</label>
            <input
              type="url"
              value={form.meetLink}
              onChange={e => updateField('meetLink', e.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              rows={3}
              placeholder="Event details..."
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm resize-none"
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={e => updateField('isRecurring', e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-brand focus:ring-brand"
            />
            <label className="text-sm font-bold text-zinc-700">Recurring event</label>
          </div>
          {form.isRecurring && (
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Recurrence Note</label>
              <input
                type="text"
                value={form.recurrenceNote}
                onChange={e => updateField('recurrenceNote', e.target.value)}
                placeholder="e.g. Every 1st Monday"
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700 font-bold">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !form.title || !form.date || !form.startTime}
            className="w-full py-4 font-bold text-base bg-brand text-white border border-black rounded-full hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 uppercase tracking-wide"
          >
            <span className="w-2 h-2 rounded-full bg-white" />
            {saving ? <Loader2 size={16} className="animate-spin" /> : editingEvent ? <Check size={16} /> : <Plus size={16} />}
            {saving ? (editingEvent ? 'Saving...' : 'Creating...') : (editingEvent ? 'Save Changes' : 'Create Event')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OrgCalendar;
