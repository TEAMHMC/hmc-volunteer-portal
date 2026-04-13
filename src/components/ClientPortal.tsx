import React, { useState, useEffect, useRef } from 'react';
import { Opportunity, ClientRecord } from '../types';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';
import {
  Wind, Target, BookOpen, Calendar, MapPin, CheckCircle, Loader2, X,
  ArrowRight, MessageCircle, Smartphone, Heart, Users, ChevronRight,
  Home, Wrench, Star, Send, ToggleLeft, ToggleRight, UserCheck,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type HubTab = 'home' | 'tools' | 'events' | 'care';

interface ClientPortalProps {
  onBackToLanding: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const HMC_BASE = 'https://healthmatters.clinic';

const TOOLS = [
  {
    id: 'calmkit',
    title: 'Calm Kit',
    badge: 'Reset',
    badgeStyle: 'bg-blue-50 text-blue-600 border border-blue-100',
    description: 'Breathing and grounding to help you settle.',
    cta: 'Open',
    Icon: Wind,
    href: `${HMC_BASE}/resources/calmkit`,
  },
  {
    id: 'gameplan',
    title: 'Game Plan',
    badge: 'Next steps',
    badgeStyle: 'bg-orange-50 text-orange-600 border border-orange-100',
    description: 'A simple plan when life feels off track.',
    cta: 'Open',
    Icon: Target,
    href: `${HMC_BASE}/resources/checkyourself`,
  },
  {
    id: 'resources',
    title: 'Resource Directory',
    badge: 'Curated',
    badgeStyle: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
    description: 'Trusted partners and local support.',
    cta: 'Browse',
    Icon: BookOpen,
    href: `${HMC_BASE}/resources/resourcedirectory`,
  },
];

const STORIES = [
  {
    quote: '"Movement helped me feel like myself again."',
    attribution: 'Community member',
    program: 'Unstoppable',
    bullets: ['A calm reset', 'A simple next step', 'A place to connect'],
  },
  {
    quote: '"I needed tools I could use outside of therapy."',
    attribution: 'Workshop participant',
    program: 'Unstoppable',
    bullets: ['Quick check-ins', 'Calm Kit', 'Game Plan'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const isPast = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

const formatEventDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const isThisWeekend = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const day = now.getDay();
  const daysUntilFri = (5 - day + 7) % 7;
  const fri = new Date(now); fri.setDate(now.getDate() + daysUntilFri); fri.setHours(0,0,0,0);
  const sun = new Date(fri); sun.setDate(fri.getDate() + 2); sun.setHours(23,59,59,999);
  return d >= fri && d <= sun;
};

// ─────────────────────────────────────────────────────────────────────────────
// RSVP Modal
// ─────────────────────────────────────────────────────────────────────────────

const RSVPModal: React.FC<{ opportunity: Opportunity; onClose: () => void }> = ({ opportunity, onClose }) => {
  const [formData, setFormData] = useState<Partial<Omit<ClientRecord, 'id'>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const isVirtual = opportunity.serviceLocation?.toLowerCase().includes('zoom') ||
    opportunity.serviceLocation?.toLowerCase().includes('virtual') ||
    opportunity.serviceLocation?.toLowerCase().includes('online');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await apiService.post('/api/public/rsvp', { client: formData, eventId: opportunity.id });
      setIsSuccess(true);
    } catch (err) {
      setError('Unable to submit. Please try again or contact unstoppable@healthmatters.clinic.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rsvp-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <h2 id="rsvp-modal-title" className="font-black text-zinc-900 text-base leading-tight">{opportunity.title}</h2>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">{formatEventDate(opportunity.date)}
              {opportunity.serviceLocation && ` · ${isVirtual ? 'Virtual' : opportunity.serviceLocation}`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-colors ml-2 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {isSuccess ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-emerald-500" size={32} />
            </div>
            <h3 className="font-black text-zinc-900 text-lg">You're registered.</h3>
            <p className="text-sm text-zinc-500 font-medium mt-2">
              {isVirtual
                ? 'A Zoom link will be sent to your email before the event.'
                : 'We look forward to seeing you there.'}
            </p>
            <p className="text-xs text-zinc-400 mt-4">
              Accessibility needs? Contact{' '}
              <a href="mailto:kayla@healthmatters.clinic" className="text-[#233DFF] font-bold">kayla@healthmatters.clinic</a>
            </p>
            <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-full text-sm hover:bg-zinc-200 transition-colors">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                placeholder="First name"
                onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#233DFF] focus:ring-2 focus:ring-[#233DFF]/10 min-h-[44px]"
              />
              <input
                required
                placeholder="Last name"
                onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#233DFF] focus:ring-2 focus:ring-[#233DFF]/10 min-h-[44px]"
              />
            </div>
            <input
              required
              type="email"
              placeholder="Email address"
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#233DFF] focus:ring-2 focus:ring-[#233DFF]/10 min-h-[44px]"
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#233DFF] focus:ring-2 focus:ring-[#233DFF]/10 min-h-[44px]"
            />
            <div className="text-[10px] text-zinc-400 font-medium leading-relaxed">
              By registering you agree to receive event reminders. Accessibility accommodations:{' '}
              <a href="mailto:kayla@healthmatters.clinic" className="text-[#233DFF] font-bold">kayla@healthmatters.clinic</a>
            </div>
            {error && <p className="text-rose-500 text-xs font-medium">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full hover:bg-[#1a2de0] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors text-sm"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><span className="w-1.5 h-1.5 rounded-full bg-white" /> Confirm RSVP</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Needs Form Modal (Care tab)
// ─────────────────────────────────────────────────────────────────────────────

const NEEDS_OPTIONS = [
  { id: 'housing', label: 'Housing or shelter' },
  { id: 'food', label: 'Food or groceries' },
  { id: 'mentalHealth', label: 'Mental health support' },
  { id: 'healthcare', label: 'Medical care' },
  { id: 'benefits', label: 'Benefits or financial help' },
  { id: 'transportation', label: 'Transportation' },
  { id: 'safety', label: 'Safety or domestic violence' },
  { id: 'substanceUse', label: 'Substance use support' },
];

const NeedsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      await apiService.post('/api/public/needs-intake', { name, contact, needs: selected });
    } catch {
      // fail silently — still show success to reduce barrier
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="needs-modal-title"
      onClick={onClose}
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 id="needs-modal-title" className="font-black text-zinc-900">What do you need right now?</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        {submitted ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-emerald-500" size={32} />
            </div>
            <h3 className="font-black text-zinc-900 text-lg">Got it.</h3>
            <p className="text-sm text-zinc-500 font-medium mt-2">Our team will follow up with resources and next steps.</p>
            <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-full text-sm hover:bg-zinc-200 transition-colors">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-sm text-zinc-500 font-medium">Select everything that applies. We will suggest practical options and connect you to local support.</p>
            <div className="grid grid-cols-2 gap-2">
              {NEEDS_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggle(opt.id)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all min-h-[44px] border ${
                    selected.includes(opt.id)
                      ? 'bg-[#233DFF] text-white border-[#233DFF]'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Your name (optional)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#233DFF] focus:ring-2 focus:ring-[#233DFF]/10 min-h-[44px]"
            />
            <input
              type="text"
              placeholder="Best way to reach you (phone or email, optional)"
              value={contact}
              onChange={e => setContact(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#233DFF] focus:ring-2 focus:ring-[#233DFF]/10 min-h-[44px]"
            />
            <button
              type="submit"
              disabled={selected.length === 0 || submitting}
              className="w-full min-h-[48px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full hover:bg-[#1a2de0] disabled:opacity-40 flex items-center justify-center gap-2 transition-colors text-sm"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Get Support'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Event Check-In Modal
// ─────────────────────────────────────────────────────────────────────────────

const CheckInModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSubmitting(true);
    try {
      await apiService.post('/api/public/self-checkin', { firstName: firstName.trim(), lastName: lastName.trim() });
      setDone(true);
    } catch {
      setError('Check-in unavailable right now. Please see a staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-modal-title"
      onClick={onClose}
    >
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 id="checkin-modal-title" className="font-black text-zinc-900">Check In</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        {done ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <UserCheck className="text-emerald-500" size={32} />
            </div>
            <h3 className="font-black text-zinc-900 text-lg">You're checked in.</h3>
            <p className="text-sm text-zinc-500 font-medium mt-2">Welcome. Our team will connect with you shortly.</p>
            <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-full text-sm hover:bg-zinc-200 transition-colors">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <p className="text-sm text-zinc-500 font-medium">Let us know you're here so our team can find you.</p>
            <input
              required
              placeholder="First name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#233DFF] focus:ring-2 focus:ring-[#233DFF]/10 min-h-[44px]"
            />
            <input
              required
              placeholder="Last name"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#233DFF] focus:ring-2 focus:ring-[#233DFF]/10 min-h-[44px]"
            />
            {error && <p className="text-rose-500 text-xs font-medium">{error}</p>}
            <button
              type="submit"
              disabled={!firstName.trim() || !lastName.trim() || submitting}
              className="w-full min-h-[48px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full hover:bg-[#1a2de0] disabled:opacity-40 flex items-center justify-center gap-2 transition-colors text-sm"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <><UserCheck size={15} /> Check In</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Section Label
// ─────────────────────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ title: string; subtitle: string; tag?: string; tagStyle?: string }> = ({
  title, subtitle, tag, tagStyle = 'bg-zinc-100 text-zinc-600',
}) => (
  <div className="flex items-start justify-between mb-4 gap-3">
    <div>
      <h2 className="text-lg font-black text-zinc-900 tracking-tight">{title}</h2>
      <p className="text-sm text-zinc-400 font-medium mt-0.5">{subtitle}</p>
    </div>
    {tag && (
      <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${tagStyle}`}>
        {tag}
      </span>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Hub
// ─────────────────────────────────────────────────────────────────────────────

const ClientPortal: React.FC<ClientPortalProps> = ({ onBackToLanding }) => {
  const [activeTab, setActiveTab] = useState<HubTab>('home');
  const [events, setEvents] = useState<Opportunity[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Opportunity | null>(null);
  const [showNeedsModal, setShowNeedsModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsSubmitted, setSmsSubmitted] = useState(false);

  useEffect(() => {
    apiService.get('/api/public/events')
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data?.opportunities ?? []);
        setEvents(list.filter((o: Opportunity) => !isPast(o.date)));
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  const handleSmsOptIn = async () => {
    if (!smsPhone.trim()) return;
    try {
      await apiService.post('/api/public/sms-optin', { phone: smsPhone.trim() });
    } catch {
      // fail silently
    } finally {
      setSmsSubmitted(true);
    }
  };

  const tabs: { id: HubTab; label: string; Icon: React.ElementType }[] = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'tools', label: 'Tools', Icon: Wrench },
    { id: 'events', label: 'Events', Icon: Calendar },
    { id: 'care', label: 'Care', Icon: Heart },
  ];

  return (
    <div className="min-h-screen bg-white font-['Inter'] pb-24">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBackToLanding} className="flex items-center gap-2">
            <img src={APP_CONFIG.BRAND.logoUrl} alt="Health Matters Clinic" className="w-7 h-7" />
            <span className="text-xs font-black text-zinc-900 uppercase tracking-wider hidden sm:block">Health Matters Clinic</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-400 px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-100">No long forms</span>
            <span className="text-[10px] font-bold text-[#233DFF] px-2.5 py-1 rounded-full bg-[#233DFF]/5 border border-[#233DFF]/10">One clear step</span>
          </div>
        </div>

        {/* Tab nav */}
        <div className="max-w-2xl mx-auto px-4 flex gap-0 border-t border-zinc-50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                activeTab === tab.id
                  ? 'text-[#233DFF] border-b-2 border-[#233DFF]'
                  : 'text-zinc-400 hover:text-zinc-600 border-b-2 border-transparent'
              }`}
            >
              <tab.Icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        {/* ─── HOME ─── */}
        {activeTab === 'home' && (
          <>
            {/* Hero check-in card */}
            <div className="bg-[#233DFF] rounded-2xl p-5 text-white">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Welcome</p>
              <h1 className="text-2xl font-black tracking-tight leading-tight">Helping + Healing Hub</h1>
              <p className="text-sm opacity-80 font-medium mt-1.5">Reset from wherever you are. Tools, events, and care — in one place.</p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowCheckInModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-[#233DFF] font-black rounded-full text-xs uppercase tracking-wider hover:bg-zinc-50 transition-colors min-h-[40px]"
                >
                  <UserCheck size={14} /> Check In
                </button>
                <button
                  onClick={() => setActiveTab('care')}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 text-white font-black rounded-full text-xs uppercase tracking-wider hover:bg-white/20 transition-colors min-h-[40px]"
                >
                  <Heart size={14} /> I Need Help
                </button>
              </div>
            </div>

            {/* Tools preview */}
            <section>
              <SectionLabel
                title="Tools for right now"
                subtitle="Small resets and next steps you can use today."
                tag="Unstoppable"
                tagStyle="bg-orange-50 text-orange-600 border border-orange-100"
              />
              <div className="grid grid-cols-1 gap-3">
                {TOOLS.map(tool => (
                  <a
                    key={tool.id}
                    href={tool.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-100 hover:border-zinc-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center flex-shrink-0 group-hover:bg-[#233DFF]/5 transition-colors">
                      <tool.Icon size={18} className="text-zinc-500 group-hover:text-[#233DFF] transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-zinc-900 text-sm">{tool.title}</p>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${tool.badgeStyle}`}>{tool.badge}</span>
                      </div>
                      <p className="text-xs text-zinc-400 font-medium mt-0.5 truncate">{tool.description}</p>
                    </div>
                    <span className="text-xs font-black text-zinc-400 group-hover:text-[#233DFF] transition-colors flex-shrink-0 border border-zinc-200 rounded-full px-3 py-1.5 group-hover:border-[#233DFF]/20">{tool.cta}</span>
                  </a>
                ))}
              </div>
            </section>

            {/* Events preview */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <SectionLabel
                  title="Events & screenings"
                  subtitle="Find upcoming events. Walk in, RSVP, or learn what to bring."
                  tag="Los Angeles"
                  tagStyle="bg-zinc-100 text-zinc-600"
                />
              </div>
              {eventsLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-zinc-300" /></div>
              ) : events.length === 0 ? (
                <div className="p-6 rounded-2xl border border-zinc-100 text-center">
                  <Calendar size={28} className="mx-auto text-zinc-200 mb-2" />
                  <p className="text-sm font-bold text-zinc-400">No upcoming events right now.</p>
                  <p className="text-xs text-zinc-400 mt-1">Check back soon or follow us on Instagram.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {events.slice(0, 4).map(event => {
                    const weekend = isThisWeekend(event.date);
                    const isVirtualEvent = event.serviceLocation?.toLowerCase().includes('zoom') || event.serviceLocation?.toLowerCase().includes('virtual');
                    return (
                      <div key={event.id} className="p-4 rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-all flex flex-col gap-3">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-zinc-900 text-sm leading-tight">{event.title}</p>
                            {weekend && (
                              <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">This weekend</span>
                            )}
                            {isVirtualEvent && (
                              <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">Virtual</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 font-medium mt-1">{event.description?.slice(0, 80)}{event.description?.length > 80 ? '…' : ''}</p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-medium">
                          <span className="flex items-center gap-1"><Calendar size={11} /> {formatEventDate(event.date)}</span>
                          {event.serviceLocation && <span className="flex items-center gap-1 truncate"><MapPin size={11} /> {isVirtualEvent ? 'Online' : event.serviceLocation}</span>}
                        </div>
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="w-full min-h-[40px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-xs hover:bg-[#1a2de0] transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white" /> RSVP
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {events.length > 4 && (
                <button onClick={() => setActiveTab('events')} className="mt-3 w-full py-2.5 text-xs font-black text-[#233DFF] uppercase tracking-wider hover:bg-[#233DFF]/5 rounded-xl transition-colors flex items-center justify-center gap-1">
                  View all events <ChevronRight size={13} />
                </button>
              )}
            </section>

            {/* Care & support */}
            <section>
              <SectionLabel
                title="Care & support"
                subtitle="Help with housing, food, transportation, and safety."
                tag="Care needs"
                tagStyle="bg-rose-50 text-rose-600 border border-rose-100"
              />
              <div className="rounded-2xl border border-zinc-100 overflow-hidden divide-y divide-zinc-50">
                <div className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center flex-shrink-0">
                    <Users size={18} className="text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-zinc-900 text-sm">Daily needs support</p>
                    <p className="text-xs text-zinc-400 font-medium mt-0.5">Share what's getting in the way. We'll suggest practical options.</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setShowNeedsModal(true)}
                      className="px-3 py-2 min-h-[36px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-[10px] hover:bg-[#1a2de0] transition-colors"
                    >
                      Start
                    </button>
                    <a
                      href={`${HMC_BASE}/resources/resourcedirectory`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 min-h-[36px] border border-zinc-200 text-zinc-600 font-black uppercase tracking-wider rounded-full text-[10px] hover:bg-zinc-50 transition-colors flex items-center"
                    >
                      Browse
                    </a>
                  </div>
                </div>
                <div className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center flex-shrink-0">
                    <MessageCircle size={18} className="text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-zinc-900 text-sm">Want gentle check-ins?</p>
                    <p className="text-xs text-zinc-400 font-medium mt-0.5">We can send a short check-in by text. You can stop anytime.</p>
                  </div>
                  <button
                    onClick={() => setSmsOptIn(v => !v)}
                    aria-label={smsOptIn ? 'Disable SMS check-ins' : 'Enable SMS check-ins'}
                    className="flex-shrink-0 transition-colors"
                  >
                    {smsOptIn
                      ? <ToggleRight size={32} className="text-[#233DFF]" />
                      : <ToggleLeft size={32} className="text-zinc-300" />}
                  </button>
                </div>
                {smsOptIn && !smsSubmitted && (
                  <div className="p-4 bg-[#233DFF]/3 flex gap-2 items-center">
                    <input
                      type="tel"
                      placeholder="Your phone number"
                      value={smsPhone}
                      onChange={e => setSmsPhone(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#233DFF] min-h-[40px]"
                    />
                    <button
                      onClick={handleSmsOptIn}
                      disabled={!smsPhone.trim()}
                      className="px-4 py-2 min-h-[40px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-[10px] hover:bg-[#1a2de0] disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      <Send size={12} /> Sign Up
                    </button>
                  </div>
                )}
                {smsOptIn && smsSubmitted && (
                  <div className="p-4 bg-emerald-50 flex items-center gap-2 text-emerald-700">
                    <CheckCircle size={16} />
                    <p className="text-xs font-bold">You're signed up for SMS check-ins.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Unstoppable Stories */}
            <section>
              <SectionLabel
                title="Unstoppable stories"
                subtitle="Real words from the community — plus a clear next step."
                tag="Human"
                tagStyle="bg-zinc-100 text-zinc-600"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STORIES.map((story, i) => (
                  <div key={i} className="rounded-2xl border border-zinc-100 p-4 flex flex-col gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100">{story.program}</span>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Digital companion</span>
                      </div>
                      <p className="text-sm font-bold text-zinc-800 leading-snug">{story.quote}</p>
                      <p className="text-[10px] text-zinc-400 font-medium mt-1">{story.attribution}</p>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-2">What you'll get</p>
                      <ul className="space-y-1">
                        {story.bullets.map((b, j) => (
                          <li key={j} className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                            <span className="w-1 h-1 rounded-full bg-zinc-400 flex-shrink-0" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={() => setActiveTab('tools')}
                      className="mt-auto w-full min-h-[40px] border border-zinc-200 text-zinc-700 font-black uppercase tracking-wider rounded-full text-[10px] hover:bg-zinc-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      Try a tool <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ─── TOOLS ─── */}
        {activeTab === 'tools' && (
          <section>
            <SectionLabel
              title="Tools for right now"
              subtitle="No account needed. Open, use, and close."
              tag="Unstoppable"
              tagStyle="bg-orange-50 text-orange-600 border border-orange-100"
            />
            <div className="space-y-3">
              {TOOLS.map(tool => (
                <a
                  key={tool.id}
                  href={tool.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-5 rounded-2xl border border-zinc-100 hover:border-[#233DFF]/20 hover:shadow-sm transition-all group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center flex-shrink-0 group-hover:bg-[#233DFF]/5 transition-colors">
                    <tool.Icon size={20} className="text-zinc-500 group-hover:text-[#233DFF] transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-zinc-900">{tool.title}</p>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${tool.badgeStyle}`}>{tool.badge}</span>
                    </div>
                    <p className="text-sm text-zinc-400 font-medium mt-0.5">{tool.description}</p>
                  </div>
                  <span className="text-xs font-black text-zinc-400 group-hover:text-[#233DFF] transition-colors flex-shrink-0 border border-zinc-200 rounded-full px-4 py-2 group-hover:border-[#233DFF]/20 min-h-[36px] flex items-center">
                    {tool.cta}
                  </span>
                </a>
              ))}
            </div>

            {/* Sunny prompt */}
            <div className="mt-6 p-5 rounded-2xl bg-[#233DFF]/5 border border-[#233DFF]/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#233DFF] flex items-center justify-center flex-shrink-0">
                  <Star size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-zinc-900 text-sm">Not sure where to start?</p>
                  <p className="text-xs text-zinc-500 font-medium">Ask Sunny. Our AI navigator can point you in the right direction.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── EVENTS ─── */}
        {activeTab === 'events' && (
          <section>
            <SectionLabel
              title="Events & screenings"
              subtitle="All upcoming HMC events. Walk in or RSVP ahead."
              tag="Los Angeles"
              tagStyle="bg-zinc-100 text-zinc-600"
            />
            {eventsLoading ? (
              <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-zinc-300" /></div>
            ) : events.length === 0 ? (
              <div className="py-16 text-center">
                <Calendar size={40} className="mx-auto text-zinc-200 mb-4" />
                <p className="font-bold text-zinc-400">No upcoming events right now.</p>
                <p className="text-sm text-zinc-400 mt-1">Follow us on Instagram for updates.</p>
                <a
                  href="https://instagram.com/healthmattersclinic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-xs hover:bg-[#1a2de0] transition-colors"
                >
                  Follow on Instagram
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map(event => {
                  const weekend = isThisWeekend(event.date);
                  const isVirtualEvent = event.serviceLocation?.toLowerCase().includes('zoom') || event.serviceLocation?.toLowerCase().includes('virtual');
                  return (
                    <div key={event.id} className="p-5 rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-all">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="font-bold text-zinc-900">{event.title}</h3>
                        <div className="flex flex-wrap gap-1 flex-shrink-0">
                          {weekend && <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">This weekend</span>}
                          {isVirtualEvent && <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">Virtual</span>}
                          {event.category && <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">{event.category}</span>}
                        </div>
                      </div>
                      {event.description && <p className="text-sm text-zinc-500 font-medium mb-3 leading-relaxed">{event.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-medium mb-4">
                        <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatEventDate(event.date)}</span>
                        {event.serviceLocation && (
                          <span className="flex items-center gap-1.5">
                            <MapPin size={12} />
                            {isVirtualEvent ? 'Virtual — Zoom' : event.serviceLocation}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedEvent(event)}
                        className="w-full min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] transition-colors flex items-center justify-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white" /> RSVP Now
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ─── CARE ─── */}
        {activeTab === 'care' && (
          <section className="space-y-4">
            <SectionLabel
              title="Care & support"
              subtitle="Help with housing, food, transportation, safety, and mental health."
              tag="Care needs"
              tagStyle="bg-rose-50 text-rose-600 border border-rose-100"
            />

            {/* Immediate help CTA */}
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100">
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-500 mb-1">Crisis support</p>
              <p className="font-bold text-zinc-900 text-sm mb-3">If you're in crisis or need immediate help:</p>
              <div className="space-y-2">
                <a href="tel:988" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-rose-100 hover:shadow-sm transition-all group">
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <Smartphone size={14} className="text-rose-600" />
                  </div>
                  <div>
                    <p className="font-black text-zinc-900 text-sm">988 Suicide &amp; Crisis Lifeline</p>
                    <p className="text-xs text-zinc-400 font-medium">Call or text 988 — free, 24/7</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-300 ml-auto group-hover:text-rose-400 transition-colors" />
                </a>
                <a href="sms:741741?body=HELLO" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-rose-100 hover:shadow-sm transition-all group">
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <MessageCircle size={14} className="text-rose-600" />
                  </div>
                  <div>
                    <p className="font-black text-zinc-900 text-sm">Crisis Text Line</p>
                    <p className="text-xs text-zinc-400 font-medium">Text HOME to 741741</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-300 ml-auto group-hover:text-rose-400 transition-colors" />
                </a>
              </div>
            </div>

            {/* Needs intake */}
            <div className="p-5 rounded-2xl border border-zinc-100">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center flex-shrink-0">
                  <Users size={18} className="text-zinc-400" />
                </div>
                <div>
                  <p className="font-bold text-zinc-900 text-sm">Daily needs support</p>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">Tell us what's getting in the way. We'll match you with practical resources and follow up.</p>
                </div>
              </div>
              <button
                onClick={() => setShowNeedsModal(true)}
                className="w-full min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] transition-colors flex items-center justify-center gap-2"
              >
                Share What You Need
              </button>
              <button
                onClick={() => window.open(`${HMC_BASE}/resources/resourcedirectory`, '_blank')}
                className="w-full min-h-[44px] mt-2 border border-zinc-200 text-zinc-600 font-black uppercase tracking-wider rounded-full text-sm hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
              >
                <BookOpen size={14} /> Browse Resource Directory
              </button>
            </div>

            {/* SMS check-ins */}
            <div className="p-5 rounded-2xl border border-zinc-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={18} className="text-zinc-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-zinc-900 text-sm">Want gentle check-ins?</p>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">A short text from us, once a week. You can stop anytime.</p>
                </div>
                <button
                  onClick={() => setSmsOptIn(v => !v)}
                  aria-label={smsOptIn ? 'Disable SMS check-ins' : 'Enable SMS check-ins'}
                >
                  {smsOptIn
                    ? <ToggleRight size={36} className="text-[#233DFF]" />
                    : <ToggleLeft size={36} className="text-zinc-300" />}
                </button>
              </div>
              {smsOptIn && !smsSubmitted && (
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="Your phone number"
                    value={smsPhone}
                    onChange={e => setSmsPhone(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#233DFF] min-h-[44px]"
                  />
                  <button
                    onClick={handleSmsOptIn}
                    disabled={!smsPhone.trim()}
                    className="px-4 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-xs hover:bg-[#1a2de0] disabled:opacity-40 transition-colors flex items-center gap-1.5"
                  >
                    <Send size={13} /> Sign Up
                  </button>
                </div>
              )}
              {smsOptIn && smsSubmitted && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 rounded-xl text-emerald-700">
                  <CheckCircle size={16} />
                  <p className="text-xs font-bold">Signed up for SMS check-ins.</p>
                </div>
              )}
            </div>

            {/* Contact */}
            <div className="p-5 rounded-2xl border border-zinc-100">
              <p className="font-bold text-zinc-900 text-sm mb-3">Reach our team directly</p>
              <div className="space-y-2">
                {[
                  { label: 'General', email: 'unstoppable@healthmatters.clinic' },
                  { label: 'Accessibility needs', email: 'kayla@healthmatters.clinic' },
                  { label: 'Partnerships', email: 'partner@healthmatters.clinic' },
                ].map(({ label, email }) => (
                  <a
                    key={email}
                    href={`mailto:${email}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 transition-colors group"
                  >
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</p>
                      <p className="text-sm font-bold text-[#233DFF]">{email}</p>
                    </div>
                    <ChevronRight size={16} className="text-zinc-300 group-hover:text-[#233DFF] transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-100 sm:hidden">
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] font-black uppercase tracking-wider transition-colors ${
                activeTab === tab.id ? 'text-[#233DFF]' : 'text-zinc-400'
              }`}
            >
              <tab.Icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Modals ── */}
      {selectedEvent && <RSVPModal opportunity={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      {showNeedsModal && <NeedsModal onClose={() => setShowNeedsModal(false)} />}
      {showCheckInModal && <CheckInModal onClose={() => setShowCheckInModal(false)} />}
    </div>
  );
};

export default ClientPortal;
