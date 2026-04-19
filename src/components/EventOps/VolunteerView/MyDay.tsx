import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Users,
  MapPin,
  Clock,
  Star,
  Zap,
  ClipboardList,
  BookOpen,
  UserCheck,
  LogOut,
  ChevronRight,
  Loader2,
  AlertCircle,
  Trophy,
  Shield,
  Navigation,
  X,
  MessageSquare,
  Camera,
  Image,
} from 'lucide-react';
import { useOps } from '../OpsContext';
import {
  CHECKLIST_TEMPLATES,
  SCRIPTS,
  EVENT_TYPE_TEMPLATE_MAP,
} from '../../../constants';
import { apiService } from '../../../services/apiService';
import { toastService } from '../../../services/toastService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VolunteerMyDayProps {
  onBack: () => void;
  onNavigateToAcademy?: () => void;
}

type ServiceLogType = 'screening' | 'resources' | 'referral' | 'survey' | null;

interface ReferralForm {
  clientName: string;
  clientId?: string;
  needType: string;
  consentGiven: boolean;
}

interface ResourceForm {
  itemName: string;
  quantity: number;
}

// DHSP county-mandated demographics for regulated items (HIV/Syphilis test kits, Narcan)
const REGULATED_ITEMS = ['HIV Test Kit', 'Syphilis Test Kit', 'Narcan'] as const;
type RegulatedItem = typeof REGULATED_ITEMS[number];

const DHSP_GENDER_OPTIONS = [
  { value: 'A', label: 'Male' },
  { value: 'B', label: 'Female' },
  { value: 'C', label: 'Transgender Male' },
  { value: 'D', label: 'Transgender Female' },
  { value: 'E', label: 'Non-Binary / Gender Non-Conforming' },
  { value: 'F', label: 'Other' },
  { value: 'G', label: 'Prefer not to answer' },
];
const DHSP_RACE_OPTIONS = [
  { value: 'A', label: 'American Indian / Alaska Native' },
  { value: 'B', label: 'Asian' },
  { value: 'C', label: 'Black / African American' },
  { value: 'D', label: 'Hispanic / Latino' },
  { value: 'E', label: 'Native Hawaiian / Pacific Islander' },
  { value: 'F', label: 'White' },
  { value: 'G', label: 'Multiracial / Other' },
];
const DHSP_AGE_OPTIONS = [
  { value: 'A', label: '13–17' },
  { value: 'B', label: '18–24' },
  { value: 'C', label: '25–34' },
  { value: 'D', label: '35–44' },
  { value: 'E', label: '45–54' },
  { value: 'F', label: '55–64' },
  { value: 'G', label: '65+' },
];
const DHSP_HIV_TEST_OPTIONS = [
  { value: 'A', label: 'Never tested' },
  { value: 'B', label: 'Tested more than 12 months ago' },
  { value: 'C', label: 'Tested within the last 12 months' },
  { value: 'D', label: 'Prefer not to answer' },
];

interface DhspDemographics {
  genderIdentity: string;
  raceEthnicity: string;
  ageRange: string;
  hivTestHistory: string;
  zipCode: string;
  hivKitCount: 0 | 1 | 2;
  syphilisKitCount: 0 | 1 | 2;
  narcanCount: number;
  referredForTesting: boolean;
  referralLocation: string;
}

type ScreeningType = 'bp' | 'o2' | 'temp' | 'glucose' | 'bmi';

interface ScreeningForm {
  screeningType: ScreeningType;
  systolic: string;
  diastolic: string;
  o2: string;
  temp: string;
  glucose: string;
  bmi: string;
  followUp: boolean;
  clientName: string;
  clientId?: string;
  isWalkIn: boolean;
  notes: string;
}

type TrafficLevel = 'normal' | 'elevated' | 'high' | 'critical';

interface TrafficResult {
  level: TrafficLevel;
  color: 'green' | 'yellow' | 'red';
  label: string;
  flagKey?: 'bloodPressure' | 'glucose';
}

function getBpTraffic(sys: number, dia: number): TrafficResult {
  if (sys >= 180 || dia >= 120) return { level: 'critical', color: 'red', label: 'Hypertensive Crisis — 911 if symptoms', flagKey: 'bloodPressure' };
  if (sys >= 140 || dia >= 90) return { level: 'high', color: 'red', label: 'Stage 2 High — Flag for follow-up', flagKey: 'bloodPressure' };
  if (sys >= 130 || dia >= 80) return { level: 'elevated', color: 'yellow', label: 'Stage 1 High — Recommend doctor visit', flagKey: 'bloodPressure' };
  if (sys >= 120) return { level: 'elevated', color: 'yellow', label: 'Elevated — Monitor, lifestyle advice', flagKey: 'bloodPressure' };
  return { level: 'normal', color: 'green', label: 'Normal — No action needed', flagKey: 'bloodPressure' };
}

function getO2Traffic(o2: number): TrafficResult {
  if (o2 < 90) return { level: 'critical', color: 'red', label: 'Critical — Needs immediate attention' };
  if (o2 < 95) return { level: 'elevated', color: 'yellow', label: 'Low — Monitor, refer if persistent' };
  return { level: 'normal', color: 'green', label: 'Normal' };
}

function getTempTraffic(temp: number): TrafficResult {
  if (temp > 103 || temp < 96) return { level: 'critical', color: 'red', label: 'Critical — Immediate medical attention' };
  if (temp > 100.4 || temp < 97) return { level: 'high', color: 'red', label: 'Fever / Hypothermia — Flag for follow-up' };
  if (temp > 99.5) return { level: 'elevated', color: 'yellow', label: 'Low-grade fever — Monitor' };
  return { level: 'normal', color: 'green', label: 'Normal' };
}

function getGlucoseTraffic(g: number): TrafficResult {
  if (g >= 200 || g < 54) return { level: 'critical', color: 'red', label: 'Critical — Flag for immediate follow-up', flagKey: 'glucose' };
  if (g >= 126 || g < 70) return { level: 'high', color: 'red', label: 'High / Low — Flag for follow-up', flagKey: 'glucose' };
  if (g >= 100) return { level: 'elevated', color: 'yellow', label: 'Pre-diabetic range — Recommend doctor visit', flagKey: 'glucose' };
  return { level: 'normal', color: 'green', label: 'Normal', flagKey: 'glucose' };
}

function getBmiTraffic(bmi: number): TrafficResult {
  if (bmi >= 40 || bmi < 15) return { level: 'critical', color: 'red', label: 'Critical range — Medical referral recommended' };
  if (bmi >= 30 || bmi < 18.5) return { level: 'high', color: 'red', label: 'Outside healthy range — Suggest provider visit' };
  if (bmi >= 25) return { level: 'elevated', color: 'yellow', label: 'Overweight — Lifestyle guidance' };
  return { level: 'normal', color: 'green', label: 'Healthy weight' };
}

const TRAFFIC_COLORS = {
  green: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  yellow: { dot: 'bg-amber-400', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  red: { dot: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
};

const BP_REFERENCE = [
  { color: 'green' as const, label: 'Normal', range: '< 120 / < 80' },
  { color: 'yellow' as const, label: 'Elevated', range: '120–129 / < 80' },
  { color: 'yellow' as const, label: 'Stage 1 High', range: '130–139 / 80–89' },
  { color: 'red' as const, label: 'Stage 2 High', range: '≥ 140 / ≥ 90' },
  { color: 'red' as const, label: 'Crisis', range: '≥ 180 / ≥ 120' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatShiftTime(timeStr: string): string {
  // Handles "HH:MM" or ISO strings
  if (timeStr.includes('T')) return formatTime(timeStr);
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getElapsedMinutes(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isWithin45Minutes(endTimeStr: string): boolean {
  const now = new Date();
  const [h, m] = endTimeStr.includes('T')
    ? [new Date(endTimeStr).getHours(), new Date(endTimeStr).getMinutes()]
    : endTimeStr.split(':').map(Number);
  const end = new Date();
  end.setHours(h, m, 0, 0);
  const diffMs = end.getTime() - now.getTime();
  return diffMs <= 45 * 60 * 1000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Progress Indicator
// ─────────────────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Arrive', 'Assigned', 'Serving', 'Wrap Up'];

function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 px-4 py-3">
      {STEP_LABELS.map((label, idx) => {
        const isCompleted = idx < current;
        const isActive = idx === current;
        const isFuture = idx > current;
        return (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  'flex items-center justify-center rounded-full font-black text-xs transition-all duration-300',
                  'w-8 h-8',
                  isCompleted
                    ? 'bg-[#233DFF]/40 text-white'
                    : isActive
                    ? 'bg-[#233DFF] text-white shadow-lg shadow-[#233DFF]/30'
                    : 'bg-zinc-200 text-zinc-400',
                ].join(' ')}
              >
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={[
                  'text-[10px] font-black uppercase tracking-wider',
                  isActive ? 'text-[#233DFF]' : isCompleted ? 'text-[#233DFF]/50' : 'text-zinc-300',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div
                className={[
                  'h-[2px] flex-1 mx-1 mb-5 rounded-full transition-all duration-300',
                  idx < current ? 'bg-[#233DFF]/40' : 'bg-zinc-200',
                ].join(' ')}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulation Guide — visible only in test/practice mode
// ─────────────────────────────────────────────────────────────────────────────

interface SimScenario {
  id: string;
  step: string;
  title: string;
  context: string;
  clientSays?: string;
  volunteerSays?: string;
  action: string;
  mockReading?: {
    label: string;
    value: string;
    color: 'green' | 'yellow' | 'red';
    meaning: string;
    doNext: string;
  };
  isComplete: (state: any) => boolean;
}

const SIMULATION_SCENARIOS: SimScenario[] = [
  {
    id: 'arrive',
    step: '1 of 5',
    title: 'Arrive & Check In',
    context: "You've arrived at 545 S San Pedro St. Your Events Lead is setting up near the entrance. Make contact and check in to get your station assignment.",
    action: 'Tap "Check In" to check in with your lead.',
    isComplete: (s) => !!s.checkinStatus?.checkedIn,
  },
  {
    id: 'screening',
    step: '2 of 5',
    title: 'Client Encounter — Raymond',
    context: "You're walking the outreach area near 5th & San Pedro. Raymond (approx. 50s, male) is sitting on a crate. He looks tired but makes eye contact.",
    clientSays: '"My blood pressure has been acting up and I haven\'t seen a doctor in two years. I don\'t know what to do."',
    volunteerSays: '"Hi Raymond, I\'m with Health Matters Clinic. We have a free health station set up right here — can I check your BP right now? Takes about two minutes."',
    mockReading: {
      label: "Raymond's BP reading",
      value: '158 / 96 mmHg',
      color: 'red',
      meaning: 'RED — Stage 2 High Blood Pressure (≥ 140/90). This is above normal and needs follow-up.',
      doNext: 'Tell Raymond: "Your blood pressure is higher than it should be. That\'s something a doctor should look at soon — we can connect you with a free clinic today." Log the screening and check "Follow-up needed."',
    },
    action: 'Tap "Screening" below, enter the BP reading, and log the result.',
    isComplete: (s) => (s.tracker?.clientLogs ?? []).some((l: any) => l.type === 'screening') || (s.simTestLogs ?? []).includes('screening'),
  },
  {
    id: 'distribution',
    step: '3 of 5',
    title: 'Client Encounter — Maria',
    context: "Maria (approx. 30s, female) walks over to your supply table. She mentions she's staying at a nearby shelter and asks about HIV self-test kits.",
    clientSays: '"I heard you have those at-home HIV test kits? My partner and I haven\'t been tested in a while and I want to be safe."',
    volunteerSays: '"Absolutely — we have free HIV self-test kits. Before I give you one, LA County asks us to collect a few anonymous questions. No name needed — it just helps them fund these programs."',
    action: 'Tap "Resources", select "HIV Test Kit", complete the required DHSP demographics form, and log the distribution.',
    isComplete: (s) => (s.tracker?.clientLogs ?? []).some((l: any) => l.type === 'distribution') || (s.simTestLogs ?? []).includes('distribution'),
  },
  {
    id: 'referral',
    step: '4 of 5',
    title: 'Client Encounter — James',
    context: "James (approx. 40s, male) steps aside with you, away from the group. He speaks quietly and looks vulnerable.",
    clientSays: '"I\'ve been feeling really low lately... can\'t sleep, can\'t focus. I heard you all know about mental health help."',
    volunteerSays: '"James, thank you for trusting me. You deserve real support — we connect people with mental health services. Can I get your verbal consent to set up a referral for you?"',
    action: 'After getting his verbal consent, tap "Referrals" and log the referral (Mental Health Services). Check the consent box.',
    isComplete: (s) => (s.tracker?.clientLogs ?? []).some((l: any) => l.type === 'referral') || (s.simTestLogs ?? []).includes('referral'),
  },
  {
    id: 'wrapup',
    step: '5 of 5',
    title: 'Wrap Up & Sign Off',
    context: "Outstanding work! You\'ve completed all four practice encounters — a screening, a distribution, and a referral. The Events Lead is signaling wrap-up time.",
    action: 'Tap "Begin Wrap-Up" when you\'re ready, then review your logs and sign off to complete the simulation.',
    isComplete: (s) => !!s.checkoutResult,
  },
];

function SimulationGuide() {
  const { state } = useOps();
  const [minimized, setMinimized] = useState(false);

  const completedCount = SIMULATION_SCENARIOS.filter(s => s.isComplete(state)).length;
  const activeIndex = SIMULATION_SCENARIOS.findIndex(s => !s.isComplete(state));
  const scenario = activeIndex >= 0 ? SIMULATION_SCENARIOS[activeIndex] : null;

  // Auto-expand when scenario changes
  const prevActiveIndex = useRef(activeIndex);
  useEffect(() => {
    if (activeIndex !== prevActiveIndex.current) {
      setMinimized(false);
      prevActiveIndex.current = activeIndex;
    }
  }, [activeIndex]);

  if (!scenario) return null; // All done — celebration shown by WrapUp

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="w-full mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 text-left active:scale-[0.99] transition-all"
      >
        <MessageSquare size={14} className="text-amber-500 flex-shrink-0" />
        <span className="text-xs font-black text-amber-700 uppercase tracking-wider flex-1">Scenario Guide</span>
        <div className="flex gap-1 mr-2">
          {SIMULATION_SCENARIOS.map((s, i) => (
            <div key={s.id} className={`w-1.5 h-1.5 rounded-full ${i < completedCount ? 'bg-amber-500' : i === completedCount ? 'bg-amber-400 animate-pulse' : 'bg-amber-200'}`} />
          ))}
        </div>
        <span className="text-[10px] text-amber-500 font-black">{completedCount}/{SIMULATION_SCENARIOS.length}</span>
      </button>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={14} className="text-amber-500 flex-shrink-0" />
        <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider flex-1">Scenario Guide — Step {scenario.step}</span>
        <div className="flex gap-1 mr-1">
          {SIMULATION_SCENARIOS.map((s, i) => (
            <div key={s.id} className={`w-1.5 h-1.5 rounded-full transition-colors ${i < completedCount ? 'bg-amber-500' : i === completedCount ? 'bg-amber-400 animate-pulse' : 'bg-amber-200'}`} />
          ))}
        </div>
        <button onClick={() => setMinimized(true)} className="text-amber-300 hover:text-amber-600 ml-1"><X size={14} /></button>
      </div>

      {/* Scenario title + context */}
      <p className="text-sm font-black text-amber-900 mb-1.5">{scenario.title}</p>
      <p className="text-xs text-amber-800 font-medium leading-relaxed mb-2">{scenario.context}</p>

      {/* Client says */}
      {scenario.clientSays && (
        <div className="bg-white border border-amber-200 rounded-xl p-2.5 mb-2">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider mb-1">Client says:</p>
          <p className="text-xs text-zinc-700 italic leading-relaxed">{scenario.clientSays}</p>
        </div>
      )}

      {/* Volunteer response */}
      {scenario.volunteerSays && (
        <div className="bg-[#233DFF]/5 border border-[#233DFF]/10 rounded-xl p-2.5 mb-2">
          <p className="text-[10px] font-black text-[#233DFF] uppercase tracking-wider mb-1">Your response:</p>
          <p className="text-xs text-zinc-700 italic leading-relaxed">{scenario.volunteerSays}</p>
        </div>
      )}

      {/* Mock reading + traffic light */}
      {scenario.mockReading && (() => {
        const r = scenario.mockReading!;
        const colorMap = {
          green: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', label: 'text-emerald-600' },
          yellow: { dot: 'bg-amber-400', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', label: 'text-amber-600' },
          red: { dot: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', label: 'text-red-600' },
        }[r.color];
        return (
          <div className={`${colorMap.bg} ${colorMap.border} border rounded-xl p-3 mb-2`}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-3 h-3 rounded-full ${colorMap.dot} flex-shrink-0`} />
              <p className={`text-[10px] font-black uppercase tracking-wider ${colorMap.label}`}>{r.label}</p>
            </div>
            <p className={`text-lg font-black ${colorMap.text} mb-1`}>{r.value}</p>
            <p className={`text-xs font-bold ${colorMap.text} mb-2 leading-relaxed`}>{r.meaning}</p>
            <div className="bg-white/60 rounded-lg p-2">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">What to do:</p>
              <p className="text-xs text-zinc-700 leading-relaxed italic">{r.doNext}</p>
            </div>
          </div>
        );
      })()}

      {/* Action */}
      <div className="flex items-start gap-2 mt-2 bg-amber-100 rounded-xl px-3 py-2">
        <ArrowRight size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 font-black leading-relaxed">{scenario.action}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 0 — ARRIVE
// ─────────────────────────────────────────────────────────────────────────────

function StepArrive() {
  const { state, opportunity, shift, isTestMode, checkIn } = useOps();
  const [checking, setChecking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const isCheckedIn = state.checkinStatus?.checkedIn ?? false;

  useEffect(() => {
    if (isCheckedIn) setShowSuccess(true);
  }, [isCheckedIn]);

  const handleCheckIn = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await checkIn();
      setShowSuccess(true);
    } catch {
      // toastService already shows error
    } finally {
      setChecking(false);
    }
  };

  const checkinStatus = state.checkinStatus;

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#233DFF]">
            Today's Mission
          </span>
          {isTestMode && (
            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
              <Zap className="w-2.5 h-2.5" />
              Practice Mode
            </span>
          )}
        </div>

        <h1 className="text-2xl font-black tracking-tighter uppercase text-zinc-900 leading-tight mb-3">
          {opportunity.title}
        </h1>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-zinc-400 font-medium text-sm">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              {formatShiftTime(shift.startTime)} – {formatShiftTime(shift.endTime)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400 font-medium text-sm">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>{opportunity.serviceLocation}</span>
          </div>
        </div>
      </div>

      {/* Check-in action (only shown when not yet checked in) */}
      {!showSuccess && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
          <button
            onClick={handleCheckIn}
            disabled={checking}
            className={[
              'w-full flex items-center justify-center gap-3 rounded-full font-black uppercase tracking-wider text-white transition-all duration-300',
              'min-h-[64px] text-base',
              checking
                ? 'bg-[#233DFF]/60 cursor-not-allowed'
                : 'bg-[#233DFF] active:scale-95 shadow-lg shadow-[#233DFF]/25',
            ].join(' ')}
          >
            {checking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Checking In...
              </>
            ) : (
              <>
                <UserCheck className="w-5 h-5" />
                I'm Here — Check In
              </>
            )}
          </button>
          <p className="text-center text-zinc-400 font-medium text-xs mt-3">
            Team members only · Not for community participants
          </p>
        </div>
      )}

      {/* Success + Buddy card */}
      {showSuccess && checkinStatus && (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Check-in confirmation */}
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="font-black text-zinc-900 text-base">You're checked in!</p>
                {checkinStatus.checkedInAt && (
                  <p className="text-zinc-400 font-medium text-sm">
                    {formatTime(checkinStatus.checkedInAt)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Buddy card */}
          {checkinStatus.buddyName ? (
            <div className="rounded-2xl border border-[#233DFF]/10 bg-gradient-to-br from-[#233DFF]/5 to-blue-50 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#233DFF] flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#233DFF] mb-1">
                    Your Buddy
                  </p>
                  <p className="font-black text-zinc-900 text-lg leading-tight">
                    {checkinStatus.buddyName}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {checkinStatus.buddyRole && (
                      <span className="bg-[#233DFF]/10 text-[#233DFF] text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                        {checkinStatus.buddyRole}
                      </span>
                    )}
                    {checkinStatus.pairLabel && (
                      <span className="bg-zinc-100 text-zinc-500 text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                        {checkinStatus.pairLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 animate-pulse">
                  <Users className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-black text-amber-800 text-sm">Waiting for buddy assignment</p>
                  <p className="text-amber-600 font-medium text-xs mt-0.5">
                    You'll be paired when another volunteer arrives
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Advance hint — step auto-advances via state */}
          <div className="flex items-center justify-center gap-2 text-zinc-400 font-medium text-sm py-1">
            <span>Scroll down to see your assignment</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — ASSIGNED
// ─────────────────────────────────────────────────────────────────────────────

interface StepAssignedProps {
  onStartServing: () => void;
}

function StepAssigned({ onStartServing }: StepAssignedProps) {
  const { shift, opportunity, user } = useOps();
  const [scriptOpen, setScriptOpen] = useState(false);

  const templateId = EVENT_TYPE_TEMPLATE_MAP[opportunity.category] ?? null;
  const template = templateId
    ? CHECKLIST_TEMPLATES.find((t) => t.id === templateId) ?? null
    : null;
  const previewItems = template
    ? Object.values(template.stages)
        .flatMap((stage) => stage.items)
        .slice(0, 4)
    : [];

  // Find a matching script by event category keywords
  const matchedScript = SCRIPTS.find((s) =>
    s.title.toLowerCase().includes('en') &&
    (opportunity.category.toLowerCase().includes('survey') ||
      opportunity.category.toLowerCase().includes('outreach') ||
      opportunity.category.toLowerCase().includes('street'))
  ) ?? SCRIPTS[0] ?? null;

  const roleLabel = shift.roleType || user.role || 'Volunteer';

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Assignment card */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="border-l-4 border-[#233DFF] p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#233DFF] mb-3">
            Your Assignment
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-0.5">Role</p>
              <p className="text-xl font-black tracking-tight text-zinc-900">{roleLabel}</p>
            </div>
            <div className="h-px bg-zinc-100" />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
                <p className="text-sm font-medium text-zinc-600">{opportunity.serviceLocation}</p>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                <p className="text-sm font-medium text-zinc-600">
                  {formatShiftTime(shift.startTime)} – {formatShiftTime(shift.endTime)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What you'll be doing */}
      {previewItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-[#233DFF]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-[#233DFF]">
              What You'll Be Doing Today
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            {previewItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-zinc-200 flex items-center justify-center shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-zinc-600 leading-snug">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Script reference — collapsible */}
      {matchedScript && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setScriptOpen((v) => !v)}
            className="w-full flex items-center justify-between p-5 min-h-[44px] text-left"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#233DFF]" />
              <span className="text-sm font-black text-zinc-800">Outreach Script</span>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                scriptOpen ? 'rotate-90' : ''
              }`}
            />
          </button>
          {scriptOpen && (
            <div className="border-t border-zinc-100 px-5 pb-5 animate-in fade-in duration-200">
              {matchedScript.notice && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 mt-3">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-amber-700">{matchedScript.notice}</p>
                </div>
              )}
              <pre className="whitespace-pre-wrap text-sm text-zinc-600 font-sans leading-relaxed mt-3">
                {matchedScript.content.trim()}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onStartServing}
        className="w-full flex items-center justify-center gap-2 bg-[#233DFF] text-white rounded-full font-black uppercase tracking-wider min-h-[56px] text-sm active:scale-95 transition-all duration-200 shadow-lg shadow-[#233DFF]/25"
      >
        I'm Ready — Let's Go
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — SERVING
// ─────────────────────────────────────────────────────────────────────────────

interface StepServingProps {
  onBeginWrapUp: () => void;
  serviceLogsCount: number;
  onServiceLogged: () => void;
}

function StepServing({ onBeginWrapUp, serviceLogsCount, onServiceLogged }: StepServingProps) {
  const { state, opportunity, shift, user, isTestMode, checkItem, logAudit, logSimActivity } = useOps();
  const [activeLog, setActiveLog] = useState<ServiceLogType>(null);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [showSurveyKiosk, setShowSurveyKiosk] = useState(false);
  const [escalationScreeningId, setEscalationScreeningId] = useState<string | null>(null);
  const [escalationClientName, setEscalationClientName] = useState('');
  const [showRefusalForm, setShowRefusalForm] = useState(false);
  const [refusalSubmitting, setRefusalSubmitting] = useState(false);
  const [refusalForm, setRefusalForm] = useState({ reason: '', witness1Name: '', witness1Sig: '', witness2Name: '', witness2Sig: '' });
  const [referralForm, setReferralForm] = useState<ReferralForm>({ clientName: '', clientId: undefined, needType: '', consentGiven: false });
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);

  // Debounced client search
  useEffect(() => {
    if (isTestMode || clientSearchQuery.trim().length < 2) {
      setClientSearchResults([]);
      setClientSearchOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setClientSearchLoading(true);
      try {
        const res = await apiService.post('/api/clients/search', { name: clientSearchQuery.trim() });
        if (res?.multiple) setClientSearchResults(res.results);
        else if (res?.id) setClientSearchResults([res]);
        else setClientSearchResults([]);
        setClientSearchOpen(true);
      } catch {
        setClientSearchResults([]);
        setClientSearchOpen(true); // show "not found" state
      } finally {
        setClientSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [clientSearchQuery, isTestMode]);
  const [resourceForm, setResourceForm] = useState<ResourceForm>({ itemName: '', quantity: 1 });
  const [dhspDemographics, setDhspDemographics] = useState<DhspDemographics>({
    genderIdentity: '', raceEthnicity: '', ageRange: '', hivTestHistory: '',
    zipCode: '', hivKitCount: 0, syphilisKitCount: 0, narcanCount: 0,
    referredForTesting: false, referralLocation: '',
  });
  const [screeningForm, setScreeningForm] = useState<ScreeningForm>({
    screeningType: 'bp', systolic: '', diastolic: '', o2: '', temp: '', glucose: '', bmi: '', followUp: false,
    clientName: '', clientId: undefined, isWalkIn: false, notes: '',
  });
  const [screeningPhoto, setScreeningPhoto] = useState<string | null>(null);
  const [screeningPhotoName, setScreeningPhotoName] = useState<string>('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [screeningClientQuery, setScreeningClientQuery] = useState('');
  const [screeningClientResults, setScreeningClientResults] = useState<any[]>([]);
  const [screeningClientLoading, setScreeningClientLoading] = useState(false);
  const [screeningClientOpen, setScreeningClientOpen] = useState(false);

  useEffect(() => {
    if (isTestMode || screeningClientQuery.trim().length < 2) {
      setScreeningClientResults([]);
      setScreeningClientOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setScreeningClientLoading(true);
      try {
        const res = await apiService.post('/api/clients/search', { name: screeningClientQuery.trim() });
        if (res?.multiple) setScreeningClientResults(res.results);
        else if (res?.id) setScreeningClientResults([res]);
        else setScreeningClientResults([]);
        setScreeningClientOpen(true);
      } catch {
        setScreeningClientResults([]);
        setScreeningClientOpen(true);
      } finally {
        setScreeningClientLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [screeningClientQuery, isTestMode]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const checkedInAt = state.checkinStatus?.checkedInAt;
    if (!checkedInAt) return;
    setElapsed(getElapsedMinutes(checkedInAt));
    const id = setInterval(() => setElapsed(getElapsedMinutes(checkedInAt)), 60000);
    return () => clearInterval(id);
  }, [state.checkinStatus?.checkedInAt]);

  const templateId = EVENT_TYPE_TEMPLATE_MAP[opportunity.category] ?? null;
  const template = templateId
    ? CHECKLIST_TEMPLATES.find((t) => t.id === templateId) ?? null
    : null;
  const allItems = template
    ? Object.values(template.stages).flatMap((stage) => stage.items)
    : [];
  const completedItems = state.opsRun?.completedItems ?? [];
  const completedCount = allItems.filter((i) => completedItems.includes(i.id)).length;

  const canWrapUp =
    isWithin45Minutes(shift.endTime) || completedCount > 0 || serviceLogsCount > 0;

  // ── Service log handlers ──

  const handleLogScreening = async () => {
    // Compute traffic result and flags to send to API
    const sf = screeningForm;
    let trafficResult: TrafficResult | null = null;
    const payload: Record<string, any> = {
      eventId: opportunity.id,
      shiftId: shift.id,
      loggedBy: user.id,
      type: sf.screeningType,
      followUpNeeded: sf.followUp,
      flags: {} as Record<string, any>,
      ...(sf.isWalkIn ? { isWalkIn: true } : {}),
      ...(sf.clientId ? { clientId: sf.clientId, clientName: sf.clientName } : sf.clientName ? { clientName: sf.clientName } : {}),
      ...(sf.notes.trim() ? { notes: sf.notes.trim() } : {}),
      ...(screeningPhoto ? { photo: { data: screeningPhoto, fileName: screeningPhotoName, contentType: 'image/jpeg' } } : {}),
    };

    if (sf.screeningType === 'bp') {
      const sys = parseInt(sf.systolic), dia = parseInt(sf.diastolic);
      if (!isNaN(sys) && !isNaN(dia)) {
        payload.systolic = sys;
        payload.diastolic = dia;
        trafficResult = getBpTraffic(sys, dia);
        if (trafficResult.flagKey) payload.flags.bloodPressure = { level: trafficResult.level, label: trafficResult.label };
        if (trafficResult.color === 'red') payload.followUpNeeded = true;
      }
    } else if (sf.screeningType === 'o2') {
      const val = parseFloat(sf.o2);
      if (!isNaN(val)) { payload.oxygenSaturation = val; trafficResult = getO2Traffic(val); }
    } else if (sf.screeningType === 'temp') {
      const val = parseFloat(sf.temp);
      if (!isNaN(val)) { payload.temperature = val; trafficResult = getTempTraffic(val); }
    } else if (sf.screeningType === 'glucose') {
      const val = parseInt(sf.glucose);
      if (!isNaN(val)) {
        payload.glucose = val;
        trafficResult = getGlucoseTraffic(val);
        if (trafficResult.flagKey) payload.flags.glucose = { level: trafficResult.level, label: trafficResult.label };
        if (trafficResult.color === 'red') payload.followUpNeeded = true;
      }
    } else if (sf.screeningType === 'bmi') {
      const val = parseFloat(sf.bmi);
      if (!isNaN(val)) { payload.bmi = val; trafficResult = getBmiTraffic(val); }
    }

    setLogLoading(true);
    try {
      let screeningId: string | undefined;
      if (!isTestMode) {
        const result = await apiService.post('/api/screenings/create', payload);
        screeningId = result?.id;
      }
      if (isTestMode) logSimActivity('screening');
      const resultLabel = trafficResult ? ` — ${trafficResult.label}` : '';
      toastService.success(isTestMode ? `[PRACTICE] Screening logged${resultLabel}` : `Screening logged${resultLabel}`);
      const isCritical = trafficResult?.level === 'critical';
      if (isCritical && !isTestMode) {
        setEscalationScreeningId(screeningId ?? null);
        setEscalationClientName(sf.clientName || 'Client');
        setActiveLog(null);
      }
      logAudit({
        actionType: 'LOG_SCREENING',
        targetSystem: 'HealthScreenings',
        targetId: opportunity.id,
        summary: `Volunteer ${user.id} logged a ${sf.screeningType} screening for event ${opportunity.id}`,
      });
      onServiceLogged();
      setScreeningForm({ screeningType: 'bp', systolic: '', diastolic: '', o2: '', temp: '', glucose: '', bmi: '', followUp: false, clientName: '', clientId: undefined, isWalkIn: false, notes: '' });
      setScreeningPhoto(null);
      setScreeningPhotoName('');
      setScreeningClientQuery('');
      setScreeningClientResults([]);
      setScreeningClientOpen(false);
      if (!isCritical) setActiveLog(null);
    } catch {
      // error shown by apiService
    } finally {
      setLogLoading(false);
    }
  };

  const handleRefusalSubmit = async () => {
    if (!escalationScreeningId) return;
    if (!refusalForm.witness1Name.trim() || !refusalForm.witness2Name.trim()) {
      toastService.error('Both witness names are required.');
      return;
    }
    setRefusalSubmitting(true);
    try {
      await apiService.patch(`/api/screenings/${escalationScreeningId}/refusal`, {
        refusalOfCare: true,
        refusalData: {
          reason: refusalForm.reason,
          witness1Name: refusalForm.witness1Name,
          witness1Signature: refusalForm.witness1Sig,
          witness2Name: refusalForm.witness2Name,
          witness2Signature: refusalForm.witness2Sig,
          timestamp: new Date().toISOString(),
        },
      });
      toastService.success('Refusal of care documented.');
      setShowRefusalForm(false);
      setEscalationScreeningId(null);
      setRefusalForm({ reason: '', witness1Name: '', witness1Sig: '', witness2Name: '', witness2Sig: '' });
    } catch {
      // error shown by apiService
    } finally {
      setRefusalSubmitting(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toastService.error('Photo too large. Maximum 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setScreeningPhoto(base64);
      setScreeningPhotoName(file.name);
    };
    reader.readAsDataURL(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const isRegulatedItem = REGULATED_ITEMS.includes(resourceForm.itemName as RegulatedItem);

  const handleLogResource = async () => {
    if (!resourceForm.itemName.trim()) {
      toastService.error('Please enter an item name');
      return;
    }
    // Validate demographics if regulated item
    if (isRegulatedItem) {
      const d = dhspDemographics;
      if (!d.genderIdentity || !d.raceEthnicity || !d.ageRange || !d.hivTestHistory || !d.zipCode) {
        toastService.error('County-mandated demographics are required for this item');
        return;
      }
    }
    setLogLoading(true);
    try {
      if (!isTestMode) {
        const payload: Record<string, any> = {
          item: resourceForm.itemName,
          quantity: resourceForm.quantity,
          shiftId: shift.id,
          loggedBy: user.id,
        };
        if (isRegulatedItem) payload.dhspDemographics = dhspDemographics;
        await apiService.post(`/api/ops/tracker/${opportunity.id}/distribution`, payload);
        // Submit to DHSP REDCap if regulated
        if (isRegulatedItem) {
          await apiService.post('/api/dhsp/redcap-submit', {
            ...dhspDemographics,
            itemName: resourceForm.itemName,
            eventId: opportunity.id,
            loggedBy: user.id,
          }).catch(() => {
            toastService.error('REDCap submission failed — please log manually at dhspredcap.ph.lacounty.gov');
          });
        }
      }
      if (isTestMode) logSimActivity('distribution');
      toastService.success(isTestMode ? '[PRACTICE] Distribution logged' : 'Distribution logged');
      if (isRegulatedItem && !isTestMode) {
        toastService.success('DHSP demographics submitted to REDCap');
      }
      logAudit({
        actionType: 'LOG_DISTRIBUTION',
        targetSystem: 'OpsTracker',
        targetId: opportunity.id,
        summary: `Volunteer ${user.id} logged ${resourceForm.quantity}x ${resourceForm.itemName}${isRegulatedItem ? ' (regulated — DHSP logged)' : ''}`,
      });
      onServiceLogged();
      setResourceForm({ itemName: '', quantity: 1 });
      setDhspDemographics({ genderIdentity: '', raceEthnicity: '', ageRange: '', hivTestHistory: '', zipCode: '', hivKitCount: 0, syphilisKitCount: 0, narcanCount: 0, referredForTesting: false, referralLocation: '' });
      setActiveLog(null);
    } catch {
      // error shown by apiService
    } finally {
      setLogLoading(false);
    }
  };

  const handleLogReferral = async () => {
    if (!referralForm.clientName.trim() || !referralForm.needType) {
      toastService.error('Please fill out all fields');
      return;
    }
    if (!referralForm.consentGiven) {
      toastService.error('Verbal consent must be confirmed before logging a referral');
      return;
    }
    setLogLoading(true);
    try {
      if (!isTestMode) {
        await apiService.post('/api/referrals/create', {
          clientName: referralForm.clientName,
          ...(referralForm.clientId ? { clientId: referralForm.clientId } : {}),
          needType: referralForm.needType,
          consentGiven: true,
          eventId: opportunity.id,
          shiftId: shift.id,
          loggedBy: user.id,
        });
      }
      if (isTestMode) logSimActivity('referral');
      toastService.success(isTestMode ? '[PRACTICE] Referral logged' : 'Referral logged');
      logAudit({
        actionType: 'LOG_REFERRAL',
        targetSystem: 'Referrals',
        targetId: opportunity.id,
        summary: `Volunteer ${user.id} logged referral: ${referralForm.needType} for ${referralForm.clientName}`,
      });
      onServiceLogged();
      setReferralForm({ clientName: '', clientId: undefined, needType: '', consentGiven: false });
      setClientSearchQuery('');
      setClientSearchResults([]);
      setClientSearchOpen(false);
      setActiveLog(null);
    } catch {
      // error shown by apiService
    } finally {
      setLogLoading(false);
    }
  };

  const handleStartSurvey = () => {
    logAudit({
      actionType: 'START_SURVEY_KIOSK',
      targetSystem: 'SurveyKit',
      targetId: opportunity.id,
      summary: `Volunteer ${user.id} initiated survey kiosk for event ${opportunity.id}`,
    });
    setShowSurveyKiosk(true);
    setActiveLog(null);
  };

  // ── Service log forms ──

  const renderInlineForm = () => {
    if (!activeLog) return null;

    const formBase =
      'mt-4 pt-4 border-t border-zinc-100 animate-in fade-in slide-in-from-bottom-2 duration-200';

    if (activeLog === 'screening') {
      const sf = screeningForm;
      // Compute live traffic light
      let liveTraffic: TrafficResult | null = null;
      if (sf.screeningType === 'bp') {
        const sys = parseInt(sf.systolic), dia = parseInt(sf.diastolic);
        if (!isNaN(sys) && !isNaN(dia) && sys > 0 && dia > 0) liveTraffic = getBpTraffic(sys, dia);
      } else if (sf.screeningType === 'o2') {
        const v = parseFloat(sf.o2); if (!isNaN(v)) liveTraffic = getO2Traffic(v);
      } else if (sf.screeningType === 'temp') {
        const v = parseFloat(sf.temp); if (!isNaN(v)) liveTraffic = getTempTraffic(v);
      } else if (sf.screeningType === 'glucose') {
        const v = parseInt(sf.glucose); if (!isNaN(v)) liveTraffic = getGlucoseTraffic(v);
      } else if (sf.screeningType === 'bmi') {
        const v = parseFloat(sf.bmi); if (!isNaN(v)) liveTraffic = getBmiTraffic(v);
      }
      const tc = liveTraffic ? TRAFFIC_COLORS[liveTraffic.color] : null;

      const TYPE_LABELS: Record<ScreeningType, string> = { bp: 'BP', o2: 'O₂', temp: 'Temp', glucose: 'Glucose', bmi: 'BMI' };

      // Pre-fill from simulation mock reading if in test mode and BP
      const showMockHint = isTestMode && sf.screeningType === 'bp' && !sf.systolic && !sf.diastolic;

      const hasSelectedScreeningClient = !!screeningForm.clientId || screeningForm.isWalkIn;

      return (
        <div className={formBase}>
          {/* Client lookup */}
          <div className="relative mb-4">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1.5">Client</p>
            {screeningForm.isWalkIn ? (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <UserCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm font-black text-amber-800 flex-1">Walk-in / No Contact Info</span>
                <button
                  onClick={() => setScreeningForm((f) => ({ ...f, isWalkIn: false, clientName: '', clientId: undefined }))}
                  className="text-zinc-400 hover:text-zinc-600"
                ><X size={14} /></button>
              </div>
            ) : hasSelectedScreeningClient ? (
              <div className="flex items-center gap-2 bg-[#233DFF]/5 border border-[#233DFF]/20 rounded-xl px-4 py-2.5">
                <UserCheck className="w-4 h-4 text-[#233DFF] flex-shrink-0" />
                <span className="text-sm font-black text-zinc-800 flex-1">{screeningForm.clientName}</span>
                <button
                  onClick={() => {
                    setScreeningForm((f) => ({ ...f, clientName: '', clientId: undefined, isWalkIn: false }));
                    setScreeningClientQuery('');
                    setScreeningClientResults([]);
                    setScreeningClientOpen(false);
                  }}
                  className="text-zinc-400 hover:text-zinc-600"
                ><X size={14} /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={isTestMode ? 'Practice: type "James"' : 'Search by name...'}
                    value={screeningClientQuery}
                    onChange={(e) => {
                      setScreeningClientQuery(e.target.value);
                      setScreeningForm((f) => ({ ...f, clientName: e.target.value, clientId: undefined }));
                    }}
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] pr-9"
                  />
                  {screeningClientLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 animate-spin" />
                  )}
                </div>
                {screeningClientOpen && (
                  <div className="mt-1 border border-zinc-200 rounded-xl overflow-hidden shadow-md bg-white z-10 relative">
                    {screeningClientResults.length > 0 ? (
                      <>
                        {screeningClientResults.map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
                              setScreeningForm((f) => ({ ...f, clientName: name, clientId: c.id }));
                              setScreeningClientQuery(name);
                              setScreeningClientOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
                          >
                            <p className="text-sm font-black text-zinc-800">{c.firstName} {c.lastName}</p>
                            {(c.dob || c.phone) && (
                              <p className="text-xs text-zinc-400 mt-0.5">{c.dob ? `DOB: ${c.dob}` : ''}{c.dob && c.phone ? ' · ' : ''}{c.phone ? c.phone : ''}</p>
                            )}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setScreeningForm((f) => ({ ...f, clientName: screeningClientQuery, clientId: undefined }));
                            setScreeningClientOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs text-zinc-400 hover:bg-zinc-50"
                        >Not listed — use name as entered</button>
                      </>
                    ) : (
                      <div className="px-4 py-3">
                        <p className="text-xs text-zinc-500 font-medium">No client found — they may not be registered yet.</p>
                        <button
                          onClick={() => {
                            setScreeningForm((f) => ({ ...f, clientName: screeningClientQuery, clientId: undefined }));
                            setScreeningClientOpen(false);
                          }}
                          className="mt-1 text-xs font-black text-[#233DFF] underline underline-offset-2"
                        >Continue with name only</button>
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setScreeningForm((f) => ({ ...f, isWalkIn: true, clientName: '', clientId: undefined }))}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-xl py-2 hover:bg-amber-100 transition-colors"
                >
                  Walk-in / No Contact Info
                </button>
              </>
            )}
          </div>

          {/* Type selector */}
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-2">Screening type</p>
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {(['bp', 'o2', 'temp', 'glucose', 'bmi'] as ScreeningType[]).map((t) => (
              <button
                key={t}
                onClick={() => setScreeningForm((f) => ({ ...f, screeningType: t }))}
                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                  sf.screeningType === t
                    ? 'bg-[#233DFF] text-white shadow-sm'
                    : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Mock hint for simulation */}
          {showMockHint && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3 flex items-start gap-2">
              <AlertCircle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 font-medium">Practice: enter Raymond's reading — <strong>158 / 96</strong></p>
            </div>
          )}

          {/* Inputs */}
          {sf.screeningType === 'bp' && (
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Systolic</p>
                <input
                  type="number" inputMode="numeric" placeholder="e.g. 120"
                  value={sf.systolic}
                  onChange={(e) => setScreeningForm((f) => ({ ...f, systolic: e.target.value }))}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-lg font-black text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] text-center"
                />
              </div>
              <div className="flex items-end pb-2.5 text-zinc-300 font-black text-xl">/</div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Diastolic</p>
                <input
                  type="number" inputMode="numeric" placeholder="e.g. 80"
                  value={sf.diastolic}
                  onChange={(e) => setScreeningForm((f) => ({ ...f, diastolic: e.target.value }))}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-lg font-black text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] text-center"
                />
              </div>
            </div>
          )}
          {sf.screeningType === 'o2' && (
            <div className="mb-3">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">O₂ Saturation (%)</p>
              <input type="number" inputMode="decimal" placeholder="e.g. 97" value={sf.o2}
                onChange={(e) => setScreeningForm((f) => ({ ...f, o2: e.target.value }))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-lg font-black text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] text-center"
              />
            </div>
          )}
          {sf.screeningType === 'temp' && (
            <div className="mb-3">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Temperature (°F)</p>
              <input type="number" inputMode="decimal" placeholder="e.g. 98.6" value={sf.temp}
                onChange={(e) => setScreeningForm((f) => ({ ...f, temp: e.target.value }))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-lg font-black text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] text-center"
              />
            </div>
          )}
          {sf.screeningType === 'glucose' && (
            <div className="mb-3">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Glucose (mg/dL)</p>
              <input type="number" inputMode="numeric" placeholder="e.g. 95" value={sf.glucose}
                onChange={(e) => setScreeningForm((f) => ({ ...f, glucose: e.target.value }))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-lg font-black text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] text-center"
              />
            </div>
          )}
          {sf.screeningType === 'bmi' && (
            <div className="mb-3">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">BMI</p>
              <input type="number" inputMode="decimal" placeholder="e.g. 22.5" value={sf.bmi}
                onChange={(e) => setScreeningForm((f) => ({ ...f, bmi: e.target.value }))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-lg font-black text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] text-center"
              />
            </div>
          )}

          {/* Live traffic light result */}
          {liveTraffic && tc && (
            <div className={`${tc.bg} ${tc.border} border rounded-xl px-3 py-2.5 mb-3`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-3 h-3 rounded-full ${tc.dot} flex-shrink-0`} />
                <div>
                  <p className={`text-xs font-black ${tc.text}`}>{liveTraffic.label}</p>
                  {liveTraffic.color === 'red' && (
                    <p className={`text-[10px] ${tc.text} mt-0.5`}>Follow-up flag will be set automatically</p>
                  )}
                </div>
              </div>
              {liveTraffic.level === 'critical' && (
                <div className="mt-2 bg-white/70 rounded-lg px-2.5 py-2">
                  <p className="text-xs font-black text-red-700 mb-1">⚠️ CRITICAL — Action required:</p>
                  <p className="text-xs text-red-700 leading-relaxed">Stay with this person. Do NOT leave them alone. Logging will notify your Events Lead and clinical team immediately.</p>
                </div>
              )}
            </div>
          )}

          {/* BP reference guide */}
          {sf.screeningType === 'bp' && (
            <div className="mb-3 border border-zinc-100 rounded-xl overflow-hidden">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider px-3 py-2 bg-zinc-50">BP Traffic Light Reference</p>
              {BP_REFERENCE.map((r) => (
                <div key={r.label} className="flex items-center gap-2 px-3 py-1.5 border-t border-zinc-100">
                  <div className={`w-2.5 h-2.5 rounded-full ${TRAFFIC_COLORS[r.color].dot} flex-shrink-0`} />
                  <span className="text-xs font-black text-zinc-600 w-24 flex-shrink-0">{r.label}</span>
                  <span className="text-xs text-zinc-400 font-mono">{r.range}</span>
                </div>
              ))}
            </div>
          )}

          {/* Follow-up override */}
          <button
            onClick={() => setScreeningForm((f) => ({ ...f, followUp: !f.followUp }))}
            className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3 border transition-all ${
              sf.followUp ? 'bg-red-50 border-red-200' : 'bg-zinc-50 border-zinc-200'
            }`}
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              sf.followUp ? 'bg-red-500 border-red-500' : 'border-zinc-300'
            }`}>
              {sf.followUp && <CheckCircle className="w-3 h-3 text-white" />}
            </div>
            <span className={`text-xs font-black ${sf.followUp ? 'text-red-700' : 'text-zinc-500'}`}>
              Flag for follow-up
            </span>
          </button>

          {/* Notes */}
          <textarea
            rows={2}
            placeholder="Additional notes (optional)"
            value={screeningForm.notes}
            onChange={(e) => setScreeningForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] resize-none mb-1"
          />

          {/* Photo capture */}
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
          {screeningPhoto ? (
            <div className="flex items-center gap-2 mb-3 bg-zinc-50 rounded-xl px-3 py-2">
              <Image className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <span className="text-xs text-zinc-500 truncate flex-1">{screeningPhotoName}</span>
              <button type="button" onClick={() => { setScreeningPhoto(null); setScreeningPhotoName(''); }} className="p-1 hover:bg-red-50 rounded-full transition-colors">
                <X className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-zinc-200 rounded-xl py-2 text-xs font-black text-zinc-400 mb-3 hover:border-[#233DFF]/30 hover:text-[#233DFF] transition-all"
            >
              <Camera className="w-4 h-4" /> Attach Photo / Form
            </button>
          )}

          {!screeningForm.clientName.trim() && !screeningForm.clientId && (
            <p className="text-xs font-black text-rose-500 text-center -mb-1">Client name required</p>
          )}
          <button
            onClick={handleLogScreening}
            disabled={logLoading || (!screeningForm.clientName.trim() && !screeningForm.clientId)}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white rounded-full font-black uppercase tracking-wider min-h-[44px] text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {logLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Log Screening
          </button>
        </div>
      );
    }

    if (activeLog === 'resources') {
      const dd = dhspDemographics;
      const setDd = (patch: Partial<DhspDemographics>) => setDhspDemographics((f) => ({ ...f, ...patch }));
      const selectClass = "w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] bg-white";
      return (
        <div className={formBase}>
          <div className="flex flex-col gap-3 mb-3">
            {/* Quick-select regulated items */}
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-2">Regulated Items (county-mandated)</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {REGULATED_ITEMS.map((item) => (
                  <button
                    key={item}
                    onClick={() => setResourceForm((f) => ({ ...f, itemName: f.itemName === item ? '' : item }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-black border-2 transition-all ${
                      resourceForm.itemName === item
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-white border-orange-200 text-orange-600'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              placeholder="Or type any item (e.g. Hygiene Kit)"
              value={resourceForm.itemName}
              onChange={(e) => setResourceForm((f) => ({ ...f, itemName: e.target.value }))}
              className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
            />
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">Qty</span>
              <div className="flex items-center gap-2 bg-zinc-50 rounded-full px-1 py-1">
                <button
                  onClick={() => setResourceForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                  className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-black text-zinc-600 text-lg min-h-0 active:scale-90 transition-all"
                >
                  −
                </button>
                <span className="w-8 text-center font-black text-zinc-900 text-base">
                  {resourceForm.quantity}
                </span>
                <button
                  onClick={() => setResourceForm((f) => ({ ...f, quantity: f.quantity + 1 }))}
                  className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-black text-zinc-600 text-lg min-h-0 active:scale-90 transition-all"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* County-mandated demographics — only for regulated items */}
          {isRegulatedItem && (
            <div className="border border-orange-200 rounded-2xl p-3 mb-3 bg-orange-50">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={13} className="text-orange-600 flex-shrink-0" />
                <p className="text-[10px] font-black text-orange-700 uppercase tracking-wider flex-1">County-Required Demographics (DHSP)</p>
                <span className="text-[10px] text-orange-500 font-black">Mandatory</span>
              </div>
              <p className="text-[10px] text-orange-600 leading-relaxed mb-3">Los Angeles County requires anonymous demographics for HIV/Syphilis test kits and Narcan distribution. Responses go to DHSP REDCap — no names collected.</p>

              <div className="flex flex-col gap-2.5">
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Gender Identity</p>
                  <select value={dd.genderIdentity} onChange={(e) => setDd({ genderIdentity: e.target.value })} className={selectClass}>
                    <option value="">Select…</option>
                    {DHSP_GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Race / Ethnicity</p>
                  <select value={dd.raceEthnicity} onChange={(e) => setDd({ raceEthnicity: e.target.value })} className={selectClass}>
                    <option value="">Select…</option>
                    {DHSP_RACE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Age Range</p>
                  <select value={dd.ageRange} onChange={(e) => setDd({ ageRange: e.target.value })} className={selectClass}>
                    <option value="">Select…</option>
                    {DHSP_AGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Has client ever tested for HIV?</p>
                  <select value={dd.hivTestHistory} onChange={(e) => setDd({ hivTestHistory: e.target.value })} className={selectClass}>
                    <option value="">Select…</option>
                    {DHSP_HIV_TEST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Zip Code</p>
                  <input
                    type="text" inputMode="numeric" maxLength={5} placeholder="90012"
                    value={dd.zipCode} onChange={(e) => setDd({ zipCode: e.target.value })}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
                  />
                </div>

                {/* Kit counts — prefill from item selection */}
                {(resourceForm.itemName === 'HIV Test Kit' || resourceForm.itemName === 'Syphilis Test Kit') && (
                  <div className="grid grid-cols-2 gap-2">
                    {resourceForm.itemName === 'HIV Test Kit' && (
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">HIV Kits Given</p>
                        <select value={dd.hivKitCount} onChange={(e) => setDd({ hivKitCount: parseInt(e.target.value) as 0 | 1 | 2 })} className={selectClass}>
                          <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option>
                        </select>
                      </div>
                    )}
                    {resourceForm.itemName === 'Syphilis Test Kit' && (
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Syphilis Kits Given</p>
                        <select value={dd.syphilisKitCount} onChange={(e) => setDd({ syphilisKitCount: parseInt(e.target.value) as 0 | 1 | 2 })} className={selectClass}>
                          <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Referred for HIV/STD testing */}
                <button
                  onClick={() => setDd({ referredForTesting: !dd.referredForTesting })}
                  className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 border transition-all ${
                    dd.referredForTesting ? 'bg-blue-50 border-blue-200' : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    dd.referredForTesting ? 'bg-blue-500 border-blue-500' : 'border-zinc-300'
                  }`}>
                    {dd.referredForTesting && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-xs font-black ${dd.referredForTesting ? 'text-blue-700' : 'text-zinc-500'}`}>
                    Referred for HIV/STD Testing
                  </span>
                </button>
                {dd.referredForTesting && (
                  <input
                    type="text" placeholder="Referral location (clinic name or address)"
                    value={dd.referralLocation} onChange={(e) => setDd({ referralLocation: e.target.value })}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF]"
                  />
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleLogResource}
            disabled={logLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white rounded-full font-black uppercase tracking-wider min-h-[44px] text-sm transition-all active:scale-95"
          >
            {logLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Log Distribution
          </button>
        </div>
      );
    }

    if (activeLog === 'referral') {
      const hasSelectedClient = !!referralForm.clientId;
      return (
        <div className={formBase}>
          <div className="flex flex-col gap-3 mb-3">

            {/* Client lookup */}
            <div className="relative">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Client</p>
              {hasSelectedClient ? (
                <div className="flex items-center gap-2 bg-[#233DFF]/5 border border-[#233DFF]/20 rounded-xl px-4 py-2.5">
                  <UserCheck className="w-4 h-4 text-[#233DFF] flex-shrink-0" />
                  <span className="text-sm font-black text-zinc-800 flex-1">{referralForm.clientName}</span>
                  <button
                    onClick={() => {
                      setReferralForm((f) => ({ ...f, clientName: '', clientId: undefined }));
                      setClientSearchQuery('');
                      setClientSearchResults([]);
                      setClientSearchOpen(false);
                    }}
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={isTestMode ? 'Practice: type "James"' : 'Search by name...'}
                      value={clientSearchQuery}
                      onChange={(e) => {
                        setClientSearchQuery(e.target.value);
                        setReferralForm((f) => ({ ...f, clientName: e.target.value, clientId: undefined }));
                      }}
                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] pr-9"
                    />
                    {clientSearchLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 animate-spin" />
                    )}
                  </div>

                  {/* Search results dropdown */}
                  {clientSearchOpen && (
                    <div className="mt-1 border border-zinc-200 rounded-xl overflow-hidden shadow-md bg-white">
                      {clientSearchResults.length > 0 ? (
                        <>
                          {clientSearchResults.map((c: any) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
                                setReferralForm((f) => ({ ...f, clientName: name, clientId: c.id }));
                                setClientSearchQuery(name);
                                setClientSearchOpen(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
                            >
                              <p className="text-sm font-black text-zinc-800">{c.firstName} {c.lastName}</p>
                              {(c.dob || c.phone) && (
                                <p className="text-xs text-zinc-400 mt-0.5">{c.dob ? `DOB: ${c.dob}` : ''}{c.dob && c.phone ? ' · ' : ''}{c.phone ? `${c.phone.slice(-4).padStart(c.phone.length, '·')}` : ''}</p>
                              )}
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              setReferralForm((f) => ({ ...f, clientName: clientSearchQuery, clientId: undefined }));
                              setClientSearchOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs text-zinc-400 hover:bg-zinc-50"
                          >
                            Not listed — use name as entered
                          </button>
                        </>
                      ) : (
                        <div className="px-4 py-3">
                          <p className="text-xs text-zinc-500 font-medium">No client found — they may not be registered yet.</p>
                          <button
                            onClick={() => {
                              setReferralForm((f) => ({ ...f, clientName: clientSearchQuery, clientId: undefined }));
                              setClientSearchOpen(false);
                            }}
                            className="mt-1 text-xs font-black text-[#233DFF] underline underline-offset-2"
                          >
                            Continue with name only
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Need type</p>
              <select
                value={referralForm.needType}
                onChange={(e) => setReferralForm((f) => ({ ...f, needType: e.target.value }))}
                className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20 focus:border-[#233DFF] bg-white"
              >
                <option value="">Select need type...</option>
                <option value="Housing">Housing</option>
                <option value="Mental Health Services">Mental Health Services</option>
                <option value="Substance Use Treatment">Substance Use Treatment</option>
                <option value="Medical / Primary Care">Medical / Primary Care</option>
                <option value="Food / Nutrition">Food / Nutrition</option>
                <option value="Benefits / SSI">Benefits / SSI</option>
                <option value="Legal">Legal</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Consent confirmation */}
            <button
              onClick={() => setReferralForm((f) => ({ ...f, consentGiven: !f.consentGiven }))}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border transition-all ${
                referralForm.consentGiven ? 'bg-emerald-50 border-emerald-200' : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                referralForm.consentGiven ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-300'
              }`}>
                {referralForm.consentGiven && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              <span className={`text-xs font-black ${referralForm.consentGiven ? 'text-emerald-700' : 'text-zinc-500'}`}>
                Verbal consent obtained from client
              </span>
            </button>
          </div>

          <button
            onClick={handleLogReferral}
            disabled={logLoading || !referralForm.consentGiven}
            className="w-full flex items-center justify-center gap-2 bg-purple-500 text-white rounded-full font-black uppercase tracking-wider min-h-[44px] text-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {logLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Log Referral
          </button>
        </div>
      );
    }

    if (activeLog === 'survey') {
      return (
        <div className={formBase}>
          <p className="text-xs text-zinc-500 font-medium mb-3">
            Open the survey kiosk for a community participant
          </p>
          <button
            onClick={handleStartSurvey}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white rounded-full font-black uppercase tracking-wider min-h-[44px] text-sm transition-all active:scale-95"
          >
            <Star className="w-4 h-4" />
            Start Survey
          </button>
        </div>
      );
    }

    return null;
  };

  const ServiceButton = ({
    type,
    icon,
    title,
    subtitle,
    color,
  }: {
    type: ServiceLogType;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    color: string;
  }) => {
    const isActive = activeLog === type;
    return (
      <button
        onClick={() => setActiveLog(isActive ? null : type)}
        className={[
          'flex flex-col gap-1 rounded-2xl p-5 min-h-[88px] text-left transition-all duration-200',
          'border active:scale-95',
          isActive
            ? 'bg-[#233DFF]/5 border-[#233DFF]/20 shadow-sm'
            : 'bg-white border-zinc-100 shadow-sm',
        ].join(' ')}
      >
        <div className={`text-${color} mb-1`}>{icon}</div>
        <p className="font-black text-zinc-900 text-sm leading-tight">{title}</p>
        <p className="text-zinc-400 font-medium text-xs">{subtitle}</p>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Live status bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5 min-h-[32px]">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-emerald-700 font-black text-xs uppercase tracking-wider">Active</span>
          <span className="text-emerald-600 font-medium text-xs">· {formatElapsed(elapsed)}</span>
        </div>
        {isTestMode && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 min-h-[32px]">
            <Zap className="w-3 h-3 text-amber-500" />
            <span className="text-amber-700 font-black text-xs uppercase tracking-wider">Practice</span>
          </div>
        )}
      </div>

      {/* Quick-log service buttons */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">
          Log a Service
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ServiceButton
            type="screening"
            icon={<Shield className="w-5 h-5" />}
            title="Screening"
            subtitle="Health checks"
            color="emerald-500"
          />
          <ServiceButton
            type="resources"
            icon={<Navigation className="w-5 h-5" />}
            title="Resources"
            subtitle="Supplies given"
            color="blue-500"
          />
          <ServiceButton
            type="referral"
            icon={<ArrowRight className="w-5 h-5" />}
            title="Referral"
            subtitle="Complex needs"
            color="purple-500"
          />
          <ServiceButton
            type="survey"
            icon={<Star className="w-5 h-5" />}
            title="Survey"
            subtitle="Community data"
            color="amber-500"
          />
        </div>
        {renderInlineForm()}
      </div>

      {/* Critical reading escalation card */}
      {escalationScreeningId && !showRefusalForm && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-red-800 text-sm">⚠️ Critical Reading — {escalationClientName}</p>
              <p className="text-red-700 text-xs mt-1 font-medium">Stay with this person. Do NOT leave them alone.</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-red-200">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-black text-zinc-700">Medical team &amp; Events Lead notified</span>
            </div>
            <a
              href={`https://maps.apple.com/?q=urgent+care&sll=&near=Current+Location`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-red-200 w-full text-left"
              onClick={e => {
                e.preventDefault();
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(pos => {
                    const { latitude, longitude } = pos.coords;
                    window.open(`https://maps.apple.com/?q=urgent+care&sll=${latitude},${longitude}&z=14`, '_blank');
                  }, () => {
                    window.open('https://maps.apple.com/?q=urgent+care+near+me', '_blank');
                  });
                } else {
                  window.open('https://maps.apple.com/?q=urgent+care+near+me', '_blank');
                }
              }}
            >
              <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-xs font-black text-blue-700">Find Nearest Open Urgent Care</span>
              <ArrowRight className="w-3 h-3 text-blue-400 ml-auto" />
            </a>
            <button
              onClick={() => setShowRefusalForm(true)}
              className="w-full flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-red-200"
            >
              <X className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs font-black text-red-700">Client Refused Follow-up Care</span>
              <ArrowRight className="w-3 h-3 text-red-400 ml-auto" />
            </button>
          </div>
          <button
            onClick={() => setEscalationScreeningId(null)}
            className="mt-3 text-xs text-red-400 font-black uppercase tracking-wider underline underline-offset-2 w-full text-center"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Refusal of care form */}
      {showRefusalForm && (
        <div className="bg-white border-2 border-red-300 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 mb-4">
            <X className="w-5 h-5 text-red-600" />
            <p className="font-black text-red-800 text-sm">Refusal of Care — {escalationClientName}</p>
          </div>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            Document that <strong>{escalationClientName}</strong> voluntarily refused follow-up care. Two witnesses required. This will be added to their screening record.
          </p>
          <div className="space-y-3">
            <textarea
              rows={2}
              placeholder="Reason for refusal (optional)"
              value={refusalForm.reason}
              onChange={e => setRefusalForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 resize-none"
            />
            <div className="border border-zinc-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Witness 1</p>
              <input
                type="text"
                placeholder="Full name *"
                value={refusalForm.witness1Name}
                onChange={e => setRefusalForm(f => ({ ...f, witness1Name: e.target.value }))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
              />
              <input
                type="text"
                placeholder="Type your name to sign"
                value={refusalForm.witness1Sig}
                onChange={e => setRefusalForm(f => ({ ...f, witness1Sig: e.target.value }))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm italic focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
              />
            </div>
            <div className="border border-zinc-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Witness 2</p>
              <input
                type="text"
                placeholder="Full name *"
                value={refusalForm.witness2Name}
                onChange={e => setRefusalForm(f => ({ ...f, witness2Name: e.target.value }))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
              />
              <input
                type="text"
                placeholder="Type your name to sign"
                value={refusalForm.witness2Sig}
                onChange={e => setRefusalForm(f => ({ ...f, witness2Sig: e.target.value }))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm italic focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
              />
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed px-1">
              By submitting, both witnesses confirm they observed {escalationClientName} verbally decline follow-up care of their own free will, and that HMC and its volunteers are released from liability related to this decision.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRefusalForm(false)}
                className="flex-1 py-2.5 border border-zinc-200 rounded-full text-xs font-black text-zinc-600 uppercase tracking-wider"
              >
                Back
              </button>
              <button
                onClick={handleRefusalSubmit}
                disabled={refusalSubmitting || !refusalForm.witness1Name.trim() || !refusalForm.witness2Name.trim()}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-full text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {refusalSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Confirm Refusal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Survey kiosk notice */}
      {showSurveyKiosk && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start gap-3">
            <Star className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-900 text-sm">Survey Kiosk Active</p>
              <p className="text-amber-700 font-medium text-xs mt-1">
                Walk through the survey <strong>with</strong> the participant — keep the device in your hands at all times. Read each question aloud and enter their answers. Remind them: voluntary, anonymous, ~10 minutes.
              </p>
              <button
                onClick={() => setShowSurveyKiosk(false)}
                className="mt-2 text-amber-600 font-black text-xs uppercase tracking-wider underline underline-offset-2"
              >
                Done — Close Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Tasks accordion */}
      {allItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setTasksOpen((v) => !v)}
            className="w-full flex items-center justify-between p-5 min-h-[44px] text-left"
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#233DFF]" />
              <span className="font-black text-zinc-800 text-sm">My Tasks</span>
              <span className="bg-zinc-100 text-zinc-500 font-black text-xs px-2 py-0.5 rounded-full">
                {completedCount}/{allItems.length}
              </span>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                tasksOpen ? 'rotate-90' : ''
              }`}
            />
          </button>
          {tasksOpen && (
            <div className="border-t border-zinc-100 px-5 pb-5 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1 mt-3">
                {allItems.map((item) => {
                  const done = completedItems.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => checkItem(item.id)}
                      className="flex items-start gap-3 py-2.5 text-left min-h-[44px] rounded-xl hover:bg-zinc-50 px-2 -mx-2 transition-colors"
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                          done
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-zinc-300'
                        }`}
                      >
                        {done && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <p
                        className={`text-sm font-medium leading-snug ${
                          done ? 'line-through text-zinc-400' : 'text-zinc-600'
                        }`}
                      >
                        {item.text}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Begin Wrap-Up button */}
      {canWrapUp && (
        <button
          onClick={onBeginWrapUp}
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white rounded-full font-black uppercase tracking-wider min-h-[56px] text-sm active:scale-95 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          Begin Wrap-Up
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature Canvas
// ─────────────────────────────────────────────────────────────────────────────

interface SignatureCanvasProps {
  onChange: (dataUrl: string | null) => void;
}

function SignatureCanvas({ onChange }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStrokes = useRef(false);

  const getPos = (
    e: MouseEvent | TouchEvent,
    canvas: HTMLCanvasElement
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      e.preventDefault();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawing.current = true;
      const { x, y } = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(x, y);
    },
    []
  );

  const draw = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      e.preventDefault();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1a1a1a';
      const { x, y } = getPos(e, canvas);
      ctx.lineTo(x, y);
      ctx.stroke();
      hasStrokes.current = true;
      onChange(canvas.toDataURL('image/png'));
    },
    [onChange]
  );

  const stopDraw = useCallback(() => {
    drawing.current = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);

    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDraw);
      canvas.removeEventListener('mouseleave', stopDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDraw);
    };
  }, [startDraw, draw, stopDraw]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={300}
          height={100}
          className="w-full rounded-xl border border-zinc-200 bg-white touch-none"
          style={{ height: 100, cursor: 'crosshair' }}
        />
        <p className="absolute inset-0 flex items-center justify-center text-zinc-200 font-medium text-sm pointer-events-none select-none">
          Sign here
        </p>
      </div>
      <button
        onClick={handleClear}
        className="text-zinc-400 font-black text-xs uppercase tracking-wider self-end underline underline-offset-2 min-h-[44px] px-2"
      >
        Clear
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Celebration Animation
// ─────────────────────────────────────────────────────────────────────────────

function Celebration() {
  return (
    <div className="relative flex items-center justify-center w-20 h-20 mx-auto mb-2">
      <div className="absolute w-20 h-20 rounded-full bg-amber-100 animate-ping opacity-75" />
      <div
        className="absolute w-16 h-16 rounded-full animate-[ping_1.2s_ease-out_0.15s_infinite] opacity-50"
        style={{ background: 'rgba(52,211,153,0.3)' }}
      />
      <div
        className="absolute w-12 h-12 rounded-full animate-[ping_1.4s_ease-out_0.3s_infinite] opacity-40"
        style={{ background: 'rgba(99,102,241,0.3)' }}
      />
      <div className="relative z-10 w-14 h-14 bg-amber-400 rounded-full flex items-center justify-center">
        <Trophy className="w-7 h-7 text-white" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — WRAP UP
// ─────────────────────────────────────────────────────────────────────────────

interface StepWrapUpProps {
  onBack: () => void;
  serviceLogsCount: number;
}

function StepWrapUp({ onBack, serviceLogsCount }: StepWrapUpProps) {
  const { state, opportunity, checkOut } = useOps();
  const [signature, setSignature] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const checkinStatus = state.checkinStatus;
  const checkoutResult = state.checkoutResult;

  const completedCount = state.opsRun?.completedItems?.length ?? 0;

  const hoursWorked = useMemo(() => {
    if (!checkinStatus?.checkedInAt) return 0;
    const diff = (Date.now() - new Date(checkinStatus.checkedInAt).getTime()) / 3600000;
    return Math.round(diff * 10) / 10;
  }, [checkinStatus?.checkedInAt]);

  const handleCheckOut = async () => {
    if (checkingOut) return;
    setCheckingOut(true);
    try {
      await checkOut();
    } catch {
      // toast shown in context
    } finally {
      setCheckingOut(false);
    }
  };

  if (checkoutResult) {
    return (
      <div className="flex flex-col items-center gap-5 text-center animate-in fade-in slide-in-from-bottom-4 duration-300 py-4">
        <Celebration />
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase text-zinc-900">
            Great work!
          </h2>
          <p className="text-zinc-500 font-medium text-base mt-1">
            {checkoutResult.hoursServed}h recorded · +{checkoutResult.pointsEarned} pts
          </p>
        </div>
        <p className="text-zinc-400 font-medium text-sm max-w-xs">
          Thank you for serving your community today.
        </p>
        <button
          onClick={onBack}
          className="w-full flex items-center justify-center gap-2 bg-[#233DFF] text-white rounded-full font-black uppercase tracking-wider min-h-[56px] text-sm active:scale-95 transition-all duration-200 shadow-lg shadow-[#233DFF]/25"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Missions
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-[#233DFF]/5 to-blue-50 px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#233DFF] mb-1">
            Mission Complete
          </p>
          <h2 className="text-xl font-black tracking-tighter uppercase text-zinc-900">
            {opportunity.title}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-px bg-zinc-100">
          {[
            { label: 'Hours', value: `${hoursWorked}h`, color: 'text-[#233DFF]' },
            { label: 'Services', value: String(serviceLogsCount), color: 'text-emerald-500' },
            { label: 'Tasks Done', value: String(completedCount), color: 'text-amber-500' },
            {
              label: 'Buddy Pair',
              value: checkinStatus?.pairLabel ?? '—',
              color: 'text-zinc-700',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white px-4 py-4 flex flex-col gap-0.5">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-400">{label}</p>
              <p className={`text-2xl font-black tracking-tighter ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Signature */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <LogOut className="w-4 h-4 text-[#233DFF]" />
          <p className="text-sm font-black text-zinc-800">Sign to confirm your shift</p>
        </div>
        <SignatureCanvas onChange={setSignature} />
      </div>

      {/* Check-out button */}
      <button
        onClick={handleCheckOut}
        disabled={checkingOut || !signature}
        className={[
          'w-full flex items-center justify-center gap-2 rounded-full font-black uppercase tracking-wider min-h-[56px] text-sm transition-all duration-200',
          checkingOut || !signature
            ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
            : 'bg-emerald-500 text-white active:scale-95 shadow-lg shadow-emerald-500/25',
        ].join(' ')}
      >
        {checkingOut ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking Out...
          </>
        ) : (
          <>
            <LogOut className="w-4 h-4" />
            Check Out + Record Hours
          </>
        )}
      </button>
      {!signature && (
        <p className="text-center text-zinc-400 font-medium text-xs -mt-2">
          Please sign above to enable check-out
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MyDay({ onBack, onNavigateToAcademy }: VolunteerMyDayProps) {
  const { state, isTestMode } = useOps();
  const [opsRunStarted, setOpsRunStarted] = useState(false);
  const [serviceLogsCount, setServiceLogsCount] = useState(0);
  const [wrapUpRequested, setWrapUpRequested] = useState(false);

  // Increment service log counter
  const handleServiceLogged = useCallback(() => {
    setServiceLogsCount((n) => n + 1);
  }, []);

  // Derive current step from state — never from setStep
  const currentStep = useMemo(() => {
    if (!state.checkinStatus?.checkedIn) return 0;
    if (!opsRunStarted && serviceLogsCount === 0) return 1;
    if (!state.checkinStatus?.checkedOut && !wrapUpRequested) return 2;
    if (wrapUpRequested || state.checkinStatus?.checkedOut) return 3;
    return 2;
  }, [state.checkinStatus, opsRunStarted, serviceLogsCount, wrapUpRequested]);

  // Loading state
  if (state.loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-[#233DFF] animate-spin" />
        <p className="text-zinc-400 font-medium text-sm">Loading your day...</p>
      </div>
    );
  }

  return (
    <div
      className={[
        'flex flex-col min-h-screen bg-zinc-50',
        isTestMode ? 'pt-11' : '',
      ].join(' ')}
    >
      {/* Back nav */}
      <div className="px-4 pt-4 pb-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-zinc-400 font-black text-xs uppercase tracking-wider min-h-[44px] -ml-1 px-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Schedule
        </button>
      </div>

      {/* Step progress */}
      <div className="px-2 pt-1 pb-0">
        <StepProgress current={currentStep} />
      </div>

      {/* Step content */}
      <div className="flex-1 px-4 pb-8 pt-2">
        {isTestMode && <SimulationGuide />}
        {currentStep === 0 && <StepArrive />}
        {currentStep === 1 && (
          <StepAssigned
            onStartServing={() => {
              setOpsRunStarted(true);
            }}
          />
        )}
        {currentStep === 2 && (
          <StepServing
            onBeginWrapUp={() => setWrapUpRequested(true)}
            serviceLogsCount={serviceLogsCount}
            onServiceLogged={handleServiceLogged}
          />
        )}
        {currentStep === 3 && (
          <StepWrapUp
            onBack={onBack}
            serviceLogsCount={serviceLogsCount}
          />
        )}

        {/* Academy nudge (optional, show when idle on step 1) */}
        {currentStep === 1 && onNavigateToAcademy && (
          <div className="mt-4 flex items-center justify-center">
            <button
              onClick={onNavigateToAcademy}
              className="flex items-center gap-1.5 text-[#233DFF] font-black text-xs uppercase tracking-wider min-h-[44px] px-2"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Open Training Academy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
