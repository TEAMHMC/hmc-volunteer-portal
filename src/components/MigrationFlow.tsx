
import React, { useState, useEffect, useMemo } from 'react';
import { Volunteer } from '../types';
import { HMC_MODULES, TIER_1_MODULES, TIER_2_MODULES, ALL_TRAINING_MODULES, hasCompletedAllModules, TIER_1_IDS, TIER_2_IDS } from '../constants';
import { ArrowRight, CheckSquare, Loader2, Square } from 'lucide-react';
import TrainingAcademy from './TrainingAcademy';

interface MigrationFlowProps {
  user: Volunteer;
  onUpdateUser: (updatedUser: Volunteer) => Promise<void>;
  onComplete: () => void;
}

const formatPhoneNumber = (value: string) => value.replace(/\D/g, '').slice(0, 10).replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');

const MigrationFlow: React.FC<MigrationFlowProps> = ({ user, onUpdateUser, onComplete }) => {
  const [step, setStep] = useState<'profile' | 'orientation' | 'training'>('profile');
  const [formData, setFormData] = useState({
      phone: user.phone || '',
      emergencyContact: user.emergencyContact || { name: '', relationship: '', cellPhone: '', email: '' },
      tshirtSize: user.tshirtSize || '',
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [watchedIntro, setWatchedIntro] = useState(false);
  const [watchedChampion, setWatchedChampion] = useState(false);
  
  const [migratingUser, setMigratingUser] = useState(user);

  useEffect(() => {
    setMigratingUser(user);
  }, [user]);

  const handleDataChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleEmergencyContactChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, emergencyContact: { ...prev.emergencyContact, [field]: value } }));
  }

  const validateAndProceed = async () => {
    const errors: any = {};
    if (step === 'profile') {
        if ((formData.phone || '').replace(/\D/g, '').length !== 10) errors.phone = "A valid 10-digit phone number is required.";
        if (!formData.emergencyContact.name || !formData.emergencyContact.relationship || !formData.emergencyContact.cellPhone) errors.eContact = "All emergency contact fields are required.";
        else if ((formData.emergencyContact.cellPhone || '').replace(/\D/g, '').length !== 10) errors.eContact = "A valid 10-digit emergency contact phone number is required.";
        if (!formData.tshirtSize) errors.tshirtSize = "Please select a T-shirt size.";
    }
    if (step === 'orientation') {
        if (!watchedIntro || !watchedChampion) errors.orientation = "You must acknowledge both orientation modules.";
    }
    setFormErrors(errors);

    if (Object.keys(errors).length === 0) {
      setIsLoading(true);
      try {
        if (step === 'profile') {
          await onUpdateUser({ ...user, ...formData });
          setStep('orientation');
        } else if (step === 'orientation') {
          setStep('training');
        }
      } catch (e) {
        alert("Failed to save progress. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const completedModuleIds = useMemo(() => migratingUser.completedTrainingIds || [], [migratingUser.completedTrainingIds]);

  // Training complete = Tier 1 + Tier 2 all done (with legacy compat)
  const isTrainingComplete = useMemo(() => {
    return hasCompletedAllModules(completedModuleIds, [...TIER_1_IDS, ...TIER_2_IDS]);
  }, [completedModuleIds]);


  const renderContent = () => {
    switch (step) {
      case 'profile':
        return (
          <>
            <h2 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic leading-none">Complete Your Profile</h2>
            <p className="text-zinc-500 font-medium">To finalize your transition to our new portal, please fill in the missing details below.</p>
            <div className="space-y-6 pt-8">
                <div><label className="text-xs font-bold">Phone Number</label><input type="tel" value={formData.phone} onChange={e => handleDataChange('phone', formatPhoneNumber(e.target.value))} placeholder="Phone Number" className={`w-full px-6 py-4 bg-zinc-50 border rounded-xl font-bold ${formErrors.phone ? 'border-rose-500' : 'border-zinc-100'}`} />{formErrors.phone && <p className="text-rose-500 text-xs font-bold mt-1">{formErrors.phone}</p>}</div>
                <div>
                    <label className="text-xs font-bold">Emergency Contact</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <input placeholder="Full Name" value={formData.emergencyContact.name} onChange={e => handleEmergencyContactChange('name', e.target.value)} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-xl font-bold" />
                        <select value={formData.emergencyContact.relationship} onChange={e => handleEmergencyContactChange('relationship', e.target.value)} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-xl font-bold"><option value="">Relationship...</option><option>Spouse</option><option>Partner</option><option>Parent</option><option>Sibling</option><option>Friend</option><option>Other</option></select>
                        <input placeholder="Cell Phone" value={formData.emergencyContact.cellPhone} onChange={e => handleEmergencyContactChange('cellPhone', formatPhoneNumber(e.target.value))} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-xl font-bold" />
                    </div>
                     {formErrors.eContact && <p className="text-rose-500 text-xs font-bold mt-1">{formErrors.eContact}</p>}
                </div>
                <div><label className="text-xs font-bold">T-Shirt Size</label><select value={formData.tshirtSize} onChange={e => handleDataChange('tshirtSize', e.target.value)} className={`w-full px-6 py-4 bg-zinc-50 border rounded-xl font-bold ${formErrors.tshirtSize ? 'border-rose-500' : 'border-zinc-100'}`}><option value="">Select Size...</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select>{formErrors.tshirtSize && <p className="text-rose-500 text-xs font-bold mt-1">{formErrors.tshirtSize}</p>}</div>
            </div>
          </>
        );
      case 'orientation':
        return (
            <>
                <h2 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic">Core Orientation</h2>
                <p className="text-zinc-500 font-medium">To ensure everyone is up-to-date, please review our two core orientation modules.</p>
                <div className="space-y-6 pt-8">
                    {[HMC_MODULES.hmcIntro, HMC_MODULES.champion].map(m => (
                        <div key={m.id} className="bg-zinc-50/50 p-8 rounded-2xl border border-zinc-100 space-y-6">
                            <h3 className="text-xl font-black text-zinc-900">{m.title}</h3>
                            <div className="aspect-video bg-zinc-200 rounded-xl overflow-hidden"><iframe src={m.embed} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture;" allowFullScreen></iframe></div>
                            <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl bg-white" onClick={() => (m.id === 'hmc_orientation' ? setWatchedIntro(!watchedIntro) : setWatchedChampion(!watchedChampion))}>
                                {(m.id === 'hmc_orientation' ? watchedIntro : watchedChampion) ? <CheckSquare className="text-[#233DFF]" /> : <Square className="text-zinc-300" />}
                                <span className="text-sm font-medium text-zinc-600">I have watched and understood this module.</span>
                            </label>
                        </div>
                    ))}
                    {formErrors.orientation && <p className="text-rose-500 text-center font-bold">{formErrors.orientation}</p>}
                </div>
            </>
        );
      case 'training':
        return (
            <>
                <h2 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic">Finalize Training</h2>
                <p className="text-zinc-500 font-medium">Please complete your required training plan to fully activate your account.</p>
                <div className="pt-8 -mx-12">
                    <TrainingAcademy user={migratingUser} onUpdate={onUpdateUser} />
                </div>
            </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center p-6 md:p-12 font-['Inter']">
      <div className="w-full max-w-4xl my-4 text-center">
         <h1 className="text-2xl font-black">Welcome Back, {user.name}!</h1>
         <p className="text-zinc-500">Let's get your new profile up and running.</p>
      </div>
      <div className="max-w-4xl w-full bg-white rounded-[40px] shadow-2xl border border-zinc-100 p-10 md:p-16 relative overflow-hidden">
        <div className="space-y-8 animate-in fade-in">
          {renderContent()}
        </div>
        <div className="flex items-center gap-4 pt-8 mt-8 border-t border-zinc-100">
          {step === 'training' ? (
            <button onClick={onComplete} disabled={!isTrainingComplete || isLoading} className="flex-1 py-5 bg-emerald-600 text-white rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? <Loader2 className="animate-spin" /> : <>Complete Activation <ArrowRight className="group-hover:translate-x-2 transition-transform" /></>}
            </button>
          ) : (
            <button onClick={validateAndProceed} disabled={isLoading} className="flex-1 py-5 bg-[#233DFF] text-white rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? <Loader2 className="animate-spin" /> : <>Continue <ArrowRight className="group-hover:translate-x-2 transition-transform" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MigrationFlow;
