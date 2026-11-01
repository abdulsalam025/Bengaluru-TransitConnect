import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Code2,
  Database,
  Download,
  GitCompareArrows,
  Layers,
  Loader2,
  PieChart,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Ticket,
  TrendingUp,
  X
} from 'lucide-react';
import { transitApi } from '../api/transitApi';

const VIEW_SQL_SNIPPETS = {
  corridors: `CREATE VIEW v_popular_searched_corridors AS
SELECT jp.source_name, jp.destination_name,
       COUNT(jp.plan_id) AS total_searches,
       COUNT(th.history_id) AS total_booked_passes,
       ROUND(MIN(jp.total_time_mins), 0) AS fastest_time_mins,
       ROUND(MIN(jp.estimated_fare_inr), 2) AS cheapest_fare_inr
FROM journey_plans jp
LEFT JOIN travel_history th ON th.plan_id = jp.plan_id
GROUP BY jp.source_name, jp.destination_name;`,
  modes: `CREATE VIEW v_transport_mode_usage_report AS
SELECT jp.route_category,
       COUNT(jp.plan_id) AS generated_plans_count,
       COUNT(th.history_id) AS booked_passes_count,
       ROUND(AVG(jp.total_time_mins), 1) AS avg_total_time_mins,
       ROUND(AVG(jp.estimated_fare_inr), 2) AS avg_fare_inr,
       ROUND(AVG(jp.transfer_count), 2) AS avg_transfers
FROM journey_plans jp
LEFT JOIN travel_history th ON th.plan_id = jp.plan_id
GROUP BY jp.route_category;`,
  hubs: `CREATE VIEW v_multimodal_hub_connectivity AS
SELECT tp.hub_name, bs.stop_name, ms.station_name, ml.line_name,
       tp.walking_distance_m, tp.has_skywalk,
       COUNT(DISTINCT brs.route_id) AS connected_bmtc_routes
FROM transfer_points tp
INNER JOIN bus_stops bs ON bs.stop_id = tp.bus_stop_id
INNER JOIN metro_stations ms ON ms.station_id = tp.metro_station_id
INNER JOIN metro_lines ml ON ml.line_id = ms.line_id
LEFT JOIN bus_route_stops brs ON brs.stop_id = bs.stop_id
WHERE tp.is_active = TRUE
GROUP BY tp.transfer_id, ...;`,
  feedback: `CREATE VIEW v_route_feedback_summary AS
SELECT br.route_number, br.route_name, br.service_type,
       COUNT(fb.feedback_id) AS total_reviews,
       ROUND(COALESCE(AVG(fb.rating), 0.0), 2) AS avg_rating
FROM bus_routes br
LEFT JOIN feedback fb ON fb.bus_route_id = br.route_id
GROUP BY br.route_id, br.route_number, br.route_name, br.service_type;`
};

const MODE_META = {
  COMBINED: {
    label: 'Multi-Modal (BMTC + Metro)',
    hex: '#4F46E5',
    pillClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  BUS_ONLY: {
    label: 'BMTC Bus Only',
    hex: '#2563EB',
    pillClass: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  METRO_ONLY: {
    label: 'Namma Metro Only',
    hex: '#9333EA',
    pillClass: 'bg-purple-50 text-purple-700 border-purple-200'
  }
};

function escapeCsvCell(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function ModeShareDonut({ modes, totalPlans }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let cumulativeFraction = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80">
      <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 140 140" className="w-36 h-36 -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="16"
          />
          {totalPlans > 0 &&
            modes.map((m) => {
              const count = Number(m.generated_plans_count || 0);
              const frac = count / totalPlans;
              const dash = frac * circumference;
              const offset = -cumulativeFraction * circumference;
              cumulativeFraction += frac;
              const meta = MODE_META[m.route_category] || { hex: '#2563EB' };
              return (
                <circle
                  key={m.route_category}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={meta.hex}
                  strokeWidth="16"
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-xl font-extrabold text-slate-900 tabular-nums leading-none">
            {totalPlans}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
            SQL Plans
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {modes.map((m) => {
          const count = Number(m.generated_plans_count || 0);
          const share = totalPlans > 0 ? Math.round((count / totalPlans) * 100) : 0;
          const meta = MODE_META[m.route_category] || {
            label: m.route_category,
            hex: '#2563EB'
          };
          return (
            <div
              key={m.route_category}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: meta.hex }}
                />
                <span className="font-bold text-slate-800 truncate">{meta.label}</span>
              </div>
              <span className="font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                {share}% ({count})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalyticsView({ onNotify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openSqlKey, setOpenSqlKey] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');

  const loadAnalytics = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await transitApi.getAnalyticsDashboard(forceRefresh);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to query MySQL analytical views.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics(false);
  }, [loadAnalytics]);

  const db = data?.databaseSnapshot || {};
  const corridors = useMemo(() => data?.popularCorridors || [], [data]);
  const hubs = useMemo(() => data?.multimodalHubs || [], [data]);
  const modes = useMemo(() => data?.transportModeUsage || [], [data]);
  const feedbackRows = useMemo(() => data?.routeFeedbackSummary || [], [data]);

  const needle = filterQuery.trim().toLowerCase();

  const filteredCorridors = useMemo(() => {
    if (!needle) {
      return corridors;
    }
    return corridors.filter(
      (c) =>
        String(c.source_name || '').toLowerCase().includes(needle) ||
        String(c.destination_name || '').toLowerCase().includes(needle)
    );
  }, [corridors, needle]);

  const filteredHubs = useMemo(() => {
    if (!needle) {
      return hubs;
    }
    return hubs.filter(
      (h) =>
        String(h.hub_name || '').toLowerCase().includes(needle) ||
        String(h.bmtc_stop_name || '').toLowerCase().includes(needle) ||
        String(h.metro_station_name || '').toLowerCase().includes(needle) ||
        String(h.metro_line_name || '').toLowerCase().includes(needle)
    );
  }, [hubs, needle]);

  const totals = useMemo(() => {
    const plans = modes.reduce((acc, m) => acc + Number(m.generated_plans_count || 0), 0);
    const passes = modes.reduce((acc, m) => acc + Number(m.booked_passes_count || 0), 0);
    const maxSearches = Math.max(1, ...corridors.map((c) => Number(c.total_searches || 0)));
    const skywalkHubs = hubs.filter((h) => Boolean(h.has_skywalk)).length;
    return { plans, passes, maxSearches, skywalkHubs };
  }, [modes, corridors, hubs]);

  const handleExportCsv = () => {
    const lines = [
      ['Section', 'Origin / Hub / Category', 'Destination / Metro', 'Metric 1', 'Metric 2', 'Metric 3']
        .map(escapeCsvCell)
        .join(',')
    ];

    corridors.forEach((c) => {
      lines.push(
        [
          'POPULAR_CORRIDOR',
          c.source_name,
          c.destination_name,
          `Searches: ${c.total_searches}`,
          `Fastest: ${c.fastest_time_mins}m`,
          `QR Passes: ${c.total_booked_passes}`
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    });

    modes.forEach((m) => {
      lines.push(
        [
          'MODE_SHARE',
          m.route_category,
          '-',
          `Plans: ${m.generated_plans_count}`,
          `Avg Time: ${m.avg_total_time_mins}m`,
          `Avg Fare: Rs. ${m.avg_fare_inr}`
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    });

    hubs.forEach((h) => {
      lines.push(
        [
          'INTERCHANGE_HUB',
          h.hub_name,
          `${h.bmtc_stop_name} <-> ${h.metro_station_name}`,
          `Walk: ${h.walking_distance_m}m`,
          h.has_skywalk ? 'Skywalk' : 'Footpath',
          `BMTC Routes: ${h.connected_bmtc_routes}`
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'BengaluruTransitConnect-SQL-Analytics.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onNotify) {
      onNotify('Exported SQL Analytics CSV report');
    }
  };

  const toggleSql = (key) => {
    setOpenSqlKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6 space-y-6 btc-fade-in">
      {/* Executive Command Hero Banner */}
      <div className="btc-command-hero rounded-3xl p-6 lg:p-7 text-white shadow-floating border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-extrabold uppercase tracking-wider text-blue-200">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>MySQL 8 Analytical Engine &bull; Live SQL Views</span>
          </div>
          <h1 className="font-display text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
            Bengaluru Transit Intelligence &amp; SQL Analytics
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-0.5">
            <span className="px-2.5 py-1 rounded-lg bg-white/10 font-mono text-[11px] text-blue-100">
              schema: {db.databaseName || 'bengaluru_transit'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/10 font-semibold text-slate-200">
              20 Normalized 3NF Tables
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 font-semibold text-emerald-200 inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Zero Client-Side Mock Arrays
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            disabled={!data}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-extrabold transition-all"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => loadAnalytics(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-slate-900 text-xs font-extrabold shadow-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Live SQL Views</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-800">
          {error}
        </div>
      )}

      {/* 6 Top-Level Executive KPI Cards + Live Filter */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          {
            label: 'Metro Stations',
            sub: 'metro_stations',
            val: db.metroStationCount ?? '--',
            icon: Layers,
            bar: 'bg-purple-600',
            accent: 'text-purple-700 bg-purple-50 border-purple-100'
          },
          {
            label: 'BMTC Bus Stops',
            sub: 'bus_stops',
            val: db.busStopCount ?? '--',
            icon: Database,
            bar: 'bg-blue-600',
            accent: 'text-blue-700 bg-blue-50 border-blue-100'
          },
          {
            label: 'BMTC Corridors',
            sub: 'bus_routes',
            val: db.busRouteCount ?? '--',
            icon: BarChart3,
            bar: 'bg-cyan-600',
            accent: 'text-cyan-700 bg-cyan-50 border-cyan-100'
          },
          {
            label: 'Interchange Hubs',
            sub: `${totals.skywalkHubs} skywalk linked`,
            val: db.transferHubCount ?? '--',
            icon: GitCompareArrows,
            bar: 'bg-amber-500',
            accent: 'text-amber-700 bg-amber-50 border-amber-100'
          },
          {
            label: 'Generated Plans',
            sub: 'journey_plans',
            val: totals.plans,
            icon: TrendingUp,
            bar: 'bg-emerald-600',
            accent: 'text-emerald-700 bg-emerald-50 border-emerald-100'
          },
          {
            label: 'Booked QR Passes',
            sub: 'travel_history',
            val: totals.passes,
            icon: Ticket,
            bar: 'bg-indigo-600',
            accent: 'text-indigo-700 bg-indigo-50 border-indigo-100'
          }
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="relative bg-white rounded-2xl border border-slate-200/95 p-4 shadow-card overflow-hidden"
            >
              <div className={`absolute top-0 left-0 right-0 h-1 ${kpi.bar}`} />
              <div className="flex items-start justify-between gap-2 pt-0.5">
                <div>
                  <div className="text-[11px] font-bold text-slate-500">{kpi.label}</div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 tabular-nums mt-1">
                    {kpi.val}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{kpi.sub}</div>
                </div>
                <span
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${kpi.accent}`}
                >
                  <Icon className="w-5 h-5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Instant Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/95 px-4 py-2.5 shadow-2xs flex items-center gap-2.5">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter SQL corridors or interchange hubs instantly (e.g., Silk Board, Whitefield, Purple Line)..."
          className="w-full bg-transparent text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
        {filterQuery && (
          <button
            type="button"
            onClick={() => setFilterQuery('')}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading && !data ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-2.5 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs font-bold">Executing MySQL 8 analytical views...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* VIEW 1: Popular Searched Corridors */}
          <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/95 p-6 shadow-card space-y-4">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  VIEW: v_popular_searched_corridors
                </span>
                <h2 className="font-display text-lg font-extrabold text-slate-900 mt-1.5">
                  Top Commuter Origin-Destination Demand
                </h2>
              </div>
              <button
                type="button"
                onClick={() => toggleSql('corridors')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
              >
                <Code2 className="w-3.5 h-3.5 text-blue-600" />
                <span>{openSqlKey === 'corridors' ? 'Hide SQL' : 'Inspect SQL'}</span>
              </button>
            </div>

            {openSqlKey === 'corridors' && (
              <pre className="p-3.5 rounded-2xl bg-slate-900 text-blue-100 text-[11px] font-mono overflow-x-auto border border-slate-800">
                {VIEW_SQL_SNIPPETS.corridors}
              </pre>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left tabular-nums">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Rank &amp; Corridor</th>
                    <th className="py-2.5 px-3">Search Volume</th>
                    <th className="py-2.5 px-3 text-right">Fastest</th>
                    <th className="py-2.5 px-3 text-right">Min Fare</th>
                    <th className="py-2.5 px-3 text-right">QR Passes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCorridors.map((c, idx) => {
                    const pct = Math.max(
                      12,
                      Math.round((Number(c.total_searches || 0) / totals.maxSearches) * 100)
                    );
                    return (
                      <tr
                        key={`${c.source_name}-${c.destination_name}-${idx}`}
                        className="hover:bg-blue-50/35 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900">
                                {c.source_name} &rarr; {c.destination_name}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Avg {c.avg_estimated_time_mins}m &bull; Avg Rs.{' '}
                                {c.avg_estimated_fare_inr}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 min-w-[130px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-extrabold text-slate-900">
                              {c.total_searches}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-800">
                          {c.fastest_time_mins}m
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700">
                          Rs. {Number(c.cheapest_fare_inr).toFixed(0)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-extrabold">
                            {c.total_booked_passes}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* VIEW 2: Transport Mode Share Donut + Efficiency Cards */}
          <section className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/95 p-6 shadow-card space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                  VIEW: v_transport_mode_usage_report
                </span>
                <h2 className="font-display text-lg font-extrabold text-slate-900 mt-1.5 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-purple-600" />
                  <span>Mode Share &amp; Efficiency Split</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => toggleSql('modes')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
              >
                <Code2 className="w-3.5 h-3.5 text-purple-600" />
                <span>{openSqlKey === 'modes' ? 'Hide SQL' : 'Inspect SQL'}</span>
              </button>
            </div>

            {openSqlKey === 'modes' && (
              <pre className="p-3.5 rounded-2xl bg-slate-900 text-blue-100 text-[11px] font-mono overflow-x-auto border border-slate-800">
                {VIEW_SQL_SNIPPETS.modes}
              </pre>
            )}

            <ModeShareDonut modes={modes} totalPlans={totals.plans} />

            <div className="space-y-2.5 tabular-nums">
              {modes.map((m) => {
                const count = Number(m.generated_plans_count || 0);
                const share = totals.plans > 0 ? Math.round((count / totals.plans) * 100) : 0;
                const meta = MODE_META[m.route_category] || {
                  label: m.route_category,
                  pillClass: 'bg-slate-100 text-slate-700 border-slate-200'
                };

                return (
                  <div
                    key={m.route_category}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200/90 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${meta.pillClass}`}
                      >
                        {m.route_category}
                      </span>
                      <span className="font-bold text-slate-700">
                        {share}% share &bull; {m.booked_passes_count} QR passes
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600">
                      <div className="bg-slate-50 rounded-lg px-2 py-1">
                        Avg Time: <b className="text-slate-900">{m.avg_total_time_mins}m</b>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-2 py-1">
                        Avg Fare: <b className="text-slate-900">Rs. {m.avg_fare_inr}</b>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-2 py-1">
                        Transfers: <b className="text-slate-900">{m.avg_transfers}</b>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* VIEW 3: Multi-Modal Hub Connectivity */}
          <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/95 p-6 shadow-card space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                  VIEW: v_multimodal_hub_connectivity
                </span>
                <h2 className="font-display text-lg font-extrabold text-slate-900 mt-1.5">
                  BMTC &harr; Namma Metro Interchange Connectivity
                </h2>
              </div>
              <button
                type="button"
                onClick={() => toggleSql('hubs')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
              >
                <Code2 className="w-3.5 h-3.5 text-amber-600" />
                <span>{openSqlKey === 'hubs' ? 'Hide SQL' : 'Inspect SQL'}</span>
              </button>
            </div>

            {openSqlKey === 'hubs' && (
              <pre className="p-3.5 rounded-2xl bg-slate-900 text-blue-100 text-[11px] font-mono overflow-x-auto border border-slate-800">
                {VIEW_SQL_SNIPPETS.hubs}
              </pre>
            )}

            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-xs text-left tabular-nums">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold border-y border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Interchange Hub</th>
                    <th className="py-2.5 px-3">Metro Line</th>
                    <th className="py-2.5 px-3 text-center">Pedestrian Link</th>
                    <th className="py-2.5 px-3 text-right">BMTC Routes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHubs.map((h) => (
                    <tr key={h.transfer_id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{h.hub_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {h.bmtc_stop_name} &harr; {h.metro_station_name}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-white"
                          style={{ backgroundColor: h.metro_line_color || '#7C3AED' }}
                        >
                          {h.metro_line_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="font-bold text-slate-800">
                          {h.walking_distance_m}m (
                          {Number(h.walking_time_mins) + Number(h.transfer_buffer_mins)}m)
                        </div>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            h.has_skywalk
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {h.has_skywalk ? 'Skywalk' : 'Footpath'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-700 font-extrabold">
                          {h.connected_bmtc_routes}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* VIEW 4: BMTC Route Feedback Summary (LEFT JOIN) */}
          <section className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/95 p-6 shadow-card space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                  VIEW: v_route_feedback_summary
                </span>
                <h2 className="font-display text-lg font-extrabold text-slate-900 mt-1.5">
                  BMTC Corridor Ratings (LEFT JOIN)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => toggleSql('feedback')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
              >
                <Code2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{openSqlKey === 'feedback' ? 'Hide SQL' : 'Inspect SQL'}</span>
              </button>
            </div>

            {openSqlKey === 'feedback' && (
              <pre className="p-3.5 rounded-2xl bg-slate-900 text-blue-100 text-[11px] font-mono overflow-x-auto border border-slate-800">
                {VIEW_SQL_SNIPPETS.feedback}
              </pre>
            )}

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 tabular-nums">
              {feedbackRows.map((r) => {
                const reviews = Number(r.total_reviews || 0);
                const ratingVal = Number(r.avg_rating || 0);
                const pct = Math.min(100, Math.round((ratingVal / 5) * 100));
                return (
                  <div
                    key={r.route_id}
                    className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/75 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[11px] font-extrabold">
                            {r.route_number}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-slate-500">
                            {r.service_type}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 truncate mt-1">
                          {r.route_name}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {reviews > 0 ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            <span>{ratingVal.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
                            0 Reviews (LEFT JOIN)
                          </span>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {reviews} review{reviews === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
