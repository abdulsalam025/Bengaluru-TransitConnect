const API_BASE = import.meta.env?.VITE_API_BASE_URL || '/api';
const TOKEN_STORAGE_KEY = 'btc_jwt_token';

// Lightweight in-memory GET cache + inflight request deduplication for 0ms smooth UI transitions
const responseCache = new Map();
const inflightRequests = new Map();

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  clearTransitCache();
}

export function clearTransitCache(prefix = '') {
  if (!prefix) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
}

async function request(path, options = {}, cacheTtlMs = 0) {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const token = getStoredToken();
  const cacheKey = `${token ? 'auth' : 'anon'}:${path}`;

  if (isGet && cacheTtlMs > 0) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }
    if (inflightRequests.has(cacheKey)) {
      return inflightRequests.get(cacheKey);
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const fetchPromise = (async () => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers
    });

    if (response.status === 204) {
      if (!isGet) {
        clearTransitCache();
      }
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    let payload = null;
    if (rawText) {
      if (contentType.includes('application/json')) {
        try {
          payload = JSON.parse(rawText);
        } catch {
          payload = rawText;
        }
      } else {
        payload = rawText;
      }
    }

    if (!response.ok) {
      const msg =
        (payload && typeof payload === 'object' && payload.message) ||
        `Request failed with HTTP ${response.status}`;
      const error = new Error(msg);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    if (isGet && cacheTtlMs > 0) {
      responseCache.set(cacheKey, {
        payload,
        expiresAt: Date.now() + cacheTtlMs
      });
    } else if (!isGet) {
      clearTransitCache();
    }

    return payload;
  })();

  if (isGet && cacheTtlMs > 0) {
    inflightRequests.set(cacheKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      inflightRequests.delete(cacheKey);
    }
  }

  return fetchPromise;
}

export const transitApi = {
  // System & Auth
  getHealth: () => request('/health', {}, 15000),
  login: (emailOrCredentials, maybePassword) => {
    const bodyObj =
      typeof emailOrCredentials === 'object' && emailOrCredentials !== null
        ? {
            email: emailOrCredentials.email,
            password: emailOrCredentials.password
          }
        : {
            email: emailOrCredentials,
            password: maybePassword
          };
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(bodyObj)
    });
  },
  register: (data) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getMe: () => request('/auth/me'),

  // Public Transit Network, Specific Place Search & Fares (Cached for smooth instant UX)
  getNetwork: (forceRefresh = false) => {
    if (forceRefresh) {
      clearTransitCache('anon:/transit/network');
      clearTransitCache('auth:/transit/network');
    }
    return request('/transit/network', {}, 60000);
  },
  getBusRouteStops: (routeId, direction = 'OUTBOUND') =>
    request(`/transit/bus-routes/${routeId}/stops?direction=${direction}`, {}, 60000),
  getNearbyNodes: (lat, lng, radiusKm = 4.0, limit = 6) =>
    request(
      `/transit/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}&limit=${limit}`,
      {},
      30000
    ),
  searchPlaces: (q = '', limit = 80, category = '') =>
    request(
      `/transit/places?q=${encodeURIComponent(q)}&limit=${limit}&category=${encodeURIComponent(
        category || ''
      )}`,
      {},
      45000
    ),
  getFareRules: () => request('/transit/fares', {}, 60000),
  getFares: () => request('/transit/fares', {}, 60000),

  // Multi-Modal Journey Planner, Short-Auth Booking Shield, Gate Scan & Smart Wallet
  searchJourneys: (payload) =>
    request('/journeys/search', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  requestBookingChallenge: (planIdOrObj) => {
    const planId =
      typeof planIdOrObj === 'object' && planIdOrObj !== null
        ? planIdOrObj.planId
        : planIdOrObj;
    return request('/journeys/book/challenge', {
      method: 'POST',
      body: JSON.stringify({ planId })
    });
  },
  bookUnifiedPass: (bookingPayload) => {
    const bodyObj =
      typeof bookingPayload === 'object' && bookingPayload !== null
        ? bookingPayload
        : { planId: bookingPayload };
    return request('/journeys/book', {
      method: 'POST',
      body: JSON.stringify(bodyObj)
    });
  },
  scanPass: (historyId) =>
    request(`/journeys/passes/${historyId}/scan`, {
      method: 'PATCH'
    }),
  getHistoryAndWallet: () => request('/journeys/history'),
  topUpWallet: (amountOrObj) => {
    const amountInr =
      typeof amountOrObj === 'object' && amountOrObj !== null
        ? amountOrObj.amountInr
        : amountOrObj;
    return request('/journeys/wallet/topup', {
      method: 'POST',
      body: JSON.stringify({ amountInr })
    });
  },

  // Passenger Feedback
  getFeedback: (page = 0, size = 10) =>
    request(`/feedback?page=${page}&size=${size}`, {}, 15000),
  submitFeedback: (payload) =>
    request('/feedback', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // SQL Analytical Views
  getAnalyticsDashboard: (forceRefresh = false) => {
    if (forceRefresh) {
      clearTransitCache('anon:/analytics/dashboard');
      clearTransitCache('auth:/analytics/dashboard');
    }
    return request('/analytics/dashboard', {}, 20000);
  },

  // Admin Protected CRUD Endpoints (ROLE_ADMIN required)
  getAdminInventory: () => request('/admin/inventory'),
  getAdminDbmsSchema: () => request('/admin/dbms-schema'),
  getAdminDbmsTableDetails: (tableName, limit = 20) =>
    request(`/admin/dbms-schema/${encodeURIComponent(tableName)}?limit=${limit}`),
  getAuditLogs: (page = 0, size = 20) =>
    request(`/admin/audit-logs?page=${page}&size=${size}`),

  createBusRoute: (payload) =>
    request('/admin/bus-routes', { method: 'POST', body: JSON.stringify(payload) }),
  updateBusRoute: (id, payload) =>
    request(`/admin/bus-routes/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteBusRoute: (id) =>
    request(`/admin/bus-routes/${id}`, { method: 'DELETE' }),

  createBusStop: (payload) =>
    request('/admin/bus-stops', { method: 'POST', body: JSON.stringify(payload) }),
  updateBusStop: (id, payload) =>
    request(`/admin/bus-stops/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteBusStop: (id) =>
    request(`/admin/bus-stops/${id}`, { method: 'DELETE' }),

  addRouteStop: (payload) =>
    request('/admin/route-stops', { method: 'POST', body: JSON.stringify(payload) }),
  deleteRouteStop: (id) =>
    request(`/admin/route-stops/${id}`, { method: 'DELETE' }),

  createBus: (payload) =>
    request('/admin/buses', { method: 'POST', body: JSON.stringify(payload) }),
  updateBus: (id, payload) =>
    request(`/admin/buses/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteBus: (id) =>
    request(`/admin/buses/${id}`, { method: 'DELETE' }),

  createMetroStation: (payload) =>
    request('/admin/metro-stations', { method: 'POST', body: JSON.stringify(payload) }),
  updateMetroStation: (id, payload) =>
    request(`/admin/metro-stations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  createTransferPoint: (payload) =>
    request('/admin/transfer-points', { method: 'POST', body: JSON.stringify(payload) }),
  updateTransferPoint: (id, payload) =>
    request(`/admin/transfer-points/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTransferPoint: (id) =>
    request(`/admin/transfer-points/${id}`, { method: 'DELETE' }),

  createSchedule: (payload) =>
    request('/admin/schedules', { method: 'POST', body: JSON.stringify(payload) }),
  updateSchedule: (id, payload) =>
    request(`/admin/schedules/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  createFareRule: (payload) =>
    request('/admin/fare-rules', { method: 'POST', body: JSON.stringify(payload) }),
  updateFareRule: (id, payload) =>
    request(`/admin/fare-rules/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  moderateFeedback: (feedbackId, reviewStatus) =>
    request(`/admin/feedback/${feedbackId}/moderate`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewStatus })
    }),

  createLandmark: (payload) =>
    request('/admin/landmarks', { method: 'POST', body: JSON.stringify(payload) }),
  updateLandmark: (id, payload) =>
    request(`/admin/landmarks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteLandmark: (id) =>
    request(`/admin/landmarks/${id}`, { method: 'DELETE' })
};
