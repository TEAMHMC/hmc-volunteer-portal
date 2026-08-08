import React from 'react';
import { APP_CONFIG } from '../config';
import { PARTNERSHIP_TYPES, ELIGIBILITY, NOT_A_FIT, type PartnershipTypeId } from '../partnerTypes';

interface PartnerLandingPageProps {
  onLogin: (partnerMode?: boolean) => void;
  /** Carries the partnership type the organization picked into registration. */
  onRegister: (type?: PartnershipTypeId) => void;
  onAdminLogin: (email: string, password: string) => Promise<void>;
}

const PartnerLandingPage: React.FC<PartnerLandingPageProps> = ({ onLogin, onRegister }) => {
  const handleLogin = () => {
    window.history.replaceState({}, '', '/');
    onLogin(true);
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
            onClick={() => onRegister()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#0a0e28', border: '1.5px solid #0f0f0f', borderRadius: 100, padding: '10px 22px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0a0e28', display: 'inline-block', flexShrink: 0 }} />
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
            The referral and service network for Los Angeles organizations doing health and social
            care work. Receive referrals that close with a real outcome, publish events to the whole
            county, find partners for the work you cannot staff alone, and show your impact with data.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => onRegister()}
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

      {/* THREE PATHS */}
      <section style={{ background: '#fff', color: '#111', padding: '72px 48px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', borderTop: '1px solid rgba(0,0,0,.08)' }}>
          {[
            { title: 'Join the network', desc: 'Apply as a referral partner, event co-host, subcontractor, or community partner. Free, and your account is active the same day.', cta: 'Get started', action: 'register' },
            { title: 'Partner Portal', desc: 'Already working with HMC? Sign in to your referral inbox, event listings, performance view, and the community board.', cta: 'Sign in', action: 'login' },
            { title: 'See what partners do', desc: 'Four partnership types, what each one gives you, and what HMC asks in return. Read before you apply.', cta: 'Compare types', action: 'types' },
          ].map((col, i) => (
            <div key={col.title} style={{ padding: '32px 28px', borderLeft: i === 0 ? 'none' : '1px solid rgba(0,0,0,.08)' }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', color: '#111', marginTop: 0, marginBottom: 10 }}>{col.title}</h3>
              <p style={{ fontSize: 14, color: '#555', lineHeight: 1.65, marginBottom: 18 }}>{col.desc}</p>
              <button
                onClick={() => {
                  if (col.action === 'register') onRegister();
                  else if (col.action === 'login') handleLogin();
                  else document.getElementById('partnership-types')?.scrollIntoView({ block: 'start' });
                }}
                style={{ background: '#fff', color: '#0a0e28', border: '1.5px solid rgba(0,0,0,.18)', borderRadius: 100, padding: '10px 22px', fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                {col.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: '#fff', color: '#111', padding: '96px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: '#233dff', marginBottom: 16 }}>How It Works</p>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: .95, marginBottom: 20, color: '#111' }}>Up and running the same day.</h2>
          <p style={{ fontSize: 18, color: '#555', lineHeight: 1.65, maxWidth: 620, marginBottom: 56 }}>Any health or wellness organization serving the LA community can create an account and start listing events today. Partnership types that carry obligations, like receiving referrals, are reviewed before they turn on.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              {
                num: '01',
                title: 'Create Your Account',
                desc: 'Sign up with your organization email and tell us how you want to partner. Your account is active immediately, so you can start listing events the same day.',
              },
              {
                num: '02',
                title: 'List Your First Event',
                desc: 'Add your event title, date, location, and flyer. Your listing goes live on the HMC Event Finder after a quick review.',
              },
              {
                num: '03',
                title: 'Get RSVPs and Grow',
                desc: 'Community members register directly through the platform. You get notified in real time and can track attendance from your dashboard. Referral and subcontract partnership unlocks once an administrator approves it.',
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
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: .95, marginBottom: 20, color: '#fff' }}>Built for the work,<br />not just the calendar.</h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.5)', lineHeight: 1.65, maxWidth: 620, marginBottom: 56 }}>Most community referral disappears the moment it leaves the room. The portal exists so a person handed to your organization has an owner, a status, and an outcome somebody can point to later.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {[
              {
                title: 'Referral Inbox',
                desc: 'Every referral HMC routes to you, matched to the services you declared. Accept it, work it, and close it with an outcome. Marking Unable to Serve releases the person to be routed elsewhere instead of stranding them.',
                icon: (
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#f9c74f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.95 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.86 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                ),
              },
              {
                title: 'Performance and Reporting',
                desc: 'Referral volume, response time, completion rate, and enrollment counts over rolling periods. The numbers a funder asks for, without rebuilding a report each time.',
                icon: (
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#f9c74f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ),
              },
              {
                title: 'Community Board',
                desc: 'Post what you need to the whole partner network. A request for volunteers routes into the HMC volunteer network, which is how an organization with six volunteers staffs an event that needs twelve.',
                icon: (
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#f9c74f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                ),
              },
              {
                title: 'Events and Community Reach',
                desc: 'Publish to the HMC Event Finder and the Member Hub in one submission, with real-time RSVP notifications. Community reach on day one without building an audience of your own.',
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

      {/* CHOOSE HOW YOU PARTNER */}
      <section id="partnership-types" style={{ background: '#fff', color: '#111', padding: '96px 48px', borderTop: '1px solid rgba(0,0,0,.06)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: '#233dff', marginBottom: 16 }}>Partnership Types</p>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: .95, marginBottom: 20, color: '#111' }}>Choose how you partner.</h2>
          <p style={{ fontSize: 18, color: '#555', lineHeight: 1.65, maxWidth: 640, marginBottom: 56 }}>
            Each type maps to work your organization already does. You can hold more than one, and you can add
            another later without reapplying.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 20 }}>
            {PARTNERSHIP_TYPES.map((t) => (
              <div key={t.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,.1)', borderRadius: 20, padding: '30px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#233dff', marginBottom: 10 }}>{t.tagline}</p>
                  <h3 style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.1, color: '#111', margin: 0 }}>{t.name}</h3>
                </div>
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.65, margin: 0 }}>{t.description}</p>

                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }}>What you get</p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {t.youGet.map((g) => (
                      <li key={g} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: '#333', lineHeight: 1.5 }}>
                        <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="#233dff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }}><polyline points="20 6 9 17 4 12"/></svg>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }}>What we ask</p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {t.weAsk.map((a) => (
                      <li key={a} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: '#666', lineHeight: 1.5 }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#ccc', flexShrink: 0, marginTop: 8 }} />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <p style={{ fontSize: 11.5, color: '#888', lineHeight: 1.5, marginBottom: 14 }}>
                    Once approved, your profile shows <strong style={{ color: '#333' }}>{t.readinessStatus}</strong>.
                  </p>
                  <button
                    onClick={() => onRegister(t.id)}
                    style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#0a0e28', color: '#fff', border: 'none', borderRadius: 100, padding: '13px 22px', fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    Apply as {t.name}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13.5, color: '#888', marginTop: 28, lineHeight: 1.65, maxWidth: 720 }}>
            Selecting a type here tells us what you are applying for. An HMC administrator reviews every
            application and approves the types your organization is ready for, which may be more or fewer than
            you requested.
          </p>
        </div>
      </section>

      {/* ELIGIBILITY */}
      <section style={{ background: '#fff', color: '#111', padding: '0 48px 96px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          <div style={{ background: '#f5f5f4', border: '1px solid rgba(0,0,0,.06)', borderRadius: 20, padding: '32px 30px' }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-.02em', color: '#111', marginTop: 0, marginBottom: 18 }}>To partner with HMC, your organization should</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ELIGIBILITY.map((e) => (
                <li key={e} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 14.5, color: '#333', lineHeight: 1.6 }}>
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#233dff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 5 }}><polyline points="20 6 9 17 4 12"/></svg>
                  {e}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background: '#f5f5f4', border: '1px solid rgba(0,0,0,.06)', borderRadius: 20, padding: '32px 30px' }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-.02em', color: '#111', marginTop: 0, marginBottom: 18 }}>This is not the right door if</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {NOT_A_FIT.map((e) => (
                <li key={e} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 14.5, color: '#666', lineHeight: 1.6 }}>
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#ff6e40" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 5 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  {e}
                </li>
              ))}
            </ul>
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
                onClick={() => onRegister()}
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
