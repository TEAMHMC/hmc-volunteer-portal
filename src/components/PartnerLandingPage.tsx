import React, { useState } from 'react';
import { APP_CONFIG } from '../config';

interface PartnerLandingPageProps {
  onLogin: (partnerMode?: boolean) => void;
  onRegister: () => void;
  onAdminLogin: (email: string, password: string) => Promise<void>;
}

const PartnerLandingPage: React.FC<PartnerLandingPageProps> = ({ onLogin, onRegister, onAdminLogin }) => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const handleLogin = () => {
    window.history.replaceState({}, '', '/');
    onLogin(true);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);
    try {
      await onAdminLogin(adminEmail.trim().toLowerCase(), adminPassword);
    } catch (err: any) {
      setAdminError(err?.message || 'Login failed. Check your credentials.');
      setAdminLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: '#fff', color: '#0a0e28', minHeight: '100vh', WebkitFontSmoothing: 'antialiased' }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,.07)', padding: '16px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <a href="https://www.healthmatters.clinic" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <img src={APP_CONFIG.BRAND.logoUrl} alt="Health Matters Clinic" width={36} height={36} style={{ borderRadius: 8, background: '#fff', objectFit: 'contain' }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#0a0e28' }}>
            HMC <span style={{ color: 'rgba(10,14,40,.45)' }}>PARTNER PORTAL</span>
          </span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onRegister}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#0a0e28', border: '1.5px solid #0f0f0f', borderRadius: 100, padding: '10px 22px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Create Account
          </button>
          <button
            onClick={handleLogin}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#233dff', color: '#fff', border: '1.5px solid #0f0f0f', borderRadius: 100, padding: '10px 22px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block', flexShrink: 0 }} />
            Partner Login
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: 'linear-gradient(135deg, #fff4ec 0%, #fdeef5 45%, #f0eeff 100%)', padding: '96px 48px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Grid overlay */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,0,0,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.03) 1px,transparent 1px)', backgroundSize: '60px 60px', WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%,black,transparent)', maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%,black,transparent)', pointerEvents: 'none' }} />
        {/* Warm peach radial glow */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(255,160,110,.18), transparent)', pointerEvents: 'none' }} />
        {/* Lavender accent glow */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 40% at 80% 80%, rgba(150,120,255,.12), transparent)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(35,61,255,.08)', border: '1px solid rgba(35,61,255,.3)', borderRadius: 100, padding: '8px 16px', marginBottom: 28, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#233dff' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#233dff', display: 'inline-block', flexShrink: 0 }} />
            HMC Partner Network
          </div>

          <h1 style={{ fontSize: 'clamp(52px, 7.5vw, 100px)', fontWeight: 900, lineHeight: .9, letterSpacing: '-.04em', maxWidth: 900, margin: '0 auto 28px', color: '#0a0e28', fontStyle: 'italic', textTransform: 'uppercase' }}>
            Serve Your<br />
            <span style={{ background: 'linear-gradient(135deg, #f9c74f 0%, #ff8c42 60%, #ff5f7e 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Community.</span>
          </h1>

          <p style={{ fontSize: 'clamp(17px, 2vw, 20px)', color: '#555', maxWidth: 620, margin: '0 auto 44px', lineHeight: 1.65, fontStyle: 'italic' }}>
            The platform for health and wellness organizations to list events, collect RSVPs, and reach thousands of community members across Los Angeles.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              onClick={onRegister}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: '#233dff', color: '#fff', border: '1.5px solid #0f0f0f', borderRadius: 100, padding: '18px 40px', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 4px 24px rgba(35,61,255,.4)' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block', flexShrink: 0 }} />
              Get Started
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button
              onClick={handleLogin}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: '#fff', color: '#0a0e28', border: '1.5px solid #0f0f0f', borderRadius: 100, padding: '18px 40px', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0a0e28', display: 'inline-block', flexShrink: 0 }} />
              Partner Login
            </button>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: '#fff', color: '#111', padding: '96px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: '#233dff', marginBottom: 16 }}>How It Works</p>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: .95, marginBottom: 20, color: '#111' }}>Up and running in minutes.</h2>
          <p style={{ fontSize: 18, color: '#555', lineHeight: 1.65, maxWidth: 560, marginBottom: 56 }}>Any health or wellness organization serving the LA community can create an account and start listing events today.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              {
                num: '01',
                title: 'Create Your Account',
                desc: 'Sign up with your organization email. No application, no approval process. Your account is ready immediately.',
              },
              {
                num: '02',
                title: 'List Your First Event',
                desc: 'Add your event title, date, location, and flyer. Your listing goes live on the HMC Event Finder after a quick review.',
              },
              {
                num: '03',
                title: 'Get RSVPs and Grow',
                desc: 'Community members register directly through the platform. You get notified in real time and can track attendance from your dashboard.',
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
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(249,199,79,.7)', marginBottom: 16 }}>What You Get</p>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: .95, marginBottom: 20, color: '#fff' }}>Everything you need<br />in one place.</h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.5)', lineHeight: 1.65, maxWidth: 560, marginBottom: 56 }}>Your portal gives you the tools to reach more people, stay organized, and demonstrate your community impact.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {[
              {
                title: 'Event Finder Listing',
                desc: 'Submit events directly to the HMC Event Finder. Attach a flyer, set your date and location, and reach thousands of community members across Los Angeles.',
                icon: (
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#f9c74f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.95 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.86 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                ),
              },
              {
                title: 'RSVP Notifications',
                desc: 'Get a real-time email every time someone registers for your event through the HMC Event Finder. Know your attendance before event day.',
                icon: (
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#f9c74f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ),
              },
              {
                title: 'Referral Inbox',
                desc: 'See every client referral HMC sends your way. Accept, update status, and log outcomes with one click. No back-and-forth emails.',
                icon: (
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#f9c74f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                ),
              },
              {
                title: 'Performance Dashboard',
                desc: 'Track event RSVPs, referral volume, acceptance rate, and outcomes over rolling time periods. Demonstrate your community impact with data.',
                icon: (
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#f9c74f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                ),
              },
            ].map((feature) => (
              <div key={feature.title} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: '28px 24px' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(249,199,79,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
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
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: '#f9c74f', marginBottom: 16 }}>Who It's For</p>
              <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: .95, marginBottom: 20, color: '#111' }}>Any health or wellness<br />org in Los Angeles.</h2>
              <p style={{ fontSize: 17, color: '#555', lineHeight: 1.7, marginBottom: 28 }}>
                You do not need to be an existing HMC partner. If your organization hosts health and wellness events for the LA community, this platform is for you:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Clinics and community health centers', 'Mental health and behavioral health providers', 'Food programs, pantries, and resource fairs', 'Fitness, wellness, and movement programs', 'Housing, legal aid, and social service agencies', 'Faith-based and neighborhood organizations'].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(249,199,79,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#f9c74f" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 15, color: '#333', lineHeight: 1.5, fontWeight: 500 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#0f0f0f', borderRadius: 24, padding: '48px 40px', color: '#fff' }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(249,199,79,.7)', marginBottom: 20 }}>Get Started</p>
              <h3 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1, marginBottom: 16, color: '#fff' }}>Ready to reach more people?</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,.55)', lineHeight: 1.7, marginBottom: 24 }}>
                Create your account and list your first event today. No lengthy approval process. Just a better way to connect with your community.
              </p>
              <button
                onClick={onRegister}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f9c74f', color: '#0f0f0f', border: 'none', borderRadius: 100, padding: '14px 28px', fontSize: 14, fontWeight: 700, letterSpacing: '.02em', cursor: 'pointer', marginBottom: 12 }}
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
                <button onClick={handleLogin} style={{ background: 'none', border: 'none', color: 'rgba(249,199,79,.8)', cursor: 'pointer', fontSize: 13, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>
                  Sign in to the Partner Portal
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ADMIN LOGIN MODAL */}
      {showAdminModal && (
        <div
          onClick={() => { setShowAdminModal(false); setAdminError(''); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,.12)', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 420, color: '#fff' }}
          >
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 8 }}>HMC Staff Only</p>
              <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.02em', margin: 0 }}>Admin Sign In</h2>
            </div>
            <form onSubmit={handleAdminSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.6)', marginBottom: 6, letterSpacing: '.04em' }}>Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="admin@healthmatters.clinic"
                  required
                  style={{ width: '100%', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10, padding: '12px 14px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.6)', marginBottom: 6, letterSpacing: '.04em' }}>Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="Password"
                  required
                  style={{ width: '100%', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10, padding: '12px 14px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              {adminError && (
                <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{adminError}</p>
              )}
              <button
                type="submit"
                disabled={adminLoading}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: adminLoading ? 'rgba(255,255,255,.3)' : '#fff', color: '#0f0f0f', border: 'none', borderRadius: 100, padding: '14px 28px', fontSize: 13, fontWeight: 800, letterSpacing: '.04em', cursor: adminLoading ? 'not-allowed' : 'pointer', marginTop: 4 }}
              >
                {adminLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      )}

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
