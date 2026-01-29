
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowRight, CheckCircle, Loader2, Check, X, CheckSquare, Square, FileText,
  Eye, EyeOff, MapPin, Mail, Shield, AlertCircle, UploadCloud, AlertTriangle
} from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { analyticsService } from '../services/analyticsService';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';
import { HMC_MODULES } from '../constants';
import { Volunteer } from '../types';
import { GoogleLogin } from '@react-oauth/google';


interface OnboardingFlowProps {
  onBackToLanding: () => void;
  onSuccess?: () => void;
  googleClientId?: string;
  recaptchaSiteKey?: string;
}

type StepId = 'account' | 'personal' | 'background' | 'availability' | 'role' | 'details' | 'compliance' | 'orientation';

// --- HELPER FUNCTIONS ---

const calculateAge = (dobString: string | Date): number => {
  if (!dobString) return 0;
  let birthDate: Date;
  if (typeof dobString === 'string' && dobString.includes('/')) {
    const parts = dobString.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts.map(Number);
      // More robust validation
      if (year < 1920 || year > new Date().getFullYear() || month < 1 || month > 12 || day < 1 || day > 31) return 0;
      birthDate = new Date(year, month - 1, day);
      // Check if the date is valid (e.g., handles Feb 30)
      if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) return 0;
    } else { return 0; }
  } else { birthDate = new Date(dobString); }

  if (isNaN(birthDate.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

const evaluatePasswordStrength = (pwd: string) => {
  const checks = [
    { label: '13+ characters', passed: pwd.length >= 13 }, 
    { label: 'Uppercase', passed: /[A-Z]/.test(pwd) },
    { label: 'Lowercase', passed: /[a-z]/.test(pwd) }, 
    { label: 'Number', passed: /[0-9]/.test(pwd) }, 
    { label: 'Special', passed: /[!@#$%^&*]/.test(pwd) }
  ];
  const score = checks.filter(c => c.passed).length / checks.length;
  return { score, checks };
};


const formatPhoneNumber = (value: string) => value.replace(/\D/g, '').slice(0, 10).replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
const formatSSN = (value: string) => value.replace(/\D/g, '').slice(0, 9).replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3');
const fileToBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => res((reader.result as string).split(',')[1]);
  reader.onerror = error => rej(error);
});

// --- RECAPTCHA COMPONENT ---
const ReCAPTCHA = ({ onVerify, sitekey }: { onVerify: (token: string | null) => void; sitekey: string; }) => {
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    const loadCaptcha = () => {
        const a = window as any;
        if (a.grecaptcha && a.grecaptcha.render && recaptchaRef.current && !renderedRef.current) {
            try {
                a.grecaptcha.render(recaptchaRef.current, {
                    sitekey: sitekey,
                    callback: (token: string) => onVerify(token),
                    'expired-callback': () => onVerify(null),
                });
                renderedRef.current = true;
            } catch(e) {
                console.error("Recaptcha render error", e);
            }
        }
    };

    if ((window as any).grecaptcha?.render) {
        loadCaptcha();
    } else {
        // Poll for script load in case of async/defer delay
        const interval = setInterval(() => {
            if ((window as any).grecaptcha?.render) {
                clearInterval(interval);
                loadCaptcha();
            }
        }, 500);
        return () => clearInterval(interval);
    }
  }, [onVerify, sitekey]);

  return <div ref={recaptchaRef} className="min-h-[78px] flex justify-center"></div>;
};

// --- ONBOARDING FLOW ---

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onBackToLanding, onSuccess, googleClientId, recaptchaSiteKey }) => {
  const [step, setStep] = useState<StepId>('account');
  const [formData, setFormData] = useState<any>({ availDays: [] });
  const [formErrors, setFormErrors] = useState<any>({});
  
  const [isComplete, setIsComplete] = useState(false);
  const [isStepLoading, setIsStepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleDataChange = (field: string, value: any) => setFormData((prev: any) => ({ ...prev, [field]: value }));

  const STEPS: StepId[] = ['account', 'personal', 'background', 'availability', 'role', 'details', 'compliance', 'orientation'];
  const currentStepIndex = STEPS.indexOf(step);

  const prevStep = () => { if (currentStepIndex > 0) setStep(STEPS[currentStepIndex - 1]); };
  
  const validateAndProceed = async () => {
    const errors: any = {};
    if (step === 'account') {
        if (!formData.emailVerified) errors.email = "Please verify your email address to continue.";
        if (evaluatePasswordStrength(formData.password || '').score < 1) errors.password = "Your password does not meet all strength requirements.";
        if (formData.password !== formData.verifyPassword) errors.verifyPassword = "Passwords do not match.";
    }
    if (step === 'personal') {
        if (!formData.legalFirstName || !formData.legalLastName) errors.legalName = "Legal first and last name are required.";
        const age = calculateAge(formData.dob);
        if (!formData.dob || age === 0) errors.dob = "Please enter a valid date of birth.";
        else if (age < 18) errors.dob = "You must be at least 18 to volunteer.";

        if ((formData.phone || '').replace(/\D/g, '').length !== 10) errors.phone = "A valid 10-digit phone number is required.";
        if (!formData.address || !formData.city || !formData.state || !formData.zipCode) errors.address = "A complete physical address is required.";
        if (!/^[A-Z]{2}$/.test(formData.state || '')) errors.address = "Please enter a valid 2-letter state abbreviation.";
        if (!/^\d{5}$/.test(formData.zipCode || '')) errors.address = "Please enter a valid 5-digit zip code.";
        
        if (!formData.eContactName || !formData.eContactRelationship || !formData.eContactCellPhone) errors.eContact = "All emergency contact fields are required.";
        else if ((formData.eContactCellPhone || '').replace(/\D/g, '').length !== 10) errors.eContact = "A valid 10-digit emergency contact phone number is required.";
        
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (formData.eContactEmail && !emailRegex.test(formData.eContactEmail)) errors.eContactEmail = "Please enter a valid emergency contact email.";
    }
    if (step === 'role') {
        if (!formData.resumeFile) errors.resume = "Please upload your resume to continue.";
        if (!formData.selectedRole) errors.selectedRole = "Please confirm your desired volunteer role.";
    }
     if (step === 'details') {
        if (!formData.roleAssessment || formData.roleAssessment.some((a: any) => !a.answer.trim())) errors.details = "Please answer all role-specific questions.";
    }
    if (step === 'compliance') {
        const requiredConsents = ['ageVerified', 'backgroundCheckConsent', 'ssnAuthorizationConsent', 'termsAgreed'];
        if (formData.selectedRole?.includes('Medical')) requiredConsents.push('hipaaAcknowledgment');
        if (requiredConsents.some(c => !formData[c])) errors.compliance = "You must agree to all required terms to proceed.";
        if (!formData.signature || formData.signature.trim().toLowerCase() !== `${formData.legalFirstName} ${formData.legalLastName}`.trim().toLowerCase()) errors.signature = "Your signature must exactly match your full legal name.";
    }
    
    setFormErrors(errors);
    if (Object.keys(errors).length === 0) {
      if (step === 'account') {
        setStep(STEPS[currentStepIndex + 1]);
        return;
      }
      if (currentStepIndex < STEPS.length - 1) {
        analyticsService.logEvent('onboarding_step_complete', { step });
        setStep(STEPS[currentStepIndex + 1]);
      }
    }
  };

  const handleFinalSubmit = async () => {
    const errors: any = {};
    if (!formData.watchedIntro || !formData.watchedChampion) errors.orientation = "You must acknowledge both orientation modules.";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    
    setSubmitting(true);
    setSubmitError('');
    try {
      analyticsService.logEvent('application_submitted', { role: formData.selectedRole });
      
      let trainingPlan;
      try {
          trainingPlan = await geminiService.generateTrainingPlan(formData.selectedRole, 'General interest.');
      } catch (e) {
          console.warn("AI Plan generation skipped, utilizing default plan.");
          trainingPlan = {
            role: formData.selectedRole,
            orientationModules: [
              { id: 'default-1', title: 'Welcome to HMC', objective: 'Understand our mission.', estimatedMinutes: 10 },
            ],
            completionGoal: 'Complete basic orientation.',
            coachSummary: 'Standard onboarding track.'
          };
      }
      
      const roleConfig = APP_CONFIG.HMC_ROLES.find(r => r.label === formData.selectedRole);
      const compliance: { [key: string]: any } = {};
      const complianceLabels: {[key:string]: string} = {
          application: 'Application Submitted',
          backgroundCheck: 'Background Check',
          training: 'Orientation Training',
          orientation: 'Live Orientation',
          liveScan: 'Live Scan Fingerprinting'
      };

      roleConfig?.complianceRequirements.forEach(req => {
        compliance[req] = {
          id: `c-${req}`,
          label: complianceLabels[req] || req,
          status: req === 'application' ? 'verified' : 'pending'
        };
      });

      const v: Omit<Volunteer, 'id'> = {
        tenantId: 'hmc-health', email: formData.email, legalFirstName: formData.legalFirstName, middleName: formData.middleName,
        legalLastName: formData.legalLastName, preferredFirstName: formData.preferredFirstName, preferredLastName: formData.preferredLastName,
        dob: formData.dob, gender: formData.gender || 'Prefer not to say', name: `${formData.preferredFirstName || formData.legalFirstName} ${formData.preferredLastName || formData.legalLastName}`,
        phone: formData.phone, address: formData.address, city: formData.city, state: formData.state, zipCode: formData.zipCode, mailingAddressSame: true,
        emergencyContact: { name: formData.eContactName, relationship: formData.eContactRelationship, email: formData.eContactEmail || '', cellPhone: formData.eContactCellPhone },
        school: formData.school, degree: formData.degree, hmcAffiliation: [], volunteerStatus: 'new', gainFromExperience: formData.gainFromExperience || '', 
        interestedIn: '', howDidYouHear: formData.howDidYouHear, timeCommitment: formData.timeCommitment, isEmployed: formData.isEmployed || false, 
        isStudent: formData.isStudent || false, tshirtSize: formData.tshirtSize, 
        role: 'HMC Champion', 
        appliedRole: formData.selectedRole,
        skills: [],
        trainingPlan, 
        status: 'active',
        applicationStatus: 'pendingReview', 
        joinedDate: new Date().toISOString().split('T')[0], 
        onboardingProgress: 100,
        isAdmin: false, 
        points: 100, 
        hoursContributed: 0, 
        isNewUser: false,
        compliance: compliance as Volunteer['compliance'],
        availability: { days: formData.availDays || [], preferredTime: formData.preferredTime, startDate: formData.startDate, notes: formData.schedulingLimitations || '', servicePreference: formData.servicePreference, timezone: formData.timezone, hoursPerWeek: formData.hoursPerWeek },
        tasks: [], 
        achievements: [{ id: 'a-wel', title: 'Welcome to the Team!', icon: 'Heart', dateEarned: new Date().toISOString() }], 
        roleAssessment: formData.roleAssessment,
      };
      
      const response = await apiService.post('/auth/signup', { user: v, password: formData.password }, 90000);
      
      if (response && response.token && onSuccess) {
          onSuccess();
      } else {
          setIsComplete(true);
      }
    } catch (error) {
      setSubmitError((error as Error).message || 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  const stepProps = { data: formData, onChange: handleDataChange, errors: formErrors, setErrors: setFormErrors };
  
  const renderStepContent = () => {
    switch(step) {
      case 'account': return <AccountStep {...stepProps} onContinue={validateAndProceed} googleClientId={googleClientId} recaptchaSiteKey={recaptchaSiteKey} />;
      case 'personal': return <PersonalStep {...stepProps} />;
      case 'background': return <BackgroundStep {...stepProps} />;
      case 'availability': return <AvailabilityStep {...stepProps} />;
      case 'role': return <RoleStep {...stepProps} isStepLoading={isStepLoading} setIsStepLoading={setIsStepLoading} />;
      case 'details': return <DetailsStep {...stepProps} onChange={handleDataChange} />;
      case 'compliance': return <ComplianceStep {...stepProps} />;
      case 'orientation': return <OrientationStep {...stepProps} onSubmit={handleFinalSubmit} isLoading={submitting} submitError={submitError} />;
      default: return null;
    }
  };
  
  if (isComplete) {
    return (
      <div className="max-w-4xl w-full bg-white rounded-[40px] shadow-2xl border border-zinc-100 p-10 md:p-16 relative overflow-hidden">
        <div className="text-center py-20 animate-in fade-in">
            <CheckCircle size={64} className="mx-auto text-emerald-500 mb-6" />
            <h2 className="text-3xl font-black text-zinc-900">Application Submitted!</h2>
            <p className="text-zinc-500 mt-4 max-w-md mx-auto">Thank you for applying to volunteer with Health Matters Clinic. Our team will review your application and you will receive an email notification regarding your status soon.</p>
            <button onClick={onBackToLanding} className="mt-8 px-8 py-4 bg-[#233DFF] text-white rounded-full font-black text-sm uppercase tracking-widest">Return to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center p-6 md:p-12 font-['Inter']">
       <div className="w-full max-w-4xl my-4">
         <button onClick={onBackToLanding} className="text-sm font-bold text-zinc-500 hover:text-zinc-800 flex items-center gap-2">← Return to Welcome Page</button>
       </div>
       <div className={`max-w-4xl w-full bg-white rounded-[40px] shadow-2xl border border-zinc-100 ${step === 'account' ? 'p-10 md:p-12' : 'p-10 md:p-16'} relative overflow-hidden`}>
        {renderStepContent()}
        {step !== 'account' && (
          <div className="flex items-center gap-4 pt-8 mt-8 border-t border-zinc-100">
            {currentStepIndex > 0 && <button onClick={prevStep} className="py-5 px-10 border border-zinc-200 rounded-full font-black text-xs uppercase disabled:opacity-50">Back</button>}
            {step !== 'orientation' && <button onClick={validateAndProceed} disabled={isStepLoading} className="flex-1 py-5 bg-[#233DFF] text-white rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed">
              {isStepLoading ? <Loader2 className="animate-spin" /> : <>Continue <ArrowRight className="group-hover:translate-x-2 transition-transform" /></>}
              </button>}
          </div>
        )}
      </div>
    </div>
  );
};


// --- STEP COMPONENTS ---

const AccountStep: React.FC<any> = ({ data, onChange, errors, onContinue, googleClientId, recaptchaSiteKey }) => {
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(!recaptchaSiteKey ? 'bypass' : null);

  const [showPassword, setShowPassword] = useState(false);
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);

  const emailRegex = /^\S+@\S+\.\S+$/;
  const passwordStrength = useMemo(() => evaluatePasswordStrength(data.password || ''), [data.password]);

  const canContinue = data.emailVerified && passwordStrength.score === 1 && data.password === data.verifyPassword && !!captchaToken;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    onChange('email', email);
    setIsValidEmail(emailRegex.test(email));
    if (data.emailVerified) {
        onChange('emailVerified', false);
        setSent(false);
        setVerificationCode('');
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
        const tempUser = await apiService.post('/auth/decode-google-token', { credential: credentialResponse.credential });
        onChange('email', tempUser.email);
        onChange('password', `SocialLogin!P@ssword${Date.now()}`);
        onChange('verifyPassword', `SocialLogin!P@ssword${Date.now()}`);
        onChange('emailVerified', true);
        setIsValidEmail(true);
        setSent(true);
        setCaptchaToken('google-oauth-bypass');
        setTimeout(() => onContinue(), 200);
    } catch (e) {
        console.error("Google Sign-up failed", e);
        alert("Could not process Google sign-up. Please sign up manually.");
    }
  };

  const handleSendVerification = async () => {
    if (!isValidEmail || verifying || data.emailVerified) return;
    if (recaptchaSiteKey && !captchaToken) {
        alert("Please complete the reCAPTCHA verification first.");
        return;
    }
    setVerifying(true);
    try {
        await apiService.post('/auth/send-verification', { email: data.email, captchaToken });
        setSent(true);
    } catch (err) {
        alert((err as Error).message || "Failed to send verification code. Please try again.");
    } finally {
        setVerifying(false);
    }
  };
  
  const handleConfirmCode = async () => {
    setCodeError('');
    try {
        const res = await apiService.post('/auth/verify-code', { email: data.email, code: verificationCode });
        if (res && res.valid) {
            onChange('emailVerified', true);
        } else {
            setCodeError(res?.message || 'Invalid code');
        }
    } catch (err) {
        setCodeError('Validation failed. Code may be expired.');
    }
  };

  return (
     <div className="space-y-8 animate-in fade-in">
        <h2 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic leading-none">Create Your Volunteer Account</h2>
        
        {googleClientId && (
            <>
                <div className="w-full">
                    <GoogleLogin 
                        onSuccess={handleGoogleSuccess} 
                        onError={() => alert("Google sign-up failed. Please try again.")} 
                        theme="outline" 
                        shape="pill" 
                        text="signup_with"
                    />
                </div>
                <div className="flex items-center gap-4 py-2">
                    <div className="flex-1 h-px bg-zinc-100" />
                    <span className="text-xs font-medium text-zinc-400 uppercase">Or</span>
                    <div className="flex-1 h-px bg-zinc-100" />
                </div>
            </>
        )}

        <div className="space-y-6">
            <div>
                <label className="text-sm font-bold text-zinc-600 block mb-2">Email Address</label>
                <div className="flex gap-3">
                  <input type="email" value={data.email || ''} onChange={handleEmailChange} placeholder="your.email@example.com" readOnly={sent && data.emailVerified} autoComplete="off" className={`flex-1 px-5 py-4 bg-zinc-50 border rounded-lg outline-none font-medium ${errors.email ? 'border-rose-500' : 'border-zinc-200'} read-only:bg-zinc-100`} />
                  {data.emailVerified ? (
                     <div className="py-4 px-6 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 bg-[#86EFAC] text-emerald-800">
                        <Check size={16} /> Verified
                     </div>
                  ) : (
                     <button onClick={handleSendVerification} disabled={!isValidEmail || verifying || sent || (recaptchaSiteKey && !captchaToken)} className="py-4 px-6 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-50 bg-zinc-200 text-zinc-600 hover:bg-zinc-300 w-32">
                        {verifying ? <Loader2 className="animate-spin" size={16}/> : sent ? 'Sent' : 'Verify'}
                     </button>
                  )}
                </div>
                {sent && !data.emailVerified && 
                  <div className="mt-4 space-y-2 animate-in fade-in">
                    <p className="text-xs font-bold text-sky-600">A verification code has been sent to your email. Please check your inbox.</p>
                    <div className="flex gap-3">
                        <input type="text" value={verificationCode} onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0,6))} placeholder="6-digit code" maxLength={6} className="flex-1 px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg font-bold tracking-[0.5em] text-center" />
                        <button onClick={handleConfirmCode} className="py-4 px-6 bg-zinc-800 text-white font-bold text-xs uppercase rounded-lg">Confirm</button>
                    </div>
                    {codeError && <div className="flex items-center gap-2 text-rose-500 text-xs font-bold mt-1"><AlertCircle size={12}/>{codeError}</div>}
                  </div>
                }
                {recaptchaSiteKey && !sent && !data.emailVerified && isValidEmail && (
                  <div className="mt-4">
                    <p className="text-xs text-zinc-500 mb-2">Complete reCAPTCHA to verify your email:</p>
                    <ReCAPTCHA sitekey={recaptchaSiteKey} onVerify={setCaptchaToken} />
                  </div>
                )}
                {errors.email && <p className="text-rose-500 text-xs font-bold mt-2">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                    <label className="text-sm font-bold text-zinc-600 block mb-2">Password</label>
                    <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={data.password || ''} onChange={e => onChange('password', e.target.value)} autoComplete="new-password" className={`w-full px-5 py-4 bg-zinc-50 border rounded-lg outline-none font-medium pr-12 ${errors.password ? 'border-rose-500' : 'border-zinc-200'}`} />
                     <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 bottom-4 text-zinc-400 hover:text-zinc-600">{showPassword ? <EyeOff size={20}/>:<Eye size={20}/>}</button>
                </div>
                 <div className="relative">
                    <label className="text-sm font-bold text-zinc-600 block mb-2">Verify Password</label>
                    <input type={showVerifyPassword ? 'text' : 'password'} placeholder="Verify Password" value={data.verifyPassword || ''} onChange={e => onChange('verifyPassword', e.target.value)} autoComplete="new-password" className={`w-full px-5 py-4 bg-zinc-50 border rounded-lg outline-none font-medium pr-12 ${errors.verifyPassword ? 'border-rose-500' : 'border-zinc-200'}`} />
                    <button type="button" onClick={() => setShowVerifyPassword(!showVerifyPassword)} className="absolute right-4 bottom-4 text-zinc-400 hover:text-zinc-600">{showVerifyPassword ? <EyeOff size={20}/>:<Eye size={20}/>}</button>
                </div>
            </div>
            {data.password && (
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-2 pt-2">
                    {passwordStrength.checks.map(check => (
                        <div key={check.label} className={`flex items-center gap-2 text-xs font-bold ${check.passed ? 'text-emerald-600' : 'text-zinc-400'}`}>
                           {check.passed ? <Check size={14}/> : <X size={14}/>} {check.label}
                        </div>
                    ))}
                 </div>
             )}
             {data.password && data.password !== data.verifyPassword && data.verifyPassword && <p className="text-rose-500 text-xs font-bold">Passwords do not match.</p>}
        </div>

        <div className="pt-6">
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className="w-full py-5 bg-[#233DFF] text-white rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue <ArrowRight className="group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>
    );
};

export { AccountStep };
export default OnboardingFlow;