
import React, { useState, useMemo } from 'react';
import { KnowledgeBaseArticle } from '../types';
import { KNOWLEDGE_BASE_ARTICLES } from '../docs';
import { BookOpen, Search, ChevronDown, X, FileText } from 'lucide-react';

const DocumentationHub: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['Policies & Procedures']);
    const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);

    const filteredArticles = useMemo(() => {
        if (!searchQuery) return KNOWLEDGE_BASE_ARTICLES;
        const lowerQuery = searchQuery.toLowerCase();
        return KNOWLEDGE_BASE_ARTICLES.filter(
            article =>
                article.title.toLowerCase().includes(lowerQuery) ||
                article.content.toLowerCase().includes(lowerQuery) ||
                article.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }, [searchQuery]);

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

    return (
        <div className="space-y-12 animate-in fade-in duration-700 pb-20">
            <header>
                <h1 className="text-5xl font-black text-zinc-900 tracking-tighter">Documentation Hub</h1>
                <p className="text-zinc-500 mt-2 font-medium text-lg">Your central source for policies, procedures, and organizational knowledge.</p>
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
                    const articles = articlesByCategory[category];
                    return (
                    <div key={category} className="bg-white border border-zinc-100 rounded-[32px] overflow-hidden">
                        <button onClick={() => toggleCategory(category)} className="w-full flex items-center justify-between p-6">
                            <h2 className="text-xl font-bold text-zinc-800">{category}</h2>
                            <ChevronDown className={`transition-transform ${expandedCategories.includes(category) ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedCategories.includes(category) && (
                            <div className="px-6 pb-6 space-y-2">
                                {articles.map(article => (
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
                <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
            )}
        </div>
    );
};

const ArticleModal: React.FC<{ article: KnowledgeBaseArticle, onClose: () => void }> = ({ article, onClose }) => {
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
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700"><X size={20}/></button>
                </header>
                <main className="p-8 prose overflow-y-auto" dangerouslySetInnerHTML={{ __html: renderContent(article.content) }} />
            </div>
        </div>
    );
};

export default DocumentationHub;
