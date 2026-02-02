import React, { useState, useMemo, useCallback } from 'react';
import { Volunteer } from '../types';
import { geminiService } from '../services/geminiService';
import { analyticsService } from '../services/analyticsService';
import { ADVANCED_MODULES, ROLE_MODULES, HMC_MODULES, BOARD_GOVERNANCE_DOCS } from '../constants';
import { APP_CONFIG } from '../config';
import {
  CheckCircle2, Play, X, ShieldCheck,
  BrainCircuit, ArrowRight, Loader2, Sparkles, BookOpen, FileText, Download,
  Check, ListChecks, PlayCircle, Award, Calendar, AlertCircle, RefreshCw, Video,
  FileSignature, Briefcase, ExternalLink, Clock, Users, CalendarDays
} from 'lucide-react';

const getRoleSlug = (roleLabel: string): string => {
  if (!roleLabel) return 'general_volunteer';
  const roleConfig = APP_CONFIG.HMC_ROLES.find(r => r.label === roleLabel);
  return roleConfig ? roleConfig.id : 'general_volunteer';
};

// Static fallback quizzes for core training modules (no AI required)
const STATIC_QUIZZES: Record<string, { question: string; learningObjective: string; keyConcepts: { concept: string; description: string }[]; acceptableKeywords: string[] }> = {
  'hmc_get_to_know_us': {
    question: 'What is the primary mission of Health Matters Clinic, and how does volunteer work support this mission in the Los Angeles community?',
    learningObjective: 'Understand HMC\'s mission, values, and the role volunteers play in community health.',
    keyConcepts: [
      { concept: 'Community Health', description: 'Serving underserved populations with accessible healthcare.' },
      { concept: 'Volunteer Impact', description: 'How volunteers extend HMC\'s reach and effectiveness.' },
      { concept: 'Mission Alignment', description: 'Connecting personal values with organizational goals.' }
    ],
    acceptableKeywords: ['community', 'health', 'volunteer', 'service', 'care', 'support', 'help', 'mission']
  },
  'hipaa_staff_2025': {
    question: 'Explain how HIPAA protects patient privacy and give an example of what you would do if you accidentally saw protected health information.',
    learningObjective: 'Demonstrate understanding of HIPAA privacy rules and appropriate responses to breaches.',
    keyConcepts: [
      { concept: 'Protected Health Information (PHI)', description: 'Any health data that can identify a patient.' },
      { concept: 'Minimum Necessary Rule', description: 'Only access the information needed for your role.' },
      { concept: 'Breach Response', description: 'Report incidents immediately to supervisors.' }
    ],
    acceptableKeywords: ['privacy', 'confidential', 'report', 'protect', 'security', 'patient', 'phi', 'hipaa']
  },
  'cmhw_part1': {
    question: 'What does it mean to provide trauma-informed care, and why is it important when working with vulnerable populations?',
    learningObjective: 'Understand trauma-informed principles and their application in community health work.',
    keyConcepts: [
      { concept: 'Trauma-Informed Care', description: 'Recognizing trauma\'s impact on behavior and health.' },
      { concept: 'Safety & Trust', description: 'Creating environments where people feel secure.' },
      { concept: 'Empowerment', description: 'Supporting autonomy and choice in care decisions.' }
    ],
    acceptableKeywords: ['trauma', 'safe', 'trust', 'respect', 'care', 'support', 'understand', 'listen', 'empower']
  },
  'cmhw_part2': {
    question: 'Describe a de-escalation technique you learned and explain when you might use it in community health work.',
    learningObjective: 'Apply de-escalation and communication skills in community health settings.',
    keyConcepts: [
      { concept: 'De-escalation', description: 'Techniques to reduce tension and conflict safely.' },
      { concept: 'Active Listening', description: 'Fully engaging to understand someone\'s concerns.' },
      { concept: 'Cultural Humility', description: 'Respecting diverse backgrounds and experiences.' }
    ],
    acceptableKeywords: ['calm', 'listen', 'respect', 'safe', 'space', 'voice', 'tone', 'empathy', 'understand']
  },
  'hmc_survey_training': {
    question: 'What are the key principles for collecting survey data while maintaining participant privacy and dignity?',
    learningObjective: 'Apply ethical data collection practices that respect community members.',
    keyConcepts: [
      { concept: 'Informed Consent', description: 'Ensuring participants understand how data is used.' },
      { concept: 'Data Privacy', description: 'Protecting collected information from unauthorized access.' },
      { concept: 'Respectful Engagement', description: 'Treating every participant with dignity.' }
    ],
    acceptableKeywords: ['privacy', 'consent', 'confidential', 'respect', 'data', 'protect', 'anonymous', 'dignity']
  }
};

// Validate quiz response using keyword matching (fallback when AI unavailable)
const validateResponseLocally = (question: string, response: string, moduleId: string): boolean => {
  const quiz = STATIC_QUIZZES[moduleId];
  if (!quiz) return response.trim().length > 20; // Basic length check for unknown modules

  const responseLower = response.toLowerCase();
  const matchCount = quiz.acceptableKeywords.filter(kw => responseLower.includes(kw)).length;
  // Require at least 2 relevant keywords and minimum 30 characters
  return matchCount >= 2 && response.trim().length >= 30;
};

const TrainingAcademy: React.FC<{ user: Volunteer; onUpdate: (u: Volunteer) => void }> = ({ user, onUpdate }) => {
  const [activeSession, setActiveSession] = useState<any>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizResponse, setQuizResponse] = useState('');
  const [quizStage, setQuizStage] = useState<'video' | 'concepts' | 'question'>('video');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  
  const roleSlug = getRoleSlug(user.role);
  const roleModules = useMemo(() => ROLE_MODULES[roleSlug] || ROLE_MODULES['general_volunteer'], [roleSlug]);

  const requiredModules = useMemo(() => roleModules.filter(m => m.req), [roleModules]);
  const recommendedModules = useMemo(() => roleModules.filter(m => !m.req), [roleModules]);

  const completedModuleIds = user.completedTrainingIds || [];

  const completedRequiredCount = requiredModules.filter(m => completedModuleIds.includes(m.id)).length;
  const progress = requiredModules.length > 0 ? Math.round((completedRequiredCount / requiredModules.length) * 100) : 100;

  // Check if module is a ScreenPal video (has built-in quiz, no external assessment needed)
  const isScreenPalVideo = (embed: string) => embed?.includes('screencasthost.com') || embed?.includes('screenpal.com');

  const startQuiz = async (module: any) => {
    setActiveSession(module);
    setQuizMode(true);
    // ScreenPal videos have built-in quizzes - just watch and complete
    // YouTube/other videos need our assessment
    setQuizStage(module.embed ? 'video' : 'concepts');
    setSubmitError('');
    setQuizResponse('');
    setQuizData(null);
    setVideoError(false);
    setVideoLoading(true);
  };

  // Get proper embed URL for different video sources
  const getEmbedUrl = (embedUrl: string): string => {
    if (!embedUrl) return '';

    // YouTube URLs - ensure proper embed format
    if (embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be')) {
      // Extract video ID and construct proper embed URL
      let videoId = '';
      if (embedUrl.includes('youtube.com/embed/')) {
        videoId = embedUrl.split('youtube.com/embed/')[1]?.split('?')[0];
      } else if (embedUrl.includes('youtube.com/watch?v=')) {
        videoId = embedUrl.split('v=')[1]?.split('&')[0];
      } else if (embedUrl.includes('youtu.be/')) {
        videoId = embedUrl.split('youtu.be/')[1]?.split('?')[0];
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
      }
    }

    // ScreenPal/ScreenCastHost URLs - return as-is
    if (embedUrl.includes('screencasthost.com') || embedUrl.includes('screenpal.com')) {
      return embedUrl;
    }

    return embedUrl;
  };

  const loadQuizContent = useCallback(async () => {
    if (loadingQuiz || quizData) return;
    setLoadingQuiz(true);

    // First check for static quiz (preferred - no API dependency)
    const staticQuiz = STATIC_QUIZZES[activeSession?.id];
    if (staticQuiz) {
      setQuizData(staticQuiz);
      setLoadingQuiz(false);
      return;
    }

    // Fallback to AI-generated quiz if static not available
    try {
      const aiQuiz = await geminiService.generateModuleQuiz(activeSession.title, user.role);
      setQuizData(aiQuiz);
    } catch (e) {
      console.error("Quiz generation failed, using generic fallback", e);
      // Provide generic fallback quiz data
      setQuizData({
        question: `Reflect on "${activeSession.title}" and explain how you would apply the key concepts from this training in your volunteer work with Health Matters Clinic.`,
        learningObjective: `Demonstrate understanding of the key concepts covered in ${activeSession.title}.`,
        keyConcepts: [
          { concept: 'Core Knowledge', description: 'The fundamental principles covered in this training module.' },
          { concept: 'Practical Application', description: 'How to apply what you learned in real volunteer situations.' },
          { concept: 'HMC Values', description: 'Aligning your work with Health Matters Clinic\'s mission.' }
        ]
      });
    } finally {
      setLoadingQuiz(false);
    }
  }, [activeSession, loadingQuiz, quizData, user.role]);

  // Core Volunteer Training - ALL 5 modules required for operational access
  const CORE_TRAINING_MODULES = [
    'hmc_get_to_know_us',
    'hipaa_staff_2025',
    'cmhw_part1',
    'cmhw_part2',
    'hmc_survey_training'
  ];

  const hasCompletedCoreTraining = CORE_TRAINING_MODULES.every(id => completedModuleIds.includes(id));
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

  const handleCompleteModule = (moduleId: string, title: string) => {
    if (!completedModuleIds.includes(moduleId)) {
      analyticsService.logEvent('training_module_completed', { moduleId, title, userRole: user.role });

      // Calculate new completed training IDs
      const newCompletedIds = [...completedModuleIds, moduleId];

      // Check if this completion completes Core Volunteer Training
      const nowCompletedCore = CORE_TRAINING_MODULES.every(id => newCompletedIds.includes(id));
      const wasNotCompletedBefore = !CORE_TRAINING_MODULES.every(id => completedModuleIds.includes(id));

      const updatedUser: Partial<Volunteer> = {
        ...user,
        points: user.points + 100,
        completedTrainingIds: newCompletedIds,
        achievements: [
          ...user.achievements,
          {
            id: `mod-${moduleId}`,
            title: `Mastery: ${title}`,
            icon: 'CheckCircle',
            dateEarned: new Date().toISOString()
          }
        ]
      };

      // Set coreVolunteerStatus and eventEligibility when all 5 modules are complete
      if (nowCompletedCore && wasNotCompletedBefore) {
        updatedUser.coreVolunteerStatus = true;
        updatedUser.coreVolunteerApprovedDate = new Date().toISOString();
        // Enable core event deployment
        updatedUser.eventEligibility = {
          ...(user.eventEligibility || {}),
          canDeployCore: true,
          streetMedicineGate: false,
          clinicGate: false,
          healthFairGate: true, // Health fairs are open to core volunteers
          naloxoneDistribution: false,
          oraQuickDistribution: false,
          qualifiedEventTypes: ['Health Fair', 'Community Outreach', 'Wellness Meetup']
        };
        analyticsService.logEvent('core_volunteer_training_complete', { userId: user.id, userRole: user.role });
        setShowCompletionMessage(true);
      }

      onUpdate(updatedUser as Volunteer);
    }
    setQuizMode(false);
    setActiveSession(null);
    setQuizData(null);
    setQuizResponse('');
  };

  const handleSubmitQuiz = async () => {
    if (quizResponse.trim() === '' || !quizData?.question || !activeSession) return;
    setIsSubmitting(true);
    setSubmitError('');

    let isCorrect = false;

    // Try AI validation first, fall back to local validation if it fails
    try {
      isCorrect = await geminiService.validateQuizAnswer(quizData.question, quizResponse);
    } catch (e) {
      console.log("AI validation failed, using local validation");
      // Use local keyword-based validation as fallback
      isCorrect = validateResponseLocally(quizData.question, quizResponse, activeSession.id);
    }

    if (isCorrect) {
      handleCompleteModule(activeSession.id, activeSession.title);
    } else {
      setSubmitError("Your response needs a bit more detail. Please review the key concepts above and provide a more complete answer (at least 2-3 sentences).");
    }
    setIsSubmitting(false);
  };

  const renderModuleCard = (m: any, isRequired: boolean) => {
    const isCompleted = completedModuleIds.includes(m.id);
    const hasVideo = !!m.embed;

    return (
      <div key={m.id} className={`p-8 rounded-[40px] border flex flex-col justify-between group transition-all ${isCompleted ? 'bg-zinc-50 border-zinc-200' : 'bg-white border-zinc-100 hover:shadow-xl hover:border-zinc-200'}`}>
        <div>
          <div className="flex items-start justify-between mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm ${isCompleted ? 'bg-emerald-500 text-white' : `bg-white group-hover:bg-[#233DFF] text-zinc-300 group-hover:text-white`}`}>
              {isCompleted ? <CheckCircle2 size={28} /> : hasVideo ? <PlayCircle size={28} /> : <BookOpen size={28} />}
            </div>
            {isRequired && !isCompleted && <span className="px-3 py-1 bg-rose-50 text-rose-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-rose-100">Required</span>}
            {isCompleted && <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">Completed</span>}
          </div>
          <h4 className="text-xl font-black text-zinc-900 leading-tight">{m.title}</h4>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">{m.dur} MIN • {m.id.startsWith('hmc') ? 'HMC CORE' : 'EXTERNAL'}</p>
          <p className="text-sm text-zinc-500 mt-4 font-medium leading-relaxed">{m.desc}</p>
        </div>
        <div className="mt-8">
          {!isCompleted && (
            <button onClick={() => startQuiz(m)} className="w-full py-5 bg-zinc-900 text-white rounded-full font-black text-[11px] uppercase tracking-widest transition-all hover:scale-[1.02] shadow-xl">
              Launch Mastery Assessment
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-32">
      {/* Core Training Complete Banner */}
      {hasCompletedCoreTraining && (
        <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-[32px] flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shrink-0">
            <Award size={28} />
          </div>
          <div>
            <h4 className="text-lg font-black text-emerald-900">Core Volunteer Training Complete</h4>
            <p className="text-emerald-700 font-medium">You're eligible to sign up for community-based events. Visit My Missions to find opportunities.</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-zinc-100 p-12 rounded-[56px] shadow-sm flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden">
        <div className="max-w-xl relative z-10">
          <div className="inline-flex items-center gap-3 px-6 py-2 bg-[#233DFF]/5 text-[#233DFF] border border-[#233DFF]/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-10">
             TRAINING ACADEMY
          </div>
          <h2 className="text-6xl font-black text-zinc-900 tracking-tighter leading-none mb-6 italic">Role-Based Training</h2>
          <p className="text-zinc-500 text-lg font-medium leading-relaxed italic">
            Your personalized training plan for the <span className="font-bold text-zinc-800">{user.role}</span> role.
          </p>
        </div>

        <div className="w-full md:w-80 bg-zinc-50 p-10 rounded-[40px] border border-zinc-100 flex flex-col items-center relative z-10 shadow-inner">
          <div className="relative w-32 h-32 mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-zinc-200" />
              <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364} strokeDashoffset={364 - (364 * progress) / 100} className="text-[#233DFF] transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-zinc-900">{progress}%</div>
          </div>
          <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">REQUIRED COMPLETE</p>
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase mb-8">Required Training</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {requiredModules.map(m => renderModuleCard(m, true))}
        </div>
      </div>
      
      {recommendedModules.length > 0 && (
        <div>
          <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase mb-8 pt-8 border-t border-zinc-100">Recommended Training</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recommendedModules.map(m => renderModuleCard(m, false))}
          </div>
        </div>
      )}

      {/* Board Member Governance Section */}
      {(user.role === 'Board Member' || user.role === 'Community Advisory Board') && (
        <div className="space-y-10 pt-8 border-t border-zinc-100">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 p-12 rounded-[56px] text-white">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                <Briefcase size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight">Board Governance Center</h3>
                <p className="text-zinc-400 text-sm">Required forms, policies, and governance documents for board service.</p>
              </div>
            </div>
          </div>

          {/* Meeting Schedule */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#233DFF]/5 p-8 rounded-[32px] border border-[#233DFF]/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#233DFF]/10 flex items-center justify-center">
                  <CalendarDays size={24} className="text-[#233DFF]" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-zinc-900">
                    {user.role === 'Board Member' ? 'Board Meetings' : 'CAB Meetings'}
                  </h4>
                  <p className="text-xs text-zinc-500">{BOARD_GOVERNANCE_DOCS.meetingSchedule[user.role === 'Board Member' ? 'boardMeetings' : 'cabMeetings'].frequency}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="text-[#233DFF] mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Schedule</p>
                    <p className="text-sm text-zinc-600">{BOARD_GOVERNANCE_DOCS.meetingSchedule[user.role === 'Board Member' ? 'boardMeetings' : 'cabMeetings'].schedule}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock size={16} className="text-[#233DFF] mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Time</p>
                    <p className="text-sm text-zinc-600">{BOARD_GOVERNANCE_DOCS.meetingSchedule[user.role === 'Board Member' ? 'boardMeetings' : 'cabMeetings'].time}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users size={16} className="text-[#233DFF] mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Attendance Target</p>
                    <p className="text-sm text-zinc-600">{BOARD_GOVERNANCE_DOCS.meetingSchedule.attendanceExpectation}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-50 p-8 rounded-[32px] border border-zinc-100">
              <h4 className="text-lg font-black text-zinc-900 mb-4">Standard Meeting Agenda</h4>
              <ol className="space-y-2">
                {BOARD_GOVERNANCE_DOCS.meetingSchedule.standardAgenda.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-zinc-200 text-zinc-600 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                    <span className="text-sm text-zinc-700">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Required Forms */}
          <div>
            <h4 className="text-xl font-black text-zinc-900 tracking-tight uppercase mb-6 flex items-center gap-3">
              <FileSignature size={24} className="text-rose-500" /> Required Forms
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {BOARD_GOVERNANCE_DOCS.requiredForms.map(form => (
                <div key={form.id} className={`p-8 rounded-[32px] border-2 ${form.required ? 'border-rose-200 bg-rose-50/30' : 'border-zinc-100 bg-white'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${form.required ? 'bg-rose-100 text-rose-600' : 'bg-zinc-100 text-zinc-500'}`}>
                        <FileSignature size={20} />
                      </div>
                      {form.required && (
                        <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-[9px] font-black uppercase tracking-widest">Required</span>
                      )}
                    </div>
                  </div>
                  <h5 className="text-lg font-black text-zinc-900">{form.title}</h5>
                  <p className="text-sm text-zinc-500 mt-2">{form.description}</p>
                  <p className="text-xs font-bold text-zinc-400 mt-3">{form.dueDate}</p>
                  <button className="mt-6 w-full py-3 bg-zinc-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                    <Download size={14} /> Download Form
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Governance Documents */}
          <div>
            <h4 className="text-xl font-black text-zinc-900 tracking-tight uppercase mb-6 flex items-center gap-3">
              <FileText size={24} className="text-[#233DFF]" /> Governance Documents
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {BOARD_GOVERNANCE_DOCS.governanceDocs.map(doc => (
                <div key={doc.id} className="p-6 rounded-[28px] border border-zinc-100 bg-white hover:shadow-lg hover:border-zinc-200 transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 mb-4 group-hover:bg-[#233DFF]/10 group-hover:text-[#233DFF] transition-colors">
                    <FileText size={24} />
                  </div>
                  <h5 className="text-base font-black text-zinc-900">{doc.title}</h5>
                  <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{doc.description}</p>
                  <button className="mt-4 text-xs font-bold text-[#233DFF] flex items-center gap-1 hover:underline">
                    View Document <ExternalLink size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {quizMode && activeSession && (
        <div className="fixed inset-0 bg-zinc-900/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-8 animate-in fade-in">
           <div className="bg-white p-12 rounded-[56px] max-w-5xl w-full space-y-10 shadow-2xl border border-zinc-100">
              <div className="flex items-center justify-between">
                 <h4 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">{activeSession.title}</h4>
                 <button onClick={() => setQuizMode(false)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-300 hover:text-zinc-900"><X size={24} /></button>
              </div>
              {quizStage === 'video' && activeSession?.embed ? (
                <div className="space-y-8 animate-in fade-in">
                  <div className="aspect-video bg-zinc-900 rounded-[32px] overflow-hidden shadow-2xl relative">
                    {videoLoading && !videoError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10">
                        <Loader2 size={48} className="text-white animate-spin mb-4" />
                        <p className="text-zinc-400 text-sm font-medium">Loading video...</p>
                      </div>
                    )}
                    {videoError ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-white">
                        <AlertCircle size={48} className="text-amber-400 mb-4" />
                        <p className="text-lg font-bold mb-2">Video couldn't load</p>
                        <p className="text-zinc-400 text-sm mb-6 max-w-md text-center">
                          The video player encountered an error. You can try refreshing or proceed directly to the assessment.
                        </p>
                        <div className="flex gap-4">
                          <button
                            onClick={() => { setVideoError(false); setVideoLoading(true); }}
                            className="px-6 py-3 bg-zinc-800 text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-zinc-700"
                          >
                            <RefreshCw size={16} /> Try Again
                          </button>
                          <a
                            href={activeSession.embed.includes('youtube') ? activeSession.embed.replace('/embed/', '/watch?v=') : activeSession.embed}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-6 py-3 bg-white text-zinc-900 rounded-full font-bold text-sm flex items-center gap-2"
                          >
                            <Video size={16} /> Open in New Tab
                          </a>
                        </div>
                      </div>
                    ) : (
                      <iframe
                        className="w-full h-full"
                        src={getEmbedUrl(activeSession.embed)}
                        title={activeSession.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                        style={{ border: 'none' }}
                        onLoad={() => setVideoLoading(false)}
                        onError={() => { setVideoError(true); setVideoLoading(false); }}
                      />
                    )}
                  </div>
                  {isScreenPalVideo(activeSession.embed) ? (
                    <>
                      <p className="text-zinc-500 font-medium text-center">Complete the built-in quiz in the video, then mark as complete below.</p>
                      <button
                        onClick={() => handleCompleteModule(activeSession.id, activeSession.title)}
                        className="w-full py-6 bg-emerald-500 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <Check size={18} /> I've Completed This Training
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-zinc-500 font-medium text-center">Watch the video above, then proceed to the assessment.</p>
                      <button
                        onClick={() => { setQuizStage('concepts'); loadQuizContent(); }}
                        className="w-full py-6 bg-[#233DFF] border border-black text-white rounded-full font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <div className="w-2 h-2 rounded-full bg-white" />
                        I've Watched This - Continue to Assessment <ArrowRight size={18} />
                      </button>
                    </>
                  )}
                </div>
              ) : loadingQuiz ? (
                <div className="py-20 flex flex-col items-center gap-6">
                   <Loader2 size={48} className="text-[#233DFF] animate-spin" />
                   <p className="text-xs font-black text-zinc-400 uppercase tracking-widest animate-pulse">Generating Assessment...</p>
                </div>
              ) : quizStage === 'concepts' ? (
                <div className="space-y-8 animate-in fade-in">
                  <h5 className="text-lg font-black text-zinc-900">Learning Objective:</h5>
                  <p className="text-zinc-600 font-medium italic">"{quizData?.learningObjective}"</p>
                  <h5 className="text-lg font-black text-zinc-900 pt-4 border-t">Key Concepts to Review:</h5>
                  <div className="space-y-4">
                    {quizData?.keyConcepts?.map((item: { concept: string, description: string }, i: number) => (
                      <div key={i} className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                        <p className="font-black text-zinc-800 text-sm">{item.concept}</p>
                        <p className="text-sm text-zinc-500 mt-1">{item.description}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setQuizStage('question')} className="w-full py-6 bg-[#233DFF] border border-black text-white rounded-full font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    <div className="w-2 h-2 rounded-full bg-white" />
                    Proceed to Question
                  </button>
                </div>
              ) : (
                <div className="animate-in fade-in">
                  <div className="space-y-4 bg-zinc-50 p-8 rounded-[32px] border border-zinc-100 shadow-inner">
                     <p className="text-zinc-900 font-black text-xl leading-tight">"{quizData?.question}"</p>
                  </div>
                  <textarea value={quizResponse} onChange={e => setQuizResponse(e.target.value)} className="w-full h-32 bg-zinc-50 border border-zinc-100 rounded-[32px] p-6 font-medium outline-none mt-6" placeholder="Your response..." />
                  {submitError && <p className="text-rose-500 text-xs text-center mt-4 font-bold">{submitError}</p>}
                  <button onClick={handleSubmitQuiz} disabled={quizResponse.trim() === '' || isSubmitting} className="w-full py-6 bg-[#233DFF] border border-black text-white rounded-full font-black text-xs uppercase tracking-widest shadow-2xl disabled:opacity-30 mt-6 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all">
                     {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <div className="w-2 h-2 rounded-full bg-white" />}
                     Submit & Complete Module
                  </button>
                </div>
              )}
           </div>
        </div>
      )}

      {/* Core Volunteer Training Completion Modal */}
      {showCompletionMessage && (
        <div className="fixed inset-0 bg-zinc-900/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-8 animate-in fade-in">
          <div className="bg-white p-12 rounded-[56px] max-w-2xl w-full text-center shadow-2xl border border-zinc-100 animate-in zoom-in-95">
            <div className="w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-8 shadow-xl">
              <Award size={48} />
            </div>
            <h3 className="text-4xl font-black text-zinc-900 tracking-tight mb-4">Core Volunteer Training Complete</h3>
            <p className="text-xl text-zinc-600 font-medium leading-relaxed mb-8">
              You've completed Core Volunteer Training. You're now eligible to sign up for community-based events.
            </p>
            <div className="flex items-center justify-center gap-3 text-emerald-600 font-bold text-sm mb-8">
              <Calendar size={18} />
              <span>Completed on {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <button
              onClick={() => setShowCompletionMessage(false)}
              className="px-12 py-5 bg-[#233DFF] border border-black text-white rounded-full font-black text-sm uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 mx-auto"
            >
              <div className="w-2 h-2 rounded-full bg-white" />
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingAcademy;