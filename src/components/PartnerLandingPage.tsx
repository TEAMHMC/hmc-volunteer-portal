import React from 'react';
import { APP_CONFIG } from '../config';

interface PartnerLandingPageProps {
  onLogin: (partnerMode?: boolean) => void;
  onRegister: () => void;
}

const PartnerLandingPage: React.FC<PartnerLandingPageProps> = ({ onLogin, onRegister }) => {
  const handleLogin = () => {
    window.history.replaceState({}, '', '/');
    onLogin(true);
  };
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: '#0f0f0f', color: '#fff', minHeight: '100vh', WebkitFontSmoothing: 'antialiased' }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(15,15,15,.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '16px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <a href="https://www.healthmatters.clinic" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <img src={APP_CONFIG.BRAND.logoUrl} alt="Health Matters Clinic" width={36} height={36} style={{ borderRadius: 8, background: '#fff', objectFit: 'contain' }} />
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', color: '#fff' }}>
            HMC <span style={{ color: '#ff6e40' }}>Partner Portal</span>
          </span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="mailto:partner@healthmatters.clinic" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 100, padding: '10px 22px', fontSize: 13, fontWeight: 700, textDecoration: 'none', letterSpacing: '.02em', transition: 'color .2s' }}>
            Request Access
          </a>
          <button
            onClick={onRegister}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 100, padding: '10px 22px', fontSize: 13, fontWeight: 700, letterSpacing: '.02em', cursor: 'pointer' }}
          >
            Create Account
          </button>
          <button
            onClick={handleLogin}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ff6e40', color: '#0f0f0f', border: '1px solid #0f0f0f', borderRadius: 100, padding: '10px 22px', fontSize: 13, fontWeight: 700, letterSpacing: '.02em', cursor: 'pointer' }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0f0f0f', display: 'inline-block', flexShrink: 0 }} />
            Partner Login
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: '#0f0f0f', padding: '96px 48px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Grid overlay */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)', backgroundSize: '60px 60px', WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%,black,transparent)', maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%,black,transparent)', pointerEvents: 'none' }} />
        {/* Orange radial glow */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 0%,rgba(255,110,64,.18),transparent)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,110,64,.12)', border: '1px solid rgba(255,110,64,.3)', borderRadius: 100, padding: '8px 16px', marginBottom: 28, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,110,64,.85)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff6e40', display: 'inline-block', flexShrink: 0 }} />
            HMC Referral Partner Network
          </div>

          <h1 style={{ fontSize: 'clamp(52px, 7.5vw, 100px)', fontWeight: 900, lineHeight: .9, letterSpacing: '-.04em', maxWidth: 900, margin: '0 auto 28px', color: '#fff' }}>
            The HMC<br />
            <span style={{ color: '#ff6e40' }}>Partner Portal</span>
          </h1>

          <p style={{ fontSize: 'clamp(17px, 2vw, 20px)', color: 'rgba(255,255,255,.5)', maxWidth: 580, margin: '0 auto 44px', lineHeight: 1.65 }}>
            A dedicated workspace for organizations that HMC refers clients to. Manage referrals, update your profile, and track your community impact.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              onClick={onRegister}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ff6e40', color: '#0f0f0f', border: '1px solid #0f0f0f', borderRadius: 100, padding: '16px 36px', fontSize: 15, fontWeight: 700, letterSpacing: '.02em', cursor: 'pointer' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0f0f0f', display: 'inline-block', flexShrink: 0 }} />
              Create a Partner Account
            </button>
            <button
              onClick={handleLogin}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#111', border: '1px solid #0f0f0f', borderRadius: 100, padding: '16px 36px', fontSize: 15, fontWeight: 700, letterSpacing: '.02em', cursor: 'pointer' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#111', display: 'inline-block', flexShrink: 0 }} />
              Partner Login
            </button>
          </div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.35)', marginTop: 20 }}>
            New to the partner network?{' '}
            <button onClick={onRegister} style={{ background: 'none', border: 'none', color: '#ff6e40', cursor: 'pointer', fontSize: 14, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>
              Create your account in 2 minutes.
            </button>
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: '#fff', color: '#111', padding: '96px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: '#ff6e40', marginBottom: 16 }}>How It Works</p>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: .95, marginBottom: 20, color: '#111' }}>Three steps to get started.</h2>
          <p style={{ fontSize: 18, color: '#555', lineHeight: 1.65, maxWidth: 560, marginBottom: 56 }}>Becoming an HMC Referral Partner is a straightforward process. Here is what to expect from application to your first referral.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              {
                num: '01',
                title: 'Suggest Your Organization',
                desc: 'Suggest your organization to the HMC Resource Directory. After submitting, you\'ll be prompted to create a partner account and apply for the partnership types that fit your work.',
              },
              {
                num: '02',
                title: 'You Receive a Secure Invite',
                desc: 'An invite email arrives with a secure, single-use registration link. Complete your profile and set your password — no lengthy application required.',
              },
              {
                num: '03',
                title: 'Log In and Manage Referrals',
                desc: 'Access your Partner Portal any time to see incoming referrals, update statuses, edit your organization profile, and track your impact metrics.',
              },
            ].map((step) => (
              <div key={step.num} style={{ background: '#f5f5f4', border: '1px solid rgba(0,0,0,.06)', borderRadius: 20, padding: '32px 28px' }}>
                <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-.04em', color: '#e8e8e3', lineHeight: 1, marginBottom: 16 }}>{step.num}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.25, marginBottom: 12, color: '#111' }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT YOU GET */}
      <section style={{ background: '#0f0f0f', color: '#fff', padding: '96px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,110,64,.7)', marginBottom: 16 }}>What You Get</p>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: .95, marginBottom: 20, color: '#fff' }}>Everything you need<br />in one place.</h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.5)', lineHeight: 1.65, maxWidth: 560, marginBottom: 56 }}>Your portal surfaces exactly what you need to respond quickly, stay organized, and demonstrate your community impact.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {[
              {
                title: 'Referral Inbox',
                desc: 'See every client referral HMC sends your way, with relevant details about the person\'s needs, contact information, and referral date.',
                icon: (
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#ff6e40" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.95 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.86 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                ),
              },
              {
                title: 'Status Updates',
                desc: 'Accept referrals, mark them in progress, log outcomes — one click per action. Keep HMC staff informed without back-and-forth emails.',
                icon: (
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#ff6e40" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ),
              },
              {
                title: 'Organization Profile',
                desc: 'Keep your services, hours, languages spoken, eligibility requirements, and contact information current so HMC makes accurate referrals.',
                icon: (
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#ff6e40" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                ),
              },
              {
                title: 'Performance Dashboard',
                desc: 'Track your referral volume, acceptance rate, completion rate, and average response time over rolling time periods.',
                icon: (
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#ff6e40" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                ),
              },
            ].map((feature) => (
              <div key={feature.title} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: '28px 24px' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,110,64,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  {feature.icon}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-.01em' }}>{feature.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', lineHeight: 1.65 }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO QUALIFIES */}
      <section style={{ background: '#f5f5f4', color: '#111', padding: '96px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: '#ff6e40', marginBottom: 16 }}>Who Qualifies</p>
              <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: .95, marginBottom: 20, color: '#111' }}>Built for organizations<br />we work with.</h2>
              <p style={{ fontSize: 17, color: '#555', lineHeight: 1.7, marginBottom: 28 }}>
                The partner portal is for organizations that HMC actively refers clients to. We currently work with partners across Los Angeles County, including:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Clinics and community health centers', 'Housing and shelter providers', 'Food programs and pantries', 'Legal aid and advocacy organizations', 'Behavioral health and recovery services', 'Social service agencies'].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(255,110,64,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#ff6e40" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 15, color: '#333', lineHeight: 1.5, fontWeight: 500 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#0f0f0f', borderRadius: 24, padding: '48px 40px', color: '#fff' }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(255,110,64,.7)', marginBottom: 20 }}>Get Started</p>
              <h3 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1, marginBottom: 16, color: '#fff' }}>Interested in becoming an HMC Referral Partner?</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,.55)', lineHeight: 1.7, marginBottom: 24 }}>
                Create your partner account in minutes and start managing referrals right away. Or reach out to our team if you have questions first.
              </p>
              <button
                onClick={onRegister}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ff6e40', color: '#0f0f0f', border: 'none', borderRadius: 100, padding: '14px 28px', fontSize: 14, fontWeight: 700, letterSpacing: '.02em', cursor: 'pointer', marginBottom: 12 }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0f0f0f', display: 'inline-block', flexShrink: 0 }} />
                Create a Partner Account
              </button>
              <div>
                <a
                  href="mailto:partner@healthmatters.clinic"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 100, padding: '12px 24px', fontSize: 13, fontWeight: 700, letterSpacing: '.02em', textDecoration: 'none' }}
                >
                  Email partner@healthmatters.clinic
                </a>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginTop: 20, lineHeight: 1.6 }}>
                Already have an account?{' '}
                <button onClick={handleLogin} style={{ background: 'none', border: 'none', color: 'rgba(255,110,64,.8)', cursor: 'pointer', fontSize: 13, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>
                  Sign in to the Partner Portal
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111', color: '#fff', padding: '40px 48px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)' }}>
            &copy; 2026 Health Matters Clinic
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="https://www.healthmatters.clinic" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>healthmatters.clinic</a>
            <a href="mailto:partner@healthmatters.clinic" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>partner@healthmatters.clinic</a>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default PartnerLandingPage;
