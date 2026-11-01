import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Bus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Copy,
  Footprints,
  GitCompareArrows,
  IndianRupee,
  Info,
  Leaf,
  Loader2,
  MapPin,
  Navigation,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  TrainFront,
  X,
  Zap
} from 'lucide-react';
import { transitApi } from '../api/transitApi';
import { useAuth } from '../context/AuthContext';
import PassBookingAuthModal from './PassBookingAuthModal';
import PlaceSearchInput from './PlaceSearchInput';
import TransitLeafletMap from './TransitLeafletMap';

const FAVORITES_STORAGE_KEY = 'btc_favorite_corridors_v1';

const DEFAULT_ORIGIN = {
  kind: 'NODE',
  nodeKey: 'BUS_1',
  name: 'Silk Board Junction',
  subtitle: 'BMTC Stop - Silk Board / ORR',
  address:
    'BMTC Bus Stop (BMTC-SLKB), Hosur Road & Outer Ring Road Flyover, Silk Board, Bengaluru - 560068',
  lat: 12.9172,
  lng: 77.6228
};

const DEFAULT_DEST = {
  kind: 'NODE',
  nodeKey: 'METRO_14',
  name: 'Whitefield (Kadugodi)',
  subtitle: 'Namma Metro Purple Line (PUR-14)',
  address:
    'Namma Metro Purple Line Terminal (PUR-14), Kadugodi Main Rd, Whitefield, Bengaluru - 560067',
  lat: 12.9956,
  lng: 77.7592
};

const QUICK_CORRIDORS = [
  {
    label: 'BMS College -> Mall of Asia',
    tag: '3 Min Walk',
    origin: {
      kind: 'PLACE',
      nodeKey: null,
      name: 'BMS College of Engineering',
      subtitle: 'Basavanagudi - College / University',
      address: 'Bull Temple Road, Basavanagudi, Bengaluru - 560019',
      lat: 12.941,
      lng: 77.5655
    },
    dest: {
      kind: 'PLACE',
      nodeKey: null,
      name: 'Phoenix Mall of Asia',
      subtitle: 'Byatarayanapura / NH-44 - Mall / Market',
      address: '239/240, Bellary Road (NH-44), Byatarayanapura, Bengaluru - 560092',
      lat: 13.0706,
      lng: 77.5916
    }
  },
  {
    label: 'Vidhana Soudha -> RPO Koramangala',
    tag: 'Govt Office',
    origin: {
      kind: 'PLACE',
      nodeKey: null,
      name: 'Vidhana Soudha (State Secretariat)',
      subtitle: 'Ambedkar Veedhi / Cubbon Park - Govt Office',
      address: 'Dr B.R. Ambedkar Veedhi, Sampangi Rama Nagar, Bengaluru - 560001',
      lat: 12.979667,
      lng: 77.590667
    },
    dest: {
      kind: 'PLACE',
      nodeKey: null,
      name: 'Regional Passport Office (RPO Bengaluru)',
      subtitle: 'Koramangala 8th Block - Govt Office',
      address: '80 Feet Road, 8th Block, Koramangala, Bengaluru - 560095',
      lat: 12.9422,
      lng: 77.6184
    }
  },
  {
    label: 'Silk Board -> Whitefield',
    tag: 'ORR Flagship',
    origin: DEFAULT_ORIGIN,
    dest: DEFAULT_DEST
  },
  {
    label: 'NPS Indiranagar -> IISc',
    tag: 'School to Univ',
    origin: {
      kind: 'PLACE',
      nodeKey: null,
      name: 'National Public School (NPS) Indiranagar',
      subtitle: 'HAL 2nd Stage / Indiranagar - School / PU College',
      address: '12th A Main Road, HAL 2nd Stage, Indiranagar, Bengaluru - 560008',
      lat: 12.9698,
      lng: 77.6412
    },
    dest: {
      kind: 'PLACE',
      nodeKey: null,
      name: 'Indian Institute of Science (IISc)',
      subtitle: 'Malleshwaram / Yeshwanthpur - College / University',
      address: 'CV Raman Road, Malleshwaram, Bengaluru - 560012',
      lat: 13.0219,
      lng: 77.5671
    }
  },
  {
    label: 'PES Univ -> Orion Mall',
    tag: 'West Shortcut',
    origin: {
      kind: 'PLACE',
      nodeKey: null,
      name: 'PES University (RR Campus)',
      subtitle: 'Banashankari 3rd Stage - College / University',
      address: '100 Feet Ring Road, Banashankari 3rd Stage, Bengaluru - 560085',
      lat: 12.9345,
      lng: 77.5345
    },
    dest: {
      kind: 'PLACE',
      nodeKey: null,
      name: 'Orion Mall Brigade Gateway',
      subtitle: 'Rajajinagar / Malleshwaram West - Mall / Market',
      address: 'Dr Rajkumar Road, Malleshwaram West, Bengaluru - 560055',
      lat: 13.011,
      lng: 77.555
    }
  },
  {
    label: 'Jayanagar -> Mysuru Road',
    tag: '60-A + Metro',
    origin: {
      kind: 'NODE',
      nodeKey: 'METRO_20',
      name: 'Jayanagar',
      subtitle: 'Namma Metro Green Line',
      lat: 12.9295,
      lng: 77.5801
    },
    dest: {
      kind: 'NODE',
      nodeKey: 'METRO_3',
      name: 'Mysuru Road',
      subtitle: 'Namma Metro Purple Line',
      lat: 12.9467,
      lng: 77.5301
    }
  },
  {
    label: 'Electronic City -> Indiranagar',
    tag: 'Yellow + Purple',
    origin: {
      kind: 'NODE',
      nodeKey: 'METRO_30',
      name: 'Electronic City',
      subtitle: 'Namma Metro Yellow Line',
      lat: 12.8452,
      lng: 77.6602
    },
    dest: {
      kind: 'NODE',
      nodeKey: 'METRO_8',
      name: 'Indiranagar',
      subtitle: 'Namma Metro Purple Line',
      lat: 12.9784,
      lng: 77.6386
    }
  }
];

const MANUAL_LANDMARK_PINS = [
  { label: 'BMS College Basavanagudi', lat: 12.941, lng: 77.5655 },
  { label: 'Koramangala 5th Blk', lat: 12.9349, lng: 77.6192 },
  { label: 'Phoenix Mall of Asia', lat: 13.0706, lng: 77.5916 },
  { label: 'Manyata Tech Park', lat: 13.0458, lng: 77.6206 },
  { label: 'PES Univ RR Campus', lat: 12.9345, lng: 77.5345 }
];

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isInsideGreaterBengaluru(lat, lng) {
  return lat >= 12.5 && lat <= 13.5 && lng >= 77.2 && lng <= 78.0;
}

function summarizeOptionModes(option) {
  if (!option?.legs) {
    return [];
  }
  return option.legs.filter((l) => l.legMode === 'BUS' || l.legMode === 'METRO');
}

function endpointFromNode(node) {
  if (!node) {
    return null;
  }
  return {
    kind: 'NODE',
    nodeKey: node.nodeKey,
    name: node.name,
    subtitle: node.corridorOrArea || node.nodeType,
    lat: node.latitude,
    lng: node.longitude
  };
}

function endpointFromPlaceResult(place) {
  if (!place) {
    return null;
  }
  if (place.nodeKey) {
    return {
      kind: 'NODE',
      nodeKey: place.nodeKey,
      name: place.name,
      subtitle: place.subtitle,
      address: place.address || place.subtitle,
      lat: place.latitude,
      lng: place.longitude
    };
  }
  return {
    kind: 'PLACE',
    nodeKey: null,
    name: place.name,
    subtitle: place.subtitle,
    address: place.address || place.subtitle,
    lat: place.latitude,
    lng: place.longitude
  };
}

function getLegSegmentColor(leg) {
  if (leg.legMode === 'WALK') {
    return '#64748B';
  }
  if (leg.legMode === 'TRANSFER') {
    return '#F59E0B';
  }
  return leg.colorHex || (leg.legMode === 'METRO' ? '#7C3AED' : '#2563EB');
}

function buildShareableItineraryText(opt) {
  const header = `Bengaluru TransitConnect: ${opt.sourceName} -> ${opt.destinationName}`;
  const metrics = `Total: ${opt.totalTimeMins} mins | Fare: Rs. ${Number(opt.estimatedFareInr).toFixed(0)} | Distance: ${opt.totalDistanceKm} km | Transfers: ${opt.transferCount}`;
  const steps = (opt.legs || [])
    .map(
      (leg, idx) =>
        `${idx + 1}. [${leg.legMode}] ${leg.routeOrLineName}: ${leg.fromPointName} -> ${leg.toPointName} (${leg.durationMins}m)`
    )
    .join('\n');
  return `${header}\n${metrics}\n${steps}`;
}

export default function JourneyPlannerView({
  network,
  networkLoading,
  presetEndpoint,
  onClearPresetEndpoint,
  presetCorridor,
  onClearPresetCorridor,
  onRequireAuth,
  onBookedPass,
  onNotify,
  isVisible = true
}) {
  const { user, refreshProfile } = useAuth();

  const [originEndpoint, setOriginEndpoint] = useState(DEFAULT_ORIGIN);
  const [destEndpoint, setDestEndpoint] = useState(DEFAULT_DEST);
  const [optimizationType, setOptimizationType] = useState('FASTEST');
  const [routeCategory, setRouteCategory] = useState('COMBINED');
  const [favorites, setFavorites] = useState(() => loadFavorites());

  const [nearbyNodes, setNearbyNodes] = useState([]);
  const [gpsBanner, setGpsBanner] = useState(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [pinDropTarget, setPinDropTarget] = useState(null);

  const [searchResult, setSearchResult] = useState(null);
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);
  const [expandedCardIdx, setExpandedCardIdx] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [bookingPlanId, setBookingPlanId] = useState(null);
  const [bookingFeedback, setBookingFeedback] = useState(null);
  const [pendingBookOption, setPendingBookOption] = useState(null);
  const [bookingAuthError, setBookingAuthError] = useState('');

  const nodeMap = useMemo(() => {
    const map = new Map();
    (network?.nodes || []).forEach((n) => map.set(n.nodeKey, n));
    return map;
  }, [network]);

  const corridorFavoriteId = `${originEndpoint.name}::${destEndpoint.name}`;
  const isCurrentFavorite = useMemo(
    () => favorites.some((f) => f.id === corridorFavoriteId),
    [favorites, corridorFavoriteId]
  );

  const handleToggleFavorite = () => {
    const exists = favorites.some((f) => f.id === corridorFavoriteId);
    let next;
    if (exists) {
      next = favorites.filter((f) => f.id !== corridorFavoriteId);
      if (onNotify) {
        onNotify('Removed corridor from Favorites');
      }
    } else {
      const entry = {
        id: corridorFavoriteId,
        label: `${originEndpoint.name.split('(')[0].trim()} -> ${destEndpoint.name.split('(')[0].trim()}`,
        origin: originEndpoint,
        dest: destEndpoint
      };
      next = [entry, ...favorites].slice(0, 8);
      if (onNotify) {
        onNotify('Pinned corridor to Favorites');
      }
    }
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const hasInitialSearchedRef = useRef(false);
  const searchRequestIdRef = useRef(0);
  const handledPresetKeyRef = useRef(null);
  const plannerStateRef = useRef({
    originEndpoint,
    destEndpoint,
    optimizationType,
    routeCategory,
    onClearPresetEndpoint,
    onClearPresetCorridor
  });
  plannerStateRef.current = {
    originEndpoint,
    destEndpoint,
    optimizationType,
    routeCategory,
    onClearPresetEndpoint,
    onClearPresetCorridor
  };

  const executeSearch = useCallback(async (orig, dest, opt, cat) => {
    if (!orig || !dest) {
      return;
    }
    const reqId = ++searchRequestIdRef.current;
    setSearching(true);
    setSearchError('');
    setBookingFeedback(null);

    const isCustomOrigin = orig.kind === 'PLACE';
    const isCustomDest = dest.kind === 'PLACE';

    try {
      const res = await transitApi.searchJourneys({
        sourceNodeKey: isCustomOrigin ? '' : orig.nodeKey,
        destinationNodeKey: isCustomDest ? '' : dest.nodeKey,
        optimizationType: opt,
        routeCategory: cat,
        originLat: isCustomOrigin ? orig.lat : null,
        originLng: isCustomOrigin ? orig.lng : null,
        originPlaceName: isCustomOrigin ? orig.name : null,
        destLat: isCustomDest ? dest.lat : null,
        destLng: isCustomDest ? dest.lng : null,
        destPlaceName: isCustomDest ? dest.name : null
      });
      if (reqId !== searchRequestIdRef.current) {
        return;
      }
      setSearchResult(res);
      setSelectedCardIdx(0);
      setExpandedCardIdx(0);

      if ((isCustomOrigin || isCustomDest) && res?.recommended) {
        const firstWalk = (res.recommended.legs || []).find(
          (l) => l.routeOrLineCode === 'FIRST_MILE'
        );
        const lastWalk = (res.recommended.legs || []).find(
          (l) => l.routeOrLineCode === 'LAST_MILE'
        );
        const parts = [];
        if (firstWalk) {
          parts.push(
            `First-mile: ${firstWalk.distanceKm} km (~${firstWalk.durationMins}m walk) to ${firstWalk.toPointName}`
          );
        }
        if (lastWalk) {
          parts.push(
            `Last-mile: ${lastWalk.distanceKm} km (~${lastWalk.durationMins}m walk) from ${lastWalk.fromPointName}`
          );
        }
        if (parts.length > 0) {
          setGpsBanner({
            tone: 'success',
            text: parts.join(' | ')
          });
        }
      }
    } catch (err) {
      if (reqId !== searchRequestIdRef.current) {
        return;
      }
      setSearchError(err.message || 'Unable to compute multi-modal route.');
      setSearchResult(null);
    } finally {
      if (reqId === searchRequestIdRef.current) {
        setSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (network && !hasInitialSearchedRef.current) {
      hasInitialSearchedRef.current = true;
      if (!presetEndpoint && !presetCorridor) {
        executeSearch(DEFAULT_ORIGIN, DEFAULT_DEST, 'FASTEST', 'COMBINED');
      }
    }
  }, [network, presetEndpoint, presetCorridor, executeSearch]);

  useEffect(() => {
    if (!network || !presetEndpoint?.nodeKey) {
      return;
    }
    const presetKey = `ep:${presetEndpoint.role}:${presetEndpoint.nodeKey}:${presetEndpoint.requestId || 0}`;
    if (handledPresetKeyRef.current === presetKey) {
      return;
    }
    handledPresetKeyRef.current = presetKey;

    const { role, nodeKey } = presetEndpoint;
    const {
      originEndpoint: curOrigin,
      destEndpoint: curDest,
      optimizationType: curOpt,
      routeCategory: curCat,
      onClearPresetEndpoint: clearEp
    } = plannerStateRef.current;

    if (clearEp) {
      clearEp();
    }

    const pickedNode = nodeMap.get(nodeKey);
    if (!pickedNode) {
      return;
    }
    const nextEp = endpointFromNode(pickedNode);
    if (role === 'origin') {
      const safeDest =
        curDest.kind === 'NODE' && curDest.nodeKey === nodeKey ? DEFAULT_DEST : curDest;
      setOriginEndpoint(nextEp);
      setDestEndpoint(safeDest);
      executeSearch(nextEp, safeDest, curOpt, curCat);
    } else {
      const safeOrigin =
        curOrigin.kind === 'NODE' && curOrigin.nodeKey === nodeKey ? DEFAULT_ORIGIN : curOrigin;
      setOriginEndpoint(safeOrigin);
      setDestEndpoint(nextEp);
      executeSearch(safeOrigin, nextEp, curOpt, curCat);
    }
  }, [network, presetEndpoint, nodeMap, executeSearch]);

  // Handle Re-Plan Corridor requests from Smart Passes / History (single-shot guarded)
  useEffect(() => {
    if (!network || !presetCorridor?.sourceName || !presetCorridor?.destinationName) {
      return;
    }
    const corridorKey = `corridor:${presetCorridor.sourceName}->${presetCorridor.destinationName}:${presetCorridor.requestId || 0}`;
    if (handledPresetKeyRef.current === corridorKey) {
      return;
    }
    handledPresetKeyRef.current = corridorKey;

    const targetSourceName = presetCorridor.sourceName;
    const targetDestName = presetCorridor.destinationName;
    const {
      originEndpoint: fallbackOrig,
      destEndpoint: fallbackDest,
      optimizationType: curOpt,
      routeCategory: curCat,
      onClearPresetCorridor: clearCorridor
    } = plannerStateRef.current;

    // Clear immediately so state updates inside async resolution can never re-trigger this effect
    if (clearCorridor) {
      clearCorridor();
    }

    (async () => {
      try {
        const [origMatches, destMatches] = await Promise.all([
          transitApi.searchPlaces(targetSourceName, 5, ''),
          transitApi.searchPlaces(targetDestName, 5, '')
        ]);
        const origEp =
          endpointFromPlaceResult(origMatches?.[0]) || fallbackOrig || DEFAULT_ORIGIN;
        const dstEp =
          endpointFromPlaceResult(destMatches?.[0]) || fallbackDest || DEFAULT_DEST;
        setOriginEndpoint(origEp);
        setDestEndpoint(dstEp);
        await executeSearch(origEp, dstEp, curOpt, curCat);
      } catch {
        // executeSearch handles any user-facing route error banner
      }
    })();
  }, [network, presetCorridor, executeSearch]);

  const handleSwapEndpoints = () => {
    const prevOrig = originEndpoint;
    const prevDest = destEndpoint;
    setOriginEndpoint(prevDest);
    setDestEndpoint(prevOrig);
    executeSearch(prevDest, prevOrig, optimizationType, routeCategory);
  };

  const applyCustomCoordinates = async (role, lat, lng, customLabel) => {
    setGpsBusy(true);
    try {
      const nodes = await transitApi.getNearbyNodes(lat, lng, 4.0, 6);
      setNearbyNodes(nodes || []);
      const nearestHint =
        nodes && nodes.length > 0 ? `Near ${nodes[0].displayName}` : 'Bengaluru Map Pin';
      const placeEp = {
        kind: 'PLACE',
        nodeKey: null,
        name: customLabel || `${nearestHint} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        subtitle: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng
      };

      if (role === 'destination') {
        setDestEndpoint(placeEp);
        await executeSearch(originEndpoint, placeEp, optimizationType, routeCategory);
      } else {
        setOriginEndpoint(placeEp);
        await executeSearch(placeEp, destEndpoint, optimizationType, routeCategory);
      }
    } catch (err) {
      setGpsBanner({
        tone: 'amber',
        text: err.message || 'Coordinate lookup failed; manual place search remains active.'
      });
    } finally {
      setGpsBusy(false);
    }
  };

  const handleBrowserGps = () => {
    if (!navigator.geolocation) {
      setGpsBanner({
        tone: 'amber',
        text: 'Browser Geolocation API is unavailable. Search any specific Bengaluru place or use Map Pin below.'
      });
      return;
    }

    setGpsBusy(true);
    setGpsBanner(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        if (!isInsideGreaterBengaluru(lat, lng)) {
          setGpsBusy(false);
          setGpsBanner({
            tone: 'amber',
            text: `Device GPS (${lat.toFixed(2)}, ${lng.toFixed(2)}) is outside Greater Bengaluru. Pick any Bengaluru place or landmark below.`
          });
          return;
        }
        applyCustomCoordinates('origin', lat, lng, 'My Live GPS Location');
      },
      () => {
        setGpsBusy(false);
        setGpsBanner({
          tone: 'amber',
          text: 'GPS permission was denied or timed out. Search any place, street, or use Map Pin without GPS.'
        });
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
    );
  };

  const handleMapPinDropped = ({ target, lat, lng }) => {
    const role = target === 'destination' ? 'destination' : 'origin';
    setPinDropTarget(null);
    if (!isInsideGreaterBengaluru(lat, lng)) {
      setGpsBanner({
        tone: 'amber',
        text: 'Please click inside Greater Bengaluru bounds to plan a BMTC / Namma Metro route.'
      });
      return;
    }
    const label =
      role === 'destination'
        ? `Pinned Destination (${lat.toFixed(4)}, ${lng.toFixed(4)})`
        : `Pinned Origin (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    applyCustomCoordinates(role, lat, lng, label);
  };

  const handleHubPopupSelect = (role, nodeKey) => {
    const picked = nodeMap.get(nodeKey);
    if (!picked) {
      return;
    }
    const nextEp = endpointFromNode(picked);
    if (role === 'origin') {
      setOriginEndpoint(nextEp);
      executeSearch(nextEp, destEndpoint, optimizationType, routeCategory);
    } else if (role === 'destination') {
      setDestEndpoint(nextEp);
      executeSearch(originEndpoint, nextEp, optimizationType, routeCategory);
    }
  };

  const handleCopyItinerary = async (e, opt) => {
    e.stopPropagation();
    const summary = buildShareableItineraryText(opt);
    try {
      await navigator.clipboard.writeText(summary);
      if (onNotify) {
        onNotify('Copied step-by-step itinerary to clipboard');
      }
    } catch {
      if (onNotify) {
        onNotify('Itinerary ready to share');
      }
    }
  };

  const displayedCards = useMemo(() => {
    if (!searchResult?.recommended) {
      return [];
    }
    const list = [searchResult.recommended];
    const seenPlanIds = new Set([searchResult.recommended.planId]);

    (searchResult.alternatives || []).forEach((alt) => {
      if (!seenPlanIds.has(alt.planId)) {
        seenPlanIds.add(alt.planId);
        list.push(alt);
      }
    });

    Object.entries(searchResult.modeComparison || {}).forEach(([modeKey, opt]) => {
      if (opt && !seenPlanIds.has(opt.planId)) {
        seenPlanIds.add(opt.planId);
        list.push({
          ...opt,
          badgeLabel: modeKey === 'BUS_ONLY' ? 'Direct / Bus-Only Option' : opt.badgeLabel
        });
      }
    });

    return list;
  }, [searchResult]);

  const activeRouteOnMap = displayedCards[selectedCardIdx] || searchResult?.recommended || null;

  const tabMetrics = useMemo(() => {
    const alts = searchResult?.alternatives || [];
    const fastest = alts.find((a) => a.optimizationType === 'FASTEST');
    const cheapest = alts.find((a) => a.optimizationType === 'CHEAPEST');
    const minTr = alts.find((a) => a.optimizationType === 'MIN_TRANSFERS');
    return {
      FASTEST: fastest ? `${fastest.totalTimeMins} min` : '--',
      CHEAPEST: cheapest ? `Rs. ${Number(cheapest.estimatedFareInr).toFixed(0)}` : '--',
      MIN_TRANSFERS:
        minTr !== undefined && minTr !== null
          ? `${minTr.transferCount} ${minTr.transferCount === 1 ? 'Transfer' : 'Transfers'}`
          : '--'
    };
  }, [searchResult]);

  const handleBookPass = (option) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!option?.planId) {
      return;
    }
    setBookingFeedback(null);
    setBookingAuthError('');
    setPendingBookOption(option);
  };

  const handleConfirmAuthenticatedBook = async (authPayload) => {
    if (!pendingBookOption?.planId) {
      return;
    }
    setBookingPlanId(pendingBookOption.planId);
    setBookingAuthError('');
    setBookingFeedback(null);
    try {
      const booked = await transitApi.bookUnifiedPass(authPayload);
      await refreshProfile();
      setPendingBookOption(null);
      if (onNotify) {
        onNotify(`Issued QR Pass ${booked.qrPassCode}`);
      }
      if (onBookedPass) {
        onBookedPass(booked);
      }
    } catch (err) {
      setBookingAuthError(err.message || 'Unified QR Pass booking failed.');
    } finally {
      setBookingPlanId(null);
    }
  };

  const mapOriginPin =
    originEndpoint.kind === 'PLACE'
      ? { lat: originEndpoint.lat, lng: originEndpoint.lng, source: originEndpoint.name }
      : null;
  const mapDestPin =
    destEndpoint.kind === 'PLACE'
      ? { lat: destEndpoint.lat, lng: destEndpoint.lng, source: destEndpoint.name }
      : null;

  return (
    <div className="max-w-[1680px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-68px)]">
      {/* LEFT COMMAND PANEL: Door-to-Door Multi-Modal Route Studio */}
      <aside className="lg:col-span-5 xl:col-span-4 bg-white border-r border-slate-200/90 flex flex-col max-h-[calc(100vh-68px)] lg:overflow-y-auto">
        {/* Porcelain Mesh Hero Header */}
        <div className="btc-sidebar-hero px-5 pt-5 pb-4 border-b border-slate-200/75">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-600/10 border border-blue-600/20 text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>Multi-Modal Dijkstra &bull; Low-Walk (&le;10 min)</span>
            </div>

            <button
              type="button"
              onClick={handleToggleFavorite}
              title={
                isCurrentFavorite
                  ? 'Remove this corridor from Favorites'
                  : 'Save this Origin -> Destination corridor to Favorites'
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-all ${
                isCurrentFavorite
                  ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  isCurrentFavorite ? 'fill-amber-400 text-amber-500' : 'text-slate-400'
                }`}
              />
              <span>{isCurrentFavorite ? 'Saved' : 'Pin Route'}</span>
            </button>
          </div>

          <h1 className="font-display text-xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            Door-to-Door Journey Planner
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Search any Bengaluru government office, school, college, famous place, street, or stop
          </p>

          {/* Connected Origin -> Destination Route Pod */}
          <div className="mt-4 bg-white rounded-2xl p-3.5 border border-slate-200/95 shadow-card relative">
            <div className="flex gap-3">
              {/* Vertical Visual Connector Rail */}
              <div className="flex flex-col items-center pt-7 pb-6 shrink-0 select-none">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 shadow-2xs" />
                <div className="w-0.5 flex-1 my-1.5 border-l-2 border-dashed border-slate-300" />
                <span className="w-3.5 h-3.5 rounded-full bg-purple-600 ring-4 ring-purple-100 shadow-2xs" />
              </div>

              {/* Inputs Column */}
              <div className="flex-1 min-w-0 space-y-2.5">
                {/* ORIGIN */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Origin Place or Station
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleBrowserGps}
                        disabled={gpsBusy}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200/80 text-blue-700 text-[10px] font-bold transition-colors"
                        title="Use live browser GPS as your Origin"
                      >
                        <Navigation className="w-2.5 h-2.5" />
                        <span>{gpsBusy ? 'Locating...' : 'GPS'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPinDropTarget((prev) => (prev === 'origin' ? null : 'origin'))
                        }
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                          pinDropTarget === 'origin'
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                        title="Click any exact building or street on map as Origin"
                      >
                        <Compass className="w-2.5 h-2.5" />
                        <span>Pin</span>
                      </button>
                    </div>
                  </div>

                  <PlaceSearchInput
                    value={originEndpoint}
                    disabled={networkLoading}
                    accentColor="blue"
                    placeholder="Type origin place, college, street, or stop..."
                    onSelect={(ep) => {
                      setOriginEndpoint(ep);
                      setGpsBanner(null);
                      executeSearch(ep, destEndpoint, optimizationType, routeCategory);
                    }}
                  />
                </div>

                {/* Divider with Floating Swap Trigger */}
                <div className="relative flex items-center py-0.5">
                  <div className="h-px bg-slate-200/90 flex-1" />
                  <button
                    type="button"
                    onClick={handleSwapEndpoints}
                    title="Swap Origin and Destination"
                    className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[10px] font-bold text-slate-600 hover:text-blue-700 shadow-2xs transition-all group"
                  >
                    <ArrowUpDown className="w-3 h-3 transition-transform duration-300 group-hover:rotate-180" />
                    <span>Swap</span>
                  </button>
                </div>

                {/* DESTINATION */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Destination Place or Station
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPinDropTarget((prev) =>
                          prev === 'destination' ? null : 'destination'
                        )
                      }
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                        pinDropTarget === 'destination'
                          ? 'bg-purple-600 text-white border-purple-700'
                          : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200/80'
                      }`}
                      title="Click any exact building, college, mall, or house on map as Destination"
                    >
                      <MapPin className="w-2.5 h-2.5" />
                      <span>Map Pin</span>
                    </button>
                  </div>

                  <PlaceSearchInput
                    value={destEndpoint}
                    disabled={networkLoading}
                    accentColor="purple"
                    placeholder="Type destination place, mall, hospital, street..."
                    onSelect={(ep) => {
                      setDestEndpoint(ep);
                      setGpsBanner(null);
                      executeSearch(originEndpoint, ep, optimizationType, routeCategory);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Controls & Results Stream */}
        <div className="p-5 space-y-4">
          {/* Door-to-Door / GPS / Manual Fallback Status Banner */}
          {gpsBanner && (
            <div
              className={`rounded-2xl p-3 border text-xs space-y-2 btc-fade-in ${
                gpsBanner.tone === 'success'
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {gpsBanner.tone === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <span className="font-semibold leading-relaxed">{gpsBanner.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGpsBanner(null)}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {gpsBanner.tone === 'amber' && (
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 mb-1">
                    Manual Bengaluru Landmark Fallback:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {MANUAL_LANDMARK_PINS.map((lm) => (
                      <button
                        key={lm.label}
                        type="button"
                        onClick={() =>
                          applyCustomCoordinates('origin', lm.lat, lm.lng, lm.label)
                        }
                        className="px-2 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-[11px] font-bold text-slate-800 transition-colors"
                      >
                        {lm.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {nearbyNodes.length > 1 && gpsBanner.tone === 'amber' && (
                <div className="pt-1.5 border-t border-amber-200/70">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-75 mb-1">
                    Nearby Stops Within 4.0 km:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {nearbyNodes.slice(0, 5).map((nd) => (
                      <button
                        key={nd.nodeKey}
                        type="button"
                        onClick={() => {
                          const picked = nodeMap.get(nd.nodeKey);
                          if (picked) {
                            const ep = endpointFromNode(picked);
                            setOriginEndpoint(ep);
                            executeSearch(ep, destEndpoint, optimizationType, routeCategory);
                          }
                        }}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-blue-400"
                      >
                        {nd.displayName} ({nd.distanceKm} km)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pinned Favorites Bar (if user saved corridors) */}
          {favorites.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-amber-700 mb-1.5">
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                  <span>Pinned Favorite Corridors</span>
                </span>
                <span className="text-slate-400 font-semibold">{favorites.length} saved</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {favorites.map((fav) => {
                  const active = fav.id === corridorFavoriteId;
                  return (
                    <button
                      key={fav.id}
                      type="button"
                      onClick={() => {
                        setOriginEndpoint(fav.origin);
                        setDestEndpoint(fav.dest);
                        setGpsBanner(null);
                        executeSearch(fav.origin, fav.dest, optimizationType, routeCategory);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all ${
                        active
                          ? 'bg-amber-500 border-amber-600 text-white shadow-2xs'
                          : 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200 text-amber-900'
                      }`}
                    >
                      <Star
                        className={`w-3 h-3 ${
                          active ? 'fill-white text-white' : 'fill-amber-400 text-amber-500'
                        }`}
                      />
                      <span>{fav.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Curated 1-Click Corridors (Clean Horizontal Scroll Strip) */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>Featured Bengaluru Corridors</span>
              </span>
              {searching && displayedCards.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-blue-600 font-bold">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Updating...</span>
                </span>
              ) : (
                <span className="text-slate-400 font-semibold">Swipe &rarr;</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {QUICK_CORRIDORS.map((preset) => {
                const active =
                  originEndpoint.name === preset.origin.name &&
                  destEndpoint.name === preset.dest.name;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setOriginEndpoint(preset.origin);
                      setDestEndpoint(preset.dest);
                      setGpsBanner(null);
                      executeSearch(
                        preset.origin,
                        preset.dest,
                        optimizationType,
                        routeCategory
                      );
                    }}
                    className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-600 text-white shadow-xs'
                        : 'bg-slate-50/90 hover:bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200/80 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700'
                      }`}
                    >
                      {preset.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3-Card Tactile Optimization Metric Selector */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'FASTEST', title: 'Fastest', sub: tabMetrics.FASTEST, icon: Zap },
              { id: 'CHEAPEST', title: 'Cheapest', sub: tabMetrics.CHEAPEST, icon: IndianRupee },
              {
                id: 'MIN_TRANSFERS',
                title: 'Min Transfers',
                sub: tabMetrics.MIN_TRANSFERS,
                icon: GitCompareArrows
              }
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = optimizationType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setOptimizationType(tab.id);
                    executeSearch(originEndpoint, destEndpoint, tab.id, routeCategory);
                  }}
                  className={`p-2.5 rounded-2xl border text-left transition-all duration-150 ${
                    isSelected
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-600 shadow-glow-blue'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/95 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider ${
                        isSelected ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      {tab.title}
                    </span>
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isSelected ? 'text-blue-200' : 'text-blue-600'
                      }`}
                    />
                  </div>
                  <div
                    className={`text-sm font-extrabold tabular-nums mt-0.5 truncate ${
                      isSelected ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {tab.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Subgraph Mode Comparison Dock (Bus + Metro vs BMTC Only vs Metro Only) */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100/95 p-1 rounded-2xl border border-slate-200/90 text-xs">
            {[
              { id: 'COMBINED', label: 'Bus + Metro' },
              { id: 'BUS_ONLY', label: 'BMTC Only' },
              { id: 'METRO_ONLY', label: 'Metro Only' }
            ].map((m) => {
              const active = routeCategory === m.id;
              const cmp = searchResult?.modeComparison?.[m.id];
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setRouteCategory(m.id);
                    executeSearch(originEndpoint, destEndpoint, optimizationType, m.id);
                  }}
                  className={`py-2 px-2 rounded-xl font-bold transition-all text-center ${
                    active
                      ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="text-[11px] font-extrabold">{m.label}</div>
                  <div className="text-[10px] font-semibold text-slate-500 tabular-nums mt-0.5">
                    {cmp
                      ? `${cmp.totalTimeMins}m \u2022 Rs. ${Number(cmp.estimatedFareInr).toFixed(0)}`
                      : 'N/A'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Error / MySQL ACID Wallet Trigger Alert */}
          {(searchError || bookingFeedback) && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium btc-fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-extrabold text-red-900">
                  {bookingFeedback ? 'MySQL ACID Wallet Protection Triggered' : 'Route Notice'}
                </div>
                <div className="mt-0.5">{bookingFeedback?.text || searchError}</div>
              </div>
            </div>
          )}

          {/* Initial Loading State (only when no cards exist yet, preventing layout jump!) */}
          {(searching || networkLoading) && displayedCards.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2.5 bg-slate-50/70 rounded-2xl border border-slate-200/70">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-bold text-slate-700">
                Solving Door-to-Door Multi-Modal Graph &amp; Slab Tariffs...
              </span>
            </div>
          )}

          {/* Computed Route Option Cards (Updates smoothly in-place without DOM remount blinking) */}
          {displayedCards.length > 0 && (
            <div
              className={`space-y-3.5 transition-opacity duration-150 ${
                searching ? 'opacity-90' : 'opacity-100'
              }`}
            >
              {displayedCards.map((opt, idx) => {
                const isSelected = selectedCardIdx === idx;
                const isExpanded = expandedCardIdx === idx;
                const rideLegs = summarizeOptionModes(opt);
                const co2SavedKg = Math.max(
                  0.2,
                  Number((Number(opt.totalDistanceKm || 0) * 0.12).toFixed(1))
                );
                const legDurSum = Math.max(
                  1,
                  (opt.legs || []).reduce(
                    (acc, l) => acc + Math.max(1, Number(l.durationMins || 1)),
                    0
                  )
                );

                return (
                  <div
                    key={`route-option-${idx}`}
                    onClick={() => setSelectedCardIdx(idx)}
                    className={`rounded-2xl p-4 transition-all duration-150 cursor-pointer border-2 ${
                      isSelected
                        ? 'border-blue-600 bg-gradient-to-b from-blue-50/45 via-white to-white shadow-elevated'
                        : 'border-slate-200/95 bg-white hover:border-blue-300 shadow-2xs'
                    }`}
                  >
                    {/* Top Row: Rank + Mode Chain + Strategy Tag */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {idx + 1}
                        </span>

                        {rideLegs.map((leg, lIdx) => (
                          <React.Fragment key={leg.legOrder}>
                            {lIdx > 0 && (
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold border ${
                                leg.legMode === 'BUS'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200/80'
                                  : 'bg-purple-50 text-purple-800 border-purple-200/80'
                              }`}
                            >
                              {leg.legMode === 'BUS' ? (
                                <Bus className="w-3 h-3" />
                              ) : (
                                <TrainFront className="w-3 h-3" />
                              )}
                              <span>
                                {leg.legMode === 'BUS'
                                  ? `BMTC ${leg.routeOrLineCode}`
                                  : `Metro ${leg.routeOrLineCode}`}
                              </span>
                            </span>
                          </React.Fragment>
                        ))}
                      </div>

                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          idx === 0
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/90'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {opt.badgeLabel}
                      </span>
                    </div>

                    {/* Door-to-Door Boarding & Alighting Strip */}
                    <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/75 text-[11px] text-slate-700 flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900">{opt.sourceName}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-bold text-slate-900">{opt.destinationName}</span>
                    </div>

                    {/* Headline Duration, Distance, CO2 & Slab Fare */}
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div>
                        <div className="font-display text-2xl font-extrabold text-slate-900 tabular-nums leading-none">
                          {opt.totalTimeMins} <span className="text-base font-bold">mins</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold text-slate-600 mt-1.5 tabular-nums">
                          <span>
                            {opt.transferCount === 0
                              ? `Direct (${opt.totalDistanceKm} km)`
                              : `${opt.transferCount} Transfer${opt.transferCount > 1 ? 's' : ''} (${opt.totalDistanceKm} km)`}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            <Leaf className="w-3 h-3" />
                            <span>~{co2SavedKg} kg CO2 saved</span>
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-display text-2xl font-extrabold text-slate-900 tabular-nums leading-none">
                          Rs. {Number(opt.estimatedFareInr).toFixed(0)}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-700 mt-1">
                          Slab Tariff Verified
                        </div>
                      </div>
                    </div>

                    {/* Proportional Multi-Segment Journey Timeline Bar (Citymapper Style) */}
                    {Array.isArray(opt.legs) && opt.legs.length > 0 && (
                      <div className="mt-3">
                        <div className="h-2.5 w-full rounded-full bg-slate-100 p-0.5 flex items-center gap-0.5 overflow-hidden border border-slate-200/70">
                          {opt.legs.map((leg) => {
                            const widthPct = Math.max(
                              6,
                              Math.round(
                                (Math.max(1, Number(leg.durationMins || 1)) / legDurSum) * 100
                              )
                            );
                            return (
                              <div
                                key={leg.legOrder}
                                title={`${leg.routeOrLineName} (${leg.durationMins}m)`}
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${widthPct}%`,
                                  backgroundColor: getLegSegmentColor(leg)
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 5-Column Tabular Time Breakdown */}
                    <div className="mt-2.5 grid grid-cols-5 gap-1.5 text-center tabular-nums">
                      <div className="bg-slate-50 border border-slate-200/75 rounded-xl py-1.5 px-1">
                        <div className="text-[10px] font-semibold text-slate-500">Walk</div>
                        <div className="text-xs font-extrabold text-slate-800">
                          {opt.walkingTimeMins}m
                        </div>
                      </div>
                      <div className="bg-blue-50/80 border border-blue-100 rounded-xl py-1.5 px-1">
                        <div className="text-[10px] font-semibold text-blue-700">Bus</div>
                        <div className="text-xs font-extrabold text-blue-900">
                          {opt.busTimeMins}m
                        </div>
                      </div>
                      <div className="bg-purple-50/80 border border-purple-100 rounded-xl py-1.5 px-1">
                        <div className="text-[10px] font-semibold text-purple-700">Metro</div>
                        <div className="text-xs font-extrabold text-purple-900">
                          {opt.metroTimeMins}m
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/75 rounded-xl py-1.5 px-1">
                        <div className="text-[10px] font-semibold text-slate-500">Wait</div>
                        <div className="text-xs font-extrabold text-slate-800">
                          {opt.waitingTimeMins}m
                        </div>
                      </div>
                      <div className="bg-amber-50/80 border border-amber-100 rounded-xl py-1.5 px-1">
                        <div className="text-[10px] font-semibold text-amber-700">Transfer</div>
                        <div className="text-xs font-extrabold text-amber-900">
                          {opt.transferTimeMins}m
                        </div>
                      </div>
                    </div>

                    {/* Action Bar: Book Unified QR Pass + Copy Itinerary + Step-by-Step Timeline Toggle */}
                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                      <button
                        type="button"
                        disabled={bookingPlanId === opt.planId}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookPass(opt);
                        }}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>
                          {bookingPlanId === opt.planId
                            ? 'Issuing Pass...'
                            : 'Book Unified QR Pass'}
                        </span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleCopyItinerary(e, opt)}
                          title="Copy step-by-step itinerary to clipboard"
                          className="p-2 rounded-xl text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCardIdx(idx);
                            setExpandedCardIdx(isExpanded ? -1 : idx);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:text-blue-900 px-2 py-1.5 rounded-xl hover:bg-blue-50 transition-colors"
                        >
                          <span>{isExpanded ? 'Hide' : 'Steps'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Connected Subway-Style Step-by-Step Leg Timeline */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-3">
                        <div className="text-[11px] font-mono bg-slate-900 text-blue-100 px-3 py-2 rounded-xl border border-slate-800 tabular-nums">
                          {opt.formulaBreakdown}
                        </div>

                        <div className="relative pl-1 space-y-2">
                          {opt.legs.map((leg, lIdx) => {
                            const segColor = getLegSegmentColor(leg);
                            const isLast = lIdx === opt.legs.length - 1;
                            return (
                              <div key={leg.legOrder} className="relative flex items-stretch gap-3">
                                {/* Vertical Timeline Spine */}
                                <div className="flex flex-col items-center shrink-0">
                                  <span
                                    className="w-7 h-7 rounded-xl text-white flex items-center justify-center shadow-2xs shrink-0"
                                    style={{ backgroundColor: segColor }}
                                  >
                                    {leg.legMode === 'BUS' ? (
                                      <Bus className="w-3.5 h-3.5" />
                                    ) : leg.legMode === 'METRO' ? (
                                      <TrainFront className="w-3.5 h-3.5" />
                                    ) : (
                                      <Footprints className="w-3.5 h-3.5" />
                                    )}
                                  </span>
                                  {!isLast && (
                                    <div
                                      className="w-0.5 flex-1 my-1 rounded-full opacity-45"
                                      style={{ backgroundColor: segColor }}
                                    />
                                  )}
                                </div>

                                {/* Step Card */}
                                <div className="flex-1 min-w-0 p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="font-bold text-slate-900 leading-snug">
                                      {leg.routeOrLineName}
                                    </div>
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold whitespace-nowrap tabular-nums ${
                                        Number(leg.legFareInr) > 0
                                          ? 'bg-white border border-slate-200 text-slate-900'
                                          : 'bg-emerald-50 text-emerald-700'
                                      }`}
                                    >
                                      {Number(leg.legFareInr) > 0
                                        ? `Rs. ${Number(leg.legFareInr).toFixed(0)}`
                                        : 'Included'}
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-slate-600 mt-1 truncate">
                                    {leg.fromPointName} &rarr; <b>{leg.toPointName}</b>
                                  </div>

                                  <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums">
                                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                                      <Clock className="w-3 h-3 text-blue-600" />
                                      {leg.durationMins}m{' '}
                                      {leg.legMode === 'WALK'
                                        ? 'walk'
                                        : leg.legMode === 'TRANSFER'
                                        ? 'transfer'
                                        : 'in-vehicle'}
                                    </span>
                                    {leg.waitingMins > 0 && (
                                      <span>&bull; ~{leg.waitingMins}m headway wait</span>
                                    )}
                                    {leg.stopsCount > 0 && (
                                      <span>&bull; {leg.stopsCount} stops</span>
                                    )}
                                    <span>&bull; {Number(leg.distanceKm).toFixed(2)} km</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Data Provenance & Honesty Notice */}
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-100/90 border border-slate-200/90 text-[11px] text-slate-600 leading-relaxed">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <b className="text-slate-800">Scheduled vs Estimated Transparency:</b>{' '}
                  {searchResult?.dataHonestyNotice}
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT PANE: Interactive Leaflet + OpenStreetMap Mobility Canvas */}
      <section className="lg:col-span-7 xl:col-span-8 min-h-[480px] lg:h-[calc(100vh-68px)]">
        <TransitLeafletMap
          network={network}
          activeRoute={activeRouteOnMap}
          highlightedCorridor={null}
          gpsOriginPin={mapOriginPin}
          gpsDestPin={mapDestPin}
          pinDropTarget={pinDropTarget}
          onSetPinDropTarget={setPinDropTarget}
          onMapPinSelect={handleMapPinDropped}
          onSelectHubEndpoint={handleHubPopupSelect}
          dimBackgroundWhenActive
          isVisible={isVisible}
        />
      </section>

      {/* Short Payment Authentication Shield Modal (Prevents Accidental Wallet Debit) */}
      <PassBookingAuthModal
        option={pendingBookOption}
        user={user}
        busy={Boolean(bookingPlanId)}
        errorMessage={bookingAuthError}
        onClose={() => {
          if (!bookingPlanId) {
            setPendingBookOption(null);
            setBookingAuthError('');
          }
        }}
        onConfirm={handleConfirmAuthenticatedBook}
      />
    </div>
  );
}
