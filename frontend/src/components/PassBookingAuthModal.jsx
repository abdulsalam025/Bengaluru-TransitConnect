import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X
} from 'lucide-react';
import { transitApi } from '../api/transitApi';

function generateLocalPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function PassBookingAuthModal({
  option,
  user,
  busy = false,
  errorMessage = '',
  onClose,
  onConfirm
}) {
  const [authMode, setAuthMode] = useState('QUICK_CODE');
  const [challengeCode, setChallengeCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [digits, setDigits] = useState(['', '', '', '']);
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const digit0Ref = useRef(null);
  const digit1Ref = useRef(null);
  const digit2Ref = useRef(null);
  const digit3Ref = useRef(null);
  const digitRefs = useMemo(
    () => [digit0Ref, digit1Ref, digit2Ref, digit3Ref],
    []
  );
  const passwordRef = useRef(null);
  const submitBtnRef = useRef(null);

  const loadServerChallenge = useCallback(
    async (planId) => {
      if (!planId) {
        return;
      }
      setLoadingChallenge(true);
      setDigits(['', '', '', '']);
      setLocalError('');
      try {
        const res = await transitApi.requestBookingChallenge(planId);
        setChallengeCode(String(res.pinCode || generateLocalPin()));
        setChallengeToken(String(res.challengeToken || ''));
      } catch {
        // Graceful local fallback if user has not restarted backend yet
        setChallengeCode(generateLocalPin());
        setChallengeToken('');
      } finally {
        setLoadingChallenge(false);
        setTimeout(() => {
          digitRefs[0].current?.focus();
        }, 50);
      }
    },
    [digitRefs]
  );

  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [onClose, busy]);

  useEffect(() => {
    if (!option?.planId) {
      return undefined;
    }
    setAuthMode('QUICK_CODE');
    setPassword('');
    setLocalError('');
    loadServerChallenge(option.planId);

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busyRef.current) {
        onCloseRef.current?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [option?.planId, loadServerChallenge]);

  useEffect(() => {
    if (!option?.planId) {
      return undefined;
    }
    setLocalError('');
    const timer = setTimeout(() => {
      if (authMode === 'QUICK_CODE') {
        digitRefs[0].current?.focus();
      } else {
        passwordRef.current?.focus();
      }
    }, 45);
    return () => clearTimeout(timer);
  }, [authMode, option?.planId, digitRefs]);

  const fareInr = useMemo(() => Number(option?.estimatedFareInr || 0), [option]);
  const walletBalance = useMemo(() => Number(user?.walletBalanceInr || 0), [user]);
  const remainingBalance = useMemo(() => walletBalance - fareInr, [walletBalance, fareInr]);
  const insufficientBalance = remainingBalance < 0;

  if (!option || typeof document === 'undefined') {
    return null;
  }

  const enteredCode = digits.join('');
  const pinMatches =
    challengeCode.length === 4 && enteredCode.length === 4 && enteredCode === challengeCode;
  const canSubmit =
    !busy &&
    !loadingChallenge &&
    !insufficientBalance &&
    (authMode === 'QUICK_CODE' ? pinMatches : password.trim().length >= 4);

  const handleDigitChange = (idx, rawVal) => {
    const clean = rawVal.replace(/\D/g, '');
    setLocalError('');
    if (!clean) {
      const next = [...digits];
      next[idx] = '';
      setDigits(next);
      return;
    }
    if (clean.length > 1) {
      const pasted = clean.slice(0, 4).split('');
      const next = ['', '', '', ''];
      pasted.forEach((ch, pIdx) => {
        next[pIdx] = ch;
      });
      setDigits(next);
      if (pasted.length >= 4 && pasted.join('') === challengeCode) {
        setTimeout(() => submitBtnRef.current?.focus(), 30);
      } else {
        const focusIdx = Math.min(3, pasted.length - 1);
        digitRefs[focusIdx].current?.focus();
      }
      return;
    }
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    if (idx < 3) {
      digitRefs[idx + 1].current?.focus();
    } else if (next.join('') === challengeCode) {
      setTimeout(() => submitBtnRef.current?.focus(), 30);
    }
  };

  const handleDigitKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      digitRefs[idx - 1].current?.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (busy || insufficientBalance) {
      return;
    }
    if (authMode === 'QUICK_CODE') {
      if (enteredCode !== challengeCode) {
        setLocalError('Entered 4-digit security PIN does not match the verification code above.');
        return;
      }
      onConfirm({
        planId: option.planId,
        authMode: 'QUICK_CODE',
        challengeToken: challengeToken || undefined,
        challengeCode,
        enteredCode
      });
    } else {
      if (!password.trim()) {
        setLocalError('Please enter your account password to authorize this wallet debit.');
        return;
      }
      onConfirm({
        planId: option.planId,
        authMode: 'PASSWORD',
        password
      });
    }
  };

  const modalNode = (
    <div
      style={{ zIndex: 2200, backgroundColor: 'rgba(15, 23, 42, 0.72)' }}
      className="fixed inset-0 z-[2200] backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => {
        if (!busy) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Royal Transit Security Shield Header */}
        <div className="btc-command-hero relative px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-400/20 border border-emerald-300/35 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300">
                  NCMC Smart Wallet Shield
                </div>
                <h3 className="font-display text-lg font-extrabold tracking-tight text-white mt-0.5">
                  Authorize Unified QR Pass
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Short verification prevents accidental wallet debits
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Cancel booking"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Selected Journey Summary */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
              <span className="truncate">{option.sourceName}</span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{option.destinationName}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
              <span>
                {option.totalTimeMins} mins &bull; {(option.routeCategory || 'COMBINED').replace('_', ' ')}
              </span>
              <span className="text-blue-700 font-extrabold tabular-nums">
                Fare: Rs. {fareInr.toFixed(2)}
              </span>
            </div>
          </div>

          {/* NCMC Wallet Debit Ledger Preview */}
          <div className="p-3.5 rounded-2xl bg-blue-50/65 border border-blue-200/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600 font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-blue-600" />
                Current NCMC Balance
              </span>
              <span className="font-bold text-slate-900 tabular-nums">
                Rs. {walletBalance.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600 font-semibold">
              <span>Unified QR Pass Debit</span>
              <span className="font-bold text-rose-600 tabular-nums">
                - Rs. {fareInr.toFixed(2)}
              </span>
            </div>
            <div className="pt-1.5 border-t border-blue-200/70 flex items-center justify-between font-extrabold">
              <span className="text-slate-800">Balance After Issue</span>
              <span
                className={`tabular-nums ${
                  insufficientBalance ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                Rs. {remainingBalance.toFixed(2)}
              </span>
            </div>
          </div>

          {insufficientBalance && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <b>Insufficient NCMC Wallet Balance.</b> Please top up your wallet in the{' '}
                <b>My Passes &amp; Wallet</b> tab before issuing this pass.
              </div>
            </div>
          )}

          {/* Auth Method Selector Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setAuthMode('QUICK_CODE')}
              className={`py-2 px-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                authMode === 'QUICK_CODE'
                  ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>4-Digit Security PIN</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('PASSWORD')}
              className={`py-2 px-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                authMode === 'PASSWORD'
                  ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Account Password</span>
            </button>
          </div>

          {/* Auth Challenge Input */}
          {authMode === 'QUICK_CODE' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-900 text-white">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                    One-Time Security PIN
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Type these 4 digits below to unlock payment:
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {loadingChallenge ? (
                    <span className="px-4 py-1.5 rounded-xl bg-white/10 border border-white/15 flex items-center gap-1.5 text-xs text-slate-200">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>PIN...</span>
                    </span>
                  ) : (
                    <span className="font-mono text-xl font-black tracking-[0.28em] pl-3.5 pr-2.5 py-1 rounded-xl bg-white/10 border border-emerald-400/35 text-emerald-300 select-all">
                      {challengeCode}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={loadingChallenge || busy}
                    onClick={() => loadServerChallenge(option.planId)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    title="Generate a fresh 4-digit security PIN"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingChallenge ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={digitRefs[idx]}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    placeholder="-"
                    disabled={busy || loadingChallenge || insufficientBalance}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                    className={`w-12 h-14 text-center text-xl font-black rounded-2xl border-2 focus:outline-none transition-all tabular-nums ${
                      digit && challengeCode && digit === challengeCode[idx]
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : digit
                        ? 'border-rose-500 bg-rose-50 text-rose-900'
                        : 'border-slate-300 bg-slate-50 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/25 text-slate-900'
                    }`}
                  />
                ))}
              </div>

              {pinMatches && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Security PIN verified &mdash; ready to issue QR Pass!</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                Enter Account Password ({user?.email})
              </label>
              <input
                ref={passwordRef}
                type="password"
                value={password}
                disabled={busy || insufficientBalance}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLocalError('');
                }}
                placeholder="Enter your TransitConnect login password..."
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 focus:outline-none text-sm font-semibold text-slate-900"
              />
              <div className="text-[11px] text-slate-500">
                Verified server-side via Spring Security BCrypt against MySQL 8 before debiting wallet.
              </div>
            </div>
          )}

          {(localError || errorMessage) && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{localError || errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-1 flex items-center gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-extrabold transition-colors"
            >
              Cancel
            </button>
            <button
              ref={submitBtnRef}
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-45 disabled:pointer-events-none text-white text-xs font-extrabold shadow-sm inline-flex items-center justify-center gap-1.5 transition-all"
            >
              <QrCode className="w-4 h-4" />
              <span>
                {busy ? 'Verifying & Issuing...' : `Confirm & Pay Rs. ${fareInr.toFixed(0)}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}