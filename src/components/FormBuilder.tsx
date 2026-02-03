import React, { useState } from 'react';
import { FileText, Plus, Save, Trash2, PlusCircle, X, Loader2, CheckCircle, Eye, ChevronRight, TextCursorInput, List, CheckSquare as CheckSquareIcon, Star } from 'lucide-react';
import { apiService } from '../services/apiService';
import { FormField } from '../types';

const INITIAL_FORMS = [
    { id: 'client-intake', title: 'Client Intake Form', description: 'Collect comprehensive client information, demographics, and social determinant needs.', fields: [] },
    { id: 'new-resource', title: 'New Referral Resource', description: 'Add a new community organization or program to the referral database.', fields: [] },
    { id: 'event-feedback', title: 'Post-Event Feedback Survey', description: 'Gather attendee feedback on community events and workshops.', fields: [
        { id: 'q1', type: 'Rating', question: 'How would you rate your overall event experience?', options: ['1', '2', '3', '4', '5'], required: true },
        { id: 'q2', type: 'Short Text', question: 'Do you have any feedback for the event coordinators?', required: false },
    ] },
];

const FormBuilder: React.FC = () => {
    const [forms, setForms] = useState(INITIAL_FORMS);
    const [activeForm, setActiveForm] = useState<typeof INITIAL_FORMS[0] | null>(null);

    const handleSaveForm = (updatedForm: typeof INITIAL_FORMS[0]) => {
        // Check if this is a new form or existing form
        const existingFormIndex = forms.findIndex(f => f.id === updatedForm.id);
        if (existingFormIndex >= 0) {
            setForms(forms.map(f => f.id === updatedForm.id ? updatedForm : f));
        } else {
            setForms([...forms, updatedForm]);
        }
        setActiveForm(null);
        alert("Form saved successfully!");
    };

    const handleCreateNewForm = () => {
        const newForm = {
            id: `form-${Date.now()}`,
            title: 'New Survey Form',
            description: 'Enter a description for your new form.',
            fields: []
        };
        setActiveForm(newForm);
    };

    if (activeForm) {
        return <FormEditor form={activeForm} onSave={handleSaveForm} onBack={() => setActiveForm(null)} />;
    }

    return (
        <div className="space-y-12 animate-in fade-in duration-700 pb-20">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-5xl font-black text-zinc-900 tracking-tighter">Forms Dashboard</h1>
                    <p className="text-zinc-500 mt-2 font-medium text-lg">Manage data collection forms for surveys, applications, and feedback.</p>
                </div>
                <button
                    onClick={handleCreateNewForm}
                    className="flex items-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-transform"
                >
                    <Plus size={16} /> New Form
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {forms.map(form => (
                    <div key={form.id} className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm flex flex-col">
                        <div className="flex-1">
                          <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 mb-6 border border-zinc-100"><FileText /></div>
                          <h3 className="text-lg font-black text-zinc-900">{form.title}</h3>
                          <p className="text-sm text-zinc-500 mt-2">{form.description}</p>
                        </div>
                        <div className="mt-8 pt-6 border-t border-zinc-100 flex justify-end">
                            <button onClick={() => setActiveForm(form)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-zinc-100 text-zinc-600 px-4 py-3 rounded-xl hover:bg-zinc-200">
                                Edit Form
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const FormEditor: React.FC<{form: any, onSave: (form: any) => void, onBack: () => void}> = ({ form, onSave, onBack }) => {
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
                <button onClick={() => onSave({ ...form, title: formTitle, fields })} className="flex items-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg">
                    <Save size={16} /> Save Changes
                </button>
            </div>

            <div className="grid grid-cols-12 gap-8 items-start">
                <div className="col-span-8 bg-white p-12 rounded-[48px] border border-zinc-100 shadow-sm space-y-8">
                    <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full text-3xl font-black text-zinc-900 outline-none p-2 -ml-2 rounded-lg focus:bg-zinc-50" />
                    {fields.map(field => (
                        <div key={field.id} className="p-6 bg-zinc-50 border border-zinc-100 rounded-2xl relative group">
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
                                    <button onClick={() => addOption(field.id)} className="flex items-center gap-2 text-xs font-bold text-blue-600 mt-2 p-1 hover:bg-blue-50 rounded"><PlusCircle size={14} /> Add Option</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="col-span-4 bg-white p-8 rounded-[48px] border border-zinc-100 shadow-sm space-y-4">
                     <h3 className="text-lg font-black text-zinc-900 mb-4 uppercase tracking-widest">Add Field</h3>
                     {fieldTypes.map(field => (
                         <button key={field.name} onClick={() => addField(field.name)} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-xl flex items-center gap-4 hover:border-blue-300 hover:bg-blue-50">
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