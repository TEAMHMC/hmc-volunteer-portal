
import React, { useState, useMemo } from 'react';
import { KnowledgeBaseArticle, Volunteer } from '../types';
import { KNOWLEDGE_BASE_ARTICLES } from '../docs';
import { geminiService } from '../services/geminiService';
import { BookOpen, Search, ChevronDown, X, FileText, Plus, Edit3, Save, Trash2, Sparkles, Loader2, Wand2, RefreshCw } from 'lucide-react';

interface DocumentationHubProps {
    currentUser?: Volunteer;
}

const DocumentationHub: React.FC<DocumentationHubProps> = ({ currentUser }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['Policies & Procedures']);
    const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
    const [articles, setArticles] = useState<KnowledgeBaseArticle[]>(KNOWLEDGE_BASE_ARTICLES);
    const [showNewArticleModal, setShowNewArticleModal] = useState(false);
    const [editingArticle, setEditingArticle] = useState<KnowledgeBaseArticle | null>(null);

    // Allow admins and coordinator roles to edit documents
    const coordinatorRoles = ['Events Coordinator', 'Program Coordinator', 'Operations Coordinator', 'Volunteer Lead', 'Development Coordinator'];
    const canEdit = currentUser?.canEdit || coordinatorRoles.includes(currentUser?.role || '');

    const filteredArticles = useMemo(() => {
        if (!searchQuery) return articles;
        const lowerQuery = searchQuery.toLowerCase();
        return articles.filter(
            article =>
                article.title.toLowerCase().includes(lowerQuery) ||
                article.content.toLowerCase().includes(lowerQuery) ||
                article.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }, [searchQuery, articles]);

    const articlesByCategory = useMemo(() => {
        return filteredArticles.reduce((acc, article) => {
            (acc[article.category] = acc[article.category] || []).push(article);
            return acc;
        }, {} as Record<string, KnowledgeBaseArticle[]>);
    }, [filteredArticles]);

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev =>
            prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
        );
    };

    const handleSaveArticle = (article: KnowledgeBaseArticle) => {
        const existingIndex = articles.findIndex(a => a.id === article.id);
        if (existingIndex >= 0) {
            setArticles(articles.map(a => a.id === article.id ? article : a));
        } else {
            setArticles([...articles, article]);
        }
        setShowNewArticleModal(false);
        setEditingArticle(null);
    };

    const handleDeleteArticle = (articleId: string) => {
        if (confirm('Are you sure you want to delete this document?')) {
            setArticles(articles.filter(a => a.id !== articleId));
            setSelectedArticle(null);
        }
    };

    const handleEditArticle = (article: KnowledgeBaseArticle) => {
        setEditingArticle(article);
        setSelectedArticle(null);
    };

    return (
        <div className="space-y-12 animate-in fade-in duration-700 pb-20">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-5xl font-black text-zinc-900 tracking-tighter">Documentation Hub</h1>
                    <p className="text-zinc-500 mt-2 font-medium text-lg">Your central source for policies, procedures, and organizational knowledge.</p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => setShowNewArticleModal(true)}
                        className="flex items-center gap-3 px-6 py-4 bg-[#233DFF] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-transform"
                    >
                        <Plus size={16} /> New Document
                    </button>
                )}
            </header>

            <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-16 pr-6 py-5 bg-white border border-zinc-200 rounded-full text-lg font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="space-y-4">
                {Object.keys(articlesByCategory).map((category) => {
                    const categoryArticles = articlesByCategory[category];
                    return (
                    <div key={category} className="bg-white border border-zinc-100 rounded-[32px] overflow-hidden">
                        <button onClick={() => toggleCategory(category)} className="w-full flex items-center justify-between p-6">
                            <h2 className="text-xl font-bold text-zinc-800">{category}</h2>
                            <ChevronDown className={`transition-transform ${expandedCategories.includes(category) ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedCategories.includes(category) && (
                            <div className="px-6 pb-6 space-y-2">
                                {categoryArticles.map(article => (
                                    <button key={article.id} onClick={() => setSelectedArticle(article)} className="w-full text-left p-4 rounded-xl hover:bg-zinc-50 flex items-center gap-4">
                                        <FileText className="text-zinc-400" size={18} />
                                        <span className="font-medium text-zinc-700">{article.title}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )})}
            </div>

            {selectedArticle && (
                <ArticleModal
                    article={selectedArticle}
                    onClose={() => setSelectedArticle(null)}
                    canEdit={canEdit}
                    onEdit={handleEditArticle}
                    onDelete={handleDeleteArticle}
                />
            )}

            {(showNewArticleModal || editingArticle) && (
                <ArticleEditorModal
                    article={editingArticle}
                    onSave={handleSaveArticle}
                    onClose={() => { setShowNewArticleModal(false); setEditingArticle(null); }}
                    existingCategories={[...new Set(articles.map(a => a.category))]}
                />
            )}
        </div>
    );
};

const ArticleModal: React.FC<{
    article: KnowledgeBaseArticle;
    onClose: () => void;
    canEdit: boolean;
    onEdit: (article: KnowledgeBaseArticle) => void;
    onDelete: (articleId: string) => void;
}> = ({ article, onClose, canEdit, onEdit, onDelete }) => {
    // A simple markdown-to-html renderer
    const renderContent = (content: string) => {
        return content
            .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-6 mb-2">$1</h2>')
            .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-4 mb-2">$1</h3>')
            .replace(/\n/g, '<br />');
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2001] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white max-w-3xl w-full rounded-2xl shadow-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-zinc-100 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-bold text-blue-600 uppercase">{article.category}</p>
                        <h2 className="text-2xl font-bold text-zinc-900">{article.title}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {canEdit && (
                            <>
                                <button onClick={() => onEdit(article)} className="p-2 text-zinc-400 hover:text-[#233DFF] transition-colors">
                                    <Edit3 size={20}/>
                                </button>
                                <button onClick={() => onDelete(article.id)} className="p-2 text-zinc-400 hover:text-rose-500 transition-colors">
                                    <Trash2 size={20}/>
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700"><X size={20}/></button>
                    </div>
                </header>
                <main className="p-8 prose overflow-y-auto" dangerouslySetInnerHTML={{ __html: renderContent(article.content) }} />
            </div>
        </div>
    );
};

const ArticleEditorModal: React.FC<{
    article: KnowledgeBaseArticle | null;
    onSave: (article: KnowledgeBaseArticle) => void;
    onClose: () => void;
    existingCategories: string[];
}> = ({ article, onSave, onClose, existingCategories }) => {
    const [title, setTitle] = useState(article?.title || '');
    const [content, setContent] = useState(article?.content || '');
    const [category, setCategory] = useState(article?.category || existingCategories[0] || 'Policies & Procedures');
    const [newCategory, setNewCategory] = useState('');
    const [tags, setTags] = useState(article?.tags?.join(', ') || '');
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [showAiPanel, setShowAiPanel] = useState(false);

    const handleSave = () => {
        if (!title.trim() || !content.trim()) {
            alert('Please fill in both title and content.');
            return;
        }

        const finalCategory = newCategory.trim() || category;
        const savedArticle: KnowledgeBaseArticle = {
            id: article?.id || `doc-${Date.now()}`,
            title: title.trim(),
            content: content.trim(),
            category: finalCategory,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean)
        };
        onSave(savedArticle);
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        try {
            const generated = await geminiService.generateDocument(aiPrompt, title || 'New Document');
            if (generated) {
                setContent(prev => prev ? `${prev}\n\n${generated}` : generated);
                if (!title && generated) {
                    // Try to extract a title from the generated content
                    const firstLine = generated.split('\n')[0];
                    if (firstLine.startsWith('##')) {
                        setTitle(firstLine.replace(/^#+\s*/, ''));
                    }
                }
            }
            setAiPrompt('');
        } catch (error) {
            console.error('AI generation failed:', error);
            alert('Failed to generate content. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAiImprove = async () => {
        if (!content.trim()) return;
        setIsGenerating(true);
        try {
            const improved = await geminiService.improveDocument(content, 'Make it more professional and comprehensive');
            if (improved) {
                setContent(improved);
            }
        } catch (error) {
            console.error('AI improvement failed:', error);
            alert('Failed to improve content. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2001] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white max-w-5xl w-full rounded-[32px] shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <header className="p-8 border-b border-zinc-100 flex items-center justify-between">
                    <h2 className="text-2xl font-black text-zinc-900">{article ? 'Edit Document' : 'New Document'}</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowAiPanel(!showAiPanel)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${showAiPanel ? 'bg-purple-100 text-purple-700' : 'bg-zinc-100 text-zinc-600 hover:bg-purple-50 hover:text-purple-600'}`}
                        >
                            <Sparkles size={14} /> AI Assistant
                        </button>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700"><X size={24}/></button>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    <main className={`p-8 space-y-6 overflow-y-auto ${showAiPanel ? 'w-2/3' : 'w-full'}`}>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Document title..."
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#233DFF]/30 font-medium"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Category</label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#233DFF]/30 font-medium"
                                >
                                    {existingCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Or Create New Category</label>
                                <input
                                    type="text"
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    placeholder="New category name..."
                                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#233DFF]/30 font-medium"
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide">Content (Markdown supported)</label>
                                {content && (
                                    <button
                                        onClick={handleAiImprove}
                                        disabled={isGenerating}
                                        className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700 disabled:opacity-50"
                                    >
                                        {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                        Improve with AI
                                    </button>
                                )}
                            </div>
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="Write your document content here... Use ## for headings and ### for subheadings."
                                className="w-full min-h-[300px] px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#233DFF]/30 font-mono text-sm resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Tags (comma-separated)</label>
                            <input
                                type="text"
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                placeholder="policy, hipaa, compliance..."
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#233DFF]/30 font-medium"
                            />
                        </div>
                    </main>

                    {showAiPanel && (
                        <aside className="w-1/3 border-l border-zinc-100 p-6 bg-gradient-to-b from-purple-50 to-white overflow-y-auto">
                            <div className="flex items-center gap-2 mb-6">
                                <Sparkles size={20} className="text-purple-600" />
                                <h3 className="text-lg font-black text-zinc-900">AI Document Assistant</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white p-4 rounded-xl border border-purple-100">
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Generate Content</p>
                                    <p className="text-xs text-zinc-400 mb-3">Describe what you want to write about and AI will help draft the content.</p>
                                    <textarea
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                        placeholder="e.g., Write a guide about volunteer onboarding procedures..."
                                        className="w-full h-24 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm resize-none outline-none focus:border-purple-300"
                                    />
                                    <button
                                        onClick={handleAiGenerate}
                                        disabled={!aiPrompt.trim() || isGenerating}
                                        className="mt-3 w-full py-2 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-purple-700 transition-colors"
                                    >
                                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        Generate
                                    </button>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-zinc-100">
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">Quick Prompts</p>
                                    <div className="space-y-2">
                                        {[
                                            'Write a standard operating procedure for...',
                                            'Create a training guide for new volunteers about...',
                                            'Draft a policy document for...',
                                            'Write FAQs about...',
                                            'Create a checklist for...'
                                        ].map((prompt, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setAiPrompt(prompt)}
                                                className="w-full text-left px-3 py-2 bg-zinc-50 hover:bg-purple-50 rounded-lg text-xs text-zinc-600 hover:text-purple-700 transition-colors"
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="text-xs text-zinc-400 text-center">
                                    <p>AI-generated content should be reviewed for accuracy before publishing.</p>
                                </div>
                            </div>
                        </aside>
                    )}
                </div>

                <footer className="p-8 border-t border-zinc-100 flex justify-end gap-4">
                    <button onClick={onClose} className="px-6 py-3 border border-zinc-200 rounded-full font-bold text-sm hover:bg-zinc-50">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-3 bg-[#233DFF] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:scale-105 transition-transform"
                    >
                        <Save size={16} /> Save Document
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default DocumentationHub;
