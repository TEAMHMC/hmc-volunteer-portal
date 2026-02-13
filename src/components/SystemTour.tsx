import React, { useState } from 'react';
import { X, ArrowRight, Activity, Calendar, GraduationCap, DollarSign } from 'lucide-react';
import { APP_CONFIG } from '../config';

interface SystemTourProps {
    onComplete: () => void;
    onClose: () => void;
}

const tourSteps = [
    { 
        title: 'Welcome to the HMC Volunteer Hub!',
        content: 'This quick tour will show you the key areas of your new dashboard. It’s your central command for making an impact.',
        icon: Activity,
    },
    { 
        title: 'Main Navigation',
        content: 'Use this sidebar to navigate between different sections of the portal, from finding missions to tracking your impact.',
        icon: Activity,
    },
    { 
        title: 'My Missions',
        content: 'This is where you’ll find and sign up for volunteer opportunities, see your schedule, and access mission-critical tools on event day.',
        icon: Calendar,
    },
    { 
        title: 'Training Academy',
        content: 'Access your personalized, role-based training plan here. Complete modules to unlock new skills and opportunities.',
        icon: GraduationCap,
    },
    {
        title: 'Impact Hub',
        content: 'Track your contributed hours, see how you rank on the community leaderboard, and use our AI tools for fundraising.',
        icon: DollarSign,
    },
];

const SystemTour: React.FC<SystemTourProps> = ({ onComplete, onClose }) => {
    const [step, setStep] = useState(0);
    const currentStep = tourSteps[step];
    const isLastStep = step === tourSteps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
        } else {
            setStep(s => s + 1);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-8 animate-in fade-in" onClick={onClose}>
            <div className="bg-white max-w-xl w-full rounded-container shadow-elevation-3 p-12 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-zinc-100 rounded-full text-zinc-400 hover:bg-rose-100 hover:text-rose-500 transition-colors"><X size={20}/></button>
                
                <div className="flex items-center gap-4 mb-6">
                    <img src={APP_CONFIG.BRAND.logoUrl} alt="HMC" className="w-14 h-14" />
                </div>
                
                <h2 className="text-3xl font-black text-zinc-900 tracking-tight">{currentStep.title}</h2>
                <p className="text-zinc-500 mt-4 text-lg leading-relaxed">{currentStep.content}</p>

                <div className="flex items-center justify-between mt-10">
                    <div className="flex items-center gap-2">
                        {tourSteps.map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-brand scale-125' : 'bg-zinc-200'}`} />
                        ))}
                    </div>
                    <button onClick={handleNext} className="px-8 py-4 bg-brand text-white rounded-full font-bold text-xs uppercase tracking-wide flex items-center gap-3 group shadow-elevation-2">
                        {isLastStep ? "Let's Get Started" : "Next"}
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SystemTour;
