import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { transitApi } from './api/transitApi';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import QrPassModal from './components/QrPassModal';
import JourneyPlannerView from './components/JourneyPlannerView';
import NetworkExplorerView from './components/NetworkExplorerView';
import MyPassesView from './components/MyPassesView';
import AnalyticsView from './components/AnalyticsView';
import AdminStudioView from './components/AdminStudioView';

const TAB_KEYS_BY_ALT_DIGIT = {
  '1': 'planner',
  '2': 'network',
  '3': 'passes',
  '4': 'analytics',
  '5': 'admin'
};

function AppShell() {
  const [activeTab, setActiveTab] = useState('planner');
  const [healthInfo, setHealthInfo] = useState(null);
  const [network, setNetwork] = useState(null);
  const [networkLoading, setNetworkLoading] = useState(true);
  const [networkError, setNetworkError] = useState('');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activePassModal, setActivePassModal] = useState(null);
  const [presetEndpoint, setPresetEndpoint] = useState(null);
  const [presetCorridor, setPresetCorridor] = useState(null);
  const [passesRefreshSignal, setPassesRefreshSignal] = useState(0);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, tone = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Smooth keyboard module switcher: Alt+1 .. Alt+5
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) {
        return;
      }
      const nextTab = TAB_KEYS_BY_ALT_DIGIT[e.key];
      if (nextTab) {
        e.preventDefault();
        setActiveTab(nextTab);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const loadBootstrapData = useCallback(async (forceRefresh = false) => {
    setNetworkLoading(true);
    setNetworkError('');
    try {
      const [health, net] = await Promise.all([
        transitApi.getHealth(),
        transitApi.getNetwork(forceRefresh)
      ]);
      setHealthInfo(health);
      setNetwork(net);
    } catch (err) {
      setNetworkError(
        err.message ||
          'Could not connect to Spring Boot API on port 8080. Start run_backend.ps1 first.'
      );
    } finally {
      setNetworkLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrapData(false);
  }, [loadBootstrapData]);

  const handleOpenAuth = useCallback(() => setAuthModalOpen(true), []);
  const handleCloseAuth = useCallback(() => setAuthModalOpen(false), []);
  const handleClearPresetEndpoint = useCallback(() => setPresetEndpoint(null), []);
  const handleClearPresetCorridor = useCallback(() => setPresetCorridor(null), []);
  const handleBookedPass = useCallback((booked) => {
    setActivePassModal(booked);
    setPassesRefreshSignal((n) => n + 1);
  }, []);
  const handleJumpToPlannerWithNode = useCallback((role, nodeKey) => {
    setPresetEndpoint({ role, nodeKey, requestId: Date.now() });
    setActiveTab('planner');
  }, []);
  const handleReplanCorridor = useCallback(
    (corridor) => {
      if (!corridor?.sourceName || !corridor?.destinationName) {
        return;
      }
      setPresetCorridor({
        sourceName: corridor.sourceName,
        destinationName: corridor.destinationName,
        requestId: Date.now()
      });
      setActiveTab('planner');
      showToast(`Planning ${corridor.sourceName} -> ${corridor.destinationName}`);
    },
    [showToast]
  );
  const handleNetworkMutated = useCallback(() => loadBootstrapData(true), [loadBootstrapData]);

  const totalNodes = network?.nodes?.length || 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/80">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        healthInfo={healthInfo}
        totalNodes={totalNodes}
        onOpenAuth={handleOpenAuth}
      />

      {networkError && (
        <div className="bg-amber-50 border-b border-amber-200/90 px-4 py-2.5">
          <div className="max-w-[1680px] mx-auto flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{networkError}</span>
            </div>
            <button
              type="button"
              onClick={() => loadBootstrapData(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconnect API</span>
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {/* Keep JourneyPlannerView mounted so tab switching is 0ms instant and preserves GPS/routes/map zoom! */}
        <div className={activeTab === 'planner' ? 'block' : 'hidden'}>
          <JourneyPlannerView
            network={network}
            networkLoading={networkLoading}
            presetEndpoint={presetEndpoint}
            onClearPresetEndpoint={handleClearPresetEndpoint}
            presetCorridor={presetCorridor}
            onClearPresetCorridor={handleClearPresetCorridor}
            onRequireAuth={handleOpenAuth}
            onBookedPass={handleBookedPass}
            onNotify={showToast}
            isVisible={activeTab === 'planner'}
          />
        </div>

        {activeTab === 'network' && (
          <NetworkExplorerView
            network={network}
            onJumpToPlannerWithNode={handleJumpToPlannerWithNode}
          />
        )}

        {activeTab === 'passes' && (
          <MyPassesView
            network={network}
            onRequireAuth={handleOpenAuth}
            onInspectPass={setActivePassModal}
            onReplanCorridor={handleReplanCorridor}
            onNotify={showToast}
            refreshSignal={passesRefreshSignal}
          />
        )}

        {activeTab === 'analytics' && <AnalyticsView onNotify={showToast} />}

        {activeTab === 'admin' && (
          <AdminStudioView
            onRequireAuth={handleOpenAuth}
            onNetworkMutated={handleNetworkMutated}
            onNotify={showToast}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200/90 py-3 px-4 lg:px-6 text-xs text-slate-500">
        <div className="max-w-[1680px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="font-display font-bold text-slate-800">Bengaluru TransitConnect</span>
            <span className="text-slate-300">|</span>
            <span>BMTC &times; Namma Metro Multi-Modal Mobility Platform</span>
            <span className="hidden md:inline text-slate-300">|</span>
            <span className="hidden md:inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              ACID Verified &bull; Zero Paid APIs
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('network')}
              className="hover:text-blue-600 font-semibold transition-colors"
            >
              Tariff Slabs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className="hover:text-blue-600 font-semibold transition-colors"
            >
              SQL Views
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('passes')}
              className="hover:text-blue-600 font-semibold transition-colors"
            >
              NCMC Wallet
            </button>
            <span className="hidden lg:inline-flex items-center gap-1 text-slate-400 font-mono text-[11px]">
              <Database className="w-3 h-3" />
              MySQL 8 &bull; Spring Boot 3.4 &bull; Leaflet
            </span>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={handleCloseAuth}
      />

      <QrPassModal
        passData={activePassModal}
        onClose={() => setActivePassModal(null)}
        onPassUpdated={(updatedPass) => {
          setActivePassModal(updatedPass);
          setPassesRefreshSignal((n) => n + 1);
        }}
        onNotify={showToast}
      />

      {/* Global Smooth Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 z-[2400] px-4 py-2.5 rounded-full shadow-floating border text-xs font-extrabold flex items-center gap-2 btc-toast-in ${
            toast.tone === 'error'
              ? 'bg-red-950/95 border-red-700 text-red-100'
              : 'bg-slate-900/95 border-slate-700 text-white'
          }`}
        >
          {toast.tone === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
