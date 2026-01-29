import React, { useState, useMemo } from 'react';
import { Volunteer } from '../types';
import { geminiService } from '../services/geminiService';
import { analyticsService } from '../services/analyticsService';
import { ADVANCED_MODULES, ROLE_MODULES, HMC_MODULES } from '../constants';
import { APP_CONFIG } from '../config';
import { 
  CheckCircle2, Play, X, ShieldCheck, 
  BrainCircuit, ArrowRight, Loader2, Sparkles, BookOpen, FileText, Download,
  Check, ListChecks, PlayCircle
} from 'lucide-react';

const getRoleSlug = (roleLabel: string): string => {
  if (!roleLabel) return 'general_volunteer';
  const roleConfig = APP_CONFIG.HMC_ROLES.find(r => r.label === roleLabel);
  return roleConfig ? roleConfig.id : 'general_volunteer';
};

const TrainingAcademy: React.FC<{ user: Volunteer; onUpdate: (u: Volunteer) => void }> = ({ user, onUpdate }) => {
  const [activeSession, setActiveSession] = useState<any>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizResponse, setQuizResponse] = useState('');
  const [quizStage, setQuizStage] = useState<'concepts' | 'question'>('concepts');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  
  const roleSlug = getRoleSlug(user.role);
  const roleModules = useMemo(() => ROLE_MODULES[roleSlug] || ROLE_MODULES['general_volunteer'], [roleSlug]);

  const requiredModules = useMemo(() => roleModules.filter(m => m.req), [roleModules]);
  const recommendedModules = useMemo(() => roleModules.filter(m => !m.req), [roleModules]);

  const completedModuleIds = user.completedTrainingIds || [];

  const completedRequiredCount = requiredModules.filter(m => completedModuleIds.includes(m.id)).length;
  const progress = requiredModules.length > 0 ? Math.round((completedRequiredCount / requiredModules.length) * 100) : 100;

  const startQuiz = async (module: any) => {
    setActiveSession(module);
    setQuizMode(true);
    setQuizStage('concepts');
    setSubmitError('');
    setQuizResponse('');
    setLoadingQuiz(true);
    try {
      const aiQuiz = await geminiService.generateModuleQuiz(module.title, user.role);
      setQuizData(aiQuiz);
    } catch (e) {
      console.error("Quiz generation failed", e);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleCompleteModule = (moduleId: string, title: string) => {
    if (!completedModuleIds.includes(moduleId)) {
      analyticsService.logEvent('training_module_completed', { moduleId, title, userRole: user.role });
      onUpdate({ 
        ...user, 
        points: user.points + 100,
        completedTrainingIds: [...completedModuleIds, moduleId],
        achievements: [
          ...user.achievements,
          { 
            id: `mod-${moduleId}`, 
            title: `Mastery: ${title}`, 
            icon: 'CheckCircle', 
            dateEarned: new Date().toISOString() 
          }
        ]
      });
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
    const isCorrect = await geminiService.validateQuizAnswer(quizData.question, quizResponse);
    if (isCorrect) {
      handleCompleteModule(activeSession.id, activeSession.title);
    } else {
      setSubmitError("That doesn't seem quite right. Please review the concepts and try again.");
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
      
      {quizMode && activeSession && (
        <div className="fixed inset-0 bg-zinc-900/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-8 animate-in fade-in">
           <div className="bg-white p-12 rounded-[56px] max-w-5xl w-full space-y-10 shadow-2xl border border-zinc-100">
              <div className="flex items-center justify-between">
                 <h4 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">{activeSession.title}</h4>
                 <button onClick={() => setQuizMode(false)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-300 hover:text-zinc-900"><X size={24} /></button>
              </div>
              {loadingQuiz ? (
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
                    {quizData?.keyConcepts.map((item: { concept: string, description: string }, i: number) => (
                      <div key={i} className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                        <p className="font-black text-zinc-800 text-sm">{item.concept}</p>
                        <p className="text-sm text-zinc-500 mt-1">{item.description}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setQuizStage('question')} className="w-full py-6 bg-[#233DFF] text-white rounded-full font-black text-xs uppercase tracking-widest shadow-2xl">Proceed to Question</button>
                </div>
              ) : (
                <div className="animate-in fade-in">
                  <div className="space-y-4 bg-zinc-50 p-8 rounded-[32px] border border-zinc-100 shadow-inner">
                     <p className="text-zinc-900 font-black text-xl leading-tight">"{quizData?.question}"</p>
                  </div>
                  <textarea value={quizResponse} onChange={e => setQuizResponse(e.target.value)} className="w-full h-32 bg-zinc-50 border border-zinc-100 rounded-[32px] p-6 font-medium outline-none mt-6" placeholder="Your response..." />
                  {submitError && <p className="text-rose-500 text-xs text-center mt-4 font-bold">{submitError}</p>}
                  <button onClick={handleSubmitQuiz} disabled={quizResponse.trim() === '' || isSubmitting} className="w-full py-6 bg-zinc-900 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-2xl disabled:opacity-30 mt-6 flex items-center justify-center gap-3">
                     {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                     Submit & Complete Module
                  </button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default TrainingAcademy;