import React, { useState, useEffect } from 'react';
import { FileText, Plus, Save, Trash2, PlusCircle, X, Loader2, CheckCircle, Eye, ChevronRight, TextCursorInput, List, CheckSquare as CheckSquareIcon, Star, BarChart3, Download } from 'lucide-react';
import { FormField } from '../types';
import surveyService, { FormDefinition, SurveyResponse } from '../services/surveyService';
import { toastService } from '../services/toastService';

const DEFAULT_FORMS: FormDefinition[] = [
    { id: 'client-intake', title: 'Client Intake Form', description: 'Collect comprehensive client information, demographics, and social determinant needs.', fields: [], isActive: true, category: 'intake' },
    { id: 'new-resource', title: 'New Referral Resource', description: 'Add a new community organization or program to the referral database.', fields: [], isActive: true, category: 'referral' },
    { id: 'event-feedback', title: 'Post-Event Feedback Survey', description: 'Gather attendee feedback on community events and workshops.', fields: [
        { id: 'q1', type: 'Rating', question: 'How would you rate your overall event experience?', options: ['1', '2', '3', '4', '5'], required: true },
        { id: 'q2', type: 'Short Text', question: 'Do you have any feedback for the event coordinators?', required: false },
    ], isActive: true, category: 'feedback' },
    // Internal coordinator survey templates
    { id: 'volunteer-debrief', title: 'Post-Event Volunteer Debrief', description: 'Internal debrief survey for volunteers after an event. Measures team performance, communication, and areas for improvement.', fields: [
        { id: 'vd1', type: 'Rating', question: 'How clear were your role and responsibilities before the event?', options: ['1', '2', '3', '4', '5'], required: true },
        { id: 'vd2', type: 'Rating', question: 'How well did the team communicate during the event?', options: ['1', '2', '3', '4', '5'], required: true },
        { id: 'vd3', type: 'Rating', question: 'How adequate were the supplies and equipment provided?', options: ['1', '2', '3', '4', '5'], required: true },
        { id: 'vd4', type: 'Multiple Choice', question: 'Did you feel adequately trained for your assigned tasks?', options: ['Yes', 'Mostly', 'Somewhat', 'No'], required: true },
        { id: 'vd5', type: 'Short Text', question: 'What went well that we should repeat?', required: false },
        { id: 'vd6', type: 'Short Text', question: 'What could be improved for next time?', required: false },
    ], isActive: true, category: 'internal' },
    { id: 'volunteer-satisfaction', title: 'Volunteer Satisfaction Check-In', description: 'Quarterly survey to gauge volunteer engagement, satisfaction, and retention risk.', fields: [
        { id: 'vs1', type: 'Rating', question: 'Overall, how satisfied are you with your volunteer experience at HMC?', options: ['1', '2', '3', '4', '5'], required: true },
        { id: 'vs2', type: 'Rating', question: 'How supported do you feel by your coordinator or team lead?', options: ['1', '2', '3', '4', '5'], required: true },
        { id: 'vs3', type: 'Multiple Choice', question: 'How likely are you to continue volunteering with HMC in the next 6 months?', options: ['Definitely', 'Probably', 'Unsure', 'Unlikely'], required: true },
        { id: 'vs4', type: 'Checkboxes', question: 'What motivates you to volunteer? (Select all that apply)', options: ['Making an impact', 'Learning new skills', 'Building community', 'Resume/career development', 'Social connection', 'Mission alignment'], required: false },
        { id: 'vs5', type: 'Short Text', question: 'Is there anything we could do to improve your experience?', required: false },
    ], isActive: true, category: 'internal' },
    { id: 'ops-readiness', title: 'Operational Readiness Assessment', description: 'Pre-event checklist for coordinators to verify team readiness, logistics, and compliance.', fields: [
        { id: 'or1', type: 'Multiple Choice', question: 'Are all required volunteer slots filled for this event?', options: ['Yes', 'Partially (>75%)', 'Under-staffed (<75%)', 'Critical shortage'], required: true },
        { id: 'or2', type: 'Multiple Choice', question: 'Have all assigned volunteers completed required training?', options: ['Yes, all verified', 'Most (1-2 pending)', 'Several gaps', 'Not checked'], required: true },
        { id: 'or3', type: 'Multiple Choice', question: 'Are supplies and equipment confirmed and packed?', options: ['Yes, fully prepared', 'Mostly ready', 'Significant items missing', 'Not started'], required: true },
        { id: 'or4', type: 'Multiple Choice', question: 'Is there a clinical lead assigned (if screenings are offered)?', options: ['Yes', 'No — not required', 'No — still needed', 'Pending confirmation'], required: true },
        { id: 'or5', type: 'Checkboxes', question: 'Confirm the following are in place:', options: ['Venue confirmed', 'Parking/transit plan', 'Sign-in sheets printed', 'Emergency contact list', 'First aid kit', 'Water/snacks for volunteers'], required: false },
        { id: 'or6', type: 'Short Text', question: 'Any outstanding issues or risks?', required: false },
    ], isActive: true, category: 'internal' },
    { id: 'team-performance', title: 'Team Performance Review', description: 'Periodic review of team dynamics, workload distribution, and process effectiveness for coordinators.', fields: [
        { id: 'tp1', type: 'Rating', question: 'How effectively is work distributed across the team?', options: ['1', '2', '3', '4', '5'], required: true },
        { id: 'tp2', type: 'Rating', question: 'How well are team members meeting their commitments?', options: ['1', '2', '3', '4', '5'], required: true },
        { id: 'tp3', type: 'Multiple Choice', question: 'What is the team\'s current morale?', options: ['Excellent', 'Good', 'Fair', 'Low'], required: true },
        { id: 'tp4', type: 'Checkboxes', question: 'Which areas need attention? (Select all that apply)', options: ['Onboarding/training', 'Communication', 'Scheduling conflicts', 'Burnout/workload', 'Role clarity', 'Tool/resource gaps'], required: false },
        { id: 'tp5', type: 'Short Text', question: 'What actions should leadership take to support this team?', required: false },
    ], isActive: true, category: 'internal' },
];

const FormBuilder: React.FC = () => {
    const [forms, setForms] = useState<FormDefinition[]>(DEFAULT_FORMS);
    const [activeForm, setActiveForm] = useState<FormDefinition | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [responseCounts, setResponseCounts] = useState<{ [formId: string]: number }>({});
    const [viewingResponses, setViewingResponses] = useState<{ formId: string; responses: SurveyResponse[] } | null>(null);

    // Load forms from Firestore on mount
    useEffect(() => {
        const loadForms = async () => {
            try {
                const firestoreForms = await surveyService.getForms();
                if (firestoreForms.length > 0) {
                    setForms(firestoreForms);
                }
                // Load response counts
                const counts = await surveyService.getSurveyResponseCounts();
                setResponseCounts(counts);
            } catch (error) {
                console.error('Error loading forms:', error);
                // Fall back to defaults
            } finally {
                setIsLoading(false);
            }
        };
        loadForms();
    }, []);

    const handleSaveForm = async (updatedForm: FormDefinition) => {
        setIsSaving(true);
        try {
            // Check if this is a new form or existing form
            const existingFormIndex = forms.findIndex(f => f.id === updatedForm.id);

            if (existingFormIndex >= 0 && updatedForm.id && !updatedForm.id.startsWith('form-')) {
                // Update existing form in Firestore
                await surveyService.updateForm(updatedForm.id, {
                    title: updatedForm.title,
                    description: updatedForm.description,
                    fields: updatedForm.fields,
                    category: updatedForm.category,
                    isActive: updatedForm.isActive
                });
                setForms(forms.map(f => f.id === updatedForm.id ? updatedForm : f));
            } else {
                // Create new form in Firestore
                const newFormId = await surveyService.createForm({
                    title: updatedForm.title,
                    description: updatedForm.description || '',
                    fields: updatedForm.fields,
                    isActive: true,
                    category: updatedForm.category || 'custom'
                });
                const newForm = { ...updatedForm, id: newFormId };
                setForms([...forms, newForm]);
            }
            setActiveForm(null);
        } catch (error) {
            console.error('Error saving form:', error);
            toastService.error('Failed to save form. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteForm = async (formId: string) => {
        if (!confirm('Are you sure you want to delete this form? This cannot be undone.')) return;

        try {
            await surveyService.deleteForm(formId);
            setForms(forms.filter(f => f.id !== formId));
        } catch (error) {
            console.error('Error deleting form:', error);
            toastService.error('Failed to delete form.');
        }
    };

    const handleViewResponses = async (formId: string) => {
        try {
            const responses = await surveyService.getSurveyResponsesByForm(formId);
            setViewingResponses({ formId, responses });
        } catch (error) {
            console.error('Error loading responses:', error);
            toastService.error('Failed to load responses.');
        }
    };

    const handleExportResponses = (responses: SurveyResponse[]) => {
        const csv = convertToCSV(responses);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `survey-responses-${Date.now()}.csv`;
        a.click();
    };

    const convertToCSV = (responses: SurveyResponse[]): string => {
        if (responses.length === 0) return '';

        // Get all unique field IDs across responses
        const allFields = new Set<string>();
        responses.forEach(r => Object.keys(r.responses || {}).forEach(k => allFields.add(k)));

        const headers = ['Submitted At', 'Event', 'Respondent Type', ...Array.from(allFields)];
        const rows = responses.map(r => [
            r.submittedAt || '',
            r.eventTitle || '',
            r.respondentType || '',
            ...Array.from(allFields).map(f => String(r.responses?.[f] || ''))
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    };

    const handleCreateNewForm = () => {
        const newForm: FormDefinition = {
            id: `form-${Date.now()}`,
            title: 'New Survey Form',
            description: 'Enter a description for your new form.',
            fields: [],
            isActive: true,
            category: 'custom'
        };
        setActiveForm(newForm);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-brand" size={32} />
            </div>
        );
    }

    // Responses viewer modal
    if (viewingResponses) {
        return (
            <div className="space-y-8 animate-in fade-in duration-500 pb-20">
                <header className="flex items-center justify-between">
                    <div>
                        <button onClick={() => setViewingResponses(null)} className="text-sm font-bold text-zinc-500 mb-2">← Back to Forms</button>
                        <h1 className="text-5xl font-black tracking-tighter uppercase italic">Survey Responses</h1>
                        <p className="text-lg font-medium text-zinc-500 mt-2">{viewingResponses.responses.length} responses collected</p>
                    </div>
                    <button
                        onClick={() => handleExportResponses(viewingResponses.responses)}
                        className="flex items-center gap-2 px-5 py-3 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2"
                    >
                        <Download size={16} /> Export CSV
                    </button>
                </header>

                {viewingResponses.responses.length === 0 ? (
                    <div className="bg-zinc-50 rounded-[40px] p-8 text-center border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
                        <BarChart3 className="mx-auto text-zinc-300 mb-4" size={48} />
                        <p className="text-zinc-400 font-bold text-sm">No responses collected yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {viewingResponses.responses.map((response, idx) => (
                            <div key={response.id || idx} className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">
                                        {response.submittedAt ? new Date(response.submittedAt).toLocaleString() : 'Unknown date'}
                                    </span>
                                    <span className="px-3 py-1 bg-brand/10 text-brand text-xs font-bold rounded-full">
                                        {response.respondentType}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {Object.entries(response.responses || {}).map(([key, value]) => (
                                        <div key={key} className="flex gap-4">
                                            <span className="text-sm font-bold text-zinc-500 min-w-[120px]">{key}:</span>
                                            <span className="text-sm text-zinc-800">{Array.isArray(value) ? value.join(', ') : String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (activeForm) {
        return <FormEditor form={activeForm} onSave={handleSaveForm} onBack={() => setActiveForm(null)} isSaving={isSaving} />;
    }

    return (
        <div className="space-y-12 animate-in fade-in duration-700 pb-20">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-5xl font-black tracking-tighter uppercase italic">Forms Dashboard</h1>
                    <p className="text-lg font-medium text-zinc-500 mt-2">Manage data collection forms for surveys, applications, and feedback.</p>
                </div>
                <button
                    onClick={handleCreateNewForm}
                    className="flex items-center gap-3 px-6 py-4 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 hover:scale-105 transition-transform"
                >
                    <Plus size={16} /> New Form
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {forms.map(form => (
                    <div key={form.id} className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow flex flex-col">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-6">
                            <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 border border-zinc-100"><FileText /></div>
                            {responseCounts[form.id!] > 0 && (
                              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full">
                                <BarChart3 size={14} className="text-green-600" />
                                <span className="text-xs font-bold text-green-700">{responseCounts[form.id!]} responses</span>
                              </div>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-zinc-900">{form.title}</h3>
                          <p className="text-sm text-zinc-500 mt-2">{form.description}</p>
                          <div className="mt-3">
                            <span className="px-2 py-1 bg-zinc-100 text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] rounded">
                              {form.category || 'custom'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-zinc-100 flex justify-between gap-3">
                            <button onClick={() => handleViewResponses(form.id!)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand hover:bg-brand/5 px-4 py-3 rounded-xl">
                                <BarChart3 size={14} /> Responses
                            </button>
                            <div className="flex gap-2">
                                <button onClick={() => handleDeleteForm(form.id!)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-500 hover:bg-rose-50 px-3 py-3 rounded-xl">
                                    <Trash2 size={14} />
                                </button>
                                <button onClick={() => setActiveForm(form)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-zinc-100 text-zinc-600 px-4 py-3 rounded-xl hover:bg-zinc-200">
                                    Edit Form
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const FormEditor: React.FC<{form: FormDefinition, onSave: (form: FormDefinition) => void, onBack: () => void, isSaving?: boolean}> = ({ form, onSave, onBack, isSaving }) => {
    const [formTitle, setFormTitle] = useState(form.title);
    const [fields, setFields] = useState<FormField[]>(form.fields);

    const addField = (type: FormField['type']) => {
        const newField: FormField = {
            id: `field-${Date.now()}`,
            type,
            question: 'New Question',
            ...( (type === 'Multiple Choice' || type === 'Checkboxes') && { options: ['Option 1'] } ),
            ...( type === 'Rating' && { options: ['1', '2', '3', '4', '5'] } )
        };
        setFields([...fields, newField]);
    };

    const updateField = (id: string, key: keyof FormField, value: any) => {
        setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
    };
    
    const removeField = (id: string) => setFields(fields.filter(f => f.id !== id));

    const addOption = (fieldId: string) => {
        setFields(fields.map(f => f.id === fieldId ? { ...f, options: [...(f.options || []), `Option ${(f.options?.length || 0) + 1}`] } : f));
    };

    const updateOption = (fieldId: string, optIndex: number, value: string) => {
         setFields(fields.map(f => f.id === fieldId ? { ...f, options: f.options?.map((opt, i) => i === optIndex ? value : opt) } : f));
    };
    
    const removeOption = (fieldId: string, optIndex: number) => {
        setFields(fields.map(f => f.id === fieldId ? { ...f, options: f.options?.filter((_, i) => i !== optIndex) } : f));
    }
    
    const fieldTypes: { name: FormField['type'], icon: React.ElementType }[] = [
        { name: 'Short Text', icon: TextCursorInput },
        { name: 'Multiple Choice', icon: List },
        { name: 'Checkboxes', icon: CheckSquareIcon },
        { name: 'Rating', icon: Star },
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="text-sm font-bold text-zinc-500">← Back to Forms</button>
                <button
                    onClick={() => onSave({ ...form, title: formTitle, fields })}
                    disabled={isSaving}
                    className="flex items-center gap-3 px-6 py-4 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="grid grid-cols-12 gap-8 items-start">
                <div className="col-span-8 bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow space-y-8">
                    <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full text-3xl font-black text-zinc-900 outline-none p-4 -ml-2 bg-zinc-50 border-2 border-zinc-100 rounded-2xl focus:border-brand/30" />
                    {fields.map(field => (
                        <div key={field.id} className="p-6 bg-zinc-50 border border-zinc-100 rounded-3xl relative group">
                            <button onClick={() => removeField(field.id)} className="absolute top-4 right-4 p-2 bg-white rounded-full text-zinc-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                            <input value={field.question} onChange={e => updateField(field.id, 'question', e.target.value)} className="font-bold text-zinc-700 w-full bg-transparent outline-none p-1 rounded focus:bg-white" />
                            
                            {(field.type === 'Multiple Choice' || field.type === 'Checkboxes') && (
                                <div className="space-y-2 mt-4">
                                    {field.options?.map((opt, i) => (
                                        <div key={i} className="flex items-center gap-2 group/option">
                                            <div className={`w-4 h-4 border-2 border-zinc-300 ${field.type === 'Multiple Choice' ? 'rounded-full' : 'rounded'}`} />
                                            <input value={opt} onChange={e => updateOption(field.id, i, e.target.value)} className="flex-1 bg-transparent p-1 rounded outline-none focus:bg-white" />
                                            <button onClick={() => removeOption(field.id, i)} className="text-zinc-300 hover:text-rose-500 opacity-0 group-hover/option:opacity-100"><X size={14}/></button>
                                        </div>
                                    ))}
                                    <button onClick={() => addOption(field.id)} className="flex items-center gap-2 text-xs font-bold text-brand mt-2 p-1 hover:bg-brand/5 rounded"><PlusCircle size={14} /> Add Option</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="col-span-4 bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow space-y-4">
                     <h3 className="text-xl font-bold text-zinc-900 mb-4">Add Field</h3>
                     {fieldTypes.map(field => (
                         <button key={field.name} onClick={() => addField(field.name)} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-3xl flex items-center gap-4 hover:border-brand/30 hover:bg-brand/5">
                            <field.icon className="text-zinc-400" />
                            <span className="font-bold text-zinc-700">{field.name}</span>
                         </button>
                     ))}
                </div>
            </div>
        </div>
    );
};

export default FormBuilder;