import React from 'react';
import {
  BarChart3,
  Bus,
  CreditCard,
  LogOut,
  Map as MapIcon,
  Nfc,
  Search,
  Settings,
  TrainFront,
  User as UserIcon,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { id: 'planner', label: 'Journey Planner', shortcut: 'Alt+1', icon: Search },
  { id: 'network', label: 'Network Explorer', shortcut: 'Alt+2', icon: MapIcon },
  { id: 'passes', label: 'Smart Passes', shortcut: 'Alt+3', icon: CreditCard },
  { id: 'analytics', label: 'SQL Analytics', shortcut: 'Alt+4', icon: BarChart3 },
  { id: 'admin', label: 'Admin Studio', shortcut: 'Alt+5', icon: Settings }
];

export default function Navbar({
  activeTab,
  onSelectTab,
  healthInfo,
  totalNodes = 0,
  onOpenAuth
}) {
  const { user, isAdmin, logout } = useAuth();

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('')
    : null;

  return (
    <header className="sticky top-0 z-[1000] bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-[0_1px_12px_rgba(15,23,42,0.05)]">
      <div className="max-w-[1680px] mx-auto px-4 lg:px-6 h-[68px] flex items-center justify-between gap-3">
        {/* Dual BMTC + Namma Metro Executive Brand Identity */}
        <button
          type="button"
          onClick={() => onSelectTab('planner')}
          className="flex items-center gap-3 text-left group focus:outline-none shrink-0"
        >
          <div className="flex items-center -space-x-2">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center shadow-sm ring-2 ring-white transition-transform duration-200 group-hover:-translate-y-0.5">
              <Bus className="w-5 h-5" />
            </span>
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center shadow-sm ring-2 ring-white transition-transform duration-200 group-hover:translate-y-0.5">
              <TrainFront className="w-5 h-5" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-base lg:text-[17px] font-extrabold tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors">
                Bengaluru TransitConnect
              </span>
              <span className="hidden 2xl:inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
                v2.5 Smooth Pro
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 hidden sm:flex items-center gap-1.5">
              <span>BMTC &times; Namma Metro</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-600 font-semibold">
                {totalNodes > 0 ? `${totalNodes}-Node + 300 Places` : 'One City. Smoother Tomorrow.'}
              </span>
            </div>
          </div>
        </button>

        {/* Primary Segmented Pill Navigation Dock */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-inner">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const showAdminDot = item.id === 'admin' && isAdmin;
            return (
              <button
                key={item.id}
                type="button"
                title={`${item.label} (${item.shortcut})`}
                onClick={() => onSelectTab(item.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-glow-blue scale-[1.01]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/90 active:scale-[0.99]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {showAdminDot && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? 'bg-emerald-300' : 'bg-emerald-500'
                    }`}
                    title="ROLE_ADMIN Active"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Telemetry, Mini NCMC Smart Card & Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          {healthInfo?.status === 'UP' ? (
            <div
              title={`Schema: ${healthInfo.database?.databaseName || 'bengaluru_transit'} | Engine: ${healthInfo.database?.mysqlVersion || 'MySQL 8'}`}
              className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/90 border border-emerald-200/90 text-emerald-800 text-xs font-bold"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>MySQL 8 Live</span>
            </div>
          ) : (
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Syncing DB...</span>
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              {/* Mini Contactless NCMC Wallet Chip */}
              <button
                type="button"
                onClick={() => onSelectTab('passes')}
                className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 hover:from-blue-900 hover:to-indigo-900 text-white border border-slate-700/80 shadow-sm transition-all active:scale-[0.98]"
                title="Open NCMC Smart Wallet & Unified QR Passes"
              >
                <Nfc className="w-4 h-4 text-blue-300 shrink-0" />
                <div className="text-left leading-tight">
                  <div className="text-[9px] uppercase tracking-widest font-bold text-blue-300">
                    {isAdmin ? 'Admin NCMC' : 'NCMC Wallet'}
                  </div>
                  <div className="text-xs font-extrabold tabular-nums text-white">
                    Rs. {Number(user.walletBalanceInr || 0).toFixed(2)}
                  </div>
                </div>
              </button>

              {/* Commuter Profile Pill */}
              <div className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full bg-slate-100/90 border border-slate-200/90">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xs font-extrabold flex items-center justify-center shadow-2xs">
                  {initials}
                </span>
                <div className="hidden lg:block text-left leading-tight max-w-[122px]">
                  <div className="text-xs font-bold text-slate-800 truncate">{user.fullName}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                    {isAdmin ? 'ROLE_ADMIN' : 'Commuter'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  className="p-1.5 rounded-full text-slate-500 hover:text-red-600 hover:bg-white transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold shadow-glow-blue transition-all active:scale-[0.98]"
            >
              <UserIcon className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Mobile Navigation Row */}
      <div className="flex md:hidden items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar border-t border-slate-100 bg-slate-50/90">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 bg-white border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
