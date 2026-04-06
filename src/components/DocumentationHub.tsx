
import React, { useState, useMemo, useEffect } from 'react';
import { KnowledgeBaseArticle, Volunteer } from '../types';
import { KNOWLEDGE_BASE_ARTICLES } from '../docs';
import { geminiService } from '../services/geminiService';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';
import { BookOpen, Search, ChevronDown, X, FileText, Plus, Edit3, Save, Trash2, Sparkles, Loader2, Wand2, RefreshCw, Eye } from 'lucide-react';
import { toastService } from '../services/toastService';

interface DocumentationHubProps {
    currentUser?: Volunteer;
}

const DocumentationHub: React.FC<DocumentationHubProps> = ({ currentUser }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['Policies & Procedures', 'Volunteer Protocols & References']);
    const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
    const [articles, setArticles] = useState<KnowledgeBaseArticle[]>(KNOWLEDGE_BASE_ARTICLES);
    const [showNewArticleModal, setShowNewArticleModal] = useState(false);
    const [editingArticle, setEditingArticle] = useState<KnowledgeBaseArticle | null>(null);

    // Load persisted articles from backend on mount
    useEffect(() => {
        apiService.get('/api/knowledge-base').then((serverArticles: KnowledgeBaseArticle[]) => {
            if (serverArticles?.length) {
                // Merge: server articles override defaults by ID, plus any new server-only articles
                const merged = [...KNOWLEDGE_BASE_ARTICLES];
                serverArticles.forEach((sa: KnowledgeBaseArticle) => {
                    const idx = merged.findIndex(a => a.id === sa.id);
                    if (idx >= 0) merged[idx] = sa;
                    else merged.push(sa);
                });
                setArticles(merged);
            }
        }).catch(() => { /* Use defaults if API unavailable */ });
    }, []);

    // Allow admins and coordinator roles to edit documents
    const coordinatorRoles = ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead', 'Development Coordinator'];
    const canEdit = currentUser?.isAdmin || currentUser?.canEdit || coordinatorRoles.includes(currentUser?.role || '');

    const roleFilteredArticles = useMemo(() => {
        if (currentUser?.isAdmin) return articles;
        return articles.filter(a =>
            !a.visibleTo || a.visibleTo.length === 0 || a.visibleTo.includes(currentUser?.role || '')
        );
    }, [articles, currentUser?.isAdmin, currentUser?.role]);

    const filteredArticles = useMemo(() => {
        if (!searchQuery) return roleFilteredArticles;
        const lowerQuery = searchQuery.toLowerCase();
        return roleFilteredArticles.filter(
            article =>
                article.title.toLowerCase().includes(lowerQuery) ||
                article.content.toLowerCase().includes(lowerQuery) ||
                article.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }, [searchQuery, roleFilteredArticles]);

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

    const handleSaveArticle = async (article: KnowledgeBaseArticle) => {
        const existingIndex = articles.findIndex(a => a.id === article.id);
        try {
            if (existingIndex >= 0) {
                await apiService.put(`/api/knowledge-base/${article.id}`, article);
                setArticles(articles.map(a => a.id === article.id ? article : a));
            } else {
                const saved = await apiService.post('/api/knowledge-base', article);
                setArticles([...articles, { ...article, id: saved.id }]);
            }
        } catch (error) {
            // Fallback to local state if API fails
            if (existingIndex >= 0) {
                setArticles(articles.map(a => a.id === article.id ? article : a));
            } else {
                setArticles([...articles, article]);
            }
            toastService.error('Failed to save article to server. Changes saved locally.');
        }
        setShowNewArticleModal(false);
        setEditingArticle(null);
    };

    const handleDeleteArticle = async (articleId: string) => {
        if (confirm('Are you sure you want to delete this document?')) {
            try { await apiService.delete(`/api/knowledge-base/${articleId}`); } catch { /* proceed anyway */ }
            setArticles(articles.filter(a => a.id !== articleId));
            setSelectedArticle(null);
        }
    };

    const handleEditArticle = (article: KnowledgeBaseArticle) => {
        setEditingArticle(article);
        setSelectedArticle(null);
    };

    return (
        <div className="space-y-4 md:space-y-8 animate-in fade-in duration-700 pb-20">
            <header className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Documentation Hub</h1>
                    <p className="text-sm md:text-lg font-medium text-zinc-500 mt-2">Your central source for policies, procedures, and organizational knowledge.</p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => setShowNewArticleModal(true)}
                        className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-3 px-6 py-4 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 hover:scale-105 transition-transform"
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
                    className="w-full pl-16 pr-6 py-5 bg-zinc-50 border-2 border-zinc-100 rounded-full text-sm md:text-lg font-bold shadow-elevation-1 outline-none focus:border-brand/30"
                />
            </div>

            <div className="space-y-4">
                {Object.keys(articlesByCategory).map((category) => {
                    const categoryArticles = articlesByCategory[category];
                    return (
                    <div key={category} className="bg-white border border-zinc-100 rounded-2xl md:rounded-[40px] shadow-sm hover:shadow-2xl transition-shadow overflow-hidden">
                        <button onClick={() => toggleCategory(category)} className="w-full flex items-center justify-between p-4 md:p-6">
                            <h2 className="text-base md:text-xl font-bold text-zinc-900">{category}</h2>
                            <ChevronDown className={`transition-transform ${expandedCategories.includes(category) ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedCategories.includes(category) && (
                            <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-2">
                                {categoryArticles.map(article => (
                                    <button key={article.id} onClick={() => setSelectedArticle(article)} className="w-full text-left p-4 rounded-3xl hover:bg-zinc-50 flex items-center gap-4">
                                        <FileText className="text-zinc-400" size={18} />
                                        <span className="font-bold text-zinc-700">{article.title}</span>
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
    const renderContent = (content: string) => {
        const escapeHtmlInner = (t: string) => t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
        const applyInline = (t: string) => t
            .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code class="bg-zinc-100 px-1.5 py-0.5 rounded text-xs font-mono text-zinc-800">$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-brand underline font-medium">$1</a>');

        const lines = content.split('\n');
        let html = '';
        let tableRows: string[] = [];
        let listItems: string[] = [];
        let listType: 'ul' | 'ol' | null = null;

        const isTableSep = (r: string) => r.replace(/[\s|:\-]/g, '') === '';

        const flushTable = () => {
            if (!tableRows.length) return;
            const dataRows = tableRows.filter(r => !isTableSep(r));
            if (dataRows.length < 1) { tableRows = []; return; }
            const parseRow = (r: string) => r.split('|').slice(1, -1).map(c => escapeHtmlInner(c.trim()));
            const headers = parseRow(dataRows[0]).map(c => `<th class="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide bg-zinc-50 border-b border-zinc-200">${applyInline(c)}</th>`).join('');
            const body = dataRows.slice(1).map(r => {
                const cells = parseRow(r).map(c => `<td class="px-3 py-2 text-sm text-zinc-700 border-b border-zinc-100">${applyInline(c)}</td>`).join('');
                return `<tr class="hover:bg-zinc-50/60">${cells}</tr>`;
            }).join('');
            html += `<div class="overflow-x-auto my-4 rounded-xl border border-zinc-200"><table class="w-full border-collapse text-left"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></div>`;
            tableRows = [];
        };

        const flushList = () => {
            if (!listItems.length) return;
            const tag = listType === 'ol' ? 'ol' : 'ul';
            const cls = listType === 'ol' ? 'list-decimal' : 'list-disc';
            html += `<${tag} class="${cls} pl-5 space-y-1 my-3 text-sm text-zinc-700">${listItems.map(i => `<li>${i}</li>`).join('')}</${tag}>`;
            listItems = [];
            listType = null;
        };

        for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            const trimmed = line.trim();

            // Table
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                if (listType) flushList();
                tableRows.push(trimmed);
                continue;
            } else if (tableRows.length) {
                flushTable();
            }

            // Unordered list
            if (/^[-*+] /.test(trimmed)) {
                if (listType === 'ol') flushList();
                listType = 'ul';
                listItems.push(applyInline(escapeHtmlInner(trimmed.replace(/^[-*+] /, ''))));
                continue;
            }
            // Ordered list
            if (/^\d+[.)]\s/.test(trimmed)) {
                if (listType === 'ul') flushList();
                listType = 'ol';
                listItems.push(applyInline(escapeHtmlInner(trimmed.replace(/^\d+[.)]\s/, ''))));
                continue;
            }
            if (listType) flushList();

            // Headings
            if (/^#### /.test(trimmed)) {
                html += `<h4 class="text-base font-bold mt-3 mb-1 text-zinc-800">${applyInline(escapeHtmlInner(trimmed.slice(5)))}</h4>`;
            } else if (/^### /.test(trimmed)) {
                html += `<h3 class="text-lg font-bold mt-5 mb-2 text-zinc-900">${applyInline(escapeHtmlInner(trimmed.slice(4)))}</h3>`;
            } else if (/^## /.test(trimmed)) {
                html += `<h2 class="text-xl font-black mt-6 mb-2 text-zinc-900">${applyInline(escapeHtmlInner(trimmed.slice(3)))}</h2>`;
            } else if (/^# /.test(trimmed)) {
                html += `<h1 class="text-2xl font-black mt-6 mb-3 text-zinc-900">${applyInline(escapeHtmlInner(trimmed.slice(2)))}</h1>`;
            } else if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
                html += '<hr class="my-5 border-zinc-200" />';
            } else if (trimmed === '') {
                html += '<div class="h-2"></div>';
            } else {
                html += `<p class="text-sm text-zinc-700 leading-relaxed mb-2">${applyInline(escapeHtmlInner(trimmed))}</p>`;
            }
        }

        // Flush any remaining
        if (tableRows.length) flushTable();
        if (listType) flushList();

        return html;
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
            <div className={`bg-white w-full rounded-modal shadow-elevation-2 flex flex-col max-h-[90vh] border border-zinc-100 ${article.documentUrl ? 'max-w-5xl' : 'max-w-3xl'}`} onClick={e => e.stopPropagation()}>
                <header className="p-4 md:p-6 border-b border-zinc-100 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-bold text-brand uppercase">{article.category}</p>
                        <h2 className="text-xl md:text-2xl font-black tracking-tight text-zinc-900">{article.title}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {canEdit && (
                            <>
                                <button onClick={() => onEdit(article)} className="p-2 text-zinc-400 hover:text-brand transition-colors">
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
                {article.documentUrl ? (
                    <main className="flex-1 overflow-hidden flex flex-col">
                        <p className="px-4 md:px-8 pt-4 md:pt-6 pb-4 text-sm text-zinc-500 font-bold leading-relaxed">{article.content}</p>
                        <iframe
                            src={article.documentUrl}
                            className="flex-1 w-full border-t border-zinc-100"
                            title={article.title}
                            style={{ minHeight: '60vh' }}
                        />
                    </main>
                ) : (
                    <main className="p-4 md:p-8 prose overflow-y-auto" dangerouslySetInnerHTML={{ __html: renderContent(article.content) }} />
                )}
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
    const [visibleTo, setVisibleTo] = useState<string[]>(article?.visibleTo || []);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [showAiPanel, setShowAiPanel] = useState(false);
    const allRoles = APP_CONFIG.HMC_ROLES.map(r => r.label);

    const handleSave = () => {
        if (!title.trim() || !content.trim()) {
            toastService.error('Please fill in both title and content.');
            return;
        }

        const finalCategory = newCategory.trim() || category;
        const savedArticle: KnowledgeBaseArticle = {
            id: article?.id || `doc-${Date.now()}`,
            title: title.trim(),
            content: content.trim(),
            category: finalCategory,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
            ...(visibleTo.length > 0 ? { visibleTo } : {})
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
            toastService.error('Failed to generate content. Please try again.');
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
            toastService.error('Failed to improve content. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white max-w-5xl w-full rounded-modal shadow-elevation-3 flex flex-col max-h-[90vh] border border-zinc-100" onClick={e => e.stopPropagation()}>
                <header className="p-4 md:p-8 border-b border-zinc-100 flex items-center justify-between">
                    <h2 className="text-xl md:text-2xl font-black text-zinc-900">{article ? 'Edit Document' : 'New Document'}</h2>
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
                    <main className={`p-4 md:p-8 space-y-4 md:space-y-6 overflow-y-auto ${showAiPanel ? 'w-full md:w-2/3' : 'w-full'}`}>
                        <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Document title..."
                                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Category</label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm"
                                >
                                    {existingCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Or Create New Category</label>
                                <input
                                    type="text"
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    placeholder="New category name..."
                                    className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block">Content (Markdown supported)</label>
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
                                className="w-full min-h-[300px] p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-mono text-sm resize-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Tags (comma-separated)</label>
                            <input
                                type="text"
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                placeholder="policy, hipaa, compliance..."
                                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                                <Eye size={12} className="inline mr-1" />
                                Visible To (leave empty for all roles)
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {allRoles.map(role => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => setVisibleTo(prev =>
                                            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
                                        )}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                            visibleTo.includes(role)
                                                ? 'bg-brand text-white'
                                                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                                        }`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                            {visibleTo.length > 0 && (
                                <p className="text-xs text-zinc-400 mt-2">
                                    Only visible to: {visibleTo.join(', ')}
                                </p>
                            )}
                        </div>
                    </main>

                    {showAiPanel && (
                        <aside className="hidden md:block w-1/3 border-l border-zinc-100 p-4 md:p-6 bg-gradient-to-b from-purple-50 to-white overflow-y-auto">
                            <div className="flex items-center gap-2 mb-4 md:mb-6">
                                <Sparkles size={20} className="text-purple-600" />
                                <h3 className="text-base md:text-xl font-bold text-zinc-900">AI Document Assistant</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white p-4 rounded-3xl border border-purple-100 shadow-elevation-1">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Generate Content</p>
                                    <p className="text-xs text-zinc-400 mb-3">Describe what you want to write about and AI will help draft the content.</p>
                                    <textarea
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                        placeholder="e.g., Write a guide about volunteer onboarding procedures..."
                                        className="w-full h-24 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl text-sm resize-none outline-none focus:border-brand/30 font-bold"
                                    />
                                    <button
                                        onClick={handleAiGenerate}
                                        disabled={!aiPrompt.trim() || isGenerating}
                                        className="mt-3 w-full py-2 bg-purple-600 border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-purple-700 transition-colors"
                                    >
                                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        Generate
                                    </button>
                                </div>

                                <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-elevation-1">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">Quick Prompts</p>
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
                                                className="w-full text-left px-3 py-2 bg-zinc-50 hover:bg-purple-50 rounded-2xl text-xs text-zinc-600 hover:text-purple-700 transition-colors"
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

                <footer className="p-4 md:p-8 border-t border-zinc-100 flex flex-col sm:flex-row justify-end gap-4">
                    <button onClick={onClose} className="w-full sm:w-auto min-h-[44px] px-6 py-3 border border-black rounded-full font-bold text-xs uppercase tracking-wide hover:bg-zinc-50">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="w-full sm:w-auto min-h-[44px] px-8 py-3 bg-brand border border-black text-white rounded-full font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-elevation-2"
                    >
                        <Save size={16} /> Save Document
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default DocumentationHub;
