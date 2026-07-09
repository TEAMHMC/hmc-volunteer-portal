import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Coins, Plus, RotateCcw, Search, User, ArrowUpCircle, ArrowDownCircle, BarChart3, ChevronRight, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Volunteer } from '../types';
import { apiService } from '../services/apiService';

interface HealthCreditsAdminProps {
  user: Volunteer;
}

interface CreditAccount {
  id: string;
  displayName: string;
  email?: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
}

interface CreditTransaction {
  id: string;
  userId: string;
  displayName: string;
  type: 'award' | 'reversal';
  direction: 'credit' | 'debit';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  category: string;
  awardedBy: string;
  awardedByName: string;
  reversalOf?: string;
  createdAt: string;
}

interface SearchResult {
  id: string;
  displayName: string;
  email?: string;
  source: 'volunteer' | 'client';
}

interface PoolStats {
  totalAccounts: number;
  totalBalance: number;
  totalEarned: number;
  totalSpent: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  screening: 'Health Screening',
  workshop: 'Workshop / Training',
  event: 'Event Attendance',
  volunteer: 'Volunteer Service',
  navigator: 'Navigator Onboarding',
  referral: 'Community Referral',
  admin: 'Admin Award',
  reversal: 'Correction / Reversal',
};

const CATEGORY_DEFAULTS: Record<string, number> = {
  screening: 200,
  workshop: 100,
  event: 150,
  volunteer: 200,
  navigator: 100,
  referral: 75,
  admin: 100,
};

const AMOUNT_PRESETS = [100, 200, 300, 500];

type ActiveView = 'main' | 'award' | 'ledger' | 'stats';
type AwardStep = 'search' | 'form' | 'success';

export default function HealthCreditsAdmin({ user }: HealthCreditsAdminProps) {
  const [view, setView] = useState<ActiveView>('main');
  const [awardStep, setAwardStep] = useState<AwardStep>('search');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected member + their account
  const [selectedMember, setSelectedMember] = useState<SearchResult | null>(null);
  const [memberAccount, setMemberAccount] = useState<CreditAccount | null>(null);
  const [memberTransactions, setMemberTransactions] = useState<CreditTransaction[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);

  // Award form
  const [category, setCategory] = useState('screening');
  const [amount, setAmount] = useState(200);
  const [customAmount, setCustomAmount] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [reason, setReason] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [awardResult, setAwardResult] = useState<{ balanceBefore: number; balanceAfter: number; transactionId: string } | null>(null);

  // Ledger
  const [ledgerTransactions, setLedgerTransactions] = useState<CreditTransaction[]>([]);
  const [pool, setPool] = useState<PoolStats | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Reversal
  const [reversalTarget, setReversalTarget] = useState<CreditTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);
  const [reversalError, setReversalError] = useState('');

  const [error, setError] = useState('');

  const fetchLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const data = await apiService.get('/api/admin/credits/ledger?limit=100');
      setLedgerTransactions(data.transactions || []);
      setPool(data.pool || null);
    } catch {
      setLedgerTransactions([]);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'ledger' || view === 'stats' || view === 'main') {
      fetchLedger();
    }
  }, [view, fetchLedger]);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await apiService.get(`/api/admin/credits/search?q=${encodeURIComponent(q)}`);
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleSelectMember = async (member: SearchResult) => {
    setSelectedMember(member);
    setSearchResults([]);
    setSearchQuery('');
    setAccountLoading(true);
    try {
      const data = await apiService.get(`/api/admin/credits/account/${member.id}`);
      setMemberAccount(data.account);
      setMemberTransactions(data.transactions || []);
    } catch {
      setMemberAccount(null);
    } finally {
      setAccountLoading(false);
    }
    // Reset form
    setCategory('screening');
    setAmount(200);
    setUseCustom(false);
    setCustomAmount('');
    setReason('');
    setAwardResult(null);
    setAwardStep('form');
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    if (!useCustom) setAmount(CATEGORY_DEFAULTS[cat] ?? 100);
  };

  const handleAmountPreset = (a: number) => {
    setAmount(a);
    setUseCustom(false);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (val: string) => {
    setCustomAmount(val);
    setUseCustom(true);
    const parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) setAmount(parsed);
  };

  const handleAward = async () => {
    if (!selectedMember) return;
    const finalAmount = useCustom ? parseInt(customAmount) : amount;
    if (!finalAmount || finalAmount <= 0 || isNaN(finalAmount)) {
      setError('Enter a valid credit amount.');
      return;
    }
    if (!reason.trim()) { setError('A reason is required.'); return; }
    setError('');
    setAwarding(true);
    try {
      const result = await apiService.post('/api/admin/credits/award', {
        userId: selectedMember.id,
        displayName: selectedMember.displayName,
        email: selectedMember.email,
        amount: finalAmount,
        reason: reason.trim(),
        category,
      });
      setAwardResult(result);
      setAwardStep('success');
      fetchLedger();
    } catch (e: any) {
      setError(e?.message || 'Award failed. Please try again.');
    } finally {
      setAwarding(false);
    }
  };

  const handleReversal = async () => {
    if (!reversalTarget || !reversalReason.trim()) {
      setReversalError('A reason is required.');
      return;
    }
    setReversalError('');
    setReversing(true);
    try {
      await apiService.post('/api/admin/credits/reversal', {
        originalTransactionId: reversalTarget.id,
        reason: reversalReason.trim(),
      });
      setReversalTarget(null);
      setReversalReason('');
      fetchLedger();
    } catch (e: any) {
      setReversalError(e?.message || 'Reversal failed.');
    } finally {
      setReversing(false);
    }
  };

  const resetAward = () => {
    setSelectedMember(null);
    setMemberAccount(null);
    setMemberTransactions([]);
    setAwardStep('search');
    setAwardResult(null);
    setReason('');
    setError('');
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso; }
  };

  const formatCredits = (n: number) => n.toLocaleString();

  return (
    <div className="max-w-5xl mx-auto px-4 pb-20">
      <div className="py-8">
        <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic mb-1">Health Credits</h1>
        <p className="text-zinc-400 font-bold text-sm">Closed-loop community health capital ledger. $1 = 100 credits.</p>
      </div>

      {/* Top nav */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {[
          { id: 'main', label: 'Award Credits', icon: Plus },
          { id: 'ledger', label: 'Ledger', icon: ArrowUpCircle },
          { id: 'stats', label: 'Pool Stats', icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setView(id as ActiveView); if (id === 'main') { resetAward(); } }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all ${view === id ? 'bg-brand text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400'}`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* AWARD CREDITS VIEW */}
      {view === 'main' && (
        <div className="max-w-xl">
          {awardStep === 'search' && (
            <div className="bg-white rounded-3xl border border-zinc-100 p-6">
              <h2 className="text-lg font-black uppercase tracking-tight mb-4">Find Member</h2>
              <div className="relative">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-3 rounded-full border border-zinc-200 text-sm font-bold focus:outline-none focus:border-brand"
                />
              </div>
              {searchLoading && <p className="text-xs text-zinc-400 font-bold mt-3 px-2">Searching...</p>}
              {searchResults.length > 0 && (
                <div className="mt-3 space-y-1">
                  {searchResults.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleSelectMember(r)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-50 border border-transparent hover:border-zinc-100 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-zinc-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm">{r.displayName}</p>
                        {r.email && <p className="text-xs text-zinc-400 font-bold truncate">{r.email}</p>}
                      </div>
                      <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-zinc-300">{r.source}</span>
                      <ChevronRight size={14} className="text-zinc-300 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                <p className="text-xs text-zinc-400 font-bold mt-3 px-2">No members found. They may not be in the system yet.</p>
              )}
            </div>
          )}

          {awardStep === 'form' && selectedMember && (
            <div className="space-y-4">
              {/* Member card */}
              <div className="bg-white rounded-3xl border border-zinc-100 p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-zinc-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black">{selectedMember.displayName}</p>
                  {selectedMember.email && <p className="text-xs text-zinc-400 font-bold">{selectedMember.email}</p>}
                  {accountLoading ? (
                    <p className="text-xs text-zinc-300 font-bold mt-0.5">Loading balance...</p>
                  ) : (
                    <p className="text-xs text-zinc-400 font-bold mt-0.5">
                      Current balance: <span className="text-zinc-900 font-black">{formatCredits(memberAccount?.balance ?? 0)} credits</span>
                    </p>
                  )}
                </div>
                <button onClick={resetAward} className="text-zinc-300 hover:text-zinc-600 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Award form */}
              <div className="bg-white rounded-3xl border border-zinc-100 p-6 space-y-5">
                <h2 className="text-lg font-black uppercase tracking-tight">Award Health Credits</h2>

                {/* Category */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">Category</label>
                  <select
                    value={category}
                    onChange={e => handleCategoryChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-full border border-zinc-200 text-sm font-bold bg-white focus:outline-none focus:border-brand"
                  >
                    {Object.entries(CATEGORY_LABELS).filter(([k]) => k !== 'reversal').map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">Credits to Award</label>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {AMOUNT_PRESETS.map(a => (
                      <button
                        key={a}
                        onClick={() => handleAmountPreset(a)}
                        className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all ${!useCustom && amount === a ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={e => handleCustomAmountChange(e.target.value)}
                    placeholder="Custom amount..."
                    min="1"
                    max="100000"
                    className={`w-full px-4 py-3 rounded-full border text-sm font-bold focus:outline-none ${useCustom ? 'border-brand' : 'border-zinc-200'} focus:border-brand`}
                  />
                  <p className="text-[10px] font-black text-zinc-300 mt-1 px-1">
                    = ${((useCustom ? parseInt(customAmount) || 0 : amount) / 100).toFixed(2)} in health access value
                  </p>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">Reason (required)</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder={`e.g. Completed blood pressure screening at Altadena Fair`}
                    className="w-full px-4 py-3 rounded-full border border-zinc-200 text-sm font-bold focus:outline-none focus:border-brand"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-rose-600 bg-rose-50 rounded-2xl px-4 py-3">
                    <AlertCircle size={14} />
                    <span className="text-xs font-black">{error}</span>
                  </div>
                )}

                <button
                  onClick={handleAward}
                  disabled={awarding || !reason.trim()}
                  className="w-full py-4 rounded-full bg-brand text-white font-black text-sm uppercase tracking-[0.2em] disabled:opacity-40 hover:bg-zinc-900 transition-colors"
                >
                  {awarding ? 'Awarding...' : `Award ${formatCredits(useCustom ? parseInt(customAmount) || 0 : amount)} Credits`}
                </button>
              </div>

              {/* Member's recent transactions */}
              {memberTransactions.length > 0 && (
                <div className="bg-white rounded-3xl border border-zinc-100 p-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Recent Transactions</h3>
                  <div className="space-y-2">
                    {memberTransactions.slice(0, 5).map(tx => (
                      <div key={tx.id} className="flex items-center gap-3 py-2">
                        {tx.direction === 'credit'
                          ? <ArrowUpCircle size={16} className="text-emerald-500 flex-shrink-0" />
                          : <ArrowDownCircle size={16} className="text-rose-400 flex-shrink-0" />
                        }
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black truncate">{tx.reason}</p>
                          <p className="text-[10px] text-zinc-400 font-bold">{formatDate(tx.createdAt)}</p>
                        </div>
                        <span className={`text-sm font-black flex-shrink-0 ${tx.direction === 'credit' ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {tx.direction === 'credit' ? '+' : '-'}{formatCredits(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {awardStep === 'success' && selectedMember && awardResult && (
            <div className="bg-white rounded-3xl border border-zinc-100 p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-emerald-500" />
              </div>
              <div>
                <p className="font-black text-lg">Credits Awarded</p>
                <p className="text-zinc-400 text-sm font-bold">{selectedMember.displayName}</p>
              </div>
              <div className="bg-zinc-50 rounded-2xl p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-zinc-400">Previous Balance</span>
                  <span className="font-black">{formatCredits(awardResult.balanceBefore)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-zinc-400">Awarded</span>
                  <span className="font-black text-emerald-600">+{formatCredits(awardResult.balanceAfter - awardResult.balanceBefore)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-zinc-200 pt-2 mt-2">
                  <span className="font-bold text-zinc-400">New Balance</span>
                  <span className="font-black text-lg">{formatCredits(awardResult.balanceAfter)}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={resetAward}
                  className="flex-1 py-3 rounded-full bg-brand text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-900 transition-colors"
                >
                  Award Another
                </button>
                <button
                  onClick={() => { setView('ledger'); }}
                  className="flex-1 py-3 rounded-full bg-zinc-100 text-zinc-700 font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-200 transition-colors"
                >
                  View Ledger
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LEDGER VIEW */}
      {view === 'ledger' && (
        <div>
          {ledgerLoading ? (
            <p className="text-zinc-400 font-bold text-sm">Loading ledger...</p>
          ) : ledgerTransactions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-100 p-10 text-center">
              <Coins size={32} className="text-zinc-200 mx-auto mb-3" />
              <p className="font-black text-zinc-400">No transactions yet.</p>
              <p className="text-xs text-zinc-300 font-bold mt-1">Award credits to community members to start building the ledger.</p>
            </div>
          ) : (
            <>
              {reversalTarget && (
                <div className="bg-white rounded-3xl border border-rose-200 p-6 mb-6">
                  <h3 className="font-black text-sm uppercase tracking-wide mb-1">Reverse Transaction</h3>
                  <p className="text-xs text-zinc-400 font-bold mb-3">
                    Reversing: {formatCredits(reversalTarget.amount)} credits awarded to {reversalTarget.displayName} — "{reversalTarget.reason}"
                  </p>
                  <input
                    type="text"
                    value={reversalReason}
                    onChange={e => setReversalReason(e.target.value)}
                    placeholder="Reason for reversal (required)..."
                    className="w-full px-4 py-3 rounded-full border border-zinc-200 text-sm font-bold focus:outline-none focus:border-brand mb-3"
                  />
                  {reversalError && <p className="text-xs text-rose-600 font-black mb-3">{reversalError}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={handleReversal}
                      disabled={reversing || !reversalReason.trim()}
                      className="px-5 py-2.5 rounded-full bg-rose-500 text-white font-black text-xs uppercase tracking-[0.2em] disabled:opacity-40 hover:bg-rose-600 transition-colors"
                    >
                      {reversing ? 'Reversing...' : 'Confirm Reversal'}
                    </button>
                    <button
                      onClick={() => { setReversalTarget(null); setReversalReason(''); setReversalError(''); }}
                      className="px-5 py-2.5 rounded-full bg-zinc-100 text-zinc-600 font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-3xl border border-zinc-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        {['Date', 'Member', 'Type', 'Amount', 'Balance After', 'Category', 'Reason', 'Awarded By', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerTransactions.map(tx => (
                        <tr key={tx.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-zinc-400 whitespace-nowrap">{formatDate(tx.createdAt)}</td>
                          <td className="px-4 py-3 text-xs font-black whitespace-nowrap">{tx.displayName}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${tx.type === 'award' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <span className={`font-black ${tx.direction === 'credit' ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {tx.direction === 'credit' ? '+' : '-'}{formatCredits(tx.amount)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-zinc-600 whitespace-nowrap">{formatCredits(tx.balanceAfter)}</td>
                          <td className="px-4 py-3 text-xs font-bold text-zinc-400 whitespace-nowrap">{CATEGORY_LABELS[tx.category] || tx.category}</td>
                          <td className="px-4 py-3 text-xs font-bold text-zinc-600 max-w-[200px] truncate">{tx.reason}</td>
                          <td className="px-4 py-3 text-xs font-bold text-zinc-400 whitespace-nowrap">{tx.awardedByName}</td>
                          <td className="px-4 py-3">
                            {tx.type === 'award' && (
                              <button
                                onClick={() => setReversalTarget(tx)}
                                title="Reverse this transaction"
                                className="text-zinc-300 hover:text-rose-400 transition-colors"
                              >
                                <RotateCcw size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* POOL STATS VIEW */}
      {view === 'stats' && (
        <div className="space-y-6">
          {ledgerLoading ? (
            <p className="text-zinc-400 font-bold text-sm">Loading pool data...</p>
          ) : pool ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Active Accounts', value: pool.totalAccounts.toLocaleString(), sub: 'community members' },
                  { label: 'Total Pool Balance', value: formatCredits(pool.totalBalance), sub: `$${(pool.totalBalance / 100).toFixed(2)} in access value` },
                  { label: 'Lifetime Awarded', value: formatCredits(pool.totalEarned), sub: `$${(pool.totalEarned / 100).toFixed(2)} in services enabled` },
                  { label: 'Lifetime Redeemed', value: formatCredits(pool.totalSpent), sub: `$${(pool.totalSpent / 100).toFixed(2)} in services delivered` },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="bg-white rounded-3xl border border-zinc-100 p-5">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">{label}</p>
                    <p className="text-2xl font-black tracking-tight">{value}</p>
                    <p className="text-[10px] font-bold text-zinc-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-3xl border border-zinc-100 p-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Credit Rate</h3>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-black">$1</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Donor Dollar</p>
                  </div>
                  <div className="flex-1 h-px bg-zinc-100 relative">
                    <span className="absolute left-1/2 -translate-x-1/2 -top-3 text-[9px] font-black uppercase tracking-widest text-zinc-300">converts to</span>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-black text-brand">100</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Health Credits</p>
                  </div>
                </div>
                <p className="text-xs font-bold text-zinc-400 mt-4 border-t border-zinc-100 pt-4">
                  Health Credits are closed-loop units of health access. They cannot be transferred person-to-person, redeemed for cash, or used outside HMC's approved partner network. All transactions are recorded in an immutable ledger.
                </p>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-3xl border border-zinc-100 p-10 text-center">
              <Coins size={32} className="text-zinc-200 mx-auto mb-3" />
              <p className="font-black text-zinc-400">No pool data yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
