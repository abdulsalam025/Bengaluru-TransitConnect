import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Crosshair,
  Footprints,
  Layers,
  LocateFixed,
  Map as MapIcon,
  MapPin
} from 'lucide-react';

const BENGALURU_CENTER = [12.966, 77.638];

const TILE_ORDER = ['street', 'clean', 'night'];

const TILE_STYLES = {
  street: {
    label: 'Street Map',
    nextLabel: 'Clean Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors | Bengaluru TransitConnect'
  },
  clean: {
    label: 'Clean Transit',
    nextLabel: 'Night Map',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO | Bengaluru TransitConnect'
  },
  night: {
    label: 'Night Transit',
    nextLabel: 'Street Map',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO Dark | Bengaluru TransitConnect'
  }
};

function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeBadgeIcon(bgHex, labelText, size = 30, ringHex = '#FFFFFF', pulseHex = null) {
  const pulseHtml = pulseHex
    ? `<span class="btc-marker-halo" style="border:2.5px solid ${pulseHex};background:${pulseHex}22"></span>`
    : '';
  return L.divIcon({
    className: 'btc-div-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
      ${pulseHtml}
      <div style="
        position:relative;
        width:${size}px;
        height:${size}px;
        border-radius:9999px;
        background:${bgHex};
        border:3px solid ${ringHex};
        color:#FFFFFF;
        font-weight:800;
        font-size:11px;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 6px 16px rgba(15,23,42,0.34);
      ">${escapeHtml(labelText)}</div>
    </div>`
  });
}

export default function TransitLeafletMap({
  network,
  activeRoute,
  highlightedCorridor,
  gpsOriginPin,
  gpsDestPin = null,
  pinDropMode = false,
  pinDropTarget = null,
  onTogglePinDropMode,
  onSetPinDropTarget,
  onMapPinSelect,
  onSelectHubEndpoint,
  dimBackgroundWhenActive = true,
  isVisible = true
}) {
  const effectivePinTarget = pinDropTarget || (pinDropMode ? 'origin' : null);

  const [tileStyleKey, setTileStyleKey] = useState('street');
  const [legendOpen, setLegendOpen] = useState(true);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const baseLayerGroupRef = useRef(null);
  const routeLayerGroupRef = useRef(null);
  const hasFittedOnceRef = useRef(false);
  const lastBoundsSigRef = useRef('');
  const pinCallbackRef = useRef(onMapPinSelect);
  const hubEndpointCallbackRef = useRef(onSelectHubEndpoint);
  const pinTargetRef = useRef(effectivePinTarget);

  pinCallbackRef.current = onMapPinSelect;
  hubEndpointCallbackRef.current = onSelectHubEndpoint;
  pinTargetRef.current = effectivePinTarget;

  // 1. Initialize Leaflet Map once + ResizeObserver for smooth zero-gap layout resizing
  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const map = L.map(containerRef.current, {
      center: BENGALURU_CENTER,
      zoom: 12,
      zoomControl: false,
      zoomAnimation: true,
      fadeAnimation: true
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

    tileLayerRef.current = L.tileLayer(TILE_STYLES.street.url, {
      maxZoom: 19,
      attribution: TILE_STYLES.street.attribution
    }).addTo(map);

    baseLayerGroupRef.current = L.layerGroup().addTo(map);
    routeLayerGroupRef.current = L.layerGroup().addTo(map);

    map.on('click', (evt) => {
      if (pinTargetRef.current && pinCallbackRef.current) {
        pinCallbackRef.current({
          target: pinTargetRef.current,
          lat: Number(evt.latlng.lat.toFixed(6)),
          lng: Number(evt.latlng.lng.toFixed(6))
        });
      }
    });

    const handlePopupClick = (e) => {
      const btn = e.target.closest('[data-btc-node-action]');
      if (!btn || !hubEndpointCallbackRef.current) {
        return;
      }
      const role = btn.getAttribute('data-btc-node-action');
      const nodeKey = btn.getAttribute('data-btc-node-key');
      if (role && nodeKey) {
        hubEndpointCallbackRef.current(role, nodeKey);
        map.closePopup();
      }
    };
    const hostEl = containerRef.current;
    hostEl.addEventListener('click', handlePopupClick);

    let resizeObserver = null;
    let resizeRafId = null;
    let lastW = 0;
    let lastH = 0;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (!mapRef.current) {
          return;
        }
        const w = Math.round(hostEl.offsetWidth || 0);
        const h = Math.round(hostEl.offsetHeight || 0);
        if (w <= 0 || h <= 0) {
          return;
        }
        if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) {
          return;
        }
        lastW = w;
        lastH = h;
        if (resizeRafId) {
          cancelAnimationFrame(resizeRafId);
        }
        resizeRafId = requestAnimationFrame(() => {
          resizeRafId = null;
          if (mapRef.current) {
            mapRef.current.invalidateSize({ pan: false });
          }
        });
      });
      resizeObserver.observe(hostEl);
    }

    mapRef.current = map;

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      clearTimeout(resizeTimer);
      if (resizeRafId) {
        cancelAnimationFrame(resizeRafId);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      hostEl.removeEventListener('click', handlePopupClick);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-validate map dimensions smoothly when persistent tab switches back into view
  useEffect(() => {
    if (isVisible && mapRef.current) {
      const id = requestAnimationFrame(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ pan: false });
        }
      });
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [isVisible]);

  // Switch map tile layer dynamically when user toggles Street / Clean / Night Transit
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const chosen = TILE_STYLES[tileStyleKey] || TILE_STYLES.street;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(chosen.url, {
      maxZoom: 19,
      attribution: chosen.attribution
    }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [tileStyleKey]);

  // 2. Render Base Namma Metro Lines, Stations & Multi-Modal Interchange Hubs
  useEffect(() => {
    const group = baseLayerGroupRef.current;
    if (!group || !network) {
      return;
    }
    group.clearLayers();

    const hasForeground = Boolean(activeRoute || highlightedCorridor);
    const lineOpacity = hasForeground && dimBackgroundWhenActive ? 0.30 : 0.84;

    (network.metroLines || []).forEach((line) => {
      if (!line.operational || !line.stations || line.stations.length < 2) {
        return;
      }
      const latlngs = line.stations.map((s) => [s.latitude, s.longitude]);
      L.polyline(latlngs, {
        color: line.colorHex || '#7C3AED',
        weight: hasForeground && dimBackgroundWhenActive ? 3.5 : 5,
        opacity: lineOpacity
      }).addTo(group);

      line.stations.forEach((st) => {
        const marker = L.circleMarker([st.latitude, st.longitude], {
          radius: st.interchange ? 6.5 : 4.5,
          color: line.colorHex || '#7C3AED',
          weight: 2,
          fillColor: '#FFFFFF',
          fillOpacity: hasForeground && dimBackgroundWhenActive ? 0.65 : 1
        });
        marker.bindPopup(`
          <div style="min-width:210px">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:${escapeHtml(line.colorHex)}">
              ${escapeHtml(line.lineName)} &bull; ${escapeHtml(st.stationCode)}
            </div>
            <div style="font-size:14px;font-weight:800;color:#0F172A;margin-top:2px">
              ${escapeHtml(st.stationName)}
            </div>
            <div style="font-size:11px;color:#475569;margin-top:3px">
              Structure: <b>${escapeHtml(st.structureType)}</b> ${st.interchange ? '&bull; <b>Interchange</b>' : ''}
            </div>
            <div style="display:flex;gap:6px;margin-top:9px">
              <button data-btc-node-action="origin" data-btc-node-key="${escapeHtml(st.nodeKey)}"
                style="flex:1;padding:5px 8px;border-radius:8px;background:#EFF6FF;color:#1D4ED8;font-weight:700;font-size:11px;border:1px solid #BFDBFE;cursor:pointer">
                Origin
              </button>
              <button data-btc-node-action="destination" data-btc-node-key="${escapeHtml(st.nodeKey)}"
                style="flex:1;padding:5px 8px;border-radius:8px;background:#1D4ED8;color:#FFFFFF;font-weight:700;font-size:11px;border:none;cursor:pointer">
                Destination
              </button>
            </div>
          </div>
        `);
        marker.addTo(group);
      });
    });

    if (!hasForeground || !dimBackgroundWhenActive) {
      (network.nodes || [])
        .filter((n) => n.nodeType === 'BUS_STOP')
        .forEach((bs) => {
          const m = L.circleMarker([bs.latitude, bs.longitude], {
            radius: bs.interchange ? 5.5 : 4,
            color: '#2563EB',
            weight: 2,
            fillColor: '#DBEAFE',
            fillOpacity: 0.95
          });
          m.bindPopup(`
            <div style="min-width:210px">
              <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:#2563EB">
                BMTC Bus Stop &bull; ${escapeHtml(bs.code)}
              </div>
              <div style="font-size:14px;font-weight:800;color:#0F172A;margin-top:2px">
                ${escapeHtml(bs.name)}
              </div>
              <div style="font-size:11px;color:#475569;margin-top:2px">
                Corridor: ${escapeHtml(bs.corridorOrArea)}
              </div>
              <div style="display:flex;gap:6px;margin-top:9px">
                <button data-btc-node-action="origin" data-btc-node-key="${escapeHtml(bs.nodeKey)}"
                  style="flex:1;padding:5px 8px;border-radius:8px;background:#EFF6FF;color:#1D4ED8;font-weight:700;font-size:11px;border:1px solid #BFDBFE;cursor:pointer">
                  Origin
                </button>
                <button data-btc-node-action="destination" data-btc-node-key="${escapeHtml(bs.nodeKey)}"
                  style="flex:1;padding:5px 8px;border-radius:8px;background:#1D4ED8;color:#FFFFFF;font-weight:700;font-size:11px;border:none;cursor:pointer">
                  Destination
                </button>
              </div>
            </div>
          `);
          m.addTo(group);
        });
    }

    (network.transferHubs || []).forEach((hub) => {
      if (hasForeground && dimBackgroundWhenActive) {
        return;
      }
      const hubMarker = L.circleMarker([hub.latitude, hub.longitude], {
        radius: 8,
        color: '#F59E0B',
        weight: 2.5,
        fillColor: '#FEF3C7',
        fillOpacity: 0.95
      });
      hubMarker.bindPopup(`
        <div style="min-width:225px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#B45309">
            Multi-Modal Interchange Hub
          </div>
          <div style="font-size:14px;font-weight:800;color:#0F172A;margin-top:2px">
            ${escapeHtml(hub.hubName)}
          </div>
          <div style="font-size:11px;color:#334155;margin-top:6px;line-height:1.5">
            <div>&bull; <b>BMTC:</b> ${escapeHtml(hub.busStopName)}</div>
            <div>&bull; <b>Metro:</b> ${escapeHtml(hub.metroStationName)} (${escapeHtml(hub.metroLineName)})</div>
            <div>&bull; <b>Connector:</b> ${hub.walkingDistanceM}m ${hub.hasSkywalk ? 'Skywalk' : 'Walk'} (${hub.walkingTimeMins}m walk + ${hub.transferBufferMins}m buffer)</div>
          </div>
        </div>
      `);
      hubMarker.addTo(group);
    });
  }, [network, activeRoute, highlightedCorridor, dimBackgroundWhenActive]);

  // 3. Render Active Multi-Modal Door-to-Door Journey Polyline + Directional Flow + Smooth Camera Fly
  useEffect(() => {
    const map = mapRef.current;
    const group = routeLayerGroupRef.current;
    if (!map || !group) {
      return;
    }
    group.clearLayers();

    const boundsPoints = [];
    const hasActiveLegs = Boolean(
      activeRoute && Array.isArray(activeRoute.legs) && activeRoute.legs.length > 0
    );

    if (gpsOriginPin && !hasActiveLegs) {
      const gpsIcon = makeBadgeIcon('#16A34A', 'A', 32, '#DCFCE7', '#16A34A');
      const pinMarker = L.marker([gpsOriginPin.lat, gpsOriginPin.lng], { icon: gpsIcon });
      pinMarker.bindPopup(`
        <div style="min-width:185px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#15803D">
            Origin Place (${escapeHtml(gpsOriginPin.source || 'Selected Place')})
          </div>
          <div style="font-size:12px;font-weight:700;color:#0F172A;margin-top:2px">
            ${gpsOriginPin.lat.toFixed(5)}, ${gpsOriginPin.lng.toFixed(5)}
          </div>
        </div>
      `);
      pinMarker.addTo(group);
      boundsPoints.push([gpsOriginPin.lat, gpsOriginPin.lng]);
    }

    if (gpsDestPin && !hasActiveLegs) {
      const dstIcon = makeBadgeIcon('#7C3AED', 'B', 32, '#F3E8FF', '#7C3AED');
      const dstMarker = L.marker([gpsDestPin.lat, gpsDestPin.lng], { icon: dstIcon });
      dstMarker.bindPopup(`
        <div style="min-width:185px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#6D28D9">
            Destination Place (${escapeHtml(gpsDestPin.source || 'Selected Place')})
          </div>
          <div style="font-size:12px;font-weight:700;color:#0F172A;margin-top:2px">
            ${gpsDestPin.lat.toFixed(5)}, ${gpsDestPin.lng.toFixed(5)}
          </div>
        </div>
      `);
      dstMarker.addTo(group);
      boundsPoints.push([gpsDestPin.lat, gpsDestPin.lng]);
    }

    if (hasActiveLegs) {
      activeRoute.legs.forEach((leg, idx) => {
        const coords =
          Array.isArray(leg.polylineCoords) && leg.polylineCoords.length >= 2
            ? leg.polylineCoords
            : [
                [leg.fromLat, leg.fromLng],
                [leg.toLat, leg.toLng]
              ];

        coords.forEach((pt) => boundsPoints.push(pt));

        const isTransferOrWalk = leg.legMode === 'TRANSFER' || leg.legMode === 'WALK';

        // Crisp outer casing for high-contrast transit leg separation
        L.polyline(coords, {
          color: tileStyleKey === 'night' ? '#0F172A' : '#FFFFFF',
          weight: isTransferOrWalk ? 8.5 : 11,
          opacity: 0.94,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(group);

        const poly = L.polyline(coords, {
          color: leg.colorHex || '#2563EB',
          weight: isTransferOrWalk ? 4.5 : 6.5,
          opacity: 0.98,
          dashArray: isTransferOrWalk ? '7, 8' : null,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(group);

        // Directional animated glide overlay on active BMTC / Namma Metro vehicle legs
        if (!isTransferOrWalk) {
          L.polyline(coords, {
            color: '#FFFFFF',
            weight: 2.2,
            opacity: 0.55,
            dashArray: '6, 22',
            className: 'btc-route-flow',
            interactive: false
          }).addTo(group);
        }

        poly.bindPopup(`
          <div style="min-width:215px">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:${escapeHtml(leg.colorHex || '#2563EB')}">
              Leg ${leg.legOrder} &bull; ${escapeHtml(leg.legMode)}
            </div>
            <div style="font-size:13px;font-weight:800;color:#0F172A;margin-top:2px">
              ${escapeHtml(leg.routeOrLineName)}
            </div>
            <div style="font-size:11px;color:#475569;margin-top:4px">
              ${leg.durationMins} mins &bull; ${Number(leg.distanceKm).toFixed(2)} km
              ${Number(leg.legFareInr) > 0 ? `&bull; <b>Rs. ${Number(leg.legFareInr).toFixed(0)}</b>` : ''}
            </div>
          </div>
        `);

        if (leg.legMode === 'WALK' && leg.routeOrLineCode === 'FIRST_MILE') {
          L.circleMarker([leg.toLat, leg.toLng], {
            radius: 6,
            color: '#2563EB',
            weight: 2.5,
            fillColor: '#FFFFFF',
            fillOpacity: 1
          })
            .bindPopup(`<b>Board Transit At:</b> ${escapeHtml(leg.toPointName)}`)
            .addTo(group);
        }
        if (leg.legMode === 'WALK' && leg.routeOrLineCode === 'LAST_MILE') {
          L.circleMarker([leg.fromLat, leg.fromLng], {
            radius: 6,
            color: '#7C3AED',
            weight: 2.5,
            fillColor: '#FFFFFF',
            fillOpacity: 1
          })
            .bindPopup(`<b>Alight Transit At:</b> ${escapeHtml(leg.fromPointName)}`)
            .addTo(group);
        }

        if (!isTransferOrWalk && coords.length > 2) {
          coords.slice(1, -1).forEach((pt) => {
            L.circleMarker(pt, {
              radius: 4.5,
              color: leg.colorHex || '#2563EB',
              weight: 2,
              fillColor: '#FFFFFF',
              fillOpacity: 1
            }).addTo(group);
          });
        }

        if (leg.legMode === 'TRANSFER') {
          const transferMarker = L.marker([leg.toLat, leg.toLng], {
            icon: makeBadgeIcon('#F59E0B', 'T', 28)
          }).addTo(group);
          transferMarker.bindPopup(`
            <div style="min-width:225px">
              <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#B45309">
                Multi-Modal Interchange
              </div>
              <div style="font-size:14px;font-weight:800;color:#0F172A;margin-top:2px">
                ${escapeHtml(leg.routeOrLineName)}
              </div>
              <div style="font-size:11px;color:#334155;margin-top:5px;line-height:1.45">
                <div>&bull; From: <b>${escapeHtml(leg.fromPointName)}</b></div>
                <div>&bull; To: <b>${escapeHtml(leg.toPointName)}</b></div>
                <div>&bull; Transfer Walk + Buffer: <b>${leg.durationMins} mins</b></div>
              </div>
            </div>
          `);
        }

        if (idx === 0) {
          L.marker([leg.fromLat, leg.fromLng], {
            icon: makeBadgeIcon('#16A34A', 'A', 32, '#FFFFFF', '#16A34A')
          })
            .bindPopup(`<b>Origin:</b> ${escapeHtml(leg.fromPointName)}`)
            .addTo(group);
        }
        if (idx === activeRoute.legs.length - 1) {
          L.marker([leg.toLat, leg.toLng], {
            icon: makeBadgeIcon('#7C3AED', 'B', 32, '#FFFFFF', '#7C3AED')
          })
            .bindPopup(`<b>Destination:</b> ${escapeHtml(leg.toPointName)}`)
            .addTo(group);
        }
      });
    } else if (
      highlightedCorridor &&
      Array.isArray(highlightedCorridor.stops) &&
      highlightedCorridor.stops.length > 1
    ) {
      const coords = highlightedCorridor.stops.map((s) => [
        Number(s.latitude),
        Number(s.longitude)
      ]);
      coords.forEach((pt) => boundsPoints.push(pt));

      L.polyline(coords, {
        color: tileStyleKey === 'night' ? '#0F172A' : '#FFFFFF',
        weight: 9.5,
        opacity: 0.92
      }).addTo(group);

      L.polyline(coords, {
        color: '#2563EB',
        weight: 5.5,
        opacity: 0.97
      }).addTo(group);

      L.polyline(coords, {
        color: '#FFFFFF',
        weight: 2,
        opacity: 0.55,
        dashArray: '6, 22',
        className: 'btc-route-flow',
        interactive: false
      }).addTo(group);

      highlightedCorridor.stops.forEach((s, idx) => {
        const isTerminal = idx === 0 || idx === highlightedCorridor.stops.length - 1;
        const m = L.marker([Number(s.latitude), Number(s.longitude)], {
          icon: makeBadgeIcon(
            isTerminal ? '#1D4ED8' : '#2563EB',
            String(s.stopSequence),
            isTerminal ? 28 : 22
          )
        });
        m.bindPopup(`
          <div style="min-width:190px">
            <div style="font-size:10px;font-weight:800;color:#2563EB;text-transform:uppercase">
              BMTC ${escapeHtml(highlightedCorridor.routeNumber)} &bull; Stop #${s.stopSequence}
            </div>
            <div style="font-size:13px;font-weight:800;color:#0F172A;margin-top:2px">
              ${escapeHtml(s.stopName)}
            </div>
            <div style="font-size:11px;color:#475569;margin-top:3px">
              ${Number(s.distanceFromStartKm).toFixed(2)} km from origin
            </div>
          </div>
        `);
        m.addTo(group);
      });
    }

    if (boundsPoints.length >= 2) {
      const sig = `${boundsPoints[0][0].toFixed(4)},${boundsPoints[0][1].toFixed(4)}->${boundsPoints[boundsPoints.length - 1][0].toFixed(4)},${boundsPoints[boundsPoints.length - 1][1].toFixed(4)}:${boundsPoints.length}`;
      if (sig !== lastBoundsSigRef.current) {
        lastBoundsSigRef.current = sig;
        if (hasFittedOnceRef.current && isVisible && containerRef.current?.offsetWidth > 0) {
          map.flyToBounds(boundsPoints, {
            padding: [56, 56],
            maxZoom: 14,
            duration: 0.65,
            easeLinearity: 0.25
          });
        } else {
          map.fitBounds(boundsPoints, { padding: [56, 56], maxZoom: 14 });
          hasFittedOnceRef.current = true;
        }
      }
    }
  }, [activeRoute, highlightedCorridor, gpsOriginPin, gpsDestPin, tileStyleKey, isVisible]);

  const handleCycleTileStyle = () => {
    setTileStyleKey((prev) => {
      const idx = TILE_ORDER.indexOf(prev);
      return TILE_ORDER[(idx + 1) % TILE_ORDER.length];
    });
  };

  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(BENGALURU_CENTER, 12, { duration: 0.6 });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-100 overflow-hidden">
      <div
        ref={containerRef}
        className={`w-full h-full ${effectivePinTarget ? 'cursor-crosshair' : ''}`}
      />

      {/* Top-Left Floating Glassmorphic Active Route Summary HUD */}
      {activeRoute && !effectivePinTarget && (
        <div className="hidden sm:flex absolute top-3 left-14 z-[800] max-w-[440px] items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-elevated">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{activeRoute.sourceName}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0" />
              <span className="truncate">{activeRoute.destinationName}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] font-semibold text-slate-600 tabular-nums">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600 text-white font-bold">
                <Clock className="w-3 h-3" />
                {activeRoute.totalTimeMins} mins
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold">
                Rs. {Number(activeRoute.estimatedFareInr).toFixed(0)}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-600">
                <Footprints className="w-3 h-3 text-slate-500" />
                Walk {activeRoute.walkingTimeMins}m
              </span>
              <span className="text-slate-400">&bull;</span>
              <span>{activeRoute.totalDistanceKm} km</span>
            </div>
          </div>
        </div>
      )}

      {/* Top-Center Interactive Pin-Drop Instruction Banner */}
      {effectivePinTarget && (
        <div
          className={`absolute top-3 left-1/2 -translate-x-1/2 z-[850] px-4 py-2.5 rounded-full text-white text-xs font-bold shadow-floating flex items-center gap-2 ${
            effectivePinTarget === 'destination'
              ? 'bg-gradient-to-r from-purple-700 to-indigo-700'
              : 'bg-gradient-to-r from-blue-700 to-indigo-700'
          }`}
        >
          <Crosshair className="w-4 h-4 animate-pulse" />
          <span>
            {effectivePinTarget === 'destination'
              ? 'Click anywhere on the Bengaluru map to drop your exact Destination Pin'
              : 'Click anywhere on the Bengaluru map to drop your exact Origin Pin'}
          </span>
        </div>
      )}

      {/* Map Floating Action Dock (Top-Right) */}
      <div className="absolute top-3 right-3 z-[800] flex flex-col gap-2">
        {onSetPinDropTarget ? (
          <>
            <button
              type="button"
              onClick={() =>
                onSetPinDropTarget(effectivePinTarget === 'origin' ? null : 'origin')
              }
              title="Click any spot on map as your Origin Place"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shadow-elevated border backdrop-blur-md transition-all ${
                effectivePinTarget === 'origin'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-glow-blue'
                  : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200/95'
              }`}
            >
              <Crosshair
                className="w-3.5 h-3.5 text-blue-600 shrink-0"
                style={effectivePinTarget === 'origin' ? { color: '#FFFFFF' } : {}}
              />
              <span>
                {effectivePinTarget === 'origin' ? 'Cancel Origin Pin' : 'Pin Origin on Map'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onSetPinDropTarget(
                  effectivePinTarget === 'destination' ? null : 'destination'
                )
              }
              title="Click any exact building, college, mall, or street on map as your Destination"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shadow-elevated border backdrop-blur-md transition-all ${
                effectivePinTarget === 'destination'
                  ? 'bg-purple-600 text-white border-purple-700'
                  : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200/95'
              }`}
            >
              <MapPin
                className="w-3.5 h-3.5 text-purple-600 shrink-0"
                style={effectivePinTarget === 'destination' ? { color: '#FFFFFF' } : {}}
              />
              <span>
                {effectivePinTarget === 'destination'
                  ? 'Cancel Destination Pin'
                  : 'Pin Destination on Map'}
              </span>
            </button>
          </>
        ) : (
          onTogglePinDropMode && (
            <button
              type="button"
              onClick={onTogglePinDropMode}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shadow-elevated border backdrop-blur-md transition-all ${
                effectivePinTarget
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200/95'
              }`}
            >
              <Crosshair
                className="w-3.5 h-3.5 text-blue-600 shrink-0"
                style={effectivePinTarget ? { color: '#FFFFFF' } : {}}
              />
              <span>{effectivePinTarget ? 'Cancel Map Pin' : 'Drop Origin Pin'}</span>
            </button>
          )
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCycleTileStyle}
            title="Cycle Street Map -> Clean Transit -> Night Transit Cartography"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 hover:bg-white text-slate-700 border border-slate-200/95 text-xs font-bold shadow-elevated backdrop-blur-md transition-colors"
          >
            <MapIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>{TILE_STYLES[tileStyleKey]?.nextLabel || 'Clean Map'}</span>
          </button>

          <button
            type="button"
            onClick={handleRecenter}
            title="Smoothly fly back to Bengaluru center"
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-white/95 hover:bg-white text-slate-700 border border-slate-200/95 text-xs font-bold shadow-elevated backdrop-blur-md transition-colors"
          >
            <LocateFixed className="w-3.5 h-3.5 text-slate-600" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Bottom-Right Collapsible Glassmorphic Transit Legend */}
      <div className="absolute bottom-6 right-3 z-[800] bg-white/95 backdrop-blur-md rounded-2xl shadow-elevated border border-slate-200/95 px-3.5 py-2.5 text-xs w-[236px]">
        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-600"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Bengaluru Network Legend</span>
          </span>
          {legendOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        {legendOpen && (
          <div className="pt-2 mt-1.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-700 font-semibold">BMTC Bus Corridor</span>
              <span className="w-7 h-1.5 rounded-full bg-blue-600 inline-block" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-700 font-semibold">Metro Purple Line</span>
              <span className="w-7 h-1.5 rounded-full bg-purple-600 inline-block" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-700 font-semibold">Metro Green Line</span>
              <span className="w-7 h-1.5 rounded-full bg-green-600 inline-block" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-700 font-semibold">Metro Yellow Line</span>
              <span className="w-7 h-1.5 rounded-full bg-yellow-500 inline-block" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-700 font-semibold">Skywalk / Hub Transfer</span>
              <span className="w-7 border-t-2 border-dashed border-amber-500 inline-block" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-700 font-semibold">First / Last-Mile Walk</span>
              <span className="w-7 border-t-2 border-dashed border-slate-500 inline-block" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
