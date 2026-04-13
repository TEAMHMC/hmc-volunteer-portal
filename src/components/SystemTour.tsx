import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { APP_CONFIG } from '../config';

interface SystemTourProps {
    onComplete: () => void;
    onClose: () => void;
    onNavigateToTraining?: () => void;
}

const tourSteps = [
  {
    title: 'Welcome to the HMC Volunteer Hub',
    content: 'Your central command for training, shifts, and event-day operations. Let\'s take a 60-second look at what\'s here.',
  },
  {
    title: 'Training Academy',
    content: 'Start here. Complete your orientation videos to become an HMC Champion. If you apply for a specialized role, your additional training unlocks here too — self-paced, on any device.',
  },
  {
    title: 'My Missions',
    content: 'Once you\'re cleared for events, this is where you register for shifts. On the day of an event, tap any active shift to open Event Ops Mode — your real-time command center.',
  },
  {
    title: 'Event Ops Mode',
    content: 'On event day, Event Ops Mode replaces the guesswork. Volunteers see a step-by-step flow: check in, get your assignment, log services, and sign off. Leads see a live dashboard of who\'s there and what\'s happening.',
  },
  {
    title: 'Impact Hub',
    content: 'Track your hours, points, and achievements. See how your time translates into community impact. Levels and milestones unlock as you contribute.',
  },
  {
    title: 'You\'re Ready',
    content: 'Head to Training Academy to complete your orientation. Questions? Reach us at volunteer@healthmatters.clinic.',
  },
];

const SystemTour: React.FC<SystemTourProps> = ({ onComplete, onClose, onNavigateToTraining }) => {
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 md:p-8 animate-in fade-in" onClick={onClose}>
            <div className="bg-white max-w-xl w-full rounded-modal shadow-elevation-3 p-4 md:p-8 relative border border-zinc-100" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-zinc-100 rounded-full text-zinc-400 hover:bg-rose-100 hover:text-rose-500 transition-colors"><X size={20}/></button>

                <div className="flex items-center gap-4 mb-6">
                    <img src={APP_CONFIG.BRAND.logoUrl} alt="HMC" className="w-14 h-14" />
                </div>

                <h2 className="text-xl md:text-3xl font-black text-zinc-900 tracking-tight">{currentStep.title}</h2>
                <p className="text-zinc-500 mt-4 font-bold text-sm md:text-lg leading-relaxed">{currentStep.content}</p>

                <div className="flex flex-col sm:flex-row items-center justify-between mt-10 gap-4">
                    <div className="flex items-center gap-2">
                        {tourSteps.map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-brand scale-125' : 'bg-zinc-200'}`} />
                        ))}
                    </div>
                    <button onClick={handleNext} className="px-4 md:px-8 py-4 min-h-[44px] bg-brand border border-black text-white rounded-full font-bold text-xs uppercase tracking-wide flex items-center gap-3 group shadow-elevation-2">
                        {isLastStep ? "Let's Get Started" : "Next"}
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                {isLastStep && onNavigateToTraining && (
                    <div className="mt-4 text-center">
                        <button
                            onClick={onNavigateToTraining}
                            className="text-brand text-sm font-bold underline underline-offset-2 hover:text-brand/70 transition-colors"
                        >
                            Go to Training
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SystemTour;
