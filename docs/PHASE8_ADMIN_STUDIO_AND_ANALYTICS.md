# Phase 8: Role-Protected Admin Studio & Interactive SQL Analytics Dashboard

## 1. SQL Views Analytics Dashboard (`AnalyticsView.jsx`)

Queries `GET /api/analytics/dashboard`, which executes our 4 MySQL 8 `VIEW`s via `JdbcTemplate` (`TransitSqlRepository`):

1. **`v_popular_searched_corridors`** (`journey_plans LEFT JOIN travel_history` + `GROUP BY source_name, destination_name`):
   - Ranks Bengaluru origin-destination corridors by search volume, fastest door-to-door time, lowest slab fare, and QR pass conversion.
2. **`v_transport_mode_usage_report`** (`GROUP BY route_category`):
   - Visualizes proportional mode share across `COMBINED`, `BUS_ONLY`, and `METRO_ONLY`, comparing average duration, average fare, and average transfer count.
3. **`v_multimodal_hub_connectivity`** (`transfer_points` + `bus_stops` + `metro_stations` + `metro_lines` + `LEFT JOIN bus_route_stops` + `COUNT(DISTINCT route_id)`):
   - Ranks all 12 active BMTC <-> Namma Metro interchange hubs by connected BMTC route count and skywalk walking distance.
4. **`v_route_feedback_summary`** (`bus_routes LEFT JOIN feedback`):
   - Demonstrates `LEFT JOIN` preservation of unreviewed BMTC routes (`0 Reviews`) alongside rated corridors.

Each card includes an **`Inspect SQL`** toggle so the exact MySQL `CREATE VIEW` query can be displayed live during a DBMS viva.

---

## 2. Role-Protected Admin Transit Studio (`AdminStudioView.jsx`)

Protected on both client and server by Spring Security `hasRole('ADMIN')` (`/api/admin/**`):

- **Non-Admin Verification**: Includes a 1-click **`Verify Live HTTP 403 Guard`** button when logged in as a passenger (`ROLE_PASSENGER`) to prove server-side RBAC enforcement.
- **8 Operational CRUD Tabs (`ROLE_ADMIN`)**:
  1. **BMTC Routes (`bus_routes`)**: Create, edit, toggle active status, or delete corridors; fires `trg_bus_routes_after_insert/update/delete` into `audit_logs`.
  2. **BMTC Stops (`bus_stops`)**: Manage stop geolocation coordinates within MySQL `CHECK` bounds (`12.50..13.50 N, 77.20..78.00 E`).
  3. **Stop Sequences (`bus_route_stops`)**: Inspect and append/remove ordered `OUTBOUND` and `INBOUND` stops.
  4. **BMTC Fleet (`buses`)**: Assign vehicles (`ELECTRIC_NON_AC`, `VAJRA_VOLVO_AC`, `VAYU_VAJRA_AC`, `NON_AC_DIESEL`) and operational status.
  5. **Metro Stations (`metro_stations`)**: Manage stations across Purple, Green, and Yellow Lines.
  6. **Interchange Hubs (`transfer_points`)**: Configure skywalk distances, walking minutes, and transfer buffers.
  7. **Schedules & Tariffs (`schedules` & `fare_rules`)**: Edit peak/off-peak headways and distance-slab fares inline; updating a fare slab fires `trg_fare_rules_after_update` and reprices future routes immediately.
  8. **Reviews & Audit Logs (`feedback` & `audit_logs`)**: Moderate commuter reviews (`PENDING` / `REVIEWED` / `RESOLVED`) and inspect paginated MySQL trigger JSON diffs (`OLD` vs `NEW`).