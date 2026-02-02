
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
        // Skip password validation for Google OAuth users
        if (!formData.passwordBypassed) {
            if (evaluatePasswordStrength(formData.password || '').score < 1) errors.password = "Your password does not meet all strength requirements.";
            if (formData.password !== formData.verifyPassword) errors.verifyPassword = "Passwords do not match.";
        }
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
        school: formData.school, degree: formData.degree, hmcAffiliation: [], gainFromExperience: formData.gainFromExperience || '',
        interestedIn: '', howDidYouHear: formData.howDidYouHear, timeCommitment: formData.timeCommitment, isEmployed: formData.isEmployed || false,
        isStudent: formData.isStudent || false, tshirtSize: formData.tshirtSize,

        // Identity fields (required by v4.0)
        identityLabel: 'HMC Champion',
        volunteerRole: (formData.selectedRole as Volunteer['volunteerRole']) || 'Core Volunteer',
        role: formData.selectedRole || 'Core Volunteer',
        appliedRole: formData.selectedRole,

        // Core Volunteer Training status (starts false until training complete)
        coreVolunteerStatus: false,

        // Event eligibility (all false until training complete)
        eventEligibility: {
          canDeployCore: false,
          streetMedicineGate: false,
          clinicGate: false,
          healthFairGate: false,
          naloxoneDistribution: false,
          oraQuickDistribution: false,
          qualifiedEventTypes: []
        },

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
        // Mark orientation videos as completed if watched during onboarding
        completedTrainingIds: [
          ...(formData.watchedIntro ? ['hmc_get_to_know_us'] : []),
          ...(formData.watchedChampion ? ['hmc_because_champion'] : []),
        ],
      };
      
      // Google OAuth users use their credential, email users use password
      const authPayload = formData.authProvider === 'google'
        ? { user: v, googleCredential: formData.googleCredential }
        : { user: v, password: formData.password };
      const response = await apiService.post('/auth/signup', authPayload, 90000);
      
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
            <button onClick={onBackToLanding} className="mt-8 px-8 py-4 bg-[#233DFF] border border-black text-white rounded-full font-black text-sm uppercase tracking-widest flex items-center gap-3 mx-auto hover:scale-105 active:scale-95 transition-all">
              <div className="w-2 h-2 rounded-full bg-white" />
              Return to Home
            </button>
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
            {currentStepIndex > 0 && <button onClick={prevStep} className="py-5 px-10 bg-white border border-black text-zinc-900 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
              <div className="w-2 h-2 rounded-full bg-black" />
              Back
            </button>}
            {step !== 'orientation' && <button onClick={validateAndProceed} disabled={isStepLoading} className="flex-1 py-5 bg-[#233DFF] border border-black text-white rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all">
              {isStepLoading ? <Loader2 className="animate-spin" /> : <><div className="w-2 h-2 rounded-full bg-white" /> Continue <ArrowRight className="group-hover:translate-x-2 transition-transform" /></>}
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
  const [googleProcessed, setGoogleProcessed] = useState(false);

  const emailRegex = /^\S+@\S+\.\S+$/;
  const passwordStrength = useMemo(() => evaluatePasswordStrength(data.password || ''), [data.password]);

  // Google OAuth users bypass password requirements
  const canContinue = data.emailVerified && (data.passwordBypassed || (passwordStrength.score === 1 && data.password === data.verifyPassword)) && !!captchaToken;

  // Auto-proceed for Google OAuth users once state is updated
  useEffect(() => {
    if (data.authProvider === 'google' && data.emailVerified && data.passwordBypassed && !googleProcessed) {
      setGoogleProcessed(true);
      onContinue();
    }
  }, [data.authProvider, data.emailVerified, data.passwordBypassed, googleProcessed, onContinue]);

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
        onChange('authProvider', 'google');
        onChange('googleCredential', credentialResponse.credential);
        onChange('emailVerified', true);
        // Google OAuth users don't need passwords - mark as bypassed
        onChange('passwordBypassed', true);
        setIsValidEmail(true);
        setSent(true);
        setCaptchaToken('google-oauth-bypass');
        // useEffect will auto-proceed once state updates
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

// --- PERSONAL STEP ---
const PersonalStep: React.FC<any> = ({ data, onChange, errors }) => {
  return (
    <div className="space-y-8 animate-in fade-in">
      <h2 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic">Personal Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Legal First Name *</label>
          <input type="text" value={data.legalFirstName || ''} onChange={e => onChange('legalFirstName', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="John" />
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Legal Last Name *</label>
          <input type="text" value={data.legalLastName || ''} onChange={e => onChange('legalLastName', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="Doe" />
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Middle Name</label>
          <input type="text" value={data.middleName || ''} onChange={e => onChange('middleName', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="Optional" />
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Preferred First Name</label>
          <input type="text" value={data.preferredFirstName || ''} onChange={e => onChange('preferredFirstName', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="Optional" />
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Date of Birth *</label>
          <input type="date" value={data.dob || ''} onChange={e => onChange('dob', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" />
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Gender</label>
          <select value={data.gender || ''} onChange={e => onChange('gender', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg">
            <option value="">Select...</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Phone Number *</label>
          <input type="tel" value={data.phone || ''} onChange={e => onChange('phone', formatPhoneNumber(e.target.value))} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="(555) 123-4567" />
        </div>
      </div>
      {errors.legalName && <p className="text-rose-500 text-sm font-bold">{errors.legalName}</p>}
      {errors.dob && <p className="text-rose-500 text-sm font-bold">{errors.dob}</p>}
      {errors.phone && <p className="text-rose-500 text-sm font-bold">{errors.phone}</p>}

      <h3 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase italic pt-4">Address</h3>
      <div className="grid grid-cols-1 gap-6">
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Street Address *</label>
          <input type="text" value={data.address || ''} onChange={e => onChange('address', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="123 Main St" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-bold text-zinc-600 block mb-2">City *</label>
            <input type="text" value={data.city || ''} onChange={e => onChange('city', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="Los Angeles" />
          </div>
          <div>
            <label className="text-sm font-bold text-zinc-600 block mb-2">State *</label>
            <input type="text" value={data.state || ''} onChange={e => onChange('state', e.target.value.toUpperCase().slice(0,2))} maxLength={2} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="CA" />
          </div>
          <div>
            <label className="text-sm font-bold text-zinc-600 block mb-2">Zip Code *</label>
            <input type="text" value={data.zipCode || ''} onChange={e => onChange('zipCode', e.target.value.replace(/\D/g, '').slice(0,5))} maxLength={5} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="90001" />
          </div>
        </div>
      </div>
      {errors.address && <p className="text-rose-500 text-sm font-bold">{errors.address}</p>}

      <h3 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase italic pt-4">Emergency Contact</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Contact Name *</label>
          <input type="text" value={data.eContactName || ''} onChange={e => onChange('eContactName', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="Jane Doe" />
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Relationship *</label>
          <input type="text" value={data.eContactRelationship || ''} onChange={e => onChange('eContactRelationship', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="Spouse, Parent, etc." />
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Phone Number *</label>
          <input type="tel" value={data.eContactCellPhone || ''} onChange={e => onChange('eContactCellPhone', formatPhoneNumber(e.target.value))} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="(555) 123-4567" />
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Email (Optional)</label>
          <input type="email" value={data.eContactEmail || ''} onChange={e => onChange('eContactEmail', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="jane@example.com" />
        </div>
      </div>
      {errors.eContact && <p className="text-rose-500 text-sm font-bold">{errors.eContact}</p>}
      {errors.eContactEmail && <p className="text-rose-500 text-sm font-bold">{errors.eContactEmail}</p>}
    </div>
  );
};

// --- BACKGROUND STEP ---
const BackgroundStep: React.FC<any> = ({ data, onChange, errors }) => {
  return (
    <div className="space-y-8 animate-in fade-in">
      <h2 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic">Background & Education</h2>
      <p className="text-zinc-500">Tell us a bit about your background. This helps us match you with the right volunteer opportunities.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Are you currently a student?</label>
          <select value={data.isStudent ? 'yes' : 'no'} onChange={e => onChange('isStudent', e.target.value === 'yes')} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Are you currently employed?</label>
          <select value={data.isEmployed ? 'yes' : 'no'} onChange={e => onChange('isEmployed', e.target.value === 'yes')} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        {data.isStudent && (
          <>
            <div>
              <label className="text-sm font-bold text-zinc-600 block mb-2">School/University</label>
              <input type="text" value={data.school || ''} onChange={e => onChange('school', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="UCLA, USC, etc." />
            </div>
            <div>
              <label className="text-sm font-bold text-zinc-600 block mb-2">Degree/Program</label>
              <input type="text" value={data.degree || ''} onChange={e => onChange('degree', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder="BS Nursing, MPH, etc." />
            </div>
          </>
        )}
      </div>
      <div>
        <label className="text-sm font-bold text-zinc-600 block mb-2">How did you hear about Health Matters Clinic?</label>
        <select value={data.howDidYouHear || ''} onChange={e => onChange('howDidYouHear', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg">
          <option value="">Select...</option>
          <option value="Social Media">Social Media</option>
          <option value="Friend/Family">Friend/Family</option>
          <option value="School/University">School/University</option>
          <option value="Community Event">Community Event</option>
          <option value="Web Search">Web Search</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-bold text-zinc-600 block mb-2">What do you hope to gain from this volunteer experience?</label>
        <textarea value={data.gainFromExperience || ''} onChange={e => onChange('gainFromExperience', e.target.value)} rows={4} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg resize-none" placeholder="Share your goals and motivations..." />
      </div>
    </div>
  );
};

// --- AVAILABILITY STEP ---
const AvailabilityStep: React.FC<any> = ({ data, onChange, errors }) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const times = ['Morning (8am-12pm)', 'Afternoon (12pm-5pm)', 'Evening (5pm-9pm)', 'Flexible'];
  const toggleDay = (day: string) => {
    const current = data.availDays || [];
    onChange('availDays', current.includes(day) ? current.filter((d: string) => d !== day) : [...current, day]);
  };
  return (
    <div className="space-y-8 animate-in fade-in">
      <h2 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic">Availability</h2>
      <div>
        <label className="text-sm font-bold text-zinc-600 block mb-4">Which days are you typically available? *</label>
        <div className="flex flex-wrap gap-3">
          {days.map(day => (
            <button key={day} type="button" onClick={() => toggleDay(day)} className={`px-5 py-3 rounded-full text-sm font-bold transition-all ${(data.availDays || []).includes(day) ? 'bg-[#233DFF] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
              {day}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm font-bold text-zinc-600 block mb-4">Preferred time of day? *</label>
        <div className="flex flex-wrap gap-3">
          {times.map(time => (
            <button key={time} type="button" onClick={() => onChange('preferredTime', time)} className={`px-5 py-3 rounded-full text-sm font-bold transition-all ${data.preferredTime === time ? 'bg-[#233DFF] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
              {time}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">When can you start? *</label>
          <input type="date" value={data.startDate || ''} onChange={e => onChange('startDate', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" />
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Hours per week you can commit</label>
          <select value={data.hoursPerWeek || ''} onChange={e => onChange('hoursPerWeek', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg">
            <option value="">Select...</option>
            <option value="1-4">1-4 hours</option>
            <option value="5-10">5-10 hours</option>
            <option value="11-20">11-20 hours</option>
            <option value="20+">20+ hours</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-bold text-zinc-600 block mb-2">Any scheduling limitations we should know about?</label>
        <textarea value={data.schedulingLimitations || ''} onChange={e => onChange('schedulingLimitations', e.target.value)} rows={3} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg resize-none" placeholder="e.g., unavailable on certain dates, etc." />
      </div>
    </div>
  );
};

// --- ROLE STEP (with Resume Upload and AI) ---
const RoleStep: React.FC<any> = ({ data, onChange, errors, isStepLoading, setIsStepLoading }) => {
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [extractedSkills, setExtractedSkills] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onChange('resumeFile', { name: file.name, type: file.type });
    setIsStepLoading(true);
    setAnalysisError(null);

    try {
      const base64 = await fileToBase64(file);
      const result = await geminiService.analyzeResume(base64, file.type);

      // Check if AI returned recommendations
      if (result?.recommendations && result.recommendations.length > 0) {
        setAiRecommendations(result.recommendations);
        setExtractedSkills(result.extractedSkills || []);
        // Auto-select the top recommendation
        onChange('selectedRole', result.recommendations[0].roleName);
      } else {
        // AI returned empty recommendations - show message and let user select manually
        const errorMsg = result?.error || 'Unable to analyze resume. Please select a role manually.';
        setAnalysisError(errorMsg);
        console.warn('[Resume Analysis]', errorMsg);
      }
    } catch (err) {
      console.error('Resume analysis failed:', err);
      setAnalysisError('Resume analysis failed. Please select a role manually.');
    } finally {
      setIsStepLoading(false);
    }
  };

  const availableRoles = APP_CONFIG.HMC_ROLES.filter(r => r.category !== 'admin').map(r => r.label);

  return (
    <div className="space-y-8 animate-in fade-in">
      <h2 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic">Role Selection</h2>

      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-8">
        <div className="flex items-center gap-4 mb-4">
          <UploadCloud size={32} className="text-[#233DFF]" />
          <div>
            <h3 className="font-bold text-zinc-900">Upload Your Resume</h3>
            <p className="text-sm text-zinc-500">Our AI will analyze your skills and recommend the best roles</p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current?.click()} disabled={isStepLoading} className="w-full py-4 border-2 border-dashed border-zinc-300 rounded-xl hover:border-[#233DFF] transition-colors flex items-center justify-center gap-3 text-zinc-600 font-bold">
          {isStepLoading ? <Loader2 className="animate-spin" /> : data.resumeFile ? <><CheckCircle className="text-emerald-500" /> {data.resumeFile.name}</> : 'Click to upload PDF or DOC'}
        </button>
      </div>
      {errors.resume && <p className="text-rose-500 text-sm font-bold">{errors.resume}</p>}

      {analysisError && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-amber-800 text-sm font-medium">{analysisError}</p>
            <p className="text-amber-600 text-xs mt-1">You can still select a role from the dropdown below.</p>
          </div>
        </div>
      )}

      {aiRecommendations.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-zinc-900">AI Recommended Roles</h3>
          {aiRecommendations.map((rec, i) => (
            <button key={i} onClick={() => onChange('selectedRole', rec.roleName)} className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${data.selectedRole === rec.roleName ? 'border-[#233DFF] bg-blue-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
              <div className="flex justify-between items-center">
                <span className="font-bold text-zinc-900">{rec.roleName}</span>
                <span className="text-sm font-bold text-[#233DFF]">{rec.matchPercentage}% Match</span>
              </div>
              <p className="text-sm text-zinc-500 mt-2">{rec.reasoning}</p>
            </button>
          ))}
        </div>
      )}

      {extractedSkills.length > 0 && (
        <div>
          <h4 className="font-bold text-zinc-700 mb-3">Detected Skills</h4>
          <div className="flex flex-wrap gap-2">
            {extractedSkills.map((skill, i) => (
              <span key={i} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">{skill}</span>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-bold text-zinc-900 mb-4">{aiRecommendations.length > 0 ? 'Or select a different role:' : 'Select your preferred role:'}</h3>
        <select
          value={data.selectedRole || ''}
          onChange={(e) => onChange('selectedRole', e.target.value)}
          className="w-full p-4 rounded-xl border-2 border-zinc-200 bg-white text-zinc-900 font-bold text-lg focus:border-[#233DFF] focus:ring-2 focus:ring-[#233DFF]/20 outline-none transition-all appearance-none cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23666'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5rem' }}
        >
          <option value="" disabled>Choose a volunteer role...</option>
          {availableRoles.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </div>
      {errors.selectedRole && <p className="text-rose-500 text-sm font-bold">{errors.selectedRole}</p>}
    </div>
  );
};

// --- DETAILS STEP ---
const DetailsStep: React.FC<any> = ({ data, onChange, errors }) => {
  const roleConfig = APP_CONFIG.HMC_ROLES.find(r => r.label === data.selectedRole);
  const questions = roleConfig?.applicationQuestions || [
    "Why are you interested in volunteering with Health Matters Clinic?",
    "What relevant experience do you have?",
    "How do you handle challenging situations?"
  ];

  useEffect(() => {
    if (!data.roleAssessment || data.roleAssessment.length !== questions.length) {
      onChange('roleAssessment', questions.map((q, i) => ({ question: q, answer: data.roleAssessment?.[i]?.answer || '' })));
    }
  }, [data.selectedRole]);

  const handleAnswerChange = (index: number, answer: string) => {
    const updated = [...(data.roleAssessment || [])];
    updated[index] = { ...updated[index], answer };
    onChange('roleAssessment', updated);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <h2 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic">Role-Specific Questions</h2>
      <p className="text-zinc-500">Please answer the following questions for the <strong>{data.selectedRole}</strong> role.</p>
      <div className="space-y-6">
        {(data.roleAssessment || []).map((item: any, index: number) => (
          <div key={index}>
            <label className="text-sm font-bold text-zinc-600 block mb-2">{item.question}</label>
            <textarea value={item.answer || ''} onChange={e => handleAnswerChange(index, e.target.value)} rows={4} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg resize-none" placeholder="Your answer..." />
          </div>
        ))}
      </div>
      {errors.details && <p className="text-rose-500 text-sm font-bold">{errors.details}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">T-Shirt Size</label>
          <select value={data.tshirtSize || ''} onChange={e => onChange('tshirtSize', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg">
            <option value="">Select...</option>
            <option value="XS">XS</option>
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
            <option value="XL">XL</option>
            <option value="2XL">2XL</option>
            <option value="3XL">3XL</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-zinc-600 block mb-2">Expected Time Commitment</label>
          <select value={data.timeCommitment || ''} onChange={e => onChange('timeCommitment', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg">
            <option value="">Select...</option>
            <option value="One-time event">One-time event</option>
            <option value="Weekly">Weekly</option>
            <option value="Bi-weekly">Bi-weekly</option>
            <option value="Monthly">Monthly</option>
            <option value="As needed">As needed</option>
          </select>
        </div>
      </div>
    </div>
  );
};

// --- COMPLIANCE STEP ---
const ComplianceStep: React.FC<any> = ({ data, onChange, errors }) => {
  const isMedicalRole = data.selectedRole?.includes('Medical') || data.selectedRole?.includes('Licensed');

  const ConsentCheckbox = ({ field, label, required = true }: { field: string; label: string; required?: boolean }) => (
    <button type="button" onClick={() => onChange(field, !data[field])} className="flex items-start gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200 hover:border-zinc-300 transition-all text-left w-full">
      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${data[field] ? 'bg-[#233DFF] border-[#233DFF]' : 'border-zinc-300'}`}>
        {data[field] && <Check size={16} className="text-white" />}
      </div>
      <span className="text-sm text-zinc-700">{label} {required && <span className="text-rose-500">*</span>}</span>
    </button>
  );

  return (
    <div className="space-y-8 animate-in fade-in">
      <h2 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic">Compliance & Consent</h2>
      <p className="text-zinc-500">Please review and agree to the following requirements.</p>

      <div className="space-y-4">
        <ConsentCheckbox field="ageVerified" label="I confirm that I am at least 18 years of age." />
        <ConsentCheckbox field="backgroundCheckConsent" label="I consent to a background check as part of the volunteer application process." />
        <ConsentCheckbox field="ssnAuthorizationConsent" label="I authorize Health Matters Clinic to verify my identity using my provided information." />
        {isMedicalRole && (
          <ConsentCheckbox field="hipaaAcknowledgment" label="I acknowledge that I will be required to complete HIPAA training and maintain patient confidentiality." />
        )}
        <ConsentCheckbox field="termsAgreed" label="I agree to the Health Matters Clinic Volunteer Terms of Service and Code of Conduct." />
      </div>
      {errors.compliance && <p className="text-rose-500 text-sm font-bold">{errors.compliance}</p>}

      <div className="pt-4">
        <label className="text-sm font-bold text-zinc-600 block mb-2">Electronic Signature *</label>
        <p className="text-xs text-zinc-500 mb-3">Please type your full legal name exactly as it appears above to serve as your electronic signature.</p>
        <input type="text" value={data.signature || ''} onChange={e => onChange('signature', e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-lg" placeholder={`${data.legalFirstName || 'First'} ${data.legalLastName || 'Last'}`} />
        {data.signature && data.signature.trim().toLowerCase() === `${data.legalFirstName} ${data.legalLastName}`.trim().toLowerCase() && (
          <p className="text-emerald-600 text-xs font-bold mt-2 flex items-center gap-2"><Check size={14} /> Signature verified</p>
        )}
      </div>
      {errors.signature && <p className="text-rose-500 text-sm font-bold">{errors.signature}</p>}
    </div>
  );
};

// --- ORIENTATION STEP ---
const OrientationStep: React.FC<any> = ({ data, onChange, errors, onSubmit, isLoading, submitError }) => {
  return (
    <div className="space-y-8 animate-in fade-in">
      <h2 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic">Orientation</h2>
      <p className="text-zinc-500">Complete the following orientation modules to finalize your application.</p>

      <div className="space-y-4">
        <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-zinc-900">Get to Know Health Matters Clinic</h3>
            <span className="text-xs font-bold text-zinc-500">~12 min</span>
          </div>
          <p className="text-sm text-zinc-500 mb-4">Who we are, who we serve in Los Angeles, and how our programs work together.</p>
          <div className="aspect-video bg-zinc-900 rounded-xl mb-4 overflow-hidden">
            <iframe
              className="w-full h-full"
              src="https://hmc.screencasthost.com/player/cTQ6cDnowch?width=100%&height=100%&ff=1&title=0"
              title="Get to Know Health Matters Clinic"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              style={{ border: 'none' }}
            />
          </div>
          <button onClick={() => onChange('watchedIntro', !data.watchedIntro)} className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${data.watchedIntro ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'}`}>
            {data.watchedIntro ? <><CheckCircle size={18} /> Completed</> : 'Mark as Watched'}
          </button>
        </div>

        <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-zinc-900">Because You're a Champion</h3>
            <span className="text-xs font-bold text-zinc-500">~6 min</span>
          </div>
          <p className="text-sm text-zinc-500 mb-4">Our values, expectations, and what it means to show up for community with HMC.</p>
          <div className="aspect-video bg-zinc-900 rounded-xl mb-4 overflow-hidden">
            <iframe
              className="w-full h-full"
              src="https://hmc.screencasthost.com/player/cTQQcxnoth6?width=100%&height=100%&ff=1&title=0"
              title="Because You're a Champion"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              style={{ border: 'none' }}
            />
          </div>
          <button onClick={() => onChange('watchedChampion', !data.watchedChampion)} className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${data.watchedChampion ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'}`}>
            {data.watchedChampion ? <><CheckCircle size={18} /> Completed</> : 'Mark as Watched'}
          </button>
        </div>
      </div>
      {errors.orientation && <p className="text-rose-500 text-sm font-bold">{errors.orientation}</p>}

      {submitError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3">
          <AlertTriangle className="text-rose-500 flex-shrink-0" />
          <p className="text-rose-700 text-sm font-medium">{submitError}</p>
        </div>
      )}

      <button onClick={onSubmit} disabled={isLoading || !data.watchedIntro || !data.watchedChampion} className="w-full py-6 bg-[#233DFF] border border-black text-white rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl">
        {isLoading ? <Loader2 className="animate-spin" /> : <><div className="w-2 h-2 rounded-full bg-white" /> Submit Application</>}
      </button>
    </div>
  );
};

export { AccountStep };
export default OnboardingFlow;