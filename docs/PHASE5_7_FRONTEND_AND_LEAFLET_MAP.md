# Phase 5 & Phase 7: React 18 + Tailwind CSS + Leaflet/OpenStreetMap UI

## 1. Frontend Architecture (`frontend/`)

| File | Responsibility |
| :--- | :--- |
| `vite.config.js` | Binds `0.0.0.0:5173` and proxies `/api` requests to Spring Boot (`127.0.0.1:8080`) |
| `src/api/transitApi.js` | Centralized `fetch` client with JWT `Bearer` header injection & structured error parsing |
| `src/context/AuthContext.jsx` | Manages commuter/admin session state, `localStorage` token persistence & live wallet balance sync |
| `src/components/Navbar.jsx` | Dual BMTC+Metro brand bar, 5 module tabs, live `MySQL 8 Connected` badge & NCMC Wallet chip |
| `src/components/TransitLeafletMap.jsx` | Phase 7 OpenStreetMap + Leaflet engine: Metro polylines, BMTC corridors, Skywalk popups & Map Pin-Drop |
| `src/components/JourneyPlannerView.jsx` | Split-pane multi-modal planner: From/To swap, GPS + Manual Fallback, Fastest/Cheapest/Min-Transfers, Mode Comparison & Formula Breakdown |
| `src/components/NetworkExplorerView.jsx` | Interactive explorer for 8 BMTC corridors (`OUTBOUND`/`INBOUND`), 3 Metro lines, 12 Hubs & Fare Slabs |
| `src/components/MyPassesView.jsx` | NCMC Smart Wallet card, instant top-up, booked Unified QR Passes, recent searches & Commuter Reviews |
| `src/components/QrPassModal.jsx` | Renders deterministic 21x21 inline SVG QR Pass after `sp_book_unified_qr_pass` ACID commit |
| `src/components/AuthModal.jsx` | Sign In / Register modal with 1-click Demo Commuter & Admin quick-fill buttons |

---

## 2. Geolocation & Graceful Manual Fallback (Phase 7)

1. **Browser Geolocation (`Use GPS`)**:
   - Invokes `navigator.geolocation.getCurrentPosition`.
   - If coordinates lie within Greater Bengaluru (`12.70..13.28 N, 77.35..77.88 E`), calls `GET /api/transit/nearby` (`sp_find_nearby_transit_nodes`), snaps Origin to the nearest active stop/station, and prepends the exact first-mile walking leg.
2. **Denied Permission / Out-of-City Fallback**:
   - If the passenger denies GPS permission OR tests from outside Bengaluru, the UI displays a transparent fallback banner and provides:
     - **Interactive Map Pin-Drop (`Map Pin`)**: Click any street in Bengaluru on the Leaflet map to query `sp_find_nearby_transit_nodes` live.
     - **1-Click Neighborhood Presets** (`Silk Board / HSR`, `Koramangala`, `MG Road`, `KR Puram`, `ITPL Whitefield`) and full searchable `BMTC` / `Namma Metro` dropdowns.

---

## 3. Data Transparency & ACID Demonstration Flow

- Every route card displays the exact time invariant:
  ~~~text
  Total Time = Walk + Bus + Metro + Wait + Transfer
  ~~~
- All schedules and tariffs carry explicit provenance (`SCHEDULED_SAMPLE` / `OFFICIAL_PUBLISHED`), never claiming simulated coordinates as live bus GPS.
- **Live Viva ACID Test**:
  1. Sign in as **Kavya Nair** (`kavya.nair@bengaluru.in`, Wallet `Rs. 35.00`).
  2. Click **Book Unified QR Pass** on `Silk Board -> Whitefield` (`Rs. 55.00`) -> MySQL trigger `trg_wallet_balance_guard` aborts the transaction and surfaces the exact rollback alert.
  3. Open **My Passes**, click **`+Rs. 50`** -> Balance becomes `Rs. 85.00`, then book the QR pass (`Rs. 85.00 -> Rs. 30.00`) and view the generated Unified QR ticket!