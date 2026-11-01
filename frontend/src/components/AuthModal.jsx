import React, { useState } from 'react';
import { AlertCircle, KeyRound, ShieldCheck, Sparkles, UserPlus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  {
    label: 'Arjun Rao (Commuter)',
    roleTag: 'PASSENGER',
    note: 'Wallet: Rs. 450.00 - Ready to book Unified QR Passes',
    email: 'arjun.rao@bengaluru.in',
    password: 'Pass@123'
  },
  {
    label: 'Kavya Nair (Low Wallet Test)',
    roleTag: 'ACID TEST',
    note: 'Wallet: Rs. 35.00 - Demonstrates MySQL ACID Rollback',
    email: 'kavya.nair@bengaluru.in',
    password: 'Pass@123'
  },
  {
    label: 'Siddharth Kulkarni (Transit Admin)',
    roleTag: 'ROLE_ADMIN',
    note: 'Unlocks Admin Studio CRUD & MySQL Trigger Audit Logs',
    email: 'admin@transitconnect.in',
    password: 'Admin@123'
  }
];

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('arjun.rao@bengaluru.in');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('Pass@123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      let profile;
      if (mode === 'login') {
        profile = await login(email, password);
      } else {
        profile = await register({
          fullName,
          email,
          phone,
          password,
          preferredLanguage: 'en'
        });
      }
      if (onSuccess) {
        onSuccess(profile);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const applyDemoAccount = (acct) => {
    setMode('login');
    setEmail(acct.email);
    setPassword(acct.password);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-floating border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="btc-command-hero px-6 py-5 text-white flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-extrabold uppercase tracking-wider text-blue-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>BCrypt + Stateless JWT Security</span>
            </div>
            <h2 className="font-display text-xl font-extrabold mt-2">
              {mode === 'login' ? 'Sign In to TransitConnect' : 'Create Commuter Account'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1.5 bg-slate-100 border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-extrabold transition-all ${
              mode === 'login'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setEmail('');
              setPassword('');
              setError('');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-extrabold transition-all ${
              mode === 'register'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register (+Rs. 250 Wallet)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Rohan Kulkarni"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number (10-15 digits)
                </label>
                <input
                  type="tel"
                  required
                  pattern="^[0-9+\-]{10,15}$"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9845012345"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@bengaluru.in"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-bold text-sm shadow-glow-blue transition-all"
          >
            {submitting
              ? 'Authenticating with MySQL 8...'
              : mode === 'login'
              ? 'Sign In'
              : 'Create Account & Issue NCMC Wallet'}
          </button>

          {mode === 'login' && (
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Seeded Viva Demo Accounts (1-Click Fill)</span>
              </div>
              <div className="space-y-1.5">
                {DEMO_ACCOUNTS.map((acct) => (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => applyDemoAccount(acct)}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-all ${
                      email === acct.email
                        ? 'border-blue-600 bg-blue-50/75 shadow-2xs'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{acct.label}</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-200/80 text-[9px] font-extrabold text-slate-700">
                        {acct.roleTag}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{acct.note}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}