import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Volunteer } from '../types';
import { geminiService } from '../services/geminiService';
import { analyticsService } from '../services/analyticsService';
import {
  TIER_1_MODULES, TIER_2_MODULES, TIER_4_MODULES,
  TIER_2_CORE_MODULES, TIER_2_FIELD_MODULES,
  TIER_2_CORE_IDS, TIER_2_FIELD_IDS,
  PROGRAM_COMMUNITY_WELLNESS, PROGRAM_COMMUNITY_HEALTH_OUTREACH,
  PROGRAM_STREET_MEDICINE, PROGRAM_CLINICAL,
  ROLE_SPECIFIC_MODULES, TIER_1_IDS, TIER_2_IDS,
  hasCompletedModule, hasCompletedAllModules,
  TrainingModule,
} from '../constants';
import { APP_CONFIG } from '../config';
import {
  CheckCircle2, Play, X, ShieldCheck,
  BrainCircuit, ArrowRight, Loader2, Sparkles, BookOpen, FileText, Download,
  Check, ListChecks, PlayCircle, Award, Calendar, AlertCircle, RefreshCw, Video, Stethoscope,
  Lock, Monitor, Youtube, FileCheck, ChevronDown, PenLine
} from 'lucide-react';
import ClinicalOnboarding from './ClinicalOnboarding';

const ROLE_LABEL_ALIASES: Record<string, string> = {
  'Events Coordinator': 'Events Lead',
  'Operations Coordinator': 'General Operations Coordinator',
  'Content Writer': 'Newsletter & Content Writer',
};

const getRoleSlug = (roleLabel: string): string => {
  if (!roleLabel) return 'general_volunteer';
  const normalized = ROLE_LABEL_ALIASES[roleLabel] || roleLabel;
  const roleConfig = APP_CONFIG.HMC_ROLES.find(r => r.label === normalized);
  return roleConfig ? roleConfig.id : 'general_volunteer';
};

// Format badge component
const FormatBadge: React.FC<{ format: TrainingModule['format'] }> = ({ format }) => {
  const config = {
    screenpal: { label: 'Video', icon: PlayCircle, color: 'bg-sky-100 text-sky-700 border-sky-200' },
    recorded_video: { label: 'Video', icon: Youtube, color: 'bg-sky-100 text-sky-700 border-sky-200' },
    read_ack: { label: 'Read & Acknowledge', icon: FileCheck, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  }[format];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${config.color}`}>
      <config.icon size={10} /> {config.label}
    </span>
  );
};

// Static fallback quizzes for core training modules (no AI required)
// Note: hmc_orientation and hmc_champion are ScreenPal videos with built-in quizzes — no static quiz needed
const STATIC_QUIZZES: Record<string, { question: string; learningObjective: string; keyConcepts: { concept: string; description: string }[]; acceptableKeywords: string[] }> = {
  'hipaa_nonclinical': {
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
  'survey_general': {
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
  if (!quiz) return response.trim().length > 20;

  const responseLower = response.toLowerCase();
  const matchCount = quiz.acceptableKeywords.filter(kw => responseLower.includes(kw)).length;
  return matchCount >= 2 && response.trim().length >= 30;
};

const TrainingAcademy: React.FC<{ user: Volunteer; onUpdate: (u: Volunteer) => void }> = ({ user, onUpdate }) => {
  const [activeSession, setActiveSession] = useState<TrainingModule | null>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizResponse, setQuizResponse] = useState('');
  const [quizStage, setQuizStage] = useState<'video' | 'read_ack' | 'concepts' | 'question'>('video');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [moduleContent, setModuleContent] = useState<{ content: string; sections: { heading: string; body: string }[] } | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [showFieldAccess, setShowFieldAccess] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({});

  const toggleTier = (tierId: string) => {
    setExpandedTiers(prev => ({ ...prev, [tierId]: !prev[tierId] }));
  };

  // Auto-expand the first incomplete tier
  useEffect(() => {
    const auto: Record<string, boolean> = {};
    if (!tier1Complete) {
      auto['tier1'] = true;
    } else if (!tier2CoreComplete && !isGovernanceRole) {
      auto['tier2'] = true;
    } else if (tier2CoreComplete) {
      auto['tier3'] = true;
    }
    setExpandedTiers(auto);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Try both role and appliedRole — use whichever has role-specific training
  const primarySlug = getRoleSlug(user.role);
  const appliedSlug = getRoleSlug(user.appliedRole || '');
  const roleSlug = (ROLE_SPECIFIC_MODULES[primarySlug]?.length > 0) ? primarySlug : appliedSlug;
  const roleDisplayName = (() => {
    const raw = user.role || user.appliedRole || 'Volunteer';
    return ROLE_LABEL_ALIASES[raw] || raw;
  })();
  const completedModuleIds = user.completedTrainingIds || [];

  // Governance roles (board, CAB) skip Tier 2 operational training
  const GOVERNANCE_ROLES = ['board_member', 'community_advisory_board'];
  const isGovernanceRole = GOVERNANCE_ROLES.includes(primarySlug) || GOVERNANCE_ROLES.includes(appliedSlug);

  // Modules that require a typed legal signature (governance policies + clinical docs)
  const requiresSignature = (mod: TrainingModule) =>
    mod.format === 'read_ack' && (mod.id.startsWith('gov_') || mod.programAssociation === 'clinical');

  // Tier completion checks (with legacy compat)
  const tier1Complete = hasCompletedAllModules(completedModuleIds, TIER_1_IDS);
  const tier2CoreComplete = isGovernanceRole ? true : hasCompletedAllModules(completedModuleIds, TIER_2_CORE_IDS);
  const tier2FieldComplete = hasCompletedAllModules(completedModuleIds, TIER_2_FIELD_IDS);
  const tier2Complete = tier2CoreComplete && tier2FieldComplete;
  const isOperationalEligible = user.coreVolunteerStatus === true && tier2CoreComplete;

  // Progress calculations
  const tier1CompletedCount = TIER_1_MODULES.filter(m => hasCompletedModule(completedModuleIds, m.id)).length;
  const tier1Progress = Math.round((tier1CompletedCount / TIER_1_MODULES.length) * 100);

  const tier2CoreCompletedCount = TIER_2_CORE_MODULES.filter(m => hasCompletedModule(completedModuleIds, m.id)).length;
  const tier2CoreProgress = Math.round((tier2CoreCompletedCount / TIER_2_CORE_MODULES.length) * 100);
  const tier2FieldCompletedCount = TIER_2_FIELD_MODULES.filter(m => hasCompletedModule(completedModuleIds, m.id)).length;
  const tier2CompletedCount = TIER_2_MODULES.filter(m => hasCompletedModule(completedModuleIds, m.id)).length;
  const governanceTier2Complete = hasCompletedAllModules(completedModuleIds, TIER_2_IDS);

  const overallRequired = isGovernanceRole ? [...TIER_1_MODULES] : [...TIER_1_MODULES, ...TIER_2_CORE_MODULES];
  const overallCompletedCount = overallRequired.filter(m => hasCompletedModule(completedModuleIds, m.id)).length;
  const overallProgress = Math.round((overallCompletedCount / overallRequired.length) * 100);

  // Role-specific modules
  const roleModules = useMemo(() => ROLE_SPECIFIC_MODULES[roleSlug] || [], [roleSlug]);

  // Check if module is a ScreenPal video (has built-in quiz)
  const isScreenPalVideo = (embed: string) => embed?.includes('screencasthost.com') || embed?.includes('screenpal.com');

  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

  const startQuiz = async (module: TrainingModule) => {
    setActiveSession(module);
    setQuizMode(true);
    setReviewMode(false);
    setSubmitError('');
    setQuizResponse('');
    setSignatureName('');
    setQuizData(null);
    setVideoError(false);
    setVideoLoading(true);
    setModuleContent(null);

    if (module.format === 'read_ack') {
      setQuizStage('read_ack');
    } else if (module.embed) {
      setQuizStage('video');
    } else {
      setQuizStage('concepts');
    }
  };

  const startReview = (module: TrainingModule) => {
    setActiveSession(module);
    setQuizMode(true);
    setReviewMode(true);
    setSubmitError('');
    setQuizResponse('');
    setSignatureName('');
    setQuizData(null);
    setVideoError(false);
    setVideoLoading(true);
    setModuleContent(null);

    if (module.format === 'read_ack') {
      setQuizStage('read_ack');
    } else if (module.embed) {
      setQuizStage('video');
    } else {
      setQuizStage('read_ack'); // Show content for review
    }
  };

  // Fetch AI-generated content when a read_ack module is opened
  useEffect(() => {
    if (!activeSession || activeSession.format !== 'read_ack') return;

    let cancelled = false;
    setLoadingContent(true);

    geminiService.generateModuleContent(
      activeSession.id,
      activeSession.title,
      activeSession.desc,
      roleDisplayName
    ).then(result => {
      if (!cancelled) {
        setModuleContent(result);
        setLoadingContent(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingContent(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id, activeSession?.format, roleDisplayName]);

  // Get proper embed URL for different video sources
  const getEmbedUrl = (embedUrl: string): string => {
    if (!embedUrl) return '';

    if (embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be')) {
      let videoId = '';
      if (embedUrl.includes('youtube.com/embed/')) {
        videoId = embedUrl.split('youtube.com/embed/')[1]?.split('?')[0];
      } else if (embedUrl.includes('youtube.com/watch?v=')) {
        videoId = embedUrl.split('v=')[1]?.split('&')[0];
      } else if (embedUrl.includes('youtu.be/')) {
        videoId = embedUrl.split('youtu.be/')[1]?.split('?')[0];
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?rel=0`;
      }
    }

    if (embedUrl.includes('screencasthost.com') || embedUrl.includes('screenpal.com')) {
      return embedUrl;
    }

    return embedUrl;
  };

  const loadQuizContent = useCallback(async () => {
    if (loadingQuiz || quizData) return;
    setLoadingQuiz(true);

    const staticQuiz = STATIC_QUIZZES[activeSession?.id || ''];
    if (staticQuiz) {
      setQuizData(staticQuiz);
      setLoadingQuiz(false);
      return;
    }

    try {
      const aiQuiz = await geminiService.generateModuleQuiz(activeSession!.title, user.role);
      setQuizData(aiQuiz);
    } catch (e) {
      console.error("Quiz generation failed, using generic fallback", e);
      setQuizData({
        question: `Reflect on "${activeSession!.title}" and explain how you would apply the key concepts from this training in your volunteer work with Health Matters Clinic.`,
        learningObjective: `Demonstrate understanding of the key concepts covered in ${activeSession!.title}.`,
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

  const handleCompleteModule = (moduleId: string, title: string) => {
    if (!hasCompletedModule(completedModuleIds, moduleId)) {
      analyticsService.logEvent('training_module_completed', { moduleId, title, userRole: user.role });

      const newCompletedIds = [...completedModuleIds, moduleId];

      // Check if this completion finishes required tiers (governance roles skip Tier 2)
      const requiredIds = isGovernanceRole ? TIER_1_IDS : [...TIER_1_IDS, ...TIER_2_CORE_IDS];
      const nowCompletedAll = hasCompletedAllModules(newCompletedIds, requiredIds);
      const wasNotCompletedBefore = !hasCompletedAllModules(completedModuleIds, requiredIds);

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

      // Store digital signature for governance and clinical modules
      if (activeSession && requiresSignature(activeSession) && signatureName.trim()) {
        updatedUser.trainingSignatures = {
          ...(user.trainingSignatures || {}),
          [moduleId]: {
            fullName: signatureName.trim(),
            signedAt: new Date().toISOString(),
          }
        };
      }

      if (nowCompletedAll && wasNotCompletedBefore) {
        updatedUser.coreVolunteerStatus = true;
        updatedUser.coreVolunteerApprovedDate = new Date().toISOString();
        updatedUser.eventEligibility = {
          ...(user.eventEligibility || {}),
          canDeployCore: true,
          streetMedicineGate: false,
          clinicGate: false,
          healthFairGate: true,
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
    setSignatureName('');
    setQuizResponse('');
  };

  const handleSubmitQuiz = async () => {
    if (quizResponse.trim() === '' || !quizData?.question || !activeSession) return;
    setIsSubmitting(true);
    setSubmitError('');

    let isCorrect = false;

    try {
      isCorrect = await geminiService.validateQuizAnswer(quizData.question, quizResponse);
    } catch (e) {
      console.log("AI validation failed, using local validation");
      isCorrect = validateResponseLocally(quizData.question, quizResponse, activeSession.id);
    }

    if (isCorrect) {
      handleCompleteModule(activeSession.id, activeSession.title);
    } else {
      setSubmitError("Your response needs a bit more detail. Please review the key concepts above and provide a more complete answer (at least 2-3 sentences).");
    }
    setIsSubmitting(false);
  };

  const renderModuleCard = (m: TrainingModule, tierLocked: boolean) => {
    const isCompleted = hasCompletedModule(completedModuleIds, m.id);
    const hasVideo = !!m.embed;
    const isLocked = tierLocked;

    return (
      <div key={m.id} className={`p-5 rounded-2xl border flex flex-col justify-between group transition-all ${isCompleted ? 'bg-zinc-50 border-zinc-200' : isLocked ? 'bg-zinc-50/50 border-zinc-100' : 'bg-white border-zinc-100 hover:shadow-elevation-2 hover:border-zinc-200'}`}>
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-elevation-1 ${isCompleted ? 'bg-emerald-500 text-white' : isLocked ? 'bg-zinc-100 text-zinc-300' : `bg-white group-hover:bg-[#233DFF] text-zinc-300 group-hover:text-white`}`}>
              {isCompleted ? <CheckCircle2 size={20} /> : m.format === 'read_ack' ? <FileCheck size={20} /> : hasVideo ? <PlayCircle size={20} /> : <BookOpen size={20} />}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <FormatBadge format={m.format} />
              {m.req && !isCompleted && !isLocked && <span className="px-2.5 py-0.5 bg-rose-50 text-rose-500 rounded-full text-[9px] font-bold uppercase tracking-wider border border-rose-100">Required</span>}
              {isCompleted && <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-bold uppercase tracking-wider border border-emerald-100">Completed</span>}
              {isLocked && <span className="px-2.5 py-0.5 bg-zinc-100 text-zinc-400 rounded-full text-[9px] font-bold uppercase tracking-wider border border-zinc-200">Locked</span>}
            </div>
          </div>
          <h4 className={`text-base font-black leading-tight ${isLocked ? 'text-zinc-400' : 'text-zinc-900'}`}>{m.title}</h4>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
            {m.dur} MIN {m.isAIGenerated && '• AI-GENERATED'}
          </p>
          <p className={`text-xs mt-3 font-medium leading-relaxed ${isLocked ? 'text-zinc-400' : 'text-zinc-500'}`}>{m.desc}</p>
        </div>
        <div className="mt-5">
          {!isCompleted && !isLocked && (
            <button onClick={() => startQuiz(m)} className="w-full py-3.5 bg-zinc-900 text-white rounded-full font-normal text-xs transition-all hover:scale-[1.02] shadow-elevation-2">
              {m.format === 'read_ack' ? 'Read & Acknowledge' : 'Launch Assessment'}
            </button>
          )}
          {isCompleted && (
            <button onClick={() => startReview(m)} className="w-full py-3.5 bg-white border border-zinc-200 text-zinc-600 rounded-full font-normal text-xs transition-all hover:border-[#233DFF] hover:text-[#233DFF] hover:scale-[1.02] flex items-center justify-center gap-2">
              <BookOpen size={12} /> Review
            </button>
          )}
          {isLocked && (
            <div className="w-full py-3.5 bg-zinc-100 text-zinc-400 rounded-full font-normal text-xs text-center flex items-center justify-center gap-2">
              <Lock size={12} /> Complete Previous Tier
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the Read & Acknowledge modal content
  const renderReadAckContent = () => {
    if (!activeSession) return null;
    return (
      <div className="space-y-8 animate-in fade-in">
        <div className={`${reviewMode ? 'bg-[#233DFF]/5 border-[#233DFF]/20' : 'bg-amber-50 border-amber-200'} border rounded-card p-6 flex items-center gap-4`}>
          <FileCheck size={24} className={reviewMode ? 'text-[#233DFF] shrink-0' : 'text-amber-600 shrink-0'} />
          <div>
            <p className={`font-bold text-sm ${reviewMode ? 'text-[#233DFF]' : 'text-amber-900'}`}>
              {reviewMode ? 'Reviewing Completed Module' : 'Read & Acknowledge Module'}
            </p>
            <p className={`text-xs mt-1 ${reviewMode ? 'text-[#233DFF]/70' : 'text-amber-700'}`}>
              {reviewMode ? 'You have already completed this module. Review the content below.' : 'Read the content below carefully, then acknowledge your understanding to complete this module.'}
            </p>
          </div>
        </div>

        <div className="bg-zinc-50 border border-zinc-200 rounded-card p-8 space-y-6 max-h-[500px] overflow-y-auto">
          <h4 className="text-lg font-black text-zinc-900">{activeSession.title}</h4>

          {loadingContent ? (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 size={36} className="text-[#233DFF] animate-spin" />
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider animate-pulse">
                Generating content for your role...
              </p>
            </div>
          ) : moduleContent && moduleContent.sections.length > 0 ? (
            <div className="space-y-6">
              {moduleContent.content && (
                <p className="text-zinc-600 text-sm font-medium italic border-l-4 border-[#233DFF]/30 pl-4">{moduleContent.content}</p>
              )}
              {moduleContent.sections.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <h5 className="text-sm font-black text-zinc-800 uppercase tracking-wide">{section.heading}</h5>
                  <div className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{section.body}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-700 leading-relaxed">{activeSession.desc}</p>
          )}

          <div className="border-t border-zinc-200 pt-6 space-y-4">
            <p className="text-sm text-zinc-600 leading-relaxed">
              By completing this module, you acknowledge that you have read and understood the above policy, guidelines, and expectations. You commit to applying these principles in your volunteer work with Health Matters Clinic.
            </p>
            <p className="text-sm text-zinc-600 leading-relaxed">
              If you have questions about any of the content, please reach out to your coordinator or the HMC support team through the Communication Hub.
            </p>
          </div>
        </div>

        {reviewMode ? (
          <>
            {activeSession && requiresSignature(activeSession) && user.trainingSignatures?.[activeSession.id] && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-card p-6 flex items-center gap-4">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Signed Document</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Signed by <span style={{ fontFamily: "'Caveat', 'Dancing Script', cursive", fontSize: '1.1rem' }} className="font-bold">{user.trainingSignatures[activeSession.id].fullName}</span> on {new Date(user.trainingSignatures[activeSession.id].signedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
            )}
            <button
              onClick={() => { setQuizMode(false); setActiveSession(null); }}
              className="w-full py-6 bg-zinc-900 text-white rounded-full font-bold text-xs uppercase tracking-wide shadow-elevation-3 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Done Reviewing
            </button>
          </>
        ) : (
          <>
            <div className="bg-white border border-zinc-200 rounded-card p-6">
              <label className="flex items-start gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quizResponse === 'acknowledged'}
                  onChange={(e) => setQuizResponse(e.target.checked ? 'acknowledged' : '')}
                  disabled={loadingContent}
                  className="mt-1 w-5 h-5 rounded border-zinc-300 text-[#233DFF] focus:ring-[#233DFF]"
                />
                <span className="text-sm font-medium text-zinc-700">
                  I have read and understand the content of this module. I commit to applying these guidelines in my volunteer work.
                </span>
              </label>
            </div>

            {activeSession && requiresSignature(activeSession) && (
              <div className="bg-white border border-zinc-200 rounded-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <PenLine size={18} className="text-[#233DFF] shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Digital Signature Required</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Type your full legal name below to sign this document.
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Full Legal Name"
                    disabled={loadingContent}
                    className="w-full px-4 py-3 border-b-2 border-zinc-300 focus:border-[#233DFF] bg-zinc-50 rounded-t-lg text-lg outline-none transition-colors"
                    style={{ fontFamily: "'Caveat', 'Dancing Script', cursive", fontSize: '1.5rem' }}
                  />
                  <p className="text-[10px] text-zinc-400 mt-2 uppercase tracking-wider font-bold">
                    Signed electronically on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (quizResponse === 'acknowledged') {
                  handleCompleteModule(activeSession.id, activeSession.title);
                }
              }}
              disabled={quizResponse !== 'acknowledged' || loadingContent || (activeSession && requiresSignature(activeSession) && signatureName.trim().length < 2)}
              className="w-full py-6 bg-emerald-500 text-white rounded-full font-bold text-xs uppercase tracking-wide shadow-elevation-3 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30"
            >
              {activeSession && requiresSignature(activeSession) ? (
                <><PenLine size={18} /> Sign & Complete Module</>
              ) : (
                <><Check size={18} /> Acknowledge & Complete Module</>
              )}
            </button>
          </>
        )}
      </div>
    );
  };

  // Determine which program modules to show based on user's role eligibility
  const programModules = useMemo(() => {
    const sections: { title: string; program: string; modules: TrainingModule[] }[] = [];
    const roleConfig = APP_CONFIG.HMC_ROLES.find(r => r.label === user.role || r.id === roleSlug);
    const eligibility = roleConfig?.eventEligibility;

    // Clinical Services — only for roles with clinic gate access (Licensed Medical, Medical Admin)
    const clinicalRoles = ['licensed_medical', 'medical_admin'];
    const showClinical = clinicalRoles.includes(roleSlug) || clinicalRoles.includes(primarySlug);

    // Community Wellness, Health Outreach — available to all operational (non-governance) roles
    if (PROGRAM_COMMUNITY_WELLNESS.length > 0) {
      sections.push({ title: 'Community Wellness', program: 'community_wellness', modules: PROGRAM_COMMUNITY_WELLNESS });
    }
    if (PROGRAM_COMMUNITY_HEALTH_OUTREACH.length > 0) {
      sections.push({ title: 'Community Health Outreach', program: 'community_health_outreach', modules: PROGRAM_COMMUNITY_HEALTH_OUTREACH });
    }

    // Street Medicine — only for roles with street medicine gate or clinical roles
    if (PROGRAM_STREET_MEDICINE.length > 0 && (eligibility?.streetMedicineGate || showClinical)) {
      sections.push({ title: 'Street Medicine', program: 'street_medicine', modules: PROGRAM_STREET_MEDICINE });
    }

    // Clinical Services — only for clinical roles
    if (PROGRAM_CLINICAL.length > 0 && showClinical) {
      sections.push({ title: 'Clinical Services', program: 'clinical', modules: PROGRAM_CLINICAL });
    }

    return sections;
  }, [roleSlug, primarySlug, user.role]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-16">
      {/* Tier 1 Complete Banner */}
      {tier1Complete && !tier2CoreComplete && (
        <div className="bg-[#233DFF]/5 border border-[#233DFF]/20 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#233DFF]/50 text-white flex items-center justify-center shadow-elevation-1 shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h4 className="text-lg font-black text-[#233DFF]">Orientation Complete!</h4>
            <p className="text-[#233DFF] font-medium">Welcome to HMC! Continue with Baseline Training below to unlock My Missions.</p>
          </div>
        </div>
      )}

      {/* Core Baseline Complete Banner */}
      {tier2CoreComplete && (
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-elevation-1 shrink-0">
            <Award size={20} />
          </div>
          <div>
            <h4 className="text-lg font-black text-emerald-900">{isGovernanceRole ? 'Orientation Complete' : 'Baseline Training Complete'}</h4>
            <p className="text-emerald-700 font-medium">
              {isGovernanceRole
                ? 'Complete your role-specific governance training below.'
                : "You're eligible for community events. Complete program-specific training below to unlock specialized missions."}
            </p>
          </div>
        </div>
      )}

      {/* Header with progress */}
      <div className="bg-white border border-zinc-100 p-8 md:p-10 rounded-container shadow-elevation-1 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="max-w-xl relative z-10">
          <div className="inline-flex items-center gap-3 px-5 py-1.5 bg-[#233DFF]/5 text-[#233DFF] border border-[#233DFF]/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
             TRAINING ACADEMY
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-zinc-900 tracking-tighter leading-none mb-4 italic">HMC Training</h2>
          <p className="text-zinc-500 text-base font-medium leading-relaxed">
            Complete orientation and baseline training to become operational. Then unlock program-specific clearances.
            {roleDisplayName && roleDisplayName !== 'HMC Champion' && roleDisplayName !== 'Volunteer' && (
              <span className="block mt-2 text-[#233DFF]">Applied role: <span className="font-bold">{roleDisplayName}</span></span>
            )}
          </p>
        </div>

        <div className="w-full md:w-72 bg-zinc-50 p-6 rounded-card border border-zinc-100 flex flex-col items-center relative z-10 shadow-inner gap-4">
          {/* Tier 1 Progress */}
          <div className="flex items-center gap-4 w-full">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-zinc-200" />
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={176} strokeDashoffset={176 - (176 * tier1Progress) / 100} className="text-[#233DFF] transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-zinc-900">{tier1Progress}%</div>
            </div>
            <div>
              <p className="text-xs font-black text-zinc-700">Tier 1: Orientation</p>
              <p className="text-[10px] text-zinc-400">{tier1CompletedCount}/{TIER_1_MODULES.length} videos</p>
            </div>
          </div>

          {/* Tier 2 Core Progress (hidden for governance roles, only shown after Tier 1) */}
          {!isGovernanceRole && tier1Complete && (
            <div className="flex items-center gap-4 w-full">
              <div className="relative w-16 h-16">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-zinc-200" />
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={176} strokeDashoffset={176 - (176 * tier2CoreProgress) / 100} className="text-[#233DFF] transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-zinc-900">{tier2CoreProgress}%</div>
              </div>
              <div>
                <p className="text-xs font-black text-zinc-700">Tier 2: Baseline</p>
                <p className="text-[10px] text-zinc-400">{tier2CoreCompletedCount}/{TIER_2_CORE_MODULES.length} modules</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== TIER 1: ORIENTATION ===== */}
      <div className="border border-zinc-100 rounded-container overflow-hidden">
        <button onClick={() => toggleTier('tier1')} className="w-full flex items-center gap-4 p-6 md:p-8 hover:bg-zinc-50/50 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-[#233DFF]/50 text-white flex items-center justify-center text-sm font-black shrink-0">1</div>
          <div className="flex-1 text-left">
            <h3 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Orientation</h3>
            <p className="text-zinc-400 text-sm font-medium mt-1">Two intro videos about HMC and volunteering</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {tier1Complete ? (
              <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-bold uppercase tracking-wider">Complete</span>
            ) : (
              <span className="px-3 py-1.5 bg-zinc-100 text-zinc-500 rounded-full text-[11px] font-bold uppercase tracking-wider">{tier1CompletedCount}/{TIER_1_MODULES.length}</span>
            )}
            <ChevronDown size={20} className={`text-zinc-400 transition-transform ${expandedTiers['tier1'] ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {expandedTiers['tier1'] && (
          <div className="px-6 md:px-8 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {TIER_1_MODULES.map(m => renderModuleCard(m, false))}
            </div>
          </div>
        )}
      </div>

      {/* ===== TIER 2: BASELINE OPERATIONAL ===== */}
      {/* For governance roles: optional collapsed section for field access */}
      {/* For operational roles: required section */}
      {isGovernanceRole && tier1Complete && (
        <div className="pt-8 border-t border-zinc-100">
          <button
            onClick={() => setShowFieldAccess(!showFieldAccess)}
            className="w-full flex items-center gap-4 mb-4 group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-black">
              <Calendar size={20} />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-xl font-black text-zinc-900 tracking-tight">
                {governanceTier2Complete ? 'Field Access Training' : 'Want to Support In-Person Events?'}
              </h3>
              <p className="text-zinc-500 font-medium text-sm mt-1">
                {governanceTier2Complete
                  ? 'You\'ve completed field training. My Missions is unlocked.'
                  : 'Optional: Complete these modules to unlock My Missions and sign up for shifts at community events.'}
              </p>
            </div>
            {governanceTier2Complete ? (
              <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0">Unlocked</span>
            ) : (
              <span className="px-3 py-1.5 bg-zinc-100 text-zinc-500 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0">{tier2CompletedCount}/{TIER_2_MODULES.length}</span>
            )}
            <ChevronDown size={20} className={`text-zinc-400 transition-transform ${showFieldAccess ? 'rotate-180' : ''}`} />
          </button>
          {showFieldAccess && (
            <div className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {TIER_2_MODULES.map(m => renderModuleCard(m, false))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* ===== TIER 2A: CORE BASELINE (hidden until Tier 1 complete) ===== */}
      {!isGovernanceRole && tier1Complete && (
        <div className="border border-zinc-100 rounded-container overflow-hidden">
          <button onClick={() => toggleTier('tier2')} className="w-full flex items-center gap-4 p-6 md:p-8 hover:bg-zinc-50/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#233DFF] text-white flex items-center justify-center text-sm font-black shrink-0">2</div>
            <div className="flex-1 text-left">
              <h3 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Baseline Training</h3>
              <p className="text-zinc-400 text-sm font-medium mt-1">Required to unlock My Missions and event registration</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {tier2CoreComplete ? (
                <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-bold uppercase tracking-wider">Complete</span>
              ) : (
                <span className="px-3 py-1.5 bg-zinc-100 text-zinc-500 rounded-full text-[11px] font-bold uppercase tracking-wider">{tier2CoreCompletedCount}/{TIER_2_CORE_MODULES.length}</span>
              )}
              <ChevronDown size={20} className={`text-zinc-400 transition-transform ${expandedTiers['tier2'] ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {expandedTiers['tier2'] && (
            <div className="px-6 md:px-8 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {TIER_2_CORE_MODULES.map(m => renderModuleCard(m, false))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TIER 2B: FIELD READINESS (collapsed, shown after Core Baseline) ===== */}
      {!isGovernanceRole && tier2CoreComplete && (
        <div className="pt-8 border-t border-zinc-100">
          <button
            onClick={() => setShowFieldAccess(!showFieldAccess)}
            className="w-full flex items-center gap-4 mb-4 group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-black">
              <Calendar size={20} />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-xl font-black text-zinc-900 tracking-tight">
                {tier2FieldComplete ? 'Field Readiness Training' : 'Want to Attend In-Person Events?'}
              </h3>
              <p className="text-zinc-500 font-medium text-sm mt-1">
                {tier2FieldComplete
                  ? 'You\'ve completed field readiness training. You can register for in-person events.'
                  : 'Optional: Complete these modules before registering for in-person community events.'}
              </p>
            </div>
            {tier2FieldComplete ? (
              <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0">Complete</span>
            ) : (
              <span className="px-3 py-1.5 bg-zinc-100 text-zinc-500 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0">{tier2FieldCompletedCount}/{TIER_2_FIELD_MODULES.length}</span>
            )}
            <ChevronDown size={20} className={`text-zinc-400 transition-transform ${showFieldAccess ? 'rotate-180' : ''}`} />
          </button>
          {showFieldAccess && (
            <div className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {TIER_2_FIELD_MODULES.map(m => renderModuleCard(m, false))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TIER 3: PROGRAM-SPECIFIC CLEARANCE (hidden for governance roles) ===== */}
      {tier2CoreComplete && !isGovernanceRole && (
        <div className="border border-zinc-100 rounded-container overflow-hidden">
          <button onClick={() => toggleTier('tier3')} className="w-full flex items-center gap-4 p-6 md:p-8 hover:bg-zinc-50/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center text-sm font-black shrink-0">3</div>
            <div className="flex-1 text-left">
              <h3 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Program Clearance</h3>
              <p className="text-zinc-400 text-sm font-medium mt-1">Unlock specialized missions like Street Medicine, Clinical, etc.</p>
            </div>
            <ChevronDown size={20} className={`text-zinc-400 transition-transform shrink-0 ${expandedTiers['tier3'] ? 'rotate-180' : ''}`} />
          </button>
          {expandedTiers['tier3'] && (
            <div className="px-6 md:px-8 pb-8 space-y-6">
              {programModules.map(section => {
                const sectionCompletedCount = section.modules.filter(m => hasCompletedModule(completedModuleIds, m.id)).length;
                const sectionComplete = sectionCompletedCount === section.modules.length;
                const isExpanded = expandedTiers[`prog_${section.program}`];

                return (
                  <div key={section.program} className="border border-zinc-100 rounded-2xl overflow-hidden">
                    <button onClick={() => toggleTier(`prog_${section.program}`)} className="w-full flex items-center gap-4 p-5 hover:bg-zinc-50/50 transition-colors">
                      <div className="flex-1 text-left">
                        <h4 className="text-base font-black text-zinc-800">{section.title}</h4>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {sectionComplete ? (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold uppercase tracking-wider">Cleared</span>
                        ) : (
                          <span className="px-3 py-1 bg-zinc-100 text-zinc-500 rounded-full text-[9px] font-bold uppercase tracking-wider">{sectionCompletedCount}/{section.modules.length}</span>
                        )}
                        <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {section.modules.map(m => renderModuleCard(m, false))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== ROLE-SPECIFIC TRAINING ===== */}
      {roleModules.length > 0 && tier1Complete && (
        <div className="border border-zinc-100 rounded-container overflow-hidden">
          <button onClick={() => toggleTier('role')} className="w-full flex items-center gap-4 p-6 md:p-8 hover:bg-zinc-50/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Role Training: {roleDisplayName}</h3>
              <p className="text-zinc-400 text-sm font-medium mt-1">Additional training specific to your assigned role</p>
            </div>
            <ChevronDown size={20} className={`text-zinc-400 transition-transform shrink-0 ${expandedTiers['role'] ? 'rotate-180' : ''}`} />
          </button>
          {expandedTiers['role'] && (
            <div className="px-6 md:px-8 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {roleModules.map(m => renderModuleCard(m, false))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TIER 4: RECOMMENDED (Non-blocking, 30-day deadline, hidden for governance) ===== */}
      {tier2CoreComplete && !isGovernanceRole && (
        <div className="border border-zinc-100 rounded-container overflow-hidden">
          <button onClick={() => toggleTier('tier4')} className="w-full flex items-center gap-4 p-6 md:p-8 hover:bg-zinc-50/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-zinc-400 text-white flex items-center justify-center text-sm font-black shrink-0">4</div>
            <div className="flex-1 text-left">
              <h3 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Recommended</h3>
              <p className="text-zinc-400 text-sm font-medium mt-1">Context videos — complete within 30 days to keep advanced mission access</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[11px] font-bold uppercase tracking-wider border border-amber-200">30 Days</span>
              <ChevronDown size={20} className={`text-zinc-400 transition-transform ${expandedTiers['tier4'] ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {expandedTiers['tier4'] && (
            <div className="px-6 md:px-8 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {TIER_4_MODULES.map(m => renderModuleCard(m, false))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== CLINICAL ONBOARDING ===== */}
      {(user.role?.includes('Medical') || user.role?.includes('Licensed') ||
        user.appliedRole?.includes('Medical') || user.appliedRole?.includes('Licensed')) && (
        <div className={!tier1Complete ? 'opacity-60' : ''}>
          <div className="flex items-center gap-4 mb-8 pt-8 border-t border-zinc-100">
            <div className="w-10 h-10 rounded-xl bg-[#233DFF]/50 text-white flex items-center justify-center">
              <Stethoscope size={20} />
            </div>
            <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Clinical Onboarding</h3>
            {user.clinicalOnboarding?.completed && (
              <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-bold uppercase tracking-wider">Complete</span>
            )}
            {!tier1Complete && (
              <span className="px-4 py-1.5 bg-zinc-100 text-zinc-500 rounded-full text-[11px] font-bold uppercase tracking-wider">Complete Orientation First</span>
            )}
          </div>
          <p className="text-zinc-500 font-medium mb-8 -mt-4">
            Required for all Licensed Medical Professionals. Complete document review with signatures and upload your credentials before accessing clinical stations.
          </p>
          {!tier1Complete ? (
            <div className="p-8 bg-zinc-50 rounded-container border border-zinc-100 text-center">
              <p className="text-zinc-400 font-medium">Complete Orientation training above to unlock Clinical Onboarding.</p>
            </div>
          ) : (
            <ClinicalOnboarding user={user} onUpdate={onUpdate} />
          )}
        </div>
      )}

      {/* ===== QUIZ/ASSESSMENT MODAL ===== */}
      {quizMode && activeSession && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-8 animate-in fade-in">
           <div className="bg-white p-12 rounded-container max-w-5xl w-full space-y-10 shadow-elevation-3 border border-zinc-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <h4 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">{activeSession.title}</h4>
                   <FormatBadge format={activeSession.format} />
                 </div>
                 <button onClick={() => { setQuizMode(false); setActiveSession(null); }} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-300 hover:text-zinc-900"><X size={24} /></button>
              </div>

              {/* Read & Acknowledge flow */}
              {quizStage === 'read_ack' && renderReadAckContent()}

              {/* Video flow */}
              {quizStage === 'video' && activeSession?.embed ? (
                <div className="space-y-8 animate-in fade-in">
                  <div className="aspect-video bg-zinc-900 rounded-container overflow-hidden shadow-elevation-3 relative">
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
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        style={{ border: 'none' }}
                        onLoad={() => setVideoLoading(false)}
                        onError={() => { setVideoError(true); setVideoLoading(false); }}
                      />
                    )}
                  </div>
                  {reviewMode ? (
                    <>
                      <p className="text-zinc-500 font-medium text-center">Reviewing completed module. Watch the video above as needed.</p>
                      <button
                        onClick={() => { setQuizMode(false); setActiveSession(null); }}
                        className="w-full py-6 bg-zinc-900 text-white rounded-full font-bold text-xs uppercase tracking-wide shadow-elevation-3 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        Done Reviewing
                      </button>
                    </>
                  ) : isScreenPalVideo(activeSession.embed) ? (
                    <>
                      <p className="text-zinc-500 font-medium text-center">Complete the built-in quiz in the video, then mark as complete below.</p>
                      <button
                        onClick={() => handleCompleteModule(activeSession.id, activeSession.title)}
                        className="w-full py-6 bg-emerald-500 text-white rounded-full font-bold text-xs uppercase tracking-wide shadow-elevation-3 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <Check size={18} /> I've Completed This Training
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-zinc-500 font-medium text-center">Watch the video above, then proceed to the assessment.</p>
                      <button
                        onClick={() => { setQuizStage('concepts'); loadQuizContent(); }}
                        className="w-full py-6 bg-[#233DFF] border border-black text-white rounded-full font-bold text-xs uppercase tracking-wide shadow-elevation-3 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <div className="w-2 h-2 rounded-full bg-white" />
                        I've Watched This - Continue to Assessment <ArrowRight size={18} />
                      </button>
                    </>
                  )}
                </div>
              ) : quizStage !== 'read_ack' && loadingQuiz ? (
                <div className="py-20 flex flex-col items-center gap-6">
                   <Loader2 size={48} className="text-[#233DFF] animate-spin" />
                   <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider animate-pulse">Generating Assessment...</p>
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
                  <button onClick={() => setQuizStage('question')} className="w-full py-6 bg-[#233DFF] border border-black text-white rounded-full font-bold text-xs uppercase tracking-wide shadow-elevation-3 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    <div className="w-2 h-2 rounded-full bg-white" />
                    Proceed to Question
                  </button>
                </div>
              ) : quizStage === 'question' ? (
                <div className="animate-in fade-in">
                  <div className="space-y-4 bg-zinc-50 p-8 rounded-container border border-zinc-100 shadow-inner">
                     <p className="text-zinc-900 font-black text-xl leading-tight">"{quizData?.question}"</p>
                  </div>
                  <textarea value={quizResponse} onChange={e => setQuizResponse(e.target.value)} className="w-full h-32 bg-zinc-50 border border-zinc-100 rounded-container p-6 font-medium outline-none mt-6" placeholder="Your response..." />
                  {submitError && <p className="text-rose-500 text-xs text-center mt-4 font-bold">{submitError}</p>}
                  <button onClick={handleSubmitQuiz} disabled={quizResponse.trim() === '' || isSubmitting} className="w-full py-6 bg-[#233DFF] border border-black text-white rounded-full font-bold text-xs uppercase tracking-wide shadow-elevation-3 disabled:opacity-30 mt-6 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all">
                     {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <div className="w-2 h-2 rounded-full bg-white" />}
                     Submit & Complete Module
                  </button>
                </div>
              ) : null}
           </div>
        </div>
      )}

      {/* Core Volunteer Training Completion Modal */}
      {showCompletionMessage && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-8 animate-in fade-in">
          <div className="bg-white p-12 rounded-container max-w-2xl w-full text-center shadow-elevation-3 border border-zinc-100 animate-in zoom-in-95">
            <div className="w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-8 shadow-elevation-2">
              <Award size={48} />
            </div>
            <h3 className="text-4xl font-black text-zinc-900 tracking-tight mb-4">
              {isGovernanceRole ? 'Orientation Training Complete' : 'Baseline Training Complete'}
            </h3>
            <p className="text-xl text-zinc-600 font-medium leading-relaxed mb-8">
              {isGovernanceRole
                ? `You've completed your orientation as a ${roleDisplayName}. Continue to your role-specific training below.`
                : "You've completed all baseline training. You're now eligible to sign up for community-based events through My Missions."}
            </p>
            <div className="flex items-center justify-center gap-3 text-emerald-600 font-bold text-sm mb-8">
              <Calendar size={18} />
              <span>Completed on {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <button
              onClick={() => setShowCompletionMessage(false)}
              className="px-12 py-5 bg-[#233DFF] border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide shadow-elevation-2 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 mx-auto"
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
