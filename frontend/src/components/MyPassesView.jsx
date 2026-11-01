import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  MessageSquarePlus,
  Nfc,
  PlusCircle,
  QrCode,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  Star,
  UserCheck,
  X
} from 'lucide-react';
import { transitApi } from '../api/transitApi';
import { useAuth } from '../context/AuthContext';

const QUICK_TOPUP_AMOUNTS = [50, 100, 250, 500];

export default function MyPassesView({
  network,
  onRequireAuth,
  onInspectPass,
  onReplanCorridor,
  onNotify,
  refreshSignal = 0
}) {
  const { user, refreshProfile } = useAuth();

  const [walletHistory, setWalletHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [topupBusy, setTopupBusy] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [walletMsg, setWalletMsg] = useState(null);

  const [passFilterStatus, setPassFilterStatus] = useState('ALL');
  const [passSearchText, setPassSearchText] = useState('');
  const [scanningId, setScanningId] = useState(null);

  const [reviewsPage, setReviewsPage] = useState({ content: [], page: { totalElements: 0 } });
  const [targetType, setTargetType] = useState('JOURNEY_PLANNER');
  const [busRouteId, setBusRouteId] = useState('');
  const [metroStationId, setMetroStationId] = useState('');
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  const loadReviews = useCallback(async () => {
    try {
      const page = await transitApi.getFeedback(0, 10);
      setReviewsPage(page || { content: [], page: { totalElements: 0 } });
    } catch {
      // Keep existing list on transient error
    }
  }, []);

  const loadUserPasses = useCallback(async () => {
    if (!user) {
      setWalletHistory(null);
      return;
    }
    setLoadingHistory(true);
    try {
      const data = await transitApi.getHistoryAndWallet();
      setWalletHistory(data);
    } catch (err) {
      setWalletMsg({ tone: 'error', text: err.message });
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserPasses();
    loadReviews();
  }, [loadUserPasses, loadReviews, refreshSignal]);

  const handleTopUp = async (amount) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    const numeric = Number(amount);
    if (Number.isNaN(numeric) || numeric < 10 || numeric > 5000) {
      setWalletMsg({
        tone: 'error',
        text: 'Please enter a valid recharge amount between Rs. 10 and Rs. 5,000.'
      });
      return;
    }

    setTopupBusy(true);
    setWalletMsg(null);
    try {
      const updatedProfile = await transitApi.topUpWallet(numeric);
      await refreshProfile();
      await loadUserPasses();
      setCustomAmount('');
      const msg = `Added Rs. ${numeric.toFixed(2)} to Smart Card ${updatedProfile.smartCardNo}. New balance: Rs. ${Number(updatedProfile.walletBalanceInr).toFixed(2)}`;
      setWalletMsg({ tone: 'success', text: msg });
      if (onNotify) {
        onNotify(`Wallet recharged +Rs. ${numeric.toFixed(0)}`);
      }
    } catch (err) {
      setWalletMsg({ tone: 'error', text: err.message });
    } finally {
      setTopupBusy(false);
    }
  };

  const handleCustomTopUpSubmit = (e) => {
    e.preventDefault();
    handleTopUp(customAmount);
  };

  const handleScanPassInline = async (pass) => {
    if (!pass?.historyId || pass.passStatus === 'USED') {
      return;
    }
    setScanningId(pass.historyId);
    try {
      await transitApi.scanPass(pass.historyId);
      await loadUserPasses();
      if (onNotify) {
        onNotify(`Turnstile scan complete: ${pass.qrPassCode} marked USED`);
      }
    } catch (err) {
      if (onNotify) {
        onNotify(err.message || 'Scan failed', 'error');
      }
    } finally {
      setScanningId(null);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setSubmittingFeedback(true);
    setFeedbackNotice(null);
    try {
      await transitApi.submitFeedback({
        targetType,
        busRouteId: targetType === 'BUS_ROUTE' ? Number(busRouteId) : null,
        metroStationId: targetType === 'METRO_STATION' ? Number(metroStationId) : null,
        rating: Number(rating),
        comments
      });
      setComments('');
      setFeedbackNotice({
        tone: 'success',
        text: 'Thank you! Your commuter feedback was saved to MySQL feedback table.'
      });
      if (onNotify) {
        onNotify('Feedback submitted to MySQL');
      }
      await loadReviews();
    } catch (err) {
      setFeedbackNotice({ tone: 'error', text: err.message });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const allPasses = useMemo(() => walletHistory?.bookedPasses || [], [walletHistory]);

  const passCounts = useMemo(() => {
    const active = allPasses.filter((p) => p.passStatus === 'ACTIVE').length;
    const used = allPasses.filter((p) => p.passStatus === 'USED').length;
    return { total: allPasses.length, active, used };
  }, [allPasses]);

  const filteredPasses = useMemo(() => {
    const q = passSearchText.trim().toLowerCase();
    return allPasses.filter((p) => {
      if (passFilterStatus !== 'ALL' && p.passStatus !== passFilterStatus) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        String(p.qrPassCode || '').toLowerCase().includes(q) ||
        String(p.sourceName || '').toLowerCase().includes(q) ||
        String(p.destinationName || '').toLowerCase().includes(q)
      );
    });
  }, [allPasses, passFilterStatus, passSearchText]);

  const metroStationsList = (network?.metroLines || []).flatMap((l) =>
    (l.stations || []).map((s) => ({ ...s, lineName: l.lineName }))
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6 space-y-6 btc-fade-in">
      {/* Top Grid: Realistic NCMC Contactless Smart Card + Booked Unified QR Passes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* NCMC Contactless Smart Wallet Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="btc-ncmc-card rounded-3xl text-white p-6 shadow-floating border border-slate-800">
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-200">
                  Bengaluru One &bull; NCMC RuPay Transit
                </div>
                <div className="font-display text-sm font-bold text-white/95 mt-0.5">
                  BMTC &times; Namma Metro Unified Card
                </div>
              </div>
              <Nfc className="w-6 h-6 text-blue-200" />
            </div>

            {/* EMV Metallic Chip Graphic */}
            <div className="relative z-10 mt-5 flex items-center justify-between">
              <div className="w-11 h-8 rounded-lg bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-500 border border-amber-100/60 shadow-inner flex items-center justify-center">
                <div className="w-7 h-5 rounded-xs border border-amber-700/35 grid grid-cols-2 gap-px p-0.5">
                  <span className="border border-amber-700/25 rounded-[1px]" />
                  <span className="border border-amber-700/25 rounded-[1px]" />
                  <span className="border border-amber-700/25 rounded-[1px]" />
                  <span className="border border-amber-700/25 rounded-[1px]" />
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-300/30 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
                ACID Protected
              </span>
            </div>

            {user ? (
              <div className="relative z-10">
                <div className="mt-5">
                  <div className="text-[11px] font-semibold text-blue-200">
                    Available Smart Wallet Balance
                  </div>
                  <div className="font-display text-3xl font-extrabold tabular-nums mt-0.5">
                    Rs. {Number(user.walletBalanceInr || 0).toFixed(2)}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-blue-200 text-[10px] uppercase tracking-wider">
                      Cardholder
                    </div>
                    <div className="font-bold tracking-wide">{user.fullName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-blue-200 text-[10px] uppercase tracking-wider">
                      Smart Card ID
                    </div>
                    <div className="font-mono font-bold tracking-wider">{user.smartCardNo}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative z-10 mt-5 space-y-3">
                <p className="text-xs text-blue-100 leading-relaxed">
                  Sign in to access your NCMC Smart Wallet, issue ACID-protected Unified QR Passes, and inspect journey history.
                </p>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-extrabold shadow-sm hover:bg-blue-50 transition-colors"
                >
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>Sign In / Use Demo Account</span>
                </button>
              </div>
            )}
          </div>

          {user && (
            <div className="bg-white rounded-3xl border border-slate-200/95 p-5 space-y-3.5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-blue-600" />
                  <span>Instant Wallet Recharge</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">passenger_wallets</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {QUICK_TOPUP_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={topupBusy}
                    onClick={() => handleTopUp(amt)}
                    className="py-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:border-blue-600 text-blue-800 text-xs font-extrabold tabular-nums transition-all active:scale-[0.98]"
                  >
                    +Rs. {amt}
                  </button>
                ))}
              </div>

              {/* Custom Amount Input (Rs. 10 - Rs. 5,000) */}
              <form onSubmit={handleCustomTopUpSubmit} className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-500">
                  <span className="text-xs font-extrabold text-slate-500">Rs.</span>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    step="1"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Custom amount (10 - 5000)"
                    className="w-full bg-transparent text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none tabular-nums"
                  />
                </div>
                <button
                  type="submit"
                  disabled={topupBusy || !customAmount}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white text-xs font-extrabold transition-colors whitespace-nowrap"
                >
                  {topupBusy ? 'Adding...' : 'Add Funds'}
                </button>
              </form>

              {walletMsg && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl text-xs font-semibold ${
                    walletMsg.tone === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  {walletMsg.tone === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  )}
                  <span>{walletMsg.text}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Booked Unified QR Passes (Boarding-Pass Ticket Stubs) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/95 p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-display text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <span>Booked Unified QR Passes</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Atomically issued via MySQL stored procedure{' '}
                <code className="font-mono text-slate-700">sp_book_unified_qr_pass</code>
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Row-Locked ACID Ledger
            </span>
          </div>

          {user && allPasses.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold">
                {[
                  { id: 'ALL', label: `All (${passCounts.total})` },
                  { id: 'ACTIVE', label: `Active (${passCounts.active})` },
                  { id: 'USED', label: `Used (${passCounts.used})` }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPassFilterStatus(f.id)}
                    className={`px-2.5 py-1 rounded-lg transition-all tabular-nums ${
                      passFilterStatus === f.id
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-blue-500">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={passSearchText}
                  onChange={(e) => setPassSearchText(e.target.value)}
                  placeholder="Search QR code or station..."
                  className="bg-transparent text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none w-44"
                />
                {passSearchText && (
                  <button
                    type="button"
                    onClick={() => setPassSearchText('')}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {!user ? (
            <div className="py-12 text-center text-sm text-slate-500 bg-slate-50 rounded-2xl border border-slate-200/80">
              Sign in on the left card to view your booked BMTC + Namma Metro QR passes.
            </div>
          ) : loadingHistory && !walletHistory ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500">
              Loading passes from travel_history...
            </div>
          ) : filteredPasses.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200/80">
              {allPasses.length === 0
                ? 'No passes booked yet. Book any route in the Journey Planner to generate an instant QR pass!'
                : 'No passes match your current filter.'}
            </div>
          ) : (
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {filteredPasses.map((p) => {
                const isUsed = p.passStatus === 'USED';
                return (
                  <div
                    key={p.historyId}
                    className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-white to-blue-50/40 border border-slate-200/95 hover:border-blue-300 shadow-2xs transition-all"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md">
                          {p.qrPassCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isUsed
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {p.passStatus}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900 truncate mt-1.5">
                        {p.sourceName} &rarr; {p.destinationName}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 tabular-nums">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                          <Clock className="w-3 h-3 text-blue-600" /> {p.totalTimeMins} mins
                        </span>
                        <span>&bull; Debited Rs. {Number(p.farePaidInr).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onReplanCorridor && (
                        <button
                          type="button"
                          onClick={() =>
                            onReplanCorridor({
                              sourceName: p.sourceName,
                              destinationName: p.destinationName
                            })
                          }
                          title="Re-open this corridor in Journey Planner"
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-700 text-xs font-bold transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Re-Plan</span>
                        </button>
                      )}

                      {!isUsed && (
                        <button
                          type="button"
                          disabled={scanningId === p.historyId}
                          onClick={() => handleScanPassInline(p)}
                          title="Simulate scanning QR pass at transit gate"
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-colors"
                        >
                          <ScanLine className="w-3.5 h-3.5" />
                          <span>{scanningId === p.historyId ? '...' : 'Scan Gate'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onInspectPass && onInspectPass(p)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold whitespace-nowrap shadow-xs transition-all"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Open Ticket</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent MySQL Saved Searches */}
          {user && (walletHistory?.recentSearches || []).length > 0 && (
            <div className="pt-4 border-t border-slate-200/90">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2.5">
                <History className="w-3.5 h-3.5 text-blue-600" />
                <span>Recent MySQL Saved Searches (journey_plans)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {walletHistory.recentSearches.slice(0, 4).map((s) => (
                  <div
                    key={s.planId}
                    className="p-3 rounded-xl border border-slate-200/90 text-xs bg-slate-50/70 flex items-center justify-between gap-2 tabular-nums"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">
                        {s.sourceName} &rarr; {s.destinationName}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {s.optimizationType} &bull; {s.totalTimeMins}m &bull; Rs.{' '}
                        {Number(s.estimatedFareInr).toFixed(0)}
                      </div>
                    </div>
                    {onReplanCorridor && (
                      <button
                        type="button"
                        onClick={() =>
                          onReplanCorridor({
                            sourceName: s.sourceName,
                            destinationName: s.destinationName
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 text-[11px] font-bold text-blue-700 shrink-0 transition-colors"
                      >
                        Plan
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid: Interactive Star Feedback Studio + Community Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleFeedbackSubmit}
          className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/95 p-6 space-y-4 shadow-card"
        >
          <h3 className="font-display text-base font-extrabold text-slate-900 flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-blue-600" />
            <span>Rate a BMTC Route, Station or Planner</span>
          </h3>

          {feedbackNotice && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold ${
                feedbackNotice.tone === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {feedbackNotice.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="JOURNEY_PLANNER">Journey Planner</option>
                <option value="BUS_ROUTE">BMTC Bus Route</option>
                <option value="METRO_STATION">Namma Metro Station</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Star Rating ({rating}/5)
              </label>
              <div className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50">
                {[1, 2, 3, 4, 5].map((starVal) => (
                  <button
                    key={starVal}
                    type="button"
                    onClick={() => setRating(starVal)}
                    className="p-0.5 focus:outline-none transition-transform hover:scale-110"
                    title={`${starVal} Star${starVal > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`w-5 h-5 ${
                        starVal <= Number(rating)
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {targetType === 'BUS_ROUTE' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select BMTC Route
              </label>
              <select
                required
                value={busRouteId}
                onChange={(e) => setBusRouteId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="">-- Choose Route --</option>
                {(network?.busRoutes || []).map((r) => (
                  <option key={r.routeId} value={r.routeId}>
                    {r.routeNumber} - {r.routeName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'METRO_STATION' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Metro Station
              </label>
              <select
                required
                value={metroStationId}
                onChange={(e) => setMetroStationId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="">-- Choose Station --</option>
                {metroStationsList.map((s) => (
                  <option key={s.stationId} value={s.stationId}>
                    {s.stationName} ({s.lineName})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Commuter Review</label>
            <textarea
              required
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Share skywalk transfer convenience, bus frequency, or signage notes..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <button
            type="submit"
            disabled={submittingFeedback}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm transition-all"
          >
            {submittingFeedback ? 'Saving to MySQL...' : 'Submit Commuter Feedback'}
          </button>
        </form>

        {/* Community Reviews Feed */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/95 p-6 space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-extrabold text-slate-900">
              Verified Commuter Feedback (
              {reviewsPage?.page?.totalElements || reviewsPage?.content?.length || 0})
            </h3>
            <span className="text-[11px] font-mono text-slate-400">MySQL feedback</span>
          </div>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {(reviewsPage?.content || []).map((fb) => (
              <div
                key={fb.feedbackId}
                className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-900">{fb.targetLabel}</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold tabular-nums">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span>{fb.rating}/5</span>
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{fb.comments}</p>
                <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                  <span className="font-semibold">By {fb.passengerName}</span>
                  <span className="uppercase font-extrabold text-emerald-700">
                    {fb.reviewStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
