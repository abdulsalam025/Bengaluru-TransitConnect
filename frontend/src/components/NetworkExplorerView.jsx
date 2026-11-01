import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Bus,
  GitCompareArrows,
  IndianRupee,
  Layers,
  Loader2,
  Search,
  TrainFront,
  X
} from 'lucide-react';
import { transitApi } from '../api/transitApi';
import TransitLeafletMap from './TransitLeafletMap';

export default function NetworkExplorerView({ network, onJumpToPlannerWithNode }) {
  const [subTab, setSubTab] = useState('routes');
  const [filterText, setFilterText] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [direction, setDirection] = useState('OUTBOUND');
  const [corridorDetails, setCorridorDetails] = useState(null);
  const [loadingCorridor, setLoadingCorridor] = useState(false);
  const [fareRules, setFareRules] = useState([]);

  useEffect(() => {
    if (network?.busRoutes?.length > 0 && !selectedRouteId) {
      setSelectedRouteId(network.busRoutes[0].routeId);
    }
  }, [network, selectedRouteId]);

  useEffect(() => {
    if (!selectedRouteId || subTab !== 'routes') {
      return undefined;
    }
    let cancelled = false;
    setLoadingCorridor(true);
    transitApi
      .getBusRouteStops(selectedRouteId, direction)
      .then((res) => {
        if (!cancelled) {
          setCorridorDetails(res);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCorridorDetails(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCorridor(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRouteId, direction, subTab]);

  useEffect(() => {
    if (subTab === 'fares' && fareRules.length === 0) {
      transitApi
        .getFareRules()
        .then((rows) => setFareRules(rows || []))
        .catch(() => {});
    }
  }, [subTab, fareRules.length]);

  const needle = filterText.trim().toLowerCase();

  const filteredRoutes = useMemo(() => {
    const list = network?.busRoutes || [];
    if (!needle) {
      return list;
    }
    return list.filter(
      (r) =>
        r.routeNumber.toLowerCase().includes(needle) ||
        r.routeName.toLowerCase().includes(needle) ||
        String(r.serviceType || '')
          .toLowerCase()
          .includes(needle)
    );
  }, [network, needle]);

  const filteredHubs = useMemo(() => {
    const list = network?.transferHubs || [];
    if (!needle) {
      return list;
    }
    return list.filter(
      (h) =>
        h.hubName.toLowerCase().includes(needle) ||
        h.busStopName.toLowerCase().includes(needle) ||
        h.metroStationName.toLowerCase().includes(needle)
    );
  }, [network, needle]);

  const filteredFares = useMemo(() => {
    if (!needle) {
      return fareRules;
    }
    return fareRules.filter((f) =>
      String(f.serviceCategory || '')
        .toLowerCase()
        .includes(needle)
    );
  }, [fareRules, needle]);

  return (
    <div className="max-w-[1680px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-68px)] btc-fade-in">
      <aside className="lg:col-span-5 xl:col-span-4 bg-white border-r border-slate-200/90 flex flex-col max-h-[calc(100vh-68px)] lg:overflow-y-auto">
        {/* Porcelain Mesh Sidebar Header */}
        <div className="btc-sidebar-hero px-5 pt-5 pb-4 border-b border-slate-200/75 space-y-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-600/10 border border-blue-600/20 text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
              <Layers className="w-3 h-3 text-blue-600" />
              <span>MySQL 8 Master Network Topology</span>
            </div>
            <h1 className="font-display text-xl font-extrabold text-slate-900 mt-1.5">
              Scheduled Network Explorer
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Inspect BMTC corridors, Namma Metro lines, skywalk hubs &amp; verified tariff slabs
            </p>
          </div>

          {/* 4 Segmented Sub-tabs */}
          <div className="grid grid-cols-4 gap-1 bg-slate-100/95 p-1 rounded-2xl border border-slate-200/90 text-xs font-bold">
            {[
              { id: 'routes', label: 'BMTC', icon: Bus },
              { id: 'metro', label: 'Metro', icon: TrainFront },
              { id: 'hubs', label: 'Hubs', icon: GitCompareArrows },
              { id: 'fares', label: 'Tariffs', icon: IndianRupee }
            ].map((t) => {
              const Icon = t.icon;
              const active = subTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Instant Filter Input */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/95 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={`Filter ${
                subTab === 'routes'
                  ? 'BMTC routes'
                  : subTab === 'metro'
                  ? 'Metro stations'
                  : subTab === 'hubs'
                  ? 'interchange hubs'
                  : 'fare slabs'
              }...`}
              className="w-full bg-transparent text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* TAB 1: BMTC Bus Corridors */}
          {subTab === 'routes' && (
            <div className="space-y-3.5">
              <div className="space-y-2">
                {filteredRoutes.map((r) => {
                  const selected = r.routeId === selectedRouteId;
                  return (
                    <button
                      key={r.routeId}
                      type="button"
                      onClick={() => setSelectedRouteId(r.routeId)}
                      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all ${
                        selected
                          ? 'border-blue-600 bg-gradient-to-b from-blue-50/55 to-white shadow-card'
                          : 'border-slate-200/95 hover:border-blue-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white text-xs font-extrabold">
                          BMTC {r.routeNumber}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">
                          {r.serviceType} &bull; {r.activeFleetCount} Buses
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-1.5">{r.routeName}</div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between tabular-nums">
                        <span className="font-semibold text-slate-700">
                          {r.totalDistanceKm} km corridor
                        </span>
                        {r.peakHeadwayMins && (
                          <span>
                            Peak {r.peakHeadwayMins}m ({r.dataConfidence})
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedRouteId && (
                <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/95 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <span>Ordered Stop Sequence ({direction})</span>
                      {loadingCorridor && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDirection((d) => (d === 'OUTBOUND' ? 'INBOUND' : 'OUTBOUND'))
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-slate-300 text-[11px] font-bold text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>Flip Direction</span>
                    </button>
                  </div>

                  {loadingCorridor && !corridorDetails ? (
                    <div className="py-6 flex items-center justify-center text-slate-500 text-xs gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading stops from bus_route_stops...</span>
                    </div>
                  ) : (
                    <div className="relative pl-1 space-y-1.5">
                      {(corridorDetails?.stops || []).map((st, idx, arr) => {
                        const nodeKey = st.nodeKey || `BUS_${st.stopId}`;
                        return (
                          <div key={st.routeStopId} className="flex items-stretch gap-2.5 group">
                            <div className="flex flex-col items-center shrink-0">
                              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                                {st.stopSequence}
                              </span>
                              {idx < arr.length - 1 && (
                                <div className="w-0.5 flex-1 bg-blue-200 my-0.5" />
                              )}
                            </div>
                            <div className="flex-1 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/85 text-xs">
                              <span className="font-bold text-slate-800 truncate">
                                {st.stopName}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap tabular-nums">
                                  {Number(st.distanceFromStartKm).toFixed(1)} km
                                </span>
                                {onJumpToPlannerWithNode && st.stopId && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onJumpToPlannerWithNode('destination', nodeKey)
                                    }
                                    className="px-1.5 py-0.5 rounded-md bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-[10px] font-bold transition-colors"
                                    title="Plan journey to this BMTC stop"
                                  >
                                    Go
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Namma Metro Operational Lines */}
          {subTab === 'metro' && (
            <div className="space-y-3.5">
              {(network?.metroLines || []).map((line) => {
                const stations = (line.stations || []).filter(
                  (st) => !needle || st.stationName.toLowerCase().includes(needle)
                );
                if (needle && stations.length === 0) {
                  return null;
                }
                return (
                  <div
                    key={line.lineId}
                    className="p-4 rounded-2xl border border-slate-200/95 bg-white shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full inline-block ring-2 ring-slate-100"
                          style={{ backgroundColor: line.colorHex }}
                        />
                        <span className="font-display font-extrabold text-sm text-slate-900">
                          {line.lineName}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
                        {line.totalLengthKm} km &bull; {line.stations.length} Stns
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">{line.corridorSummary}</div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {stations.map((st) => (
                        <button
                          key={st.stationId}
                          type="button"
                          onClick={() =>
                            onJumpToPlannerWithNode &&
                            onJumpToPlannerWithNode('destination', st.nodeKey)
                          }
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-colors ${
                            st.interchange
                              ? 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-900'
                              : 'bg-slate-50 hover:bg-blue-50 border-slate-200 hover:border-blue-300 text-slate-700'
                          }`}
                          title="Click to plan a journey to this Metro station"
                        >
                          {st.stationName}
                          {st.interchange ? ' (Hub)' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: Multi-Modal Interchange Hubs */}
          {subTab === 'hubs' && (
            <div className="space-y-2.5">
              {filteredHubs.map((hub) => (
                <div
                  key={hub.transferId}
                  className="p-4 rounded-2xl border border-slate-200/95 bg-white shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-extrabold text-slate-900">
                      {hub.hubName}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        hub.hasSkywalk
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {hub.hasSkywalk ? 'Skywalk Link' : 'Surface Walk'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <b className="text-blue-700">BMTC:</b> {hub.busStopName} &harr;{' '}
                    <b className="text-purple-700">Metro:</b> {hub.metroStationName}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2 tabular-nums">
                    <span>
                      Connector: <b>{hub.walkingDistanceM}m</b> ({hub.walkingTimeMins}m walk +{' '}
                      {hub.transferBufferMins}m buffer)
                    </span>
                    {onJumpToPlannerWithNode && hub.metroNodeKey && (
                      <button
                        type="button"
                        onClick={() =>
                          onJumpToPlannerWithNode('destination', hub.metroNodeKey)
                        }
                        className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-[10px] font-bold transition-colors"
                      >
                        Plan Here
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: Distance-Slab Tariff Table */}
          {subTab === 'fares' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200/95 shadow-2xs">
              <table className="w-full text-xs text-left tabular-nums">
                <thead className="bg-slate-100/95 text-slate-600 uppercase text-[10px] font-extrabold">
                  <tr>
                    <th className="px-3.5 py-2.5">Service Category</th>
                    <th className="px-3.5 py-2.5">Distance Slab</th>
                    <th className="px-3.5 py-2.5 text-right">Tariff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredFares.map((fr) => (
                    <tr key={fr.fareRuleId} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-slate-800">
                        {fr.serviceCategory}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        {fr.minDistanceKm} - {fr.maxDistanceKm} km
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-extrabold text-blue-700">
                        Rs. {Number(fr.fareInr).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </aside>

      <section className="lg:col-span-7 xl:col-span-8 min-h-[480px] lg:h-[calc(100vh-68px)]">
        <TransitLeafletMap
          network={network}
          activeRoute={null}
          highlightedCorridor={subTab === 'routes' ? corridorDetails : null}
          gpsOriginPin={null}
          pinDropMode={false}
          onSelectHubEndpoint={(role, nodeKey) =>
            onJumpToPlannerWithNode && onJumpToPlannerWithNode(role, nodeKey)
          }
          dimBackgroundWhenActive={subTab === 'routes'}
          isVisible
        />
      </section>
    </div>
  );
}
