import React, { useState, useEffect } from 'react';
import { X, Star, CheckCircle, Loader2, ClipboardCheck } from 'lucide-react';
import { FormField } from '../types';
import surveyService, { FormDefinition } from '../services/surveyService';
import { DEFAULT_FORMS } from './FormBuilder';
import { toastService } from '../services/toastService';

interface VolunteerSurveyModalProps {
  formId: string;
  volunteerId: string;
  volunteerName: string;
  eventId?: string;
  eventTitle?: string;
  onClose: () => void;
  onComplete?: () => void;
}

const VolunteerSurveyModal: React.FC<VolunteerSurveyModalProps> = ({
  formId,
  volunteerId,
  volunteerName,
  eventId,
  eventTitle,
  onClose,
  onComplete,
}) => {
  const [form, setForm] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  useEffect(() => {
    const loadForm = async () => {
      try {
        // Try Firestore first
        const forms = await surveyService.getForms();
        const found = forms.find(f => f.id === formId);
        if (found) {
          setForm(found);
        } else {
          // Fall back to hardcoded defaults (forms may not be persisted to Firestore yet)
          const defaultForm = DEFAULT_FORMS.find(f => f.id === formId);
          if (defaultForm) setForm(defaultForm);
        }
      } catch (err) {
        console.error('Failed to load survey form from Firestore, using defaults:', err);
        const defaultForm = DEFAULT_FORMS.find(f => f.id === formId);
        if (defaultForm) setForm(defaultForm);
      } finally {
        setLoading(false);
      }
    };
    loadForm();
  }, [formId]);

  const setAnswer = (fieldId: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  const toggleCheckbox = (fieldId: string, option: string) => {
    const current = (answers[fieldId] as string[]) || [];
    if (current.includes(option)) {
      setAnswer(fieldId, current.filter(o => o !== option));
    } else {
      setAnswer(fieldId, [...current, option]);
    }
  };

  const handleSubmit = async () => {
    if (!form) return;

    // Validate required fields
    const missing = form.fields.filter(f => f.required && !answers[f.id]?.length);
    if (missing.length > 0) {
      toastService.error(`Please complete all required fields (${missing.length} remaining)`);
      return;
    }

    setSubmitting(true);
    try {
      const answersFlat = Object.fromEntries(
        Object.entries(answers).map(([key, val]) => [key, Array.isArray(val) ? val.join(', ') : val])
      );
      await surveyService.submitSurveyResponse({
        formId,
        formTitle: form.title,
        eventId: eventId || '',
        respondentId: volunteerId,
        respondentType: 'volunteer',
        responses: answersFlat,
        // Also store as answers for analytics compatibility
        answers: answersFlat,
        respondentName: volunteerName,
      } as any);
      setSubmitted(true);
      onComplete?.();
    } catch (err) {
      toastService.error('Failed to submit survey. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField, index: number) => {
    const value = answers[field.id];

    if (field.type === 'Rating') {
      const rating = typeof value === 'string' ? parseInt(value, 10) : 0;
      return (
        <div key={field.id} className="space-y-3">
          <label className="block text-sm font-bold text-zinc-800">
            {index + 1}. {field.question} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setAnswer(field.id, String(n))}
                className={`w-12 h-12 rounded-xl font-bold text-sm flex items-center justify-center transition-all ${
                  rating === n
                    ? 'bg-brand text-white shadow-elevation-2 scale-110'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-zinc-400 px-1">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>
      );
    }

    if (field.type === 'Multiple Choice') {
      return (
        <div key={field.id} className="space-y-3">
          <label className="block text-sm font-bold text-zinc-800">
            {index + 1}. {field.question} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="space-y-2">
            {(field.options || []).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setAnswer(field.id, opt)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  value === opt
                    ? 'bg-brand/10 border-2 border-brand text-brand'
                    : 'bg-zinc-50 border-2 border-zinc-100 text-zinc-700 hover:border-zinc-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === 'Checkboxes') {
      const selected = (value as string[]) || [];
      return (
        <div key={field.id} className="space-y-3">
          <label className="block text-sm font-bold text-zinc-800">
            {index + 1}. {field.question} {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="space-y-2">
            {(field.options || []).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleCheckbox(field.id, opt)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-3 ${
                  selected.includes(opt)
                    ? 'bg-brand/10 border-2 border-brand text-brand'
                    : 'bg-zinc-50 border-2 border-zinc-100 text-zinc-700 hover:border-zinc-200'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                  selected.includes(opt) ? 'border-brand bg-brand' : 'border-zinc-300'
                }`}>
                  {selected.includes(opt) && <CheckCircle size={12} className="text-white" />}
                </div>
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Short Text / Long Text
    return (
      <div key={field.id} className="space-y-3">
        <label className="block text-sm font-bold text-zinc-800">
          {index + 1}. {field.question} {field.required && <span className="text-rose-500">*</span>}
        </label>
        <textarea
          value={(value as string) || ''}
          onChange={e => setAnswer(field.id, e.target.value)}
          placeholder="Type your response..."
          className="w-full p-4 h-24 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-medium text-sm resize-none"
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-2xl w-full rounded-3xl shadow-elevation-3 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <ClipboardCheck size={20} className="text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-black text-zinc-900">{form?.title || 'Survey'}</h2>
              {eventTitle && <p className="text-xs text-zinc-500">{eventTitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] p-3 bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-800 flex items-center justify-center">
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <main className="p-4 md:p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-brand" size={32} />
            </div>
          ) : submitted ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-zinc-900">Thank You!</h3>
              <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                Your feedback has been recorded. It helps us make every event better.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-3 min-h-[44px] bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide"
              >
                Done
              </button>
            </div>
          ) : form ? (
            <div className="space-y-6">
              {form.description && (
                <p className="text-sm text-zinc-500 italic">{form.description}</p>
              )}
              {form.fields.map((field, i) => renderField(field, i))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-sm text-zinc-400 font-bold">Survey not found.</p>
            </div>
          )}
        </main>

        {/* Footer */}
        {!submitted && form && !loading && (
          <footer className="p-4 md:p-6 border-t border-zinc-100 shrink-0">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full min-h-[44px] flex items-center justify-center gap-3 px-6 py-3 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 hover:bg-brand/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              Submit Survey
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};

export default VolunteerSurveyModal;
