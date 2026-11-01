import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bus,
  CheckCircle2,
  ClipboardList,
  Code2,
  Database,
  Edit3,
  Eye,
  FileJson,
  GitCompareArrows,
  IndianRupee,
  KeyRound,
  Landmark,
  LayoutGrid,
  Loader2,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Table2,
  TrainFront,
  Trash2,
  X
} from 'lucide-react';
import { transitApi } from '../api/transitApi';
import { useAuth } from '../context/AuthContext';

const ADMIN_TABS = [
  { id: 'mysql', label: 'MySQL Tables', icon: Database },
  { id: 'routes', label: 'BMTC Routes', icon: Route },
  { id: 'stops', label: 'BMTC Stops', icon: MapPin },
  { id: 'sequences', label: 'Stop Sequences', icon: ClipboardList },
  { id: 'fleet', label: 'BMTC Fleet', icon: Bus },
  { id: 'metro', label: 'Metro Stations', icon: TrainFront },
  { id: 'hubs', label: 'Interchange Hubs', icon: GitCompareArrows },
  { id: 'places', label: 'Bengaluru Places', icon: Landmark },
  { id: 'tariffs', label: 'Schedules & Tariffs', icon: IndianRupee },
  { id: 'audit', label: 'Reviews & Audit Logs', icon: FileJson }
];

const LANDMARK_CATEGORIES = [
  'GOVT_OFFICE',
  'FAMOUS_PLACE',
  'COLLEGE',
  'SCHOOL',
  'TECH_PARK',
  'HOSPITAL',
  'MALL_MARKET',
  'HERITAGE_PARK',
  'RAILWAY_HUB',
  'NEIGHBORHOOD'
];

export default function AdminStudioView({ onRequireAuth, onNetworkMutated, onNotify }) {
  const { user, isAdmin } = useAuth();

  const [tab, setTab] = useState('routes');
  const [tableFilter, setTableFilter] = useState('');
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [rbacProofMsg, setRbacProofMsg] = useState('');

  // Route Sequence Inspector state
  const [seqRouteId, setSeqRouteId] = useState('');
  const [seqDirection, setSeqDirection] = useState('OUTBOUND');
  const [seqStops, setSeqStops] = useState([]);
  const [seqForm, setSeqForm] = useState({
    stopId: '',
    stopSequence: 1,
    distanceFromStartKm: '1.50',
    travelMinsFromPrev: 4
  });

  // Forms for CRUD tabs
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [routeForm, setRouteForm] = useState({
    routeNumber: '',
    routeName: '',
    serviceType: 'ORDINARY',
    originName: '',
    destinationName: '',
    totalDistanceKm: '12.50',
    isActive: true
  });

  const [editingStopId, setEditingStopId] = useState(null);
  const [stopForm, setStopForm] = useState({
    stopCode: '',
    stopName: '',
    areaName: '',
    latitude: '12.971600',
    longitude: '77.594600',
    hasShelter: true,
    isInterchangeHub: false,
    isActive: true
  });

  const [editingBusId, setEditingBusId] = useState(null);
  const [busForm, setBusForm] = useState({
    routeId: '',
    registrationNo: '',
    busType: 'ELECTRIC_NON_AC',
    seatingCapacity: 42,
    depotName: 'Depot-25 HSR Layout',
    operationalStatus: 'ACTIVE'
  });

  const [editingStationId, setEditingStationId] = useState(null);
  const [stationForm, setStationForm] = useState({
    stationCode: '',
    stationName: '',
    lineId: 1,
    stationOrder: 15,
    latitude: '12.985000',
    longitude: '77.710000',
    isInterchange: false,
    structureType: 'ELEVATED',
    hasParking: true,
    isActive: true
  });

  const [editingHubId, setEditingHubId] = useState(null);
  const [hubForm, setHubForm] = useState({
    hubName: '',
    busStopId: '',
    metroStationId: '',
    walkingDistanceM: 180,
    walkingTimeMins: 3,
    transferBufferMins: 2,
    hasSkywalk: true,
    isActive: true
  });

  // Inline Fare Rule & Schedule editing
  const [editingFareId, setEditingFareId] = useState(null);
  const [fareEditValue, setFareEditValue] = useState('');
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [schedPeakEdit, setSchedPeakEdit] = useState('');
  const [schedOffpeakEdit, setSchedOffpeakEdit] = useState('');

  // Bengaluru Places (city_landmarks) CRUD state
  const [editingLandmarkId, setEditingLandmarkId] = useState(null);
  const [landmarkForm, setLandmarkForm] = useState({
    landmarkName: '',
    category: 'GOVT_OFFICE',
    areaName: '',
    streetAddress: '',
    pincode: '560001',
    latitude: '12.975600',
    longitude: '77.606600',
    isActive: true
  });

  // Audit Logs & Feedback Moderation
  const [auditPage, setAuditPage] = useState({ content: [], page: { number: 0, totalPages: 1, totalElements: 0 } });
  const [feedbackList, setFeedbackList] = useState([]);

  // Live MySQL 8 Schema & Attributes Explorer state
  const [dbmsSchema, setDbmsSchema] = useState(null);
  const [dbmsLoading, setDbmsLoading] = useState(false);
  const [dbmsRelationFilter, setDbmsRelationFilter] = useState('BASE_TABLES'); // BASE_TABLES | VIEWS | ALL
  const [dbmsLayoutMode, setDbmsLayoutMode] = useState('ALL_CARDS'); // ALL_CARDS | SINGLE_EXPLORER
  const [dbmsSearch, setDbmsSearch] = useState('');
  const [selectedSqlTable, setSelectedSqlTable] = useState('users');
  const [sqlDetailSubTab, setSqlDetailSubTab] = useState('ATTRIBUTES'); // ATTRIBUTES | DDL | ROWS
  const [sqlTableDetails, setSqlTableDetails] = useState(null);
  const [sqlDetailsLoading, setSqlDetailsLoading] = useState(false);

  const loadDbmsSchema = useCallback(async () => {
    if (!user || !isAdmin) {
      return;
    }
    setDbmsLoading(true);
    try {
      const schemaRes = await transitApi.getAdminDbmsSchema();
      setDbmsSchema(schemaRes);
    } catch (err) {
      setBanner({ tone: 'error', text: err.message || 'Failed to inspect MySQL schema.' });
    } finally {
      setDbmsLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (user && isAdmin) {
      loadDbmsSchema();
    }
  }, [user, isAdmin, loadDbmsSchema]);

  const loadSelectedTableDetails = useCallback(
    async (tblName, wantRows) => {
      if (!user || !isAdmin || !tblName) {
        return;
      }
      setSqlDetailsLoading(true);
      try {
        const res = await transitApi.getAdminDbmsTableDetails(tblName, wantRows ? 25 : 0);
        setSqlTableDetails(res);
      } catch {
        setSqlTableDetails(null);
      } finally {
        setSqlDetailsLoading(false);
      }
    },
    [user, isAdmin]
  );

  useEffect(() => {
    if (
      user &&
      isAdmin &&
      tab === 'mysql' &&
      dbmsLayoutMode === 'SINGLE_EXPLORER' &&
      selectedSqlTable &&
      sqlDetailSubTab !== 'ATTRIBUTES'
    ) {
      loadSelectedTableDetails(selectedSqlTable, sqlDetailSubTab === 'ROWS');
    }
  }, [
    user,
    isAdmin,
    tab,
    dbmsLayoutMode,
    selectedSqlTable,
    sqlDetailSubTab,
    loadSelectedTableDetails
  ]);

  const notifyGlobalRefresh = useCallback(() => {
    if (onNetworkMutated) {
      onNetworkMutated();
    }
  }, [onNetworkMutated]);

  const loadAdminData = useCallback(async () => {
    if (!user || !isAdmin) {
      return;
    }
    setLoading(true);
    try {
      const [inv, audits, fb] = await Promise.all([
        transitApi.getAdminInventory(),
        transitApi.getAuditLogs(0, 20),
        transitApi.getFeedback(0, 20)
      ]);
      setInventory(inv);
      setAuditPage(audits || { content: [], page: { number: 0, totalPages: 1, totalElements: 0 } });
      setFeedbackList(fb?.content || []);

      if (!seqRouteId && inv?.busRoutes?.length > 0) {
        setSeqRouteId(String(inv.busRoutes[0].routeId));
      }
      if (!busForm.routeId && inv?.busRoutes?.length > 0) {
        setBusForm((prev) => ({ ...prev, routeId: String(inv.busRoutes[0].routeId) }));
      }
      if (!hubForm.busStopId && inv?.busStops?.length > 0) {
        setHubForm((prev) => ({ ...prev, busStopId: String(inv.busStops[0].stopId) }));
      }
      if (!hubForm.metroStationId && inv?.metroStations?.length > 0) {
        setHubForm((prev) => ({ ...prev, metroStationId: String(inv.metroStations[0].stationId) }));
      }
    } catch (err) {
      setBanner({ tone: 'error', text: err.message || 'Failed to load admin inventory.' });
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, seqRouteId, busForm.routeId, hubForm.busStopId, hubForm.metroStationId]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const loadRouteSequence = useCallback(async () => {
    if (!seqRouteId) {
      return;
    }
    try {
      const res = await transitApi.getBusRouteStops(seqRouteId, seqDirection);
      const stops = res?.stops || [];
      setSeqStops(stops);
      const nextSeq = stops.length > 0 ? stops[stops.length - 1].stopSequence + 1 : 1;
      const nextDist =
        stops.length > 0 ? (Number(stops[stops.length - 1].distanceFromStartKm) + 2.0).toFixed(2) : '0.00';
      setSeqForm((prev) => ({
        ...prev,
        stopSequence: nextSeq,
        distanceFromStartKm: nextDist
      }));
    } catch {
      setSeqStops([]);
    }
  }, [seqRouteId, seqDirection]);

  useEffect(() => {
    if (isAdmin && tab === 'sequences' && seqRouteId) {
      loadRouteSequence();
    }
  }, [isAdmin, tab, seqRouteId, seqDirection, loadRouteSequence]);

  const handleTestPassengerForbidden = async () => {
    setRbacProofMsg('Testing GET /api/admin/inventory with current Passenger JWT...');
    try {
      await transitApi.getAdminInventory();
      setRbacProofMsg('Unexpected 200 OK');
    } catch (err) {
      setRbacProofMsg(`Live Backend Response -> HTTP ${err.status || 403}: ${err.message}`);
    }
  };

  const filterNeedle = tableFilter.trim().toLowerCase();

  const filteredRoutesList = useMemo(() => {
    const list = inventory?.busRoutes || [];
    if (!filterNeedle) {
      return list;
    }
    return list.filter(
      (r) =>
        String(r.routeNumber || '').toLowerCase().includes(filterNeedle) ||
        String(r.routeName || '').toLowerCase().includes(filterNeedle) ||
        String(r.serviceType || '').toLowerCase().includes(filterNeedle)
    );
  }, [inventory, filterNeedle]);

  const filteredStopsList = useMemo(() => {
    const list = inventory?.busStops || [];
    if (!filterNeedle) {
      return list;
    }
    return list.filter(
      (s) =>
        String(s.stopCode || '').toLowerCase().includes(filterNeedle) ||
        String(s.stopName || '').toLowerCase().includes(filterNeedle) ||
        String(s.areaName || '').toLowerCase().includes(filterNeedle)
    );
  }, [inventory, filterNeedle]);

  const filteredLandmarksList = useMemo(() => {
    const list = inventory?.cityLandmarks || [];
    if (!filterNeedle) {
      return list;
    }
    return list.filter(
      (lm) =>
        String(lm.landmarkName || '').toLowerCase().includes(filterNeedle) ||
        String(lm.category || '').toLowerCase().includes(filterNeedle) ||
        String(lm.areaName || '').toLowerCase().includes(filterNeedle) ||
        String(lm.streetAddress || '').toLowerCase().includes(filterNeedle) ||
        String(lm.pincode || '').toLowerCase().includes(filterNeedle)
    );
  }, [inventory, filterNeedle]);

  const filteredDbmsRelations = useMemo(() => {
    const allRels = dbmsSchema?.relations || [];
    const byType = allRels.filter((r) => {
      if (dbmsRelationFilter === 'BASE_TABLES') {
        return r.tableType === 'BASE TABLE';
      }
      if (dbmsRelationFilter === 'VIEWS') {
        return r.tableType !== 'BASE TABLE';
      }
      return true;
    });
    const q = dbmsSearch.trim().toLowerCase();
    if (!q) {
      return byType;
    }
    return byType.filter(
      (r) =>
        String(r.tableName || '').toLowerCase().includes(q) ||
        (r.attributes || []).some(
          (a) =>
            String(a.columnName || '').toLowerCase().includes(q) ||
            String(a.columnType || '').toLowerCase().includes(q) ||
            String(a.foreignKeyTarget || '').toLowerCase().includes(q)
        )
    );
  }, [dbmsSchema, dbmsRelationFilter, dbmsSearch]);

  const activeSqlRelationObj = useMemo(() => {
    const allRels = dbmsSchema?.relations || [];
    return (
      allRels.find((r) => r.tableName === selectedSqlTable) ||
      filteredDbmsRelations[0] ||
      allRels[0] ||
      null
    );
  }, [dbmsSchema, selectedSqlTable, filteredDbmsRelations]);

  // ---- Non-Admin Gateways ----
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="btc-command-hero rounded-3xl border border-slate-800 p-8 shadow-floating text-white space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-extrabold uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            <span>Spring Security RBAC Protected Module</span>
          </div>
          <h1 className="font-display text-2xl lg:text-3xl font-extrabold">
            Transit Operations &amp; Database Admin Studio
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            All <code className="text-blue-200 font-mono">/api/admin/**</code> endpoints require a
            valid stateless JWT carrying <code className="text-emerald-300 font-mono">ROLE_ADMIN</code>.
            Sign in with the seeded Transit Administrator account (
            <code className="text-white font-mono">admin@transitconnect.in</code> /{' '}
            <code className="text-white font-mono">Admin@123</code>) to manage BMTC routes, stops,
            fleet vehicles, Namma Metro stations, skywalk hubs, fare slabs, and MySQL trigger audit
            logs.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-5 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-slate-900 text-sm font-extrabold shadow-sm transition-colors"
          >
            Sign In as Transit Admin
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl border border-red-200 p-8 shadow-elevated space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-extrabold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>Role-Based Access Control (ROLE_PASSENGER Detected)</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">
            Administrator Role Required
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            You are currently signed in as <b>{user.fullName}</b> (<code>{user.email}</code>) with{' '}
            <code>ROLE_PASSENGER</code>. Spring Security blocks non-admin access to{' '}
            <code>/api/admin/**</code> with HTTP 403 Forbidden.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTestPassengerForbidden}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
            >
              Verify Live HTTP 403 Guard
            </button>
            <button
              type="button"
              onClick={onRequireAuth}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              Switch to Admin Account
            </button>
          </div>
          {rbacProofMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 font-mono text-xs text-red-900">
              {rbacProofMsg}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- CRUD Handlers ----
  const handleRouteSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    try {
      const payload = {
        ...routeForm,
        totalDistanceKm: Number(routeForm.totalDistanceKm)
      };
      if (editingRouteId) {
        await transitApi.updateBusRoute(editingRouteId, payload);
        setBanner({
          tone: 'success',
          text: `Updated BMTC route ${payload.routeNumber} (MySQL trigger trg_bus_routes_after_update logged to audit_logs).`
        });
      } else {
        await transitApi.createBusRoute(payload);
        setBanner({
          tone: 'success',
          text: `Created BMTC route ${payload.routeNumber} (MySQL trigger trg_bus_routes_after_insert logged to audit_logs).`
        });
      }
      setEditingRouteId(null);
      setRouteForm({
        routeNumber: '',
        routeName: '',
        serviceType: 'ORDINARY',
        originName: '',
        destinationName: '',
        totalDistanceKm: '12.50',
        isActive: true
      });
      await loadAdminData();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleDeleteRoute = async (route) => {
    setBanner(null);
    try {
      await transitApi.deleteBusRoute(route.routeId);
      setBanner({
        tone: 'success',
        text: `Deleted BMTC route ${route.routeNumber} (MySQL trigger trg_bus_routes_after_delete logged to audit_logs).`
      });
      await loadAdminData();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleStopSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    try {
      const payload = {
        ...stopForm,
        latitude: Number(stopForm.latitude),
        longitude: Number(stopForm.longitude)
      };
      if (editingStopId) {
        await transitApi.updateBusStop(editingStopId, payload);
        setBanner({ tone: 'success', text: `Updated BMTC stop ${payload.stopName}.` });
      } else {
        await transitApi.createBusStop(payload);
        setBanner({ tone: 'success', text: `Created BMTC stop ${payload.stopName}.` });
      }
      setEditingStopId(null);
      setStopForm({
        stopCode: '',
        stopName: '',
        areaName: '',
        latitude: '12.971600',
        longitude: '77.594600',
        hasShelter: true,
        isInterchangeHub: false,
        isActive: true
      });
      await loadAdminData();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleDeleteStop = async (stop) => {
    setBanner(null);
    try {
      await transitApi.deleteBusStop(stop.stopId);
      setBanner({ tone: 'success', text: `Deleted BMTC stop ${stop.stopName}.` });
      await loadAdminData();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleAddSequenceStop = async (e) => {
    e.preventDefault();
    setBanner(null);
    try {
      await transitApi.addRouteStop({
        routeId: Number(seqRouteId),
        stopId: Number(seqForm.stopId),
        direction: seqDirection,
        stopSequence: Number(seqForm.stopSequence),
        distanceFromStartKm: Number(seqForm.distanceFromStartKm),
        travelMinsFromPrev: Number(seqForm.travelMinsFromPrev)
      });
      setBanner({ tone: 'success', text: 'Appended stop to route sequence in bus_route_stops.' });
      await loadRouteSequence();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleRemoveSequenceStop = async (routeStopId) => {
    setBanner(null);
    try {
      await transitApi.deleteRouteStop(routeStopId);
      setBanner({ tone: 'success', text: 'Removed stop mapping from bus_route_stops.' });
      await loadRouteSequence();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleBusSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    try {
      const payload = {
        ...busForm,
        routeId: Number(busForm.routeId),
        seatingCapacity: Number(busForm.seatingCapacity)
      };
      if (editingBusId) {
        await transitApi.updateBus(editingBusId, payload);
        setBanner({ tone: 'success', text: `Updated fleet vehicle ${payload.registrationNo}.` });
      } else {
        await transitApi.createBus(payload);
        setBanner({ tone: 'success', text: `Added fleet vehicle ${payload.registrationNo}.` });
      }
      setEditingBusId(null);
      setBusForm((prev) => ({
        ...prev,
        registrationNo: '',
        seatingCapacity: 42,
        operationalStatus: 'ACTIVE'
      }));
      await loadAdminData();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleStationSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    try {
      const payload = {
        ...stationForm,
        lineId: Number(stationForm.lineId),
        stationOrder: Number(stationForm.stationOrder),
        latitude: Number(stationForm.latitude),
        longitude: Number(stationForm.longitude)
      };
      if (editingStationId) {
        await transitApi.updateMetroStation(editingStationId, payload);
        setBanner({ tone: 'success', text: `Updated Metro station ${payload.stationName}.` });
      } else {
        await transitApi.createMetroStation(payload);
        setBanner({ tone: 'success', text: `Created Metro station ${payload.stationName}.` });
      }
      setEditingStationId(null);
      setStationForm((prev) => ({
        ...prev,
        stationCode: '',
        stationName: ''
      }));
      await loadAdminData();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleHubSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    try {
      const payload = {
        ...hubForm,
        busStopId: Number(hubForm.busStopId),
        metroStationId: Number(hubForm.metroStationId),
        walkingDistanceM: Number(hubForm.walkingDistanceM),
        walkingTimeMins: Number(hubForm.walkingTimeMins),
        transferBufferMins: Number(hubForm.transferBufferMins)
      };
      if (editingHubId) {
        await transitApi.updateTransferPoint(editingHubId, payload);
        setBanner({ tone: 'success', text: `Updated interchange hub ${payload.hubName}.` });
      } else {
        await transitApi.createTransferPoint(payload);
        setBanner({ tone: 'success', text: `Created interchange hub ${payload.hubName}.` });
      }
      setEditingHubId(null);
      setHubForm((prev) => ({ ...prev, hubName: '' }));
      await loadAdminData();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleSaveFareInline = async (fr) => {
    setBanner(null);
    try {
      await transitApi.updateFareRule(fr.fareRuleId, {
        serviceCategory: fr.serviceCategory,
        minDistanceKm: Number(fr.minDistanceKm),
        maxDistanceKm: Number(fr.maxDistanceKm),
        fareInr: Number(fareEditValue),
        smartCardDiscountPct: Number(fr.smartCardDiscountPct),
        sourceNote: fr.sourceNote
      });
      setEditingFareId(null);
      setBanner({
        tone: 'success',
        text: `Updated ${fr.serviceCategory} slab (${fr.minDistanceKm}-${fr.maxDistanceKm} km) to Rs. ${fareEditValue}. MySQL trigger trg_fare_rules_after_update recorded old/new JSON in audit_logs!`
      });
      await loadAdminData();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleSaveScheduleInline = async (sc) => {
    setBanner(null);
    try {
      await transitApi.updateSchedule(sc.scheduleId, {
        transportMode: sc.transportMode,
        busRouteId: sc.busRouteId,
        metroLineId: sc.metroLineId,
        dayType: sc.dayType,
        firstServiceTime: sc.firstServiceTime,
        lastServiceTime: sc.lastServiceTime,
        peakHeadwayMins: Number(schedPeakEdit),
        offpeakHeadwayMins: Number(schedOffpeakEdit),
        dataConfidence: sc.dataConfidence,
        scheduleNote: sc.scheduleNote
      });
      setEditingScheduleId(null);
      setBanner({
        tone: 'success',
        text: 'Updated service headways in schedules (live waiting-time weights updated in TransitGraphEngine).'
      });
      await loadAdminData();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleModerateReview = async (feedbackId, status) => {
    setBanner(null);
    try {
      await transitApi.moderateFeedback(feedbackId, status);
      setBanner({ tone: 'success', text: `Marked feedback #${feedbackId} as ${status}.` });
      await loadAdminData();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const loadAuditPageNum = async (pageNum) => {
    try {
      const res = await transitApi.getAuditLogs(pageNum, 20);
      setAuditPage(res);
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleLandmarkSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    try {
      const payload = {
        ...landmarkForm,
        latitude: Number(landmarkForm.latitude),
        longitude: Number(landmarkForm.longitude)
      };
      if (editingLandmarkId) {
        await transitApi.updateLandmark(editingLandmarkId, payload);
        setBanner({
          tone: 'success',
          text: `Updated Bengaluru place "${payload.landmarkName}" in city_landmarks (logged to audit_logs).`
        });
        if (onNotify) {
          onNotify(`Updated place: ${payload.landmarkName}`);
        }
      } else {
        await transitApi.createLandmark(payload);
        setBanner({
          tone: 'success',
          text: `Added Bengaluru place "${payload.landmarkName}" (${payload.pincode}) to city_landmarks.`
        });
        if (onNotify) {
          onNotify(`Added place: ${payload.landmarkName}`);
        }
      }
      setEditingLandmarkId(null);
      setLandmarkForm({
        landmarkName: '',
        category: 'GOVT_OFFICE',
        areaName: '',
        streetAddress: '',
        pincode: '560001',
        latitude: '12.975600',
        longitude: '77.606600',
        isActive: true
      });
      await loadAdminData();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const handleDeleteLandmark = async (lm) => {
    setBanner(null);
    try {
      await transitApi.deleteLandmark(lm.landmarkId);
      setBanner({
        tone: 'success',
        text: `Deleted Bengaluru place "${lm.landmarkName}" from city_landmarks.`
      });
      if (onNotify) {
        onNotify(`Deleted place: ${lm.landmarkName}`);
      }
      await loadAdminData();
      notifyGlobalRefresh();
    } catch (err) {
      setBanner({ tone: 'error', text: err.message });
    }
  };

  const tabCounts = {
    mysql: dbmsSchema?.baseTableCount ?? 20,
    routes: inventory?.busRoutes?.length,
    stops: inventory?.busStops?.length,
    sequences: seqStops?.length,
    fleet: inventory?.buses?.length,
    metro: inventory?.metroStations?.length,
    hubs: inventory?.transferPoints?.length,
    places: inventory?.cityLandmarks?.length,
    tariffs: inventory?.fareRules?.length,
    audit: auditPage?.page?.totalElements
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6 space-y-5 btc-fade-in">
      {/* Executive Admin Command Hero */}
      <div className="btc-command-hero rounded-3xl border border-slate-800 p-6 lg:p-7 text-white shadow-floating flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-[11px] font-extrabold uppercase tracking-wider text-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {tab === 'mysql'
                ? `MySQL 8 Schema Inspector (${dbmsSchema?.databaseName || 'bengaluru_transit'})`
                : `ROLE_ADMIN Verified (${user.email}) \u2022 Live MySQL 8 Trigger Auditing`}
            </span>
          </div>
          <h1 className="font-display text-2xl lg:text-3xl font-extrabold tracking-tight">
            {tab === 'mysql'
              ? 'MySQL 8 SQL Tables & Attributes Catalog'
              : 'Bengaluru TransitConnect Operations Studio'}
          </h1>
          <p className="text-xs text-slate-300 max-w-3xl">
            {tab === 'mysql'
              ? 'Live information_schema introspection showing all normalized SQL tables, exact column attributes, SQL data types, Primary Keys, Foreign Key references, and constraints.'
              : 'Every route, stop, fleet vehicle, station, skywalk hub, headway, or tariff mutation commits directly to MySQL 8 and immediately refreshes multi-modal Dijkstra routing.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setBanner(null);
              if (tab === 'mysql') {
                setTab('routes');
              } else {
                setTab('mysql');
                if (!dbmsSchema) {
                  loadDbmsSchema();
                }
              }
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition-all ${
              tab === 'mysql'
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>
              {tab === 'mysql' ? 'Back to Operations CRUD' : 'MySQL Tables & Attributes'}
            </span>
          </button>

          <button
            type="button"
            onClick={tab === 'mysql' ? loadDbmsSchema : loadAdminData}
            disabled={tab === 'mysql' ? dbmsLoading : loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-slate-900 text-xs font-extrabold shadow-sm transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 text-blue-600 ${
                (tab === 'mysql' ? dbmsLoading : loading) ? 'animate-spin' : ''
              }`}
            />
            <span>{tab === 'mysql' ? 'Refresh Schema' : 'Reload Inventory'}</span>
          </button>
        </div>
      </div>

      {/* Focused MySQL Function Mode: ONLY shows SQL Tables & Their Attributes */}
      {tab === 'mysql' ? (
        <div className="space-y-4">
          {/* Schema Summary Metrics + Filter Controls */}
          <div className="bg-white rounded-3xl border border-slate-200/95 p-4 lg:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold tabular-nums">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white font-mono">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{dbmsSchema?.databaseName || 'bengaluru_transit'}</span>
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800">
                  {dbmsSchema?.baseTableCount ?? 20} SQL Base Tables (3NF)
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800">
                  {dbmsSchema?.viewCount ?? 4} SQL Views
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                  {dbmsSchema?.totalAttributeCount ?? 0} Total Attributes
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                  {dbmsSchema?.totalConstraintCount ?? 93} PK/FK/UK/CHECK Rules
                </span>
              </div>

              {/* Layout Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/90 text-xs font-extrabold self-start lg:self-auto">
                <button
                  type="button"
                  onClick={() => setDbmsLayoutMode('ALL_CARDS')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    dbmsLayoutMode === 'ALL_CARDS'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>All Tables &amp; Attributes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDbmsLayoutMode('SINGLE_EXPLORER')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    dbmsLayoutMode === 'SINGLE_EXPLORER'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  <span>Single Table + SQL DDL</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              {/* Relation Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs font-bold">
                {[
                  {
                    id: 'BASE_TABLES',
                    label: `SQL Tables Only (${dbmsSchema?.baseTableCount ?? 20})`
                  },
                  {
                    id: 'VIEWS',
                    label: `SQL Views (${dbmsSchema?.viewCount ?? 4})`
                  },
                  {
                    id: 'ALL',
                    label: `All Relations (${dbmsSchema?.totalRelationCount ?? 24})`
                  }
                ].map((flt) => (
                  <button
                    key={flt.id}
                    type="button"
                    onClick={() => setDbmsRelationFilter(flt.id)}
                    className={`px-3 py-1.5 rounded-xl border transition-all ${
                      dbmsRelationFilter === flt.id
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    {flt.label}
                  </button>
                ))}
              </div>

              {/* Search by SQL Table Name or Attribute Name */}
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-blue-500 sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={dbmsSearch}
                  onChange={(e) => setDbmsSearch(e.target.value)}
                  placeholder="Search SQL table or attribute name..."
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                {dbmsSearch && (
                  <button
                    type="button"
                    onClick={() => setDbmsSearch('')}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {dbmsLoading && !dbmsSchema ? (
            <div className="py-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 text-slate-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-bold">
                Querying MySQL 8 information_schema.TABLES &amp; COLUMNS...
              </span>
            </div>
          ) : dbmsLayoutMode === 'ALL_CARDS' ? (
            /* MODE 1: All SQL Tables & Their Attributes Grid (Clean DBMS Catalog) */
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredDbmsRelations.map((rel, rIdx) => (
                <div
                  key={rel.tableName}
                  className="bg-white rounded-3xl border border-slate-200/95 shadow-2xs overflow-hidden flex flex-col"
                >
                  <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-500/25 border border-blue-400/30 text-blue-200 text-[11px] font-extrabold flex items-center justify-center tabular-nums">
                        {rIdx + 1}
                      </span>
                      <span className="font-mono text-sm font-extrabold tracking-tight text-white">
                        {rel.tableName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          rel.tableType === 'BASE TABLE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                            : 'bg-purple-500/20 text-purple-200 border border-purple-400/30'
                        }`}
                      >
                        {rel.tableType === 'BASE TABLE' ? 'SQL TABLE' : 'SQL VIEW'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-bold tabular-nums">
                      <span className="text-slate-300">
                        {rel.attributeCount} attrs &bull; {rel.rowCount} rows
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSqlTable(rel.tableName);
                          setSqlDetailSubTab('DDL');
                          setDbmsLayoutMode('SINGLE_EXPLORER');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white text-[10px] font-extrabold transition-colors"
                      >
                        SQL DDL / Rows
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-2 px-3 w-8">#</th>
                          <th className="py-2 px-3">Attribute (Column)</th>
                          <th className="py-2 px-3">SQL Data Type</th>
                          <th className="py-2 px-3">Key / Foreign Key</th>
                          <th className="py-2 px-3">Null &amp; Default</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {(rel.attributes || []).map((attr) => {
                          const isPk = attr.columnKey === 'PRI';
                          const isFk = Boolean(attr.foreignKeyTarget);
                          const isUni = attr.columnKey === 'UNI';
                          return (
                            <tr key={attr.columnName} className="hover:bg-blue-50/40">
                              <td className="py-2 px-3 text-slate-400 tabular-nums">
                                {attr.ordinalPosition}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-900">
                                <span className={isPk ? 'underline decoration-amber-500 decoration-2' : ''}>
                                  {attr.columnName}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-blue-700 font-semibold">
                                {attr.columnType}
                              </td>
                              <td className="py-2 px-3 font-sans">
                                <div className="flex flex-wrap items-center gap-1">
                                  {isPk && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                                      <KeyRound className="w-2.5 h-2.5" />
                                      PK
                                    </span>
                                  )}
                                  {isUni && (
                                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-extrabold">
                                      UNIQUE
                                    </span>
                                  )}
                                  {isFk && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold font-mono">
                                      FK &rarr; {attr.foreignKeyTarget}
                                    </span>
                                  )}
                                  {!isPk && !isUni && !isFk && attr.columnKey === 'MUL' && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                                      INDEX
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 font-sans text-[11px] text-slate-600">
                                <span
                                  className={`font-bold ${
                                    attr.isNullable ? 'text-slate-400' : 'text-slate-800'
                                  }`}
                                >
                                  {attr.isNullable ? 'NULL' : 'NOT NULL'}
                                </span>
                                {attr.extra && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold font-mono">
                                    {attr.extra}
                                  </span>
                                )}
                                {attr.columnDefault !== null &&
                                  attr.columnDefault !== undefined &&
                                  attr.columnDefault !== '' && (
                                    <span className="ml-1.5 text-[10px] font-mono text-slate-500">
                                      def: {String(attr.columnDefault)}
                                    </span>
                                  )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* MODE 2: Single Table Deep Explorer (Attributes / CREATE DDL / Sample Rows) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/95 p-4 shadow-2xs space-y-1.5 max-h-[680px] overflow-y-auto">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 pb-1">
                  Select SQL Table or View ({filteredDbmsRelations.length})
                </div>
                {filteredDbmsRelations.map((rel) => {
                  const active = activeSqlRelationObj?.tableName === rel.tableName;
                  return (
                    <button
                      key={rel.tableName}
                      type="button"
                      onClick={() => setSelectedSqlTable(rel.tableName)}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-left text-xs transition-all ${
                        active
                          ? 'bg-blue-600 text-white font-extrabold shadow-2xs'
                          : 'hover:bg-slate-50 text-slate-800 font-semibold'
                      }`}
                    >
                      <span className="font-mono truncate">{rel.tableName}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums shrink-0 ${
                          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rel.attributeCount} cols &bull; {rel.rowCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/95 p-6 shadow-2xs space-y-4">
                {activeSqlRelationObj && (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono text-xl font-extrabold text-slate-900">
                            {activeSqlRelationObj.tableName}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-extrabold">
                            {activeSqlRelationObj.engine}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          {activeSqlRelationObj.attributeCount} SQL attributes &bull;{' '}
                          {activeSqlRelationObj.rowCount} live rows in MySQL 8
                        </p>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-extrabold">
                        {[
                          { id: 'ATTRIBUTES', label: 'Attributes', icon: Table2 },
                          { id: 'DDL', label: 'CREATE DDL', icon: Code2 },
                          { id: 'ROWS', label: 'Live Rows (25)', icon: Eye }
                        ].map((st) => {
                          const SubIcon = st.icon;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => setSqlDetailSubTab(st.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                sqlDetailSubTab === st.id
                                  ? 'bg-white text-blue-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <SubIcon className="w-3.5 h-3.5" />
                              <span>{st.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {sqlDetailSubTab === 'ATTRIBUTES' ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="py-2.5 px-3">#</th>
                              <th className="py-2.5 px-3">Attribute Name</th>
                              <th className="py-2.5 px-3">SQL Data Type</th>
                              <th className="py-2.5 px-3">Nullable</th>
                              <th className="py-2.5 px-3">Key / FK Reference</th>
                              <th className="py-2.5 px-3">Default / Extra</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-xs">
                            {(activeSqlRelationObj.attributes || []).map((attr) => (
                              <tr key={attr.columnName} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 text-slate-400">
                                  {attr.ordinalPosition}
                                </td>
                                <td className="py-2.5 px-3 font-extrabold text-slate-900">
                                  {attr.columnName}
                                </td>
                                <td className="py-2.5 px-3 text-blue-700 font-semibold">
                                  {attr.columnType}
                                </td>
                                <td className="py-2.5 px-3 font-sans font-bold text-slate-700">
                                  {attr.isNullable ? 'YES' : 'NO'}
                                </td>
                                <td className="py-2.5 px-3 font-sans">
                                  {attr.columnKey === 'PRI' && (
                                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold mr-1">
                                      PRIMARY KEY
                                    </span>
                                  )}
                                  {attr.columnKey === 'UNI' && (
                                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-extrabold mr-1">
                                      UNIQUE
                                    </span>
                                  )}
                                  {attr.foreignKeyTarget && (
                                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold font-mono">
                                      FK &rarr; {attr.foreignKeyTarget}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                  {[
                                    attr.columnDefault !== null &&
                                    attr.columnDefault !== undefined &&
                                    attr.columnDefault !== ''
                                      ? `DEFAULT ${attr.columnDefault}`
                                      : null,
                                    attr.extra || null
                                  ]
                                    .filter(Boolean)
                                    .join(' | ') || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : sqlDetailsLoading ? (
                      <div className="py-12 flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Querying MySQL {activeSqlRelationObj.tableName}...</span>
                      </div>
                    ) : sqlDetailSubTab === 'DDL' ? (
                      <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed">
                        {sqlTableDetails?.createDdl || 'No DDL returned.'}
                      </pre>
                    ) : (
                      <div className="overflow-x-auto max-h-[460px]">
                        {(sqlTableDetails?.sampleRows || []).length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-500">
                            Table currently has 0 rows.
                          </div>
                        ) : (
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-900 text-white font-mono text-[11px] sticky top-0">
                              <tr>
                                {Object.keys(sqlTableDetails.sampleRows[0]).map((col) => (
                                  <th key={col} className="py-2 px-3 whitespace-nowrap">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                              {sqlTableDetails.sampleRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/40">
                                  {Object.keys(sqlTableDetails.sampleRows[0]).map((col) => (
                                    <td
                                      key={col}
                                      className="py-2 px-3 text-slate-800 max-w-[260px] truncate"
                                      title={row[col] ?? 'NULL'}
                                    >
                                      {row[col] ?? <span className="text-slate-400">NULL</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Live Inventory Summary Strip */}
          {inventory && (
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 tabular-nums">
              {[
                { label: 'BMTC Routes', val: inventory.busRoutes?.length ?? 0, tone: 'text-blue-700 bg-blue-50 border-blue-100' },
                { label: 'BMTC Stops', val: inventory.busStops?.length ?? 0, tone: 'text-cyan-700 bg-cyan-50 border-cyan-100' },
                { label: 'Active Fleet', val: inventory.buses?.length ?? 0, tone: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
                { label: 'Metro Stations', val: inventory.metroStations?.length ?? 0, tone: 'text-purple-700 bg-purple-50 border-purple-100' },
                { label: 'Transfer Hubs', val: inventory.transferPoints?.length ?? 0, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
                { label: 'City Places', val: inventory.cityLandmarks?.length ?? 0, tone: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-100' },
                { label: 'Tariff Slabs', val: inventory.fareRules?.length ?? 0, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                { label: 'Audit Events', val: auditPage?.page?.totalElements ?? 0, tone: 'text-slate-700 bg-slate-100 border-slate-200' }
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white rounded-2xl border border-slate-200/95 px-4 py-3 shadow-2xs flex items-center justify-between"
                >
                  <span className="text-[11px] font-bold text-slate-500">{stat.label}</span>
                  <span className={`px-2.5 py-0.5 rounded-lg border text-sm font-extrabold ${stat.tone}`}>
                    {stat.val}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 10-Tab Segmented Operations Bar + Instant Table Filter */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white p-1.5 rounded-2xl border border-slate-200/95 shadow-2xs">
              {ADMIN_TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                const count = tabCounts[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTab(t.id);
                      setBanner(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-glow-blue'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                    {count !== undefined && count !== null && (
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${
                          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {['routes', 'stops', 'places'].includes(tab) && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-slate-200/95 shadow-2xs xl:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  placeholder={`Quick filter ${tab}...`}
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                {tableFilter && (
                  <button
                    type="button"
                    onClick={() => setTableFilter('')}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {banner && (
            <div
              className={`flex items-start gap-2.5 p-4 rounded-2xl border text-xs font-semibold ${
                banner.tone === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {banner.tone === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{banner.text}</span>
            </div>
          )}

          {loading && !inventory ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-semibold">Loading MySQL 8 administrative inventory...</span>
            </div>
          ) : (
            <>
          {/* TAB 1: BMTC BUS ROUTES */}
          {tab === 'routes' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleRouteSubmit}
                className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 space-y-3.5 shadow-2xs h-fit"
              >
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>{editingRouteId ? 'Edit BMTC Route' : 'Add BMTC Bus Route'}</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Fires MySQL <code>trg_bus_routes_after_insert / update</code> into{' '}
                  <code>audit_logs</code>.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Route No.</label>
                    <input
                      type="text"
                      required
                      value={routeForm.routeNumber}
                      onChange={(e) => setRouteForm({ ...routeForm, routeNumber: e.target.value })}
                      placeholder="e.g., 500-EB"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Service Type</label>
                    <select
                      value={routeForm.serviceType}
                      onChange={(e) => setRouteForm({ ...routeForm, serviceType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    >
                      <option value="ORDINARY">ORDINARY</option>
                      <option value="VAJRA_AC">VAJRA_AC</option>
                      <option value="VAYU_VAJRA">VAYU_VAJRA</option>
                      <option value="METRO_FEEDER">METRO_FEEDER</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Corridor Name</label>
                  <input
                    type="text"
                    required
                    value={routeForm.routeName}
                    onChange={(e) => setRouteForm({ ...routeForm, routeName: e.target.value })}
                    placeholder="Silk Board - Bellandur - KR Puram Express"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Origin</label>
                    <input
                      type="text"
                      required
                      value={routeForm.originName}
                      onChange={(e) => setRouteForm({ ...routeForm, originName: e.target.value })}
                      placeholder="Silk Board Junction"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Destination</label>
                    <input
                      type="text"
                      required
                      value={routeForm.destinationName}
                      onChange={(e) =>
                        setRouteForm({ ...routeForm, destinationName: e.target.value })
                      }
                      placeholder="KR Puram Bus Station"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Distance (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      required
                      value={routeForm.totalDistanceKm}
                      onChange={(e) =>
                        setRouteForm({ ...routeForm, totalDistanceKm: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 pt-5">
                    <input
                      type="checkbox"
                      checked={routeForm.isActive}
                      onChange={(e) => setRouteForm({ ...routeForm, isActive: e.target.checked })}
                    />
                    <span>Route Active</span>
                  </label>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                  >
                    {editingRouteId ? 'Save Route Changes' : 'Create BMTC Route'}
                  </button>
                  {editingRouteId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRouteId(null);
                        setRouteForm({
                          routeNumber: '',
                          routeName: '',
                          serviceType: 'ORDINARY',
                          originName: '',
                          destinationName: '',
                          totalDistanceKm: '12.50',
                          isActive: true
                        });
                      }}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs overflow-x-auto">
                <h3 className="text-base font-extrabold text-slate-900 mb-3">
                  BMTC Route Master ({inventory?.busRoutes?.length || 0})
                </h3>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Route</th>
                      <th className="py-2.5 px-3">Corridor</th>
                      <th className="py-2.5 px-3">Service</th>
                      <th className="py-2.5 px-3">Dist</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRoutesList.map((r) => (
                      <tr key={r.routeId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-extrabold text-blue-700">{r.routeNumber}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{r.routeName}</div>
                          <div className="text-[11px] text-slate-400">
                            {r.originName} &rarr; {r.destinationName}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">{r.serviceType}</td>
                        <td className="py-2.5 px-3 text-slate-600">{r.totalDistanceKm} km</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {r.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRouteId(r.routeId);
                              setRouteForm({
                                routeNumber: r.routeNumber,
                                routeName: r.routeName,
                                serviceType: r.serviceType,
                                originName: r.originName,
                                destinationName: r.destinationName,
                                totalDistanceKm: String(r.totalDistanceKm),
                                isActive: Boolean(r.isActive)
                              });
                            }}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
                            title="Edit route"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRoute(r)}
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                            title="Delete route (blocked by FK if fleet buses are still assigned)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: BMTC BUS STOPS */}
          {tab === 'stops' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleStopSubmit}
                className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 space-y-3.5 shadow-2xs h-fit"
              >
                <h2 className="text-base font-extrabold text-slate-900">
                  {editingStopId ? 'Edit BMTC Stop' : 'Add Geolocation Bus Stop'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Validated by MySQL CHECK constraints (Lat 12.50..13.50, Lng 77.20..78.00).
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Stop Code</label>
                    <input
                      type="text"
                      required
                      value={stopForm.stopCode}
                      onChange={(e) => setStopForm({ ...stopForm, stopCode: e.target.value })}
                      placeholder="BMTC-HSR2"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Area Name</label>
                    <input
                      type="text"
                      required
                      value={stopForm.areaName}
                      onChange={(e) => setStopForm({ ...stopForm, areaName: e.target.value })}
                      placeholder="HSR Sector 2"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Stop Name</label>
                  <input
                    type="text"
                    required
                    value={stopForm.stopName}
                    onChange={(e) => setStopForm({ ...stopForm, stopName: e.target.value })}
                    placeholder="HSR 27th Main Junction"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={stopForm.latitude}
                      onChange={(e) => setStopForm({ ...stopForm, latitude: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={stopForm.longitude}
                      onChange={(e) => setStopForm({ ...stopForm, longitude: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={stopForm.hasShelter}
                      onChange={(e) => setStopForm({ ...stopForm, hasShelter: e.target.checked })}
                    />
                    <span>Shelter</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={stopForm.isInterchangeHub}
                      onChange={(e) =>
                        setStopForm({ ...stopForm, isInterchangeHub: e.target.checked })
                      }
                    />
                    <span>TTMC / Hub</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={stopForm.isActive}
                      onChange={(e) => setStopForm({ ...stopForm, isActive: e.target.checked })}
                    />
                    <span>Active</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  {editingStopId ? 'Update Bus Stop' : 'Create Bus Stop'}
                </button>
              </form>

              <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs overflow-x-auto max-h-[560px] overflow-y-auto">
                <h3 className="text-base font-extrabold text-slate-900 mb-3">
                  BMTC Stops Inventory ({inventory?.busStops?.length || 0})
                </h3>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold border-y border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Code</th>
                      <th className="py-2 px-3">Stop &amp; Area</th>
                      <th className="py-2 px-3">Coordinates</th>
                      <th className="py-2 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStopsList.map((s) => (
                      <tr key={s.stopId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">{s.stopCode}</td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{s.stopName}</div>
                          <div className="text-[11px] text-slate-400">{s.areaName}</div>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                          {s.latitude}, {s.longitude}
                        </td>
                        <td className="py-2 px-3 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStopId(s.stopId);
                              setStopForm({
                                stopCode: s.stopCode,
                                stopName: s.stopName,
                                areaName: s.areaName,
                                latitude: String(s.latitude),
                                longitude: String(s.longitude),
                                hasShelter: Boolean(s.hasShelter),
                                isInterchangeHub: Boolean(s.isInterchangeHub),
                                isActive: Boolean(s.isActive)
                              });
                            }}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-700"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStop(s)}
                            className="p-1.5 rounded-lg bg-red-50 text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ORDERED ROUTE STOP SEQUENCES (M:N Junction bus_route_stops) */}
          {tab === 'sequences' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleAddSequenceStop}
                className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 space-y-3.5 shadow-2xs h-fit"
              >
                <h2 className="text-base font-extrabold text-slate-900">
                  Append Stop to Route Corridor
                </h2>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">BMTC Route</label>
                  <select
                    value={seqRouteId}
                    onChange={(e) => setSeqRouteId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  >
                    {(inventory?.busRoutes || []).map((r) => (
                      <option key={r.routeId} value={r.routeId}>
                        {r.routeNumber} - {r.routeName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Direction</label>
                  <select
                    value={seqDirection}
                    onChange={(e) => setSeqDirection(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  >
                    <option value="OUTBOUND">OUTBOUND</option>
                    <option value="INBOUND">INBOUND</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bus Stop</label>
                  <select
                    required
                    value={seqForm.stopId}
                    onChange={(e) => setSeqForm({ ...seqForm, stopId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  >
                    <option value="">-- Choose Stop --</option>
                    {(inventory?.busStops || []).map((s) => (
                      <option key={s.stopId} value={s.stopId}>
                        {s.stopName} ({s.stopCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Seq #</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={seqForm.stopSequence}
                      onChange={(e) => setSeqForm({ ...seqForm, stopSequence: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Km</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      value={seqForm.distanceFromStartKm}
                      onChange={(e) =>
                        setSeqForm({ ...seqForm, distanceFromStartKm: e.target.value })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">+Mins</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={seqForm.travelMinsFromPrev}
                      onChange={(e) =>
                        setSeqForm({ ...seqForm, travelMinsFromPrev: e.target.value })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  Append Stop to Sequence
                </button>
              </form>

              <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-3">
                <h3 className="text-base font-extrabold text-slate-900">
                  Ordered Sequence ({seqDirection}) &bull; {seqStops.length} Stops
                </h3>
                <div className="space-y-2">
                  {seqStops.map((st) => (
                    <div
                      key={st.routeStopId}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center">
                          {st.stopSequence}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">{st.stopName}</div>
                          <div className="text-[11px] text-slate-500">
                            {st.distanceFromStartKm} km from origin &bull; +{st.travelMinsFromPrev}m from prev
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSequenceStop(st.routeStopId)}
                        className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                        title="Remove stop from route"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BMTC FLEET VEHICLES */}
          {tab === 'fleet' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleBusSubmit}
                className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 space-y-3.5 shadow-2xs h-fit"
              >
                <h2 className="text-base font-extrabold text-slate-900">
                  {editingBusId ? 'Update Fleet Vehicle' : 'Assign Fleet Bus'}
                </h2>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Route</label>
                  <select
                    value={busForm.routeId}
                    onChange={(e) => setBusForm({ ...busForm, routeId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  >
                    {(inventory?.busRoutes || []).map((r) => (
                      <option key={r.routeId} value={r.routeId}>
                        {r.routeNumber} - {r.routeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Reg. Number</label>
                    <input
                      type="text"
                      required
                      value={busForm.registrationNo}
                      onChange={(e) => setBusForm({ ...busForm, registrationNo: e.target.value })}
                      placeholder="KA-57-F-4901"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Capacity</label>
                    <input
                      type="number"
                      min="15"
                      max="90"
                      required
                      value={busForm.seatingCapacity}
                      onChange={(e) => setBusForm({ ...busForm, seatingCapacity: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Coach Type</label>
                    <select
                      value={busForm.busType}
                      onChange={(e) => setBusForm({ ...busForm, busType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    >
                      <option value="ELECTRIC_NON_AC">ELECTRIC_NON_AC</option>
                      <option value="NON_AC_DIESEL">NON_AC_DIESEL</option>
                      <option value="VAJRA_VOLVO_AC">VAJRA_VOLVO_AC</option>
                      <option value="VAYU_VAJRA_AC">VAYU_VAJRA_AC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                    <select
                      value={busForm.operationalStatus}
                      onChange={(e) =>
                        setBusForm({ ...busForm, operationalStatus: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                      <option value="RETIRED">RETIRED</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">BMTC Depot</label>
                  <input
                    type="text"
                    required
                    value={busForm.depotName}
                    onChange={(e) => setBusForm({ ...busForm, depotName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  {editingBusId ? 'Save Vehicle' : 'Register Bus'}
                </button>
              </form>

              <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs overflow-x-auto">
                <h3 className="text-base font-extrabold text-slate-900 mb-3">
                  Assigned BMTC Fleet ({inventory?.buses?.length || 0})
                </h3>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Registration</th>
                      <th className="py-2.5 px-3">Route</th>
                      <th className="py-2.5 px-3">Type &amp; Depot</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(inventory?.buses || []).map((b) => (
                      <tr key={b.busId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {b.registrationNo}
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-blue-700">{b.routeNumber}</td>
                        <td className="py-2.5 px-3">
                          <div>{b.busType} ({b.seatingCapacity} seats)</div>
                          <div className="text-[11px] text-slate-400">{b.depotName}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              b.operationalStatus === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {b.operationalStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBusId(b.busId);
                              setBusForm({
                                routeId: String(b.routeId),
                                registrationNo: b.registrationNo,
                                busType: b.busType,
                                seatingCapacity: b.seatingCapacity,
                                depotName: b.depotName,
                                operationalStatus: b.operationalStatus
                              });
                            }}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-700"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await transitApi.deleteBus(b.busId);
                                await loadAdminData();
                                notifyGlobalRefresh();
                              } catch (err) {
                                setBanner({ tone: 'error', text: err.message });
                              }
                            }}
                            className="p-1.5 rounded-lg bg-red-50 text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: NAMMA METRO STATIONS */}
          {tab === 'metro' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleStationSubmit}
                className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 space-y-3.5 shadow-2xs h-fit"
              >
                <h2 className="text-base font-extrabold text-slate-900">
                  {editingStationId ? 'Edit Metro Station' : 'Add Namma Metro Station'}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Line</label>
                    <select
                      value={stationForm.lineId}
                      onChange={(e) => setStationForm({ ...stationForm, lineId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    >
                      {(inventory?.metroLines || []).map((l) => (
                        <option key={l.lineId} value={l.lineId}>
                          {l.lineName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Order #</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={stationForm.stationOrder}
                      onChange={(e) =>
                        setStationForm({ ...stationForm, stationOrder: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Code</label>
                    <input
                      type="text"
                      required
                      value={stationForm.stationCode}
                      onChange={(e) =>
                        setStationForm({ ...stationForm, stationCode: e.target.value })
                      }
                      placeholder="PUR-15"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Structure</label>
                    <select
                      value={stationForm.structureType}
                      onChange={(e) =>
                        setStationForm({ ...stationForm, structureType: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    >
                      <option value="ELEVATED">ELEVATED</option>
                      <option value="UNDERGROUND">UNDERGROUND</option>
                      <option value="AT_GRADE">AT_GRADE</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Station Name</label>
                  <input
                    type="text"
                    required
                    value={stationForm.stationName}
                    onChange={(e) =>
                      setStationForm({ ...stationForm, stationName: e.target.value })
                    }
                    placeholder="Hopefarm Channasandra"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={stationForm.latitude}
                      onChange={(e) => setStationForm({ ...stationForm, latitude: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={stationForm.longitude}
                      onChange={(e) =>
                        setStationForm({ ...stationForm, longitude: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={stationForm.isInterchange}
                      onChange={(e) =>
                        setStationForm({ ...stationForm, isInterchange: e.target.checked })
                      }
                    />
                    <span>Interchange</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={stationForm.hasParking}
                      onChange={(e) =>
                        setStationForm({ ...stationForm, hasParking: e.target.checked })
                      }
                    />
                    <span>Parking</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={stationForm.isActive}
                      onChange={(e) =>
                        setStationForm({ ...stationForm, isActive: e.target.checked })
                      }
                    />
                    <span>Active</span>
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                >
                  {editingStationId ? 'Save Station' : 'Create Metro Station'}
                </button>
              </form>

              <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs overflow-x-auto max-h-[560px] overflow-y-auto">
                <h3 className="text-base font-extrabold text-slate-900 mb-3">
                  Namma Metro Stations ({inventory?.metroStations?.length || 0})
                </h3>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold border-y border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Code</th>
                      <th className="py-2 px-3">Station</th>
                      <th className="py-2 px-3">Line</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(inventory?.metroStations || []).map((ms) => (
                      <tr key={ms.stationId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-purple-700">
                          {ms.stationCode}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          #{ms.stationOrder} {ms.stationName}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: ms.colorHex || '#7C3AED' }}
                          >
                            {ms.lineName}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-[10px] font-bold">
                            {ms.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStationId(ms.stationId);
                              setStationForm({
                                stationCode: ms.stationCode,
                                stationName: ms.stationName,
                                lineId: ms.lineId,
                                stationOrder: ms.stationOrder,
                                latitude: String(ms.latitude),
                                longitude: String(ms.longitude),
                                isInterchange: Boolean(ms.isInterchange),
                                structureType: ms.structureType,
                                hasParking: Boolean(ms.hasParking),
                                isActive: Boolean(ms.isActive)
                              });
                            }}
                            className="p-1.5 rounded-lg bg-purple-50 text-purple-700"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: MULTI-MODAL INTERCHANGE HUBS */}
          {tab === 'hubs' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleHubSubmit}
                className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 space-y-3.5 shadow-2xs h-fit"
              >
                <h2 className="text-base font-extrabold text-slate-900">
                  {editingHubId ? 'Edit Interchange Hub' : 'Link BMTC Stop <-> Metro Station'}
                </h2>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hub Name</label>
                  <input
                    type="text"
                    required
                    value={hubForm.hubName}
                    onChange={(e) => setHubForm({ ...hubForm, hubName: e.target.value })}
                    placeholder="Tin Factory - Benniganahalli Skywalk"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">BMTC Stop</label>
                  <select
                    value={hubForm.busStopId}
                    onChange={(e) => setHubForm({ ...hubForm, busStopId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  >
                    {(inventory?.busStops || []).map((s) => (
                      <option key={s.stopId} value={s.stopId}>
                        {s.stopName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Metro Station</label>
                  <select
                    value={hubForm.metroStationId}
                    onChange={(e) => setHubForm({ ...hubForm, metroStationId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  >
                    {(inventory?.metroStations || []).map((m) => (
                      <option key={m.stationId} value={m.stationId}>
                        {m.stationName} ({m.lineName})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Dist (m)</label>
                    <input
                      type="number"
                      min="10"
                      max="2000"
                      required
                      value={hubForm.walkingDistanceM}
                      onChange={(e) =>
                        setHubForm({ ...hubForm, walkingDistanceM: e.target.value })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Walk (m)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      required
                      value={hubForm.walkingTimeMins}
                      onChange={(e) =>
                        setHubForm({ ...hubForm, walkingTimeMins: e.target.value })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Buffer</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      required
                      value={hubForm.transferBufferMins}
                      onChange={(e) =>
                        setHubForm({ ...hubForm, transferBufferMins: e.target.value })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
                <div className="flex gap-4 text-xs font-semibold">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={hubForm.hasSkywalk}
                      onChange={(e) => setHubForm({ ...hubForm, hasSkywalk: e.target.checked })}
                    />
                    <span>Skywalk</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={hubForm.isActive}
                      onChange={(e) => setHubForm({ ...hubForm, isActive: e.target.checked })}
                    />
                    <span>Active</span>
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  {editingHubId ? 'Save Hub Connector' : 'Create Hub Connector'}
                </button>
              </form>

              <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-2.5">
                <h3 className="text-base font-extrabold text-slate-900">
                  Active &amp; Configured Transfer Points ({inventory?.transferPoints?.length || 0})
                </h3>
                {(inventory?.transferPoints || []).map((tp) => (
                  <div
                    key={tp.transferId}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{tp.hubName}</div>
                      <div className="text-[11px] text-slate-500">
                        {tp.busStopName} &harr; {tp.metroStationName} &bull; {tp.walkingDistanceM}m (
                        {tp.walkingTimeMins}m walk + {tp.transferBufferMins}m buffer)
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHubId(tp.transferId);
                          setHubForm({
                            hubName: tp.hubName,
                            busStopId: String(tp.busStopId),
                            metroStationId: String(tp.metroStationId),
                            walkingDistanceM: tp.walkingDistanceM,
                            walkingTimeMins: tp.walkingTimeMins,
                            transferBufferMins: tp.transferBufferMins,
                            hasSkywalk: Boolean(tp.hasSkywalk),
                            isActive: Boolean(tp.isActive)
                          });
                        }}
                        className="p-1.5 rounded-lg bg-blue-50 text-blue-700"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await transitApi.deleteTransferPoint(tp.transferId);
                          await loadAdminData();
                          notifyGlobalRefresh();
                        }}
                        className="p-1.5 rounded-lg bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6B: BENGALURU PLACES & ADDRESSES DIRECTORY (city_landmarks - 300+ Places) */}
          {tab === 'places' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleLandmarkSubmit}
                className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 space-y-3.5 shadow-2xs h-fit"
              >
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-fuchsia-600" />
                  <span>
                    {editingLandmarkId ? 'Edit Bengaluru Place' : 'Add Bengaluru Place & Address'}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Persists directly to MySQL <code>city_landmarks</code> (searchable immediately in
                  Journey Planner with nearest BMTC/Metro auto-matching).
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Place / Institution Name
                  </label>
                  <input
                    type="text"
                    required
                    value={landmarkForm.landmarkName}
                    onChange={(e) =>
                      setLandmarkForm({ ...landmarkForm, landmarkName: e.target.value })
                    }
                    placeholder="e.g., Karnataka Examination Authority (KEA)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={landmarkForm.category}
                      onChange={(e) =>
                        setLandmarkForm({ ...landmarkForm, category: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    >
                      {LANDMARK_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">PIN Code</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      pattern="[0-9]{6}"
                      value={landmarkForm.pincode}
                      onChange={(e) =>
                        setLandmarkForm({ ...landmarkForm, pincode: e.target.value })
                      }
                      placeholder="560001"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Neighborhood / Area
                  </label>
                  <input
                    type="text"
                    required
                    value={landmarkForm.areaName}
                    onChange={(e) => setLandmarkForm({ ...landmarkForm, areaName: e.target.value })}
                    placeholder="Malleshwaram 18th Cross"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Street Address
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={landmarkForm.streetAddress}
                    onChange={(e) =>
                      setLandmarkForm({ ...landmarkForm, streetAddress: e.target.value })
                    }
                    placeholder="Sampige Road, 18th Cross, Malleshwaram, Bengaluru"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={landmarkForm.latitude}
                      onChange={(e) =>
                        setLandmarkForm({ ...landmarkForm, latitude: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={landmarkForm.longitude}
                      onChange={(e) =>
                        setLandmarkForm({ ...landmarkForm, longitude: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={landmarkForm.isActive}
                    onChange={(e) =>
                      setLandmarkForm({ ...landmarkForm, isActive: e.target.checked })
                    }
                  />
                  <span>Active in Destination Search</span>
                </label>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold"
                  >
                    {editingLandmarkId ? 'Save Place Changes' : 'Add Bengaluru Place'}
                  </button>
                  {editingLandmarkId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLandmarkId(null);
                        setLandmarkForm({
                          landmarkName: '',
                          category: 'GOVT_OFFICE',
                          areaName: '',
                          streetAddress: '',
                          pincode: '560001',
                          latitude: '12.975600',
                          longitude: '77.606600',
                          isActive: true
                        });
                      }}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs overflow-x-auto max-h-[580px] overflow-y-auto">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Bengaluru Places &amp; Street Addresses ({filteredLandmarksList.length} /{' '}
                    {inventory?.cityLandmarks?.length || 0})
                  </h3>
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold border-y border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Place &amp; Street Address</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">PIN</th>
                      <th className="py-2 px-3">Coords</th>
                      <th className="py-2 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLandmarksList.map((lm) => (
                      <tr key={lm.landmarkId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 max-w-[320px]">
                          <div className="font-bold text-slate-900">{lm.landmarkName}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {lm.streetAddress} ({lm.areaName})
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-800 text-[10px] font-extrabold">
                            {lm.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {lm.pincode}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {Number(lm.latitude).toFixed(4)}, {Number(lm.longitude).toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLandmarkId(lm.landmarkId);
                              setLandmarkForm({
                                landmarkName: lm.landmarkName,
                                category: lm.category,
                                areaName: lm.areaName,
                                streetAddress: lm.streetAddress,
                                pincode: lm.pincode || '560001',
                                latitude: String(lm.latitude),
                                longitude: String(lm.longitude),
                                isActive: Boolean(lm.isActive)
                              });
                            }}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
                            title="Edit place"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLandmark(lm)}
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                            title="Delete place"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: SCHEDULES & DISTANCE-SLAB TARIFFS */}
          {tab === 'tariffs' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Distance-Slab Fare Editor (Fires trg_fare_rules_after_update!) */}
              <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Distance-Slab Tariff Rules (fare_rules)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Editing any fare slab fires MySQL trigger <code>trg_fare_rules_after_update</code>{' '}
                    and immediately reprices Journey Planner routes!
                  </p>
                </div>

                <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold border-y border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-2.5">Category</th>
                        <th className="py-2 px-2.5">Slab</th>
                        <th className="py-2 px-2.5">Fare (INR)</th>
                        <th className="py-2 px-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(inventory?.fareRules || []).map((fr) => {
                        const isEditing = editingFareId === fr.fareRuleId;
                        return (
                          <tr key={fr.fareRuleId}>
                            <td className="py-2 px-2.5 font-bold text-slate-800">
                              {fr.serviceCategory}
                            </td>
                            <td className="py-2 px-2.5 text-slate-600">
                              {fr.minDistanceKm}-{fr.maxDistanceKm} km
                            </td>
                            <td className="py-2 px-2.5">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={fareEditValue}
                                  onChange={(e) => setFareEditValue(e.target.value)}
                                  className="w-20 px-2 py-1 rounded-lg border border-blue-400 font-bold"
                                />
                              ) : (
                                <span className="font-extrabold text-blue-700">
                                  Rs. {Number(fr.fareInr).toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              {isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => handleSaveFareInline(fr)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold"
                                >
                                  Save
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingFareId(fr.fareRuleId);
                                    setFareEditValue(String(fr.fareInr));
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold"
                                >
                                  Edit Fare
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Service Headways Editor */}
              <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Service Windows &amp; Headways (schedules)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Peak headway minutes control estimated platform/bus-bay waiting times in Dijkstra.
                  </p>
                </div>

                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {(inventory?.schedules || []).map((sc) => {
                    const isEditing = editingScheduleId === sc.scheduleId;
                    return (
                      <div
                        key={sc.scheduleId}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            {sc.transportMode === 'BUS'
                              ? `BMTC ${sc.busRouteNumber}`
                              : sc.metroLineName}{' '}
                            ({sc.dayType})
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {sc.firstServiceTime} - {sc.lastServiceTime} &bull; {sc.dataConfidence}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="2"
                              max="120"
                              value={schedPeakEdit}
                              onChange={(e) => setSchedPeakEdit(e.target.value)}
                              className="w-14 px-2 py-1 rounded-lg border border-blue-400 font-bold"
                              title="Peak headway (mins)"
                            />
                            <input
                              type="number"
                              min="3"
                              max="180"
                              value={schedOffpeakEdit}
                              onChange={(e) => setSchedOffpeakEdit(e.target.value)}
                              className="w-14 px-2 py-1 rounded-lg border border-blue-400"
                              title="Off-peak headway (mins)"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveScheduleInline(sc)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700">
                              Peak {sc.peakHeadwayMins}m / Off {sc.offpeakHeadwayMins}m
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingScheduleId(sc.scheduleId);
                                setSchedPeakEdit(String(sc.peakHeadwayMins));
                                setSchedOffpeakEdit(String(sc.offpeakHeadwayMins));
                              }}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-700"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: FEEDBACK MODERATION & IMMUTABLE MYSQL TRIGGER AUDIT LOGS */}
          {tab === 'audit' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Commuter Feedback Moderation */}
              <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-3">
                <h3 className="text-base font-extrabold text-slate-900">
                  Commuter Review Moderation (feedback)
                </h3>
                <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                  {feedbackList.map((fb) => (
                    <div
                      key={fb.feedbackId}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">{fb.targetLabel}</span>
                        <span className="font-bold text-amber-700">{fb.rating}/5 Stars</span>
                      </div>
                      <p className="text-slate-700">{fb.comments}</p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400">
                          By {fb.passengerName} &bull; <b>{fb.reviewStatus}</b>
                        </span>
                        <div className="flex gap-1">
                          {['PENDING', 'REVIEWED', 'RESOLVED'].map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleModerateReview(fb.feedbackId, st)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                fb.reviewStatus === st
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white border border-slate-300 text-slate-600 hover:border-blue-400'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Immutable MySQL Trigger Audit Trail */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      MySQL Trigger Audit Trail (audit_logs)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Populated automatically by MySQL AFTER INSERT / UPDATE / DELETE triggers
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      disabled={(auditPage?.page?.number || 0) <= 0}
                      onClick={() => loadAuditPageNum((auditPage?.page?.number || 0) - 1)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 disabled:opacity-40 font-bold"
                    >
                      Prev
                    </button>
                    <span className="text-slate-600 font-semibold">
                      Page {(auditPage?.page?.number || 0) + 1} /{' '}
                      {Math.max(1, auditPage?.page?.totalPages || 1)}
                    </span>
                    <button
                      type="button"
                      disabled={
                        (auditPage?.page?.number || 0) + 1 >= (auditPage?.page?.totalPages || 1)
                      }
                      onClick={() => loadAuditPageNum((auditPage?.page?.number || 0) + 1)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 disabled:opacity-40 font-bold"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {(auditPage?.content || []).map((log) => (
                    <div
                      key={log.logId}
                      className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 text-xs space-y-1.5 font-mono"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                              log.operationType === 'INSERT'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : log.operationType === 'UPDATE'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {log.operationType}
                          </span>
                          <span className="font-bold text-blue-300">{log.tableName}</span>
                          <span className="text-white font-bold">[{log.recordIdentifier}]</span>
                        </div>
                        <span className="text-[10px] text-slate-400">#{log.logId}</span>
                      </div>
                      {log.oldPayload && (
                        <div className="text-[11px] text-amber-200/90 break-all">
                          OLD: {log.oldPayload}
                        </div>
                      )}
                      {log.newPayload && (
                        <div className="text-[11px] text-emerald-200/90 break-all">
                          NEW: {log.newPayload}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}
