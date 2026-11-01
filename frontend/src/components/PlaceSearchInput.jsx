import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Building2,
  Bus,
  ChevronDown,
  Clock,
  Globe,
  GraduationCap,
  HeartPulse,
  Landmark,
  Loader2,
  MapPin,
  Scale,
  Search,
  ShoppingBag,
  Sparkles,
  TrainFront,
  Trees,
  X
} from 'lucide-react';
import { transitApi } from '../api/transitApi';

const RECENT_PLACES_KEY = 'btc_recent_places_v1';

const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Places', serverCategory: '' },
  { id: 'GOVT_OFFICE', label: 'Govt Offices', serverCategory: 'GOVT_OFFICE' },
  { id: 'FAMOUS_PLACE', label: 'Famous Places', serverCategory: 'FAMOUS_PLACE' },
  { id: 'COLLEGE', label: 'Colleges', serverCategory: 'COLLEGE' },
  { id: 'SCHOOL', label: 'Schools', serverCategory: 'SCHOOL' },
  { id: 'HOSPITAL', label: 'Hospitals', serverCategory: 'HOSPITAL' },
  { id: 'TECH_PARK', label: 'Tech Parks', serverCategory: 'TECH_PARK' },
  { id: 'MALL_MARKET', label: 'Malls & Markets', serverCategory: 'MALL_MARKET' },
  { id: 'HERITAGE_PARK', label: 'Parks & Lakes', serverCategory: 'HERITAGE_PARK' },
  { id: 'METRO_STATION', label: 'Namma Metro', serverCategory: 'METRO_STATION' },
  { id: 'BUS_STOP', label: 'BMTC Stops', serverCategory: 'BUS_STOP' }
];

function loadRecentPlaces() {
  try {
    const raw = localStorage.getItem(RECENT_PLACES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecentPlace(item) {
  try {
    const prev = loadRecentPlaces();
    const compact = {
      placeId: item.placeId || item.nodeKey || item.name,
      placeType: item.placeType || (item.nodeKey ? 'BUS_STOP' : 'LANDMARK'),
      category: item.category || 'LANDMARK',
      name: item.name,
      subtitle: item.subtitle || '',
      address: item.address || item.subtitle || '',
      latitude: item.latitude ?? item.lat,
      longitude: item.longitude ?? item.lng,
      nodeKey: item.nodeKey || null
    };
    const next = [
      compact,
      ...prev.filter((p) => p.name.toLowerCase() !== compact.name.toLowerCase())
    ].slice(0, 5);
    localStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

function parseCoordinateInput(raw) {
  if (!raw) {
    return null;
  }
  const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }
  if (lat < 12.5 || lat > 13.5 || lng < 77.2 || lng > 78.0) {
    return null;
  }
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function renderHighlightedText(text, query) {
  const str = String(text || '');
  const needle = String(query || '').trim();
  if (!needle || needle.length < 2) {
    return str;
  }
  const idx = str.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) {
    return str;
  }
  const before = str.slice(0, idx);
  const match = str.slice(idx, idx + needle.length);
  const after = str.slice(idx + needle.length);
  return (
    <>
      {before}
      <mark className="bg-amber-200/80 text-slate-950 rounded-xs px-0.5 font-extrabold">
        {match}
      </mark>
      {after}
    </>
  );
}

function getCategoryStyle(item) {
  if (item.placeType === 'METRO_STATION') {
    return {
      badge: 'Metro',
      badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200/80',
      Icon: TrainFront
    };
  }
  if (item.placeType === 'BUS_STOP') {
    return {
      badge: 'BMTC',
      badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200/80',
      Icon: Bus
    };
  }
  if (item.placeType === 'OSM_PLACE') {
    return {
      badge: 'Street / Map',
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200/80',
      Icon: Globe
    };
  }
  switch (item.category) {
    case 'GOVT_OFFICE':
      return {
        badge: 'Govt Office',
        badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300/80',
        Icon: Scale
      };
    case 'FAMOUS_PLACE':
      return {
        badge: 'Famous Place',
        badgeClass: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200/80',
        Icon: Sparkles
      };
    case 'COLLEGE':
      return {
        badge: 'College / Univ',
        badgeClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200/80',
        Icon: GraduationCap
      };
    case 'SCHOOL':
      return {
        badge: 'School / PU',
        badgeClass: 'bg-sky-100 text-sky-800 border border-sky-200/80',
        Icon: BookOpen
      };
    case 'TECH_PARK':
      return {
        badge: 'Tech Park',
        badgeClass: 'bg-cyan-100 text-cyan-800 border border-cyan-200/80',
        Icon: Building2
      };
    case 'HOSPITAL':
      return {
        badge: 'Hospital',
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200/80',
        Icon: HeartPulse
      };
    case 'MALL_MARKET':
      return {
        badge: 'Mall / Market',
        badgeClass: 'bg-orange-100 text-orange-800 border border-orange-200/80',
        Icon: ShoppingBag
      };
    case 'HERITAGE_PARK':
      return {
        badge: 'Park / Lake',
        badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200/80',
        Icon: Trees
      };
    case 'RAILWAY_HUB':
      return {
        badge: 'Rail / Airport',
        badgeClass: 'bg-slate-200 text-slate-800 border border-slate-300/80',
        Icon: TrainFront
      };
    default:
      return {
        badge: 'Area / Hub',
        badgeClass: 'bg-teal-100 text-teal-800 border border-teal-200/80',
        Icon: Landmark
      };
  }
}

export default function PlaceSearchInput({
  value,
  onSelect,
  placeholder,
  disabled = false,
  accentColor = 'blue'
}) {
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [mysqlPlaces, setMysqlPlaces] = useState([]);
  const [osmPlaces, setOsmPlaces] = useState([]);
  const [loadingMysql, setLoadingMysql] = useState(false);
  const [loadingOsm, setLoadingOsm] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const [recentPlaces, setRecentPlaces] = useState(() => loadRecentPlaces());

  const displayValue = isEditing ? query : value?.name || '';

  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setIsEditing(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setRecentPlaces(loadRecentPlaces());
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let cancelled = false;
    const selectedTab = CATEGORY_TABS.find((t) => t.id === activeFilter) || CATEGORY_TABS[0];
    const trimmed = query.trim();
    const fetchLimit = trimmed ? 80 : selectedTab.serverCategory ? 120 : 120;

    const timer = setTimeout(
      async () => {
        setLoadingMysql(true);
        try {
          const res = await transitApi.searchPlaces(
            trimmed,
            fetchLimit,
            selectedTab.serverCategory
          );
          if (!cancelled) {
            setMysqlPlaces(Array.isArray(res) ? res : []);
          }
        } catch {
          if (!cancelled) {
            setMysqlPlaces([]);
          }
        } finally {
          if (!cancelled) {
            setLoadingMysql(false);
          }
        }
      },
      trimmed ? 85 : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, activeFilter]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 3 || parseCoordinateInput(trimmed) || activeFilter !== 'ALL') {
      setOsmPlaces([]);
      setLoadingOsm(false);
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoadingOsm(true);
      try {
        const searchTerm =
          trimmed.toLowerCase().includes('bengaluru') ||
          trimmed.toLowerCase().includes('bangalore')
            ? trimmed
            : `${trimmed}, Bengaluru`;
        const url =
          `https://nominatim.openstreetmap.org/search?format=jsonv2` +
          `&q=${encodeURIComponent(searchTerm)}` +
          `&viewbox=77.35,13.25,77.88,12.75&bounded=1&countrycodes=in&limit=6`;

        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        });
        if (!resp.ok) {
          throw new Error('Nominatim unavailable');
        }
        const data = await resp.json();
        if (!cancelled && Array.isArray(data)) {
          const mapped = data
            .map((item) => {
              const lat = Number(item.lat);
              const lng = Number(item.lon);
              if (Number.isNaN(lat) || Number.isNaN(lng)) {
                return null;
              }
              const parts = String(item.display_name || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              const primaryName = item.name || parts[0] || trimmed;
              const subtitle = parts.slice(1, 4).join(', ') || 'Bengaluru Street / Address';
              const fullAddress = parts.slice(0, 6).join(', ') || subtitle;
              return {
                placeId: `OSM_${item.place_id}`,
                placeType: 'OSM_PLACE',
                category: 'OSM_PLACE',
                name: primaryName,
                subtitle,
                address: fullAddress,
                latitude: Number(lat.toFixed(6)),
                longitude: Number(lng.toFixed(6)),
                nodeKey: null
              };
            })
            .filter(Boolean);
          setOsmPlaces(mapped);
        }
      } catch {
        if (!cancelled) {
          setOsmPlaces([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingOsm(false);
        }
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, activeFilter]);

  const parsedCoords = useMemo(() => parseCoordinateInput(query), [query]);

  const combinedResults = useMemo(() => {
    const list = [];
    if (parsedCoords) {
      list.push({
        placeId: `COORD_${parsedCoords.lat}_${parsedCoords.lng}`,
        placeType: 'LANDMARK',
        category: 'COORDINATES',
        name: `Exact Pin (${parsedCoords.lat}, ${parsedCoords.lng})`,
        subtitle: 'Custom Greater Bengaluru Coordinates',
        address: `Latitude ${parsedCoords.lat}, Longitude ${parsedCoords.lng}, Bengaluru`,
        latitude: parsedCoords.lat,
        longitude: parsedCoords.lng,
        nodeKey: null
      });
    }

    const seenNames = new Set();
    mysqlPlaces.forEach((p) => {
      seenNames.add(p.name.toLowerCase());
      list.push(p);
    });

    osmPlaces.forEach((o) => {
      if (!seenNames.has(o.name.toLowerCase())) {
        list.push(o);
      }
    });

    return list;
  }, [mysqlPlaces, osmPlaces, parsedCoords]);

  useEffect(() => {
    setHighlightedIdx(0);
  }, [query, activeFilter, open]);

  useEffect(() => {
    if (!open || !listRef.current) {
      return;
    }
    const el = listRef.current.querySelector(`[data-place-idx="${highlightedIdx}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIdx, open]);

  const handleChooseItem = (item) => {
    setOpen(false);
    setIsEditing(false);
    setQuery('');
    const nextRecents = saveRecentPlace(item);
    setRecentPlaces(nextRecents);

    if (item.nodeKey) {
      onSelect({
        kind: 'NODE',
        nodeKey: item.nodeKey,
        name: item.name,
        subtitle: item.subtitle,
        address: item.address || item.subtitle,
        category: item.category,
        lat: item.latitude,
        lng: item.longitude,
        placeType: item.placeType
      });
    } else {
      onSelect({
        kind: 'PLACE',
        nodeKey: null,
        name: item.name,
        subtitle: item.subtitle,
        address: item.address || item.subtitle,
        category: item.category,
        lat: item.latitude,
        lng: item.longitude,
        placeType: item.placeType
      });
    }
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
        setIsEditing(true);
        setQuery('');
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setIsEditing(false);
      setQuery('');
      inputRef.current?.blur();
      return;
    }

    if (combinedResults.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % combinedResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev - 1 + combinedResults.length) % combinedResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = combinedResults[highlightedIdx] || combinedResults[0];
      if (target) {
        handleChooseItem(target);
      }
    }
  };

  const handleClearRecents = (e) => {
    e.stopPropagation();
    try {
      localStorage.removeItem(RECENT_PLACES_KEY);
    } catch {
      // ignore storage quota errors
    }
    setRecentPlaces([]);
  };

  const ringClass =
    accentColor === 'purple'
      ? 'focus-within:ring-2 focus-within:ring-purple-500/35 focus-within:border-purple-500 focus-within:bg-white'
      : 'focus-within:ring-2 focus-within:ring-blue-500/35 focus-within:border-blue-500 focus-within:bg-white';

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50/90 hover:bg-white border border-slate-200/95 transition-all duration-150 ${ringClass} ${
          disabled ? 'opacity-60 pointer-events-none' : ''
        }`}
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          placeholder={
            placeholder ||
            'Search govt office, school, college, famous place, street, PIN code...'
          }
          onFocus={() => {
            setOpen(true);
            setIsEditing(true);
            setQuery('');
          }}
          onChange={(e) => {
            setIsEditing(true);
            setOpen(true);
            setQuery(e.target.value);
          }}
          className="w-full bg-transparent text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium focus:outline-none truncate"
        />

        {isEditing && query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded-md hover:bg-slate-100"
            title="Clear text"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (open) {
                setOpen(false);
                setIsEditing(false);
              } else {
                setOpen(true);
                setIsEditing(true);
                setQuery('');
                inputRef.current?.focus();
              }
            }}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded-md hover:bg-slate-100"
            title="Browse 300+ Bengaluru Govt Offices, Schools, Colleges, Famous Places & Addresses"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Selected Place Full Address & Door-to-Door Pin Tag */}
      {!open && value && (value.address || value.kind === 'PLACE') && (
        <div className="mt-1 px-1 space-y-0.5">
          {value.address && (
            <div className="flex items-start gap-1.5 text-[11px] text-slate-600 font-medium leading-snug">
              <MapPin className="w-3 h-3 shrink-0 text-blue-600 mt-0.5" />
              <span className="line-clamp-2">{value.address}</span>
            </div>
          )}
          {value.kind === 'PLACE' && typeof value.lat === 'number' && (
            <div className="text-[10px] text-emerald-700 font-semibold pl-4 tabular-nums">
              Door-to-door ({value.lat.toFixed(4)}, {value.lng.toFixed(4)}) &bull; Nearest BMTC/Metro auto-matched
            </div>
          )}
        </div>
      )}

      {/* Autocomplete & Category Directory Popover */}
      {open && (
        <div className="absolute left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200/95 shadow-floating overflow-hidden btc-fade-in">
          {/* Category Filter Chips */}
          <div className="flex items-center gap-1 px-2.5 py-2 bg-slate-50/95 border-b border-slate-200/90 overflow-x-auto no-scrollbar">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  activeFilter === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                }`}
              >
                {tab.label}
              </button>
            ))}

            {(loadingMysql || loadingOsm) && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 ml-auto shrink-0" />
            )}
          </div>

          {/* Recent Selections Quick Strip (when input is empty) */}
          {!query.trim() && activeFilter === 'ALL' && recentPlaces.length > 0 && (
            <div className="px-3 py-2 bg-blue-50/45 border-b border-slate-100">
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>Recent Selections</span>
                </span>
                <button
                  type="button"
                  onClick={handleClearRecents}
                  className="text-slate-400 hover:text-red-600 font-bold"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {recentPlaces.map((rp) => (
                  <button
                    key={rp.placeId || rp.name}
                    type="button"
                    onClick={() => handleChooseItem(rp)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-600 hover:text-white border border-slate-200 text-[11px] font-bold text-slate-700 whitespace-nowrap transition-colors shadow-2xs"
                  >
                    {rp.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results List with Full Street Addresses & Keyboard Highlighting */}
          <div ref={listRef} className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {combinedResults.length === 0 && !loadingMysql && !loadingOsm ? (
              <div className="px-4 py-5 text-xs text-slate-500 text-center">
                No matching Bengaluru place found. Try typing a govt office, school, college, famous place, street, PIN code (e.g. <b>560001</b>), or click <b>Map Pin</b>.
              </div>
            ) : (
              combinedResults.map((item, idx) => {
                const { badge, badgeClass, Icon } = getCategoryStyle(item);
                const isHighlighted = idx === highlightedIdx;
                return (
                  <button
                    key={item.placeId}
                    data-place-idx={idx}
                    type="button"
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    onClick={() => handleChooseItem(item)}
                    className={`w-full px-3.5 py-2.5 text-left flex items-start gap-2.5 transition-colors group ${
                      isHighlighted ? 'bg-blue-50/90' : 'hover:bg-blue-50/60'
                    }`}
                  >
                    <span className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${badgeClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold truncate transition-colors ${
                            isHighlighted
                              ? 'text-blue-700'
                              : 'text-slate-900 group-hover:text-blue-700'
                          }`}
                        >
                          {renderHighlightedText(item.name, query)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${badgeClass}`}
                        >
                          {badge}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 truncate mt-0.5">
                        {renderHighlightedText(item.subtitle, query)}
                      </div>
                      {item.address && (
                        <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {renderHighlightedText(item.address, query)}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3.5 py-2 bg-slate-50/95 border-t border-slate-200/90 text-[10px] text-slate-500 flex items-center justify-between gap-2">
            <span className="font-medium truncate">
              Use Up/Down + Enter &bull; 300 Places + 76 Stops + Street Map
            </span>
            <span className="font-bold text-blue-700 shrink-0 tabular-nums">
              {combinedResults.length} shown
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
