import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';

type FieldType = 'Rating' | 'Multiple Choice' | 'Checkboxes' | 'Short Text' | 'Long Text';
interface SurveyField {
  id: string;
  type: FieldType;
  question: string;
  options?: string[];
  required?: boolean;
}
interface SurveyForm {
  id: string;
  title: string;
  description?: string;
  fields: SurveyField[];
}

type Status =
  | { kind: 'loading' }
  | { kind: 'loaded'; form: SurveyForm; firstName: string }
  | { kind: 'submitting'; form: SurveyForm; firstName: string }
  | { kind: 'submitted' }
  | { kind: 'duplicate' }
  | { kind: 'invalid_token' }
  | { kind: 'form_not_found' }
  | { kind: 'inactive_volunteer' }
  | { kind: 'error'; message: string };

const PORTAL_HOME = 'https://volunteer.healthmatters.clinic';

const PublicSurveyView: React.FC = () => {
  const { formId, token } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      formId: (params.get('formId') || '').trim(),
      token: (params.get('token') || '').trim(),
    };
  }, []);

  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [missing, setMissing] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!formId || !token) {
        setStatus({ kind: 'invalid_token' });
        return;
      }
      try {
        const res = await fetch(
          `/api/public/survey-form?formId=${encodeURIComponent(formId)}&token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        if (res.status === 404) {
          const body = await safeJson(res);
          if (body?.error === 'form_not_found') setStatus({ kind: 'form_not_found' });
          else setStatus({ kind: 'invalid_token' });
          return;
        }
        if (res.status === 410) {
          setStatus({ kind: 'inactive_volunteer' });
          return;
        }
        if (!res.ok) {
          setStatus({ kind: 'error', message: 'We hit a snag loading your survey. Please try again.' });
          return;
        }
        const data = await res.json();
        setStatus({ kind: 'loaded', form: data.form, firstName: data.volunteer?.firstName || 'Volunteer' });
      } catch {
        if (!cancelled) setStatus({ kind: 'error', message: 'Network error. Please check your connection and try again.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status.kind !== 'loaded') return;
    const form = status.form;
    const missed = new Set<string>();
    for (const f of form.fields) {
      if (!f.required) continue;
      const v = answers[f.id];
      if (v === undefined || v === null) missed.add(f.id);
      else if (Array.isArray(v) && v.length === 0) missed.add(f.id);
      else if (typeof v === 'string' && !v.trim()) missed.add(f.id);
    }
    if (missed.size > 0) {
      setMissing(missed);
      const first = document.querySelector<HTMLElement>(`[data-field-id="${Array.from(missed)[0]}"]`);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setMissing(new Set());
    setStatus({ kind: 'submitting', form, firstName: status.firstName });
    try {
      const res = await fetch('/api/public/survey-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId, token, answers }),
      });
      if (res.status === 409) {
        setStatus({ kind: 'duplicate' });
        return;
      }
      if (res.status === 404) {
        const body = await safeJson(res);
        setStatus({ kind: body?.error === 'form_not_found' ? 'form_not_found' : 'invalid_token' });
        return;
      }
      if (res.status === 410) {
        setStatus({ kind: 'inactive_volunteer' });
        return;
      }
      if (!res.ok) {
        const body = await safeJson(res);
        setStatus({
          kind: 'error',
          message: body?.message || 'Submission failed. Please try again.',
        });
        return;
      }
      setStatus({ kind: 'submitted' });
    } catch {
      setStatus({ kind: 'error', message: 'Network error during submission. Please try again.' });
    }
  };

  if (status.kind === 'loading') return <CenteredCard><Loader2 className="animate-spin text-[#233DFF]" size={28} /><p className="mt-4 text-sm text-zinc-500">Loading your survey...</p></CenteredCard>;
  if (status.kind === 'invalid_token') return <ErrorCard title="This link is no longer valid" body="The survey link may have expired or been mistyped. If you think this is a mistake, please contact volunteer@healthmatters.clinic." />;
  if (status.kind === 'form_not_found') return <ErrorCard title="Survey not found" body="The survey you are trying to take is no longer available. Please contact volunteer@healthmatters.clinic if you have questions." />;
  if (status.kind === 'inactive_volunteer') return <ErrorCard title="Your volunteer profile is inactive" body="Please contact volunteer@healthmatters.clinic to reactivate your profile before taking surveys." />;
  if (status.kind === 'duplicate') return <SuccessCard title="You are all set" body="We already received a response from you for this survey recently. Thank you for your time." />;
  if (status.kind === 'submitted') return <SuccessCard title="Thank you" body="Your response has been recorded. Your feedback shapes how we operate." />;
  if (status.kind === 'error') return <ErrorCard title="Something went wrong" body={status.message} retry={() => window.location.reload()} />;

  const form = status.form;
  const isSubmitting = status.kind === 'submitting';

  return (
    <div className="min-h-screen bg-[#FDFEFE] py-10 px-4 font-['Inter']">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#233DFF] mb-2">Health Matters Clinic</p>
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight mb-3">Hi {status.firstName},</h1>
          <p className="text-zinc-500 text-base leading-relaxed">{form.description || 'Thank you for taking a moment to share your feedback.'}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-lg border border-zinc-100 p-6 sm:p-10 space-y-8">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">{form.title}</h2>
          </div>

          {form.fields.map((field, idx) => (
            <FieldBlock
              key={field.id}
              field={field}
              index={idx + 1}
              value={answers[field.id]}
              missing={missing.has(field.id)}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [field.id]: v }))}
            />
          ))}

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-h-[48px] bg-[#233DFF] hover:bg-[#1a30cc] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-full text-sm uppercase tracking-wide transition-all px-8 inline-flex items-center justify-center gap-2"
            >
              {isSubmitting ? (<><Loader2 className="animate-spin" size={16} /> Submitting...</>) : 'Submit Response'}
            </button>
          </div>
          <p className="text-xs text-zinc-400 text-center">Your responses are confidential. We only use them to improve the volunteer experience at HMC.</p>
        </form>
      </div>
    </div>
  );
};

const FieldBlock: React.FC<{ field: SurveyField; index: number; value: any; missing: boolean; onChange: (v: any) => void }> = ({ field, index, value, missing, onChange }) => {
  return (
    <div data-field-id={field.id} className={`space-y-3 ${missing ? 'animate-pulse' : ''}`}>
      <label className="block text-sm font-semibold text-zinc-900 leading-snug">
        <span className="text-zinc-400 mr-2">{index}.</span>
        {field.question}
        {field.required && <span className="text-rose-500 ml-1">*</span>}
      </label>

      {field.type === 'Rating' && (
        <div className="flex items-center gap-2 flex-wrap">
          {(field.options || ['1','2','3','4','5']).map((opt) => {
            const selected = String(value) === String(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`min-w-[48px] min-h-[48px] rounded-full font-bold text-base border-2 transition-all ${selected ? 'bg-[#233DFF] text-white border-[#233DFF]' : 'bg-white text-zinc-700 border-zinc-200 hover:border-[#233DFF]'}`}
                aria-pressed={selected}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {field.type === 'Multiple Choice' && (
        <div className="space-y-2">
          {(field.options || []).map((opt) => {
            const selected = value === opt;
            return (
              <label key={opt} className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selected ? 'border-[#233DFF] bg-[#233DFF]/5' : 'border-zinc-200 hover:border-zinc-300'}`}>
                <input type="radio" name={field.id} className="sr-only" checked={selected} onChange={() => onChange(opt)} />
                <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'border-[#233DFF]' : 'border-zinc-300'}`}>
                  {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#233DFF]" />}
                </span>
                <span className="text-sm text-zinc-800">{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {field.type === 'Checkboxes' && (
        <div className="space-y-2">
          {(field.options || []).map((opt) => {
            const arr: string[] = Array.isArray(value) ? value : [];
            const selected = arr.includes(opt);
            return (
              <label key={opt} className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selected ? 'border-[#233DFF] bg-[#233DFF]/5' : 'border-zinc-200 hover:border-zinc-300'}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selected}
                  onChange={() => {
                    if (selected) onChange(arr.filter((x) => x !== opt));
                    else onChange([...arr, opt]);
                  }}
                />
                <span className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'border-[#233DFF] bg-[#233DFF]' : 'border-zinc-300'}`}>
                  {selected && <CheckCircle2 className="text-white" size={14} />}
                </span>
                <span className="text-sm text-zinc-800">{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {(field.type === 'Short Text' || field.type === 'Long Text') && (
        <textarea
          rows={field.type === 'Long Text' ? 6 : 3}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-zinc-200 focus:border-[#233DFF] focus:outline-none text-sm text-zinc-900 resize-none"
          placeholder="Type your response here..."
        />
      )}

      {missing && <p className="text-xs text-rose-500 font-medium">This question needs a response.</p>}
    </div>
  );
};

const CenteredCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#FDFEFE] flex items-center justify-center p-6 font-['Inter']">
    <div className="text-center max-w-md">{children}</div>
  </div>
);

const ErrorCard: React.FC<{ title: string; body: string; retry?: () => void }> = ({ title, body, retry }) => (
  <CenteredCard>
    <div className="w-16 h-16 mx-auto bg-rose-50 rounded-2xl flex items-center justify-center mb-6 border border-rose-100">
      <AlertTriangle className="text-rose-500" size={28} />
    </div>
    <h1 className="text-2xl font-black text-zinc-900 mb-3">{title}</h1>
    <p className="text-zinc-500 leading-relaxed mb-8">{body}</p>
    <div className="flex flex-col gap-3">
      {retry && (
        <button onClick={retry} className="min-h-[48px] bg-[#233DFF] hover:bg-[#1a30cc] text-white font-bold rounded-full text-sm uppercase tracking-wide px-8">
          Try Again
        </button>
      )}
      <a href={PORTAL_HOME} className="min-h-[48px] flex items-center justify-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900">
        Go to volunteer portal <ExternalLink size={14} />
      </a>
    </div>
  </CenteredCard>
);

const SuccessCard: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <CenteredCard>
    <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100">
      <CheckCircle2 className="text-emerald-500" size={28} />
    </div>
    <h1 className="text-2xl font-black text-zinc-900 mb-3">{title}</h1>
    <p className="text-zinc-500 leading-relaxed mb-8">{body}</p>
    <a href={PORTAL_HOME} className="inline-flex items-center justify-center gap-2 min-h-[48px] bg-[#233DFF] hover:bg-[#1a30cc] text-white font-bold rounded-full text-sm uppercase tracking-wide px-8">
      Open the volunteer portal <ExternalLink size={14} />
    </a>
  </CenteredCard>
);

async function safeJson(res: Response) {
  try { return await res.json(); } catch { return null; }
}

export default PublicSurveyView;
