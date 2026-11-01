# Phase 10: Complete Diagrams, Viva-Voce Defense Guide & Production Deployment Manual

## 1. 5-Minute Live Examiner Demonstration Script

Follow this exact 6-step sequence during your DBMS lab evaluation or viva:

1. **Multi-Modal Routing & Leaflet Visualization (`Journey Planner`)**:
   - Select **Origin**: `Silk Board Junction (BMTC-SLKB)` and **Destination**: `Whitefield (Kadugodi) (PUR-14)`.
   - Click **Find Multi-Modal Routes** -> point out **46 min Total | Rs. 55.00 | 1 Transfer**:
     - `BMTC 500-D` (`19m` bus + `4m` wait, `Rs. 25`) + `KR Puram Skywalk` (`4m` transfer) + `Namma Metro Purple Line` (`15m` rail + `4m` wait, `Rs. 30`) -> `46m` exact sum (`Walk + Bus + Metro + Wait + Transfer`).
   - Toggle **Cheapest (`Rs. 36.00`)**, **Bus-Only (`59m | Rs. 60.00`)**, and **Metro-Only (`Rs. 60.00`)** to prove how multi-modal routing beats single-mode options while ORR Blue Line 2A is still under construction.
2. **GPS Denial & Manual Fallback**:
   - Click **Use My GPS** -> click **Deny** (or test outside Bengaluru) -> show that the app cleanly retains manual stop selection and displays Haversine distance (`sp_find_nearby_transit_nodes`) when coordinates are in Bengaluru.
3. **ACID Rollback Proof (`Kavya Nair` - Insufficient Smart Wallet)**:
   - Click **Sign In** -> select quick-fill **`Kavya (Rs. 35 Rollback Test)`** (`kavya.nair@bengaluru.in` / `Pass@123`).
   - Click **Book Unified QR Pass (Rs. 55)** -> show the live MySQL stored procedure rollback banner (`Insufficient Smart Wallet balance`) and confirm Kavya's balance remains untouched at **Rs. 35.00**.
4. **ACID Commit Proof (`Arjun Rao` - Row-Locked NCMC Deduction + QR Token)**:
   - Switch to **`Passenger (Arjun - Rs. 450)`** (`arjun.rao@bengaluru.in` / `Pass@123`).
   - Click **Book Unified QR Pass (Rs. 55)** -> display the generated **`BTC-QR-...`** modal and verify Arjun's wallet atomically updates to **Rs. 395.00** in **My Passes & Wallet**.
5. **SQL Views Analytics (`SQL Analytics` Tab)**:
   - Open **SQL Analytics** -> click **`Inspect SQL`** on `v_popular_searched_corridors`, `v_transport_mode_usage_report`, `v_multimodal_hub_connectivity`, and `v_route_feedback_summary` (pointing out the `0 Reviews (LEFT JOIN)` badge).
6. **Spring Security RBAC + MySQL Trigger Audit Trail (`Admin Studio` Tab)**:
   - While still signed in as Arjun (`ROLE_PASSENGER`), click **Admin Studio** -> click **`Verify Live HTTP 403 Guard`** to display live server-side `HTTP 403 Forbidden`.
   - Sign in as **`Transit Admin (RBAC)`** (`admin@transitconnect.in` / `Admin@123`) -> create or edit a BMTC route or fare slab -> open **Reviews & Audit Logs** to display the JSON `OLD` and `NEW` payloads automatically recorded by MySQL triggers (`trg_bus_routes_after_*`, `trg_fare_rules_after_update`).

---

## 2. Top 12 DBMS Viva-Voce Questions & Exact Technical Answers

1. **Why is your schema in Third Normal Form (`3NF`), and how did you eliminate transitive dependencies?**
   - Every table has an atomic primary key (`1NF`), non-key columns in composite junction tables (`bus_route_stops`, `user_roles`) depend on the whole key (`2NF`), and transitive dependencies were decomposed into separate parent relations (`metro_stations.line_id -> metro_lines` instead of repeating `line_name` and `color_hex` in every station row; `fare_rules` separated from `bus_routes`).
2. **Where did you implement `1:1`, `1:N`, and `M:N` relationships?**
   - **`1:1`**: `users <-> passenger_wallets` (`UNIQUE (user_id)` FK).
   - **`1:N`**: `metro_lines -> metro_stations`, `bus_routes -> buses`, `journey_plans -> journey_legs`, `users -> travel_history`.
   - **`M:N`**: `users <-> roles` via `user_roles`, and `bus_routes <-> bus_stops` via ordered `bus_route_stops`.
3. **Why did you set `spring.jpa.hibernate.ddl-auto=validate` instead of `update`?**
   - In a true DBMS architecture, explicit SQL DDL (`sql/01_schema.sql` and `sql/02_views_triggers_procs.sql`) is the authoritative source of truth for `CHECK` constraints, `VIEW`s, `TRIGGER`s, `STORED PROCEDURE`s, and composite indexes. `validate` guarantees Hibernate entities match MySQL columns without silently altering schema definitions.
4. **How does `sp_book_unified_qr_pass` guarantee ACID properties under concurrent bookings?**
   - **Atomicity**: Uses `START TRANSACTION` with `DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;`.
   - **Consistency**: Enforces balance >= fare and fires `trg_wallet_prevent_negative` (`CHECK (balance_inr >= 0.00)`).
   - **Isolation**: Acquires a pessimistic row lock (`SELECT wallet_id, balance_inr FROM passenger_wallets WHERE user_id = p_user_id FOR UPDATE`) so two simultaneous tabs cannot double-spend the same balance.
   - **Durability**: Committed changes to `passenger_wallets` and `travel_history` persist in InnoDB redo/tablespace logs.
5. **What is the difference between `INNER JOIN` and `LEFT JOIN` in your project?**
   - `v_multimodal_hub_connectivity` uses `INNER JOIN` between `transfer_points`, `bus_stops`, and `metro_stations` because a hub must have both endpoints, whereas `v_route_feedback_summary` uses `bus_routes LEFT JOIN feedback` so newly added or unreviewed BMTC routes still appear with `total_reviews = 0` and `avg_rating = 0.00`.
6. **Why does `TransitGraphEngine` build Ride-Leg edges instead of hop-by-hop edges?**
   - In public transit, distance-slab fares (`BMTC_ORDINARY`, `NAMMA_METRO`) are non-linear: riding 12.2 km on Purple Line costs Rs. 30 total, NOT Rs. 10 multiplied by 4 individual station hops, and boarding wait time (`peak_headway / 2`) is incurred only once per vehicle boarding. Ride-Leg edges compute exact cumulative distance, exact slab fare, and exact single boarding wait for every `(boarding_stop -> alighting_stop)` pair!
7. **How do your MySQL triggers work without application-side logging code?**
   - `trg_bus_routes_after_insert`, `trg_bus_routes_after_update`, `trg_bus_routes_after_delete`, and `trg_fare_rules_after_update` run inside MySQL (`AFTER INSERT/UPDATE/DELETE`) using `JSON_OBJECT(...)` over `OLD` and `NEW` row references, capturing changes even if an administrator modifies data directly in MySQL Workbench.
8. **How did you verify that your SQL queries do not perform full table scans?**
   - `sql/05_explain_and_security_audit.sql` and JUnit test `t10` run `EXPLAIN` across our 6 core queries, confirming `type = ref` or `range` via `idx_brs_stop_route`, `uk_route_dir_seq`, `uk_metro_edge`, `uk_bus_metro_transfer`, `idx_fare_lookup`, and `idx_th_user_date`.
9. **How does geolocation work if the user denies browser GPS permission?**
   - `navigator.geolocation.getCurrentPosition` errors are caught gracefully in `JourneyPlannerView.jsx`, switching the UI to manual searchable origin/destination selection or 6 Bengaluru landmark presets without breaking route computation.
10. **Are live bus locations simulated or faked?**
    - **No.** Every corridor and timetable carries an explicit `dataConfidence` label (`OFFICIAL_PUBLISHED` or `SCHEDULED_SAMPLE`), and estimated travel durations are clearly labeled as schedule/headway-derived estimates.
11. **How are passwords and admin APIs secured?**
    - Passwords use BCrypt (`$2a$10$`), authentication uses stateless HMAC-SHA JWT tokens, and Spring Security enforces `hasRole('ADMIN')` on `/api/admin/**` (`HTTP 401` when unauthenticated, `HTTP 403` when authenticated as `ROLE_PASSENGER`).
12. **How are SQL injection attacks prevented?**
    - All JPA repositories and `JdbcTemplate` queries (`TransitSqlRepository`) bind user inputs exclusively via `?` prepared/callable statement parameters.

---

## 3. Production Packaging & Deployment Commands

### Build Self-Contained Spring Boot Executable JAR
~~~powershell
cd "$HOME\BengaluruTransitConnect\backend"
.\mvnw.cmd clean package -DskipTests
java -jar target\transit-connect-backend-1.0.0.jar
~~~

### Build Optimized Static Frontend Bundle (`frontend/dist`)
~~~powershell
cd "$HOME\BengaluruTransitConnect\frontend"
npm.cmd run build
npx vite preview --host 0.0.0.0 --port 4173
~~~