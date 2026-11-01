# Phase 9: Comprehensive Automated Testing, Security Hardening & MySQL 8 Query Optimization

## 1. Automated 10-Test Full-Stack Integration Suite (`TransitConnectIntegrationTests.java`)

All 10 tests execute against **live MySQL 8 (`bengaluru_transit`)** via Spring Boot `MockMvc` + `JdbcTemplate` (zero in-memory H2 substitutes):

| Test ID | Test Method | Verified Requirement |
| :--- | :--- | :--- |
| **`t01`** | `t01_healthNetworkFareAndAnalyticsViewsReturnLiveMysqlData` | Verifies `/api/health`, `/api/transit/network` (`54` active transit nodes across `3` Metro lines, `8` BMTC routes, `12` interchange hubs), `/api/transit/fares` (`18` slabs), and `/api/analytics/dashboard` (`4` SQL `VIEW`s). |
| **`t02`** | `t02_geolocationStoredProcedureFindsNearestNodesAndRejectsInvalidCoords` | Verifies Haversine stored procedure `sp_find_nearby_transit_nodes` around Silk Board (`BUS_1`), graceful empty fallback (`[]`) when GPS is outside Bengaluru, and MySQL `chk_bus_stops_lat` (`HTTP 400`) when an admin submits out-of-bounds coordinates. |
| **`t03`** | `t03_multiModalOptimizerComputesFastestCheapestMinTransfersAndModeComparison` | Verifies `Walk + Bus + Metro + Wait + Transfer == Total Time` (`46 mins`, `Rs. 55.00`, `1 Transfer`), proves `COMBINED` beats `BUS_ONLY` and `METRO_ONLY`, verifies `CHEAPEST` (`Rs. 36.00`), and blocks identical Origin/Destination (`HTTP 400`). |
| **`t04`** | `t04_authRegistrationCreatesNcmcWalletBlocksDuplicatesAndRejectsBadPassword` | Verifies BCrypt registration, automatic `ROLE_PASSENGER` M:N link + `passenger_wallets` 1:1 creation (`Rs. 250.00`), duplicate email rejection, and invalid password rejection. |
| **`t05`** | `t05_rbacSecurityUnauthenticated401AndPassenger403Guards` | Proves unauthenticated calls to protected endpoints return `HTTP 401 Unauthorized`, while `ROLE_PASSENGER` calls to `/api/admin/**` return `HTTP 403 Forbidden`. |
| **`t06`** | `t06_acidSmartWalletInsufficientBalanceRollbackLeavesZeroSideEffects` | Verifies `kavya.nair@bengaluru.in` (`Rs. 35.00`) booking a `Rs. 55.00` pass rolls back atomically in `sp_book_unified_qr_pass` (`SIGNAL SQLSTATE '45000'`), leaving balance at `Rs. 35.00` and `travel_history` unchanged. |
| **`t07`** | `t07_acidSmartWalletTopUpAndUnifiedQrBookingCommitAtomically` | Registers a clean test commuter, tops up `+Rs. 100.00` (`Rs. 350.00`), computes a `Rs. 55.00` route, books an atomic `BTC-QR-...` pass (`Rs. 295.00` remaining), and verifies persistence in `GET /api/journeys/history`. |
| **`t08`** | `t08_passengerFeedbackValidationAndAdminModerationWorkflow` | Verifies Bean Validation blocks `rating = 6` (`HTTP 400`), accepts valid commuter reviews (`201 Created`, `PENDING`), and allows `ROLE_ADMIN` moderation to `RESOLVED`. |
| **`t09`** | `t09_adminCrudFiresMysqlTriggersInCommittedOrder` | Executes `POST` -> `PUT` -> `DELETE` on `/api/admin/bus-routes` and verifies MySQL triggers `trg_bus_routes_after_insert/update/delete` record `INSERT`, `UPDATE`, and `DELETE` JSON payloads in `audit_logs`. |
| **`t10`** | `t10_mysqlExplainPlansConfirmIndexUsageWithoutFullTableScans` | Runs `EXPLAIN` programmatically across 6 hot SQL queries and asserts `key IS NOT NULL` and `type != 'ALL'` (zero unindexed full table scans). |

---

## 2. Live MySQL 8 `EXPLAIN` Query Optimization Proof (`sql/05_explain_and_security_audit.sql`)

Across our **19 normalized tables**, `information_schema.table_constraints` confirms **89 active database constraints** (`31 CHECK`, `22 FOREIGN KEY`, `19 PRIMARY KEY`, `17 UNIQUE`).

| # | Query Purpose | Table | Chosen Index (`key`) | Access `type` | Examined `rows` | Full Scan Avoided? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Stop-to-Route Graph Adjacency | `bus_route_stops` | `idx_brs_stop_route` | `ref` | `10` | **Yes** |
| 2 | Ordered Route Timetable (`OUTBOUND`) | `bus_route_stops` | `uk_route_dir_seq` | `ref` | `10` | **Yes** (`Using index condition`) |
| 3 | Namma Metro Track Adjacency | `metro_connections` | `uk_metro_edge` | `ref` | `2` | **Yes** |
| 4 | Multi-Modal Skywalk Hub Lookup | `transfer_points` | `uk_bus_metro_transfer` | `ref` | `1` | **Yes** |
| 5 | Distance-Slab Fare Calculation | `fare_rules` | `idx_fare_lookup` | `range` | `4` | **Yes** (`Using index condition`) |
| 6 | Passenger QR Pass History Timeline | `travel_history` | `idx_th_user_date` | `ref` | `2` | **Yes** |

---

## 3. Application & Database Security Hardening Checklist

1. **Zero Hardcoded Secrets**: Database URL, credentials (`DB_USER`, `DB_PASS`), and `JWT_SECRET` are loaded from `.env` / environment variables (`application.properties` uses `${VAR:fallback}`).
2. **Least-Privilege Database Account**: Application connects as `'btc_app'@'localhost'` scoped exclusively to `bengaluru_transit.*` rather than MySQL `root`.
3. **Password Hashing**: Passwords are stored exclusively as **BCrypt (`$2a$10$`, strength 10)** hashes (`password_hash VARCHAR(255)`).
4. **Stateless JWT + Method/Path RBAC**: `SecurityConfig` enforces `SessionCreationPolicy.STATELESS`, returns structured JSON `401` and `403` responses, and restricts `/api/admin/**` to `ROLE_ADMIN`.
5. **SQL Injection Prevention**: Every Spring Data JPA query and `JdbcTemplate` call (`TransitSqlRepository`) uses bound `?` parameters (`PreparedStatement` / `CallableStatement`), never string concatenation.
6. **Defense-in-Depth Validation**: Jakarta Bean Validation (`@Valid`, `@NotBlank`, `@Min`, `@Max`, `@DecimalMin`) validates DTOs at the HTTP boundary, backed by 31 MySQL `CHECK` constraints and `BEFORE UPDATE` triggers (`trg_wallet_prevent_negative`) inside the storage engine.