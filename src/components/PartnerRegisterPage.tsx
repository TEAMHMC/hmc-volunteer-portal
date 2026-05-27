import React, { useState } from 'react';
import { APP_CONFIG } from '../config';

interface PartnerRegisterPageProps {
  onRegistered: () => void;
  onLogin: (partnerMode?: boolean) => void;
}

type OrgType = 'Healthcare' | 'Housing' | 'Food' | 'Legal' | 'Employment' | 'Mental Health' | 'Other';

const ORG_TYPES: OrgType[] = ['Healthcare', 'Housing', 'Food', 'Legal', 'Employment', 'Mental Health', 'Other'];

const PartnerRegisterPage: React.FC<PartnerRegisterPageProps> = ({ onRegistered, onLogin }) => {
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrgType | ''>('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [servicesProvided, setServicesProvided] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!orgName.trim()) newErrors.orgName = 'Organization name is required.';
    if (!contactName.trim()) newErrors.contactName = 'Your full name is required.';
    if (!email.trim()) newErrors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Enter a valid email address.';
    if (!password) newErrors.password = 'Password is required.';
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const apiBase = (window as any).__PORTAL_API_URL__ || '';
      const res = await fetch(`${apiBase}/api/partners/register-self`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName.trim(),
          orgType: orgType || 'Other',
          contactName: contactName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
          servicesProvided: servicesProvided.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      // Store token
      if (data.token) {
        localStorage.setItem('authToken', data.token);
      }

      onRegistered();
    } catch {
      setSubmitError('Something went wrong. Please check your connection and try again.');
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(255,255,255,.15)',
    borderRadius: 10,
    padding: '13px 16px',
    fontSize: 14,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const errorInputStyle: React.CSSProperties = {
    ...inputStyle,
    border: '1px solid #ef4444',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'rgba(255,255,255,.7)',
    marginBottom: 6,
    letterSpacing: '.01em',
  };

  const fieldErrorStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#f87171',
    marginTop: 4,
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: '#0f0f0f', color: '#fff', minHeight: '100vh', WebkitFontSmoothing: 'antialiased' }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(15,15,15,.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '16px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <a href="https://www.healthmatters.clinic" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <img src={APP_CONFIG.BRAND.logoUrl} alt="Health Matters Clinic" width={36} height={36} style={{ borderRadius: 8, background: '#fff', objectFit: 'contain' }} />
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', color: '#fff' }}>
            HMC <span style={{ color: '#f9c74f' }}>Partner Portal</span>
          </span>
        </a>
        <button
          onClick={() => { window.history.replaceState({}, '', '/'); onLogin(true); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f9c74f', color: '#0f0f0f', border: '1px solid #0f0f0f', borderRadius: 100, padding: '10px 22px', fontSize: 13, fontWeight: 700, letterSpacing: '.02em', cursor: 'pointer' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0f0f0f', display: 'inline-block', flexShrink: 0 }} />
          Partner Login
        </button>
      </nav>

      {/* FORM AREA */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(249,199,79,.12)', border: '1px solid rgba(249,199,79,.3)', borderRadius: 100, padding: '8px 16px', marginBottom: 20, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(249,199,79,.85)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f9c74f', display: 'inline-block', flexShrink: 0 }} />
            HMC Referral Partner Network
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.05, marginBottom: 12, color: '#fff' }}>
            Create your partner account
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.5)', lineHeight: 1.65, maxWidth: 440, margin: '0 auto' }}>
            Join the HMC Partner Network and start managing referrals from Health Matters Clinic.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Organization Name */}
            <div>
              <label style={labelStyle}>Organization Name <span style={{ color: '#f9c74f' }}>*</span></label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="e.g. Westside Community Health Center"
                style={errors.orgName ? errorInputStyle : inputStyle}
                autoComplete="organization"
              />
              {errors.orgName && <p style={fieldErrorStyle}>{errors.orgName}</p>}
            </div>

            {/* Organization Type */}
            <div>
              <label style={labelStyle}>Organization Type</label>
              <select
                value={orgType}
                onChange={e => setOrgType(e.target.value as OrgType | '')}
                style={{ ...inputStyle, appearance: 'none' as any }}
              >
                <option value="" style={{ background: '#1a1a1a' }}>Select a type...</option>
                {ORG_TYPES.map(t => (
                  <option key={t} value={t} style={{ background: '#1a1a1a' }}>{t}</option>
                ))}
              </select>
            </div>

            {/* Contact Name */}
            <div>
              <label style={labelStyle}>Your Full Name <span style={{ color: '#f9c74f' }}>*</span></label>
              <input
                type="text"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="First and last name"
                style={errors.contactName ? errorInputStyle : inputStyle}
                autoComplete="name"
              />
              {errors.contactName && <p style={fieldErrorStyle}>{errors.contactName}</p>}
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Your Email <span style={{ color: '#f9c74f' }}>*</span></label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@organization.org"
                style={errors.email ? errorInputStyle : inputStyle}
                autoComplete="email"
              />
              {errors.email && <p style={fieldErrorStyle}>{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Password <span style={{ color: '#f9c74f' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  style={{ ...(errors.password ? errorInputStyle : inputStyle), paddingRight: 48 }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <p style={fieldErrorStyle}>{errors.password}</p>}
            </div>

            {/* Phone */}
            <div>
              <label style={labelStyle}>Phone <span style={{ color: 'rgba(255,255,255,.3)', fontWeight: 400 }}>(optional)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(213) 555-0100"
                style={inputStyle}
                autoComplete="tel"
              />
            </div>

            {/* Website */}
            <div>
              <label style={labelStyle}>Website <span style={{ color: 'rgba(255,255,255,.3)', fontWeight: 400 }}>(optional)</span></label>
              <input
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://yourorg.org"
                style={inputStyle}
                autoComplete="url"
              />
            </div>

            {/* Services */}
            <div>
              <label style={labelStyle}>Services You Provide <span style={{ color: 'rgba(255,255,255,.3)', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                value={servicesProvided}
                onChange={e => setServicesProvided(e.target.value)}
                placeholder="Briefly describe what your organization does and who you serve..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            {/* Submit error */}
            {submitError && (
              <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '14px 16px', fontSize: 14, color: '#f87171', lineHeight: 1.5 }}>
                {submitError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: loading ? 'rgba(249,199,79,.5)' : '#f9c74f', color: '#0f0f0f', border: 'none', borderRadius: 100, padding: '16px 36px', fontSize: 15, fontWeight: 700, letterSpacing: '.02em', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, transition: 'opacity .2s' }}
            >
              {loading ? (
                <>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,.3)', borderTopColor: '#0f0f0f', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Creating account...
                </>
              ) : (
                <>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0f0f0f', display: 'inline-block', flexShrink: 0 }} />
                  Create Partner Account
                </>
              )}
            </button>

            {/* Sign in link */}
            <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,.35)', margin: 0 }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { window.history.replaceState({}, '', '/'); onLogin(true); }}
                style={{ background: 'none', border: 'none', color: '#f9c74f', cursor: 'pointer', fontSize: 14, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}
              >
                Sign in
              </button>
            </p>

          </div>
        </form>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* FOOTER */}
      <footer style={{ background: '#111', color: '#fff', padding: '32px 48px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)' }}>&copy; 2026 Health Matters Clinic</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="https://www.healthmatters.clinic" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>healthmatters.clinic</a>
            <a href="mailto:partner@healthmatters.clinic" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>partner@healthmatters.clinic</a>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default PartnerRegisterPage;
