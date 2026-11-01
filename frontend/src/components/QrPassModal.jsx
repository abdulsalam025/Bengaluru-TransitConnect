import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ScanLine,
  ShieldCheck,
  Ticket,
  Wallet,
  X
} from 'lucide-react';
import { transitApi } from '../api/transitApi';

function buildDeterministicQrMatrix(seedText) {
  const size = 21;
  const grid = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (r0, c0) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = isBorder || isCore;
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  let hash = 2166136261;
  const str = seedText || 'BTC-QR-DEFAULT';
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft) {
        continue;
      }
      if (r === 6 || c === 6) {
        grid[r][c] = (r + c) % 2 === 0;
        continue;
      }
      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      grid[r][c] = (hash >>> 3) % 2 === 0;
    }
  }
  return grid;
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildOfflinePassSvg(passData, matrix) {
  const cellSize = 8;
  const qrOffsetX = 116;
  const qrOffsetY = 92;
  const rects = [];
  matrix.forEach((row, r) => {
    row.forEach((filled, c) => {
      if (filled) {
        rects.push(
          `<rect x="${qrOffsetX + c * cellSize}" y="${qrOffsetY + r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0F172A"/>`
        );
      }
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="510" viewBox="0 0 400 510">
  <rect width="400" height="510" rx="24" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
  <rect width="400" height="76" rx="24" fill="#0F172A"/>
  <rect y="52" width="400" height="24" fill="#0F172A"/>
  <text x="24" y="34" fill="#93C5FD" font-family="Arial, sans-serif" font-size="11" font-weight="bold">BENGALURU TRANSITCONNECT - UNIFIED QR PASS</text>
  <text x="24" y="56" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="16" font-weight="bold">BMTC x Namma Metro Digital Ticket</text>
  <rect x="104" y="80" width="192" height="192" rx="16" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
  ${rects.join('\n  ')}
  <rect x="92" y="284" width="216" height="28" rx="14" fill="#EFF6FF" stroke="#BFDBFE"/>
  <text x="200" y="302" text-anchor="middle" fill="#1E40AF" font-family="Courier New, monospace" font-size="12" font-weight="bold">${escapeXml(passData.qrPassCode)}</text>
  <line x1="24" y1="330" x2="376" y2="330" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="6 6"/>
  <text x="28" y="358" fill="#64748B" font-family="Arial, sans-serif" font-size="11" font-weight="bold">ORIGIN</text>
  <text x="28" y="376" fill="#0F172A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${escapeXml(passData.sourceName)}</text>
  <text x="28" y="404" fill="#64748B" font-family="Arial, sans-serif" font-size="11" font-weight="bold">DESTINATION</text>
  <text x="28" y="422" fill="#0F172A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${escapeXml(passData.destinationName)}</text>
  <rect x="24" y="440" width="352" height="46" rx="12" fill="#FFFFFF" stroke="#E2E8F0"/>
  <text x="40" y="468" fill="#0F172A" font-family="Arial, sans-serif" font-size="12" font-weight="bold">Duration: ${Number(passData.totalTimeMins || 0)}m</text>
  <text x="168" y="468" fill="#1D4ED8" font-family="Arial, sans-serif" font-size="12" font-weight="bold">Fare: Rs. ${Number(passData.farePaidInr || 0).toFixed(2)}</text>
  <text x="296" y="468" fill="#047857" font-family="Arial, sans-serif" font-size="12" font-weight="bold">${escapeXml(passData.passStatus || 'ACTIVE')}</text>
</svg>`;
}

export default function QrPassModal({ passData, onClose, onPassUpdated, onNotify }) {
  const [scanning, setScanning] = useState(false);

  const matrix = useMemo(
    () => (passData ? buildDeterministicQrMatrix(passData.qrPassCode) : []),
    [passData]
  );

  if (!passData) {
    return null;
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(passData.qrPassCode);
      if (onNotify) {
        onNotify(`Copied pass code ${passData.qrPassCode}`);
      }
    } catch {
      if (onNotify) {
        onNotify(`Pass Code: ${passData.qrPassCode}`);
      }
    }
  };

  const handleDownloadSvg = () => {
    const svgText = buildOfflinePassSvg(passData, matrix);
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${passData.qrPassCode || 'BTC-QR-PASS'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onNotify) {
      onNotify(`Downloaded offline SVG pass (${passData.qrPassCode}.svg)`);
    }
  };

  const handleSimulateScan = async () => {
    if (!passData.historyId || passData.passStatus === 'USED') {
      return;
    }
    setScanning(true);
    try {
      const updated = await transitApi.scanPass(passData.historyId);
      if (onPassUpdated) {
        onPassUpdated(updated);
      }
      if (onNotify) {
        onNotify(`Gate scan verified! ${updated.qrPassCode} marked USED in MySQL.`);
      }
    } catch (err) {
      if (onNotify) {
        onNotify(err.message || 'Unable to scan pass.', 'error');
      }
    } finally {
      setScanning(false);
    }
  };

  const isUsed = passData.passStatus === 'USED';

  const modalContent = (
    <div className="fixed inset-0 z-[2250] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 btc-fade-in">
      <div className="bg-white rounded-3xl shadow-floating border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="btc-command-hero px-6 py-5 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ACID Transaction Committed</span>
          </div>
          <h3 className="font-display text-xl font-extrabold mt-2 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-blue-300" />
            <span>Unified BMTC + Metro QR Pass</span>
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Scan at BMTC ETM terminals &amp; Namma Metro AFC turnstiles
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Deterministic Inline SVG QR Code */}
          <div className="flex flex-col items-center">
            <div
              className={`p-4 bg-white rounded-2xl border-2 shadow-card transition-opacity ${
                isUsed ? 'border-slate-300 opacity-75' : 'border-slate-200'
              }`}
            >
              <svg width="168" height="168" viewBox="0 0 21 21" shapeRendering="crispEdges">
                <rect width="21" height="21" fill="#FFFFFF" />
                {matrix.map((row, r) =>
                  row.map((filled, c) =>
                    filled ? (
                      <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#0F172A" />
                    ) : null
                  )
                )}
              </svg>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 font-mono text-xs font-extrabold text-blue-800">
                {passData.qrPassCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy QR Pass Code"
                className="p-1.5 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Perforated Ticket Tear Line */}
          <div className="relative flex items-center">
            <div className="w-full border-t-2 border-dashed border-slate-200" />
          </div>

          {/* Corridor & Tariff Summary */}
          <div className="bg-slate-50/95 rounded-2xl p-4 border border-slate-200/90 space-y-2.5 tabular-nums">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-slate-500 font-semibold">Origin</span>
              <span className="font-bold text-slate-900 text-right">{passData.sourceName}</span>
            </div>
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-slate-500 font-semibold">Destination</span>
              <span className="font-bold text-slate-900 text-right">
                {passData.destinationName}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-2.5 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">Duration</div>
                <div className="text-sm font-extrabold text-slate-900 flex items-center justify-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>{passData.totalTimeMins}m</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">Fare Debited</div>
                <div className="text-sm font-extrabold text-blue-700 mt-0.5">
                  Rs. {Number(passData.farePaidInr).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">Wallet Left</div>
                <div className="text-sm font-extrabold text-emerald-700 flex items-center justify-center gap-1 mt-0.5">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Rs. {Number(passData.remainingWalletBalanceInr).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span className="flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Persisted in MySQL travel_history
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                isUsed
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {passData.passStatus}
            </span>
          </div>

          {/* Offline Ticket Download + Gate Turnstile Scan Simulator */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-extrabold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save SVG Pass</span>
            </button>

            <button
              type="button"
              disabled={isUsed || scanning || !passData.historyId}
              onClick={handleSimulateScan}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-extrabold transition-colors"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>
                {isUsed ? 'Gate Scanned' : scanning ? 'Scanning...' : 'Simulate Gate Scan'}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
