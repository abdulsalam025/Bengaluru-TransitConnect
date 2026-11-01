# Bengaluru TransitConnect

**Multi-Modal Public Transport Route Optimizer, Unified NCMC QR Pass Wallet & MySQL 8 Transit Intelligence Platform for BMTC Bus + Namma Metro**

![Java 21](https://img.shields.io/badge/Java-21_LTS-2563EB?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot 3.4](https://img.shields.io/badge/Spring_Boot-3.4.3-16A34A?style=for-the-badge&logo=springboot&logoColor=white)
![MySQL 8](https://img.shields.io/badge/MySQL-8.x_(3NF_DBMS)-00758F?style=for-the-badge&logo=mysql&logoColor=white)
![React 18](https://img.shields.io/badge/React-18.3_+_Vite_5-0EA5E9?style=for-the-badge&logo=react&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-OpenStreetMap-7C3AED?style=for-the-badge&logo=leaflet&logoColor=white)
![Tests](https://img.shields.io/badge/Integration_Tests-12%2F12_Passing-059669?style=for-the-badge)

---

## 1. Overview & Real-World Bengaluru Problem Statement

Commuters in Bengaluru navigate two complementary public transit networks operated by separate agencies:
- **BMTC (Bengaluru Metropolitan Transport Corporation)**: High-frequency Ordinary, Electric, Vajra AC (`500-D`, `500-CA`, `335-E`, `201-R`), Metro Feeder (`MF-1`), and Vayu Vajra Airport (`KIA-8`) bus corridors.
- **BMRCL Namma Metro**: Rapid rail across the **Purple Line** (*Challaghatta - Whitefield (Kadugodi)*), **Green Line** (*Madavara - Silk Institute*), and **Yellow Line** (*RV Road - Bommasandra via Jayadeva, BTM Layout, Central Silk Board & Electronic City*, opened August 2025).

Because the Outer Ring Road **Blue Line (Phase 2A: Silk Board - KR Puram)** is still under construction, single-mode travel from **Silk Board Junction** to **Whitefield (Kadugodi)** either sits in full-corridor road traffic (`Bus-Only: 59 mins, Rs. 60`) or detours west through two Metro interchanges at RV Road and Majestic (`Metro-Only: Rs. 60, 2 transfers`). **Bengaluru TransitConnect** models both networks in a **20-table Third Normal Form (`3NF`) MySQL 8 database** (`31` Metro stations, `45` BMTC bus stops, `13` BMTC routes, `15` transfer hubs, `50` Bengaluru landmarks) and runs a **Multi-Criteria Ride-Leg Dijkstra Optimizer** to discover faster, cheaper multi-modal combinations such as **`BMTC 500-D` -> `KR Puram Skywalk` -> `Namma Metro Purple Line` (`46 mins | Rs. 55.00 | 1 Transfer`)** or **`BMS College of Engineering -> Phoenix Mall of Asia` (`46 mins | Rs. 25.00 | 3 min Walk via BMTC 285-M`)**.

### Key Engineering Highlights
- **MySQL 8 as Single Persistent Source of Truth**: `20` normalized (`1NF -> 2NF -> 3NF`) InnoDB tables (including `city_landmarks` with 50 real Bengaluru colleges, tech parks, hospitals, malls & neighborhoods), `93` integrity constraints, `4` analytical `VIEW`s, `5` `TRIGGER`s, `3` `STORED PROCEDURE`s, and `6` `EXPLAIN`-verified index access paths.
- **Specific-Place Door-to-Door Search & Low-Walk (`<= 10 min`) Nearest-Stop / Feeder Dijkstra**: Passengers are not restricted to fixed bus/metro dropdowns -- search **any specific place, college, hospital, tech park, mall, street, or map pin** in Bengaluru (`GET /api/transit/places` + OpenStreetMap Bengaluru geocoder + dual Origin/Destination Map Pins). Whenever a seeded BMTC/Metro stop lies within `<= 0.75 km` (`<= 10 min` walk), Dijkstra boards/alights directly at the exact nearest stop (`1-10 min` walk); for inner residential streets `> 0.75 km` from trunk corridors, it automatically connects via a **BMTC Local Feeder** stage hop (`4 min` walk + real MySQL `BMTC_ORDINARY` slab-fare feeder leg) so walking never balloons to 30-55 minutes.
- **Exact Door-to-Door Time & Slab-Fare Formula**:
  ~~~text
  Total Journey Time = Walking Time + Bus Ride Time + Metro Ride Time + Boarding Wait Time + Interchange Transfer Time
  ~~~
  Computes **Fastest Route**, **Cheapest Route**, and **Minimum Transfers**, plus side-by-side **Combined vs Bus-Only vs Metro-Only** comparison cards.
- **Interactive Leaflet + OpenStreetMap Cartography**: Color-coded polylines (`#2563EB` BMTC Bus, `#7C3AED` Purple Line, `#16A34A` Green Line, `#EAB308` Yellow Line, dashed `#F59E0B` Skywalk transfers), clickable station popups, and Browser Geolocation (`sp_find_nearby_transit_nodes`) with automatic manual fallback when GPS permission is denied.
- **ACID Smart Wallet & Unified QR Pass Booking**: Row-locked (`SELECT ... FOR UPDATE`) MySQL stored procedure `sp_book_unified_qr_pass` + `trg_wallet_prevent_negative` (`SIGNAL SQLSTATE '45000'`) ensuring atomic wallet deduction and QR pass issuance (`BTC-QR-...`).
- **Role-Based Access Control (`ROLE_PASSENGER` & `ROLE_ADMIN`)**: Stateless Spring Security JWT + BCrypt (`$2a$10$`), an 8-tab **Admin Transit Studio**, and an immutable MySQL trigger `audit_logs` JSON diff viewer.
- **Strict Data Honesty**: All corridors and headways are explicitly badged **`OFFICIAL_PUBLISHED`** or **`SCHEDULED_SAMPLE`**. No simulated GPS coordinates are ever misrepresented as live vehicle telemetry.

---

## 2. System Architecture, Use Case, ER & ACID Sequence Diagrams

### 2.1 Three-Tier System Architecture
~~~mermaid
flowchart LR
    subgraph Client["Presentation Tier (React 18 + Vite 5 + Tailwind + Leaflet)"]
        UI1["Journey Planner & Leaflet Map"]
        UI2["Network Explorer & Geolocation"]
        UI3["NCMC Wallet & Unified QR Passes"]
        UI4["SQL Views Analytics Studio"]
        UI5["ROLE_ADMIN Operations & Audit Studio"]
    end

    subgraph Server["Application Tier (Java 21 + Spring Boot 3.4.3)"]
        SEC["Spring Security Filter Chain\n(Stateless JWT + BCrypt + RBAC)"]
        CTRL["REST Controllers\n(/auth, /transit, /journeys, /analytics, /admin)"]
        ENG["TransitGraphEngine\n(Ride-Leg Dijkstra + BFS Optimizer)"]
        DAL["Spring Data JPA + JdbcTemplate\n(ddl-auto=validate, Bound Params)"]
    end

    subgraph DB["Persistence Tier (MySQL 8 - bengaluru_transit)"]
        TBL["19 Normalized 3NF Tables\n(89 PK/FK/UNIQUE/CHECK Constraints)"]
        VWS["4 SQL Analytical Views\n(JOIN + GROUP BY + LEFT JOIN)"]
        PRC["3 Stored Procedures\n(Haversine GPS, Slab Fare, ACID QR Pass)"]
        TRG["5 Database Triggers\n(Negative Wallet Guard + JSON Audit Logs)"]
    end

    Client -->|"REST JSON / Bearer JWT"| SEC --> CTRL
    CTRL --> ENG --> DAL
    CTRL --> DAL
    DAL -->|"HikariCP JDBC"| TBL
    DAL --> VWS
    DAL --> PRC
    TBL --> TRG
~~~

### 2.2 Actor Use Case Diagram
~~~mermaid
flowchart TB
    Guest["Guest Commuter"]
    Pass["Registered Passenger\n(ROLE_PASSENGER)"]
    Admin["Transit Administrator\n(ROLE_ADMIN)"]

    UC1(["Search Fastest / Cheapest / Min-Transfer Routes"])
    UC2(["Compare Combined vs Bus-Only vs Metro-Only"])
    UC3(["Locate Nearest Stops via GPS or Manual Fallback"])
    UC4(["Explore Metro Lines, BMTC Routes & Skywalk Hubs"])
    UC5(["View Live SQL Corridor & Mode-Share Analytics"])
    UC6(["Top Up NCMC Smart Wallet & Book ACID Unified QR Pass"])
    UC7(["Submit Route / Station Star Ratings & Feedback"])
    UC8(["Manage Routes, Stops, Fleet, Stations, Hubs & Tariffs"])
    UC9(["Moderate Reviews & Inspect MySQL Trigger Audit Logs"])

    Guest --> UC1
    Guest --> UC2
    Guest --> UC3
    Guest --> UC4
    Guest --> UC5

    Pass --> UC1
    Pass --> UC6
    Pass --> UC7

    Admin --> UC8
    Admin --> UC9
~~~

### 2.3 Normalized (`3NF`) 19-Table Entity-Relationship Diagram
~~~mermaid
erDiagram
    USERS ||--o{ USER_ROLES : "has"
    ROLES ||--o{ USER_ROLES : "assigned_to"
    USERS ||--|| PASSENGER_WALLETS : "owns_1_to_1"
    USERS ||--o{ JOURNEY_PLANS : "searches"
    USERS ||--o{ TRAVEL_HISTORY : "books"
    USERS ||--o{ FEEDBACK : "submits"
    USERS ||--o{ AUDIT_LOGS : "triggers"

    BUS_ROUTES ||--o{ BUSES : "operates_fleet"
    BUS_ROUTES ||--o{ BUS_ROUTE_STOPS : "orders_stops"
    BUS_STOPS ||--o{ BUS_ROUTE_STOPS : "served_by"
    BUS_ROUTES ||--o{ SCHEDULES : "bus_headways"
    BUS_ROUTES ||--o{ FEEDBACK : "rated_in"

    METRO_LINES ||--o{ METRO_STATIONS : "contains_ordered"
    METRO_LINES ||--o{ METRO_CONNECTIONS : "rail_segments"
    METRO_STATIONS ||--o{ METRO_CONNECTIONS : "connects_from_to"
    METRO_LINES ||--o{ SCHEDULES : "metro_headways"
    METRO_STATIONS ||--o{ FEEDBACK : "rated_in"

    BUS_STOPS ||--o{ TRANSFER_POINTS : "interchange_bus_end"
    METRO_STATIONS ||--o{ TRANSFER_POINTS : "interchange_metro_end"

    JOURNEY_PLANS ||--|{ JOURNEY_LEGS : "decomposed_into"
    JOURNEY_PLANS ||--o{ TRAVEL_HISTORY : "ticketed_as"
    FARE_RULES }o--|| JOURNEY_LEGS : "prices_distance_slab"
~~~

### 2.4 ACID Unified QR Pass Transaction Sequence (`sp_book_unified_qr_pass`)
~~~mermaid
sequenceDiagram
    participant C as React Commuter UI
    participant S as JourneyPlannerService
    participant M as MySQL 8 (InnoDB)
    participant T as trg_wallet_prevent_negative

    C->>S: POST /api/journeys/book { planId } (Bearer JWT)
    S->>M: CALL sp_book_unified_qr_pass(userId, planId, qrCode)
    Note over M: START TRANSACTION
    M->>M: SELECT wallet_id, balance_inr FROM passenger_wallets WHERE user_id = ? FOR UPDATE
    M->>M: SELECT estimated_fare_inr FROM journey_plans WHERE plan_id = ? LOCK IN SHARE MODE
    alt balance_inr < estimated_fare_inr
        M->>M: ROLLBACK + SIGNAL SQLSTATE '45000'
        M-->>S: SQLException (SQLState 45000)
        S-->>C: HTTP 400 Bad Request (Wallet untouched!)
    else balance_inr >= estimated_fare_inr
        M->>T: UPDATE passenger_wallets SET balance_inr = balance_inr - fare
        T-->>M: Balance >= 0 verified
        M->>M: INSERT INTO travel_history (qr_pass_code, fare_paid_inr, ...)
        Note over M: COMMIT
        M-->>S: out_history_id, out_remaining_inr
        S-->>C: HTTP 201 Created (BTC-QR-... Pass + Updated Balance)
    end
~~~

---

## 3. Multi-Modal Shortcut Benchmarks (Reducing Single-Mode Detours)

| Corridor & Origin Mode | Direct / Multi-Modal Shortcut (`COMBINED`) | Single-Mode Metro Detour (`METRO_ONLY`) | Time & Distance Saved |
| :--- | :--- | :--- | :--- |
| **Silk Board -> Whitefield (Kadugodi)** | `BMTC 500-D` -> `KR Puram Skywalk` -> `Purple Line` (**46 mins**, Rs. 55, `29.1 km`) | `Yellow` -> `RV Road` -> `Green` -> `Majestic` -> `Purple` (**71 mins**, Rs. 60, `36.8 km`) | **Saves 25 mins & 7.7 km** |
| **Hanumantha Nagar (GPS) -> Mysuru Road** | Direction-aware `0.5 km` walk -> `BMTC 60-A` -> `Mysuru Rd Hub` (**20 mins**, Rs. 12, `4.2 km`) | `2.04 km` walk -> `Jayanagar` -> `Majestic` loop -> `Mysuru Rd` (**55 mins**, Rs. 30, `15.0 km`) | **Saves 35 mins, Rs. 18 & 10.8 km** |
| **Jayanagar -> Mysuru Road** | `Jayanagar Hub` -> `BMTC 60-A` South-West diagonal (**22 mins**, Rs. 18, `6.4 km`) | `Green Line` north to `Majestic` -> `Purple Line` SW (**31 mins**, Rs. 30, `13.0 km`) | **Saves 9 mins, Rs. 12 & 6.5 km** |
| **Banashankari -> Kengeri** | `BMTC 401-K` West ORR -> `Mysuru Rd Hub` -> `Purple Line` (**35 mins**, Rs. 48, `13.6 km`) | `Green Line` to `Majestic` -> `Purple Line` to `Kengeri` (**44 mins**, Rs. 50, `22.2 km`) | **Saves 9 mins & 8.6 km** |

---

## 4. Database Inventory (`bengaluru_transit`)

| Category | Count | Details |
| :--- | :---: | :--- |
| **Normalized Tables (`3NF`)** | **19** | `roles`, `users`, `user_roles`, `passenger_wallets`, `bus_routes`, `buses`, `bus_stops`, `bus_route_stops`, `metro_lines`, `metro_stations`, `metro_connections`, `schedules`, `transfer_points`, `fare_rules`, `journey_plans`, `journey_legs`, `travel_history`, `feedback`, `audit_logs` |
| **Integrity Constraints** | **89** | `31 CHECK`, `22 FOREIGN KEY`, `19 PRIMARY KEY`, `17 UNIQUE` |
| **Analytical `VIEW`s** | **4** | `v_popular_searched_corridors`, `v_multimodal_hub_connectivity`, `v_transport_mode_usage_report`, `v_route_feedback_summary` |
| **Database `TRIGGER`s** | **5** | `trg_wallet_prevent_negative`, `trg_bus_routes_after_insert`, `trg_bus_routes_after_update`, `trg_bus_routes_after_delete`, `trg_fare_rules_after_update` |
| **`STORED PROCEDURE`s** | **3** | `sp_find_nearby_transit_nodes`, `sp_calculate_slab_fare`, `sp_book_unified_qr_pass` |
| **Verified `EXPLAIN` Plans** | **6** | `idx_brs_stop_route`, `uk_route_dir_seq`, `uk_metro_edge`, `uk_bus_metro_transfer`, `idx_fare_lookup`, `idx_th_user_date` (`0` full table scans) |

---

## 5. REST API Reference Summary (`http://localhost:8080/api`)

| Method & Endpoint | Auth | Purpose |
| :--- | :---: | :--- |
| `GET /api/health` | Public | Live MySQL 8 connectivity & active station/stop/route/hub counts |
| `POST /api/auth/register` | Public | Register commuter (`BCrypt`), assign `ROLE_PASSENGER` & `Rs. 250` NCMC wallet |
| `POST /api/auth/login` | Public | Authenticate user & issue stateless JWT access token |
| `GET /api/auth/me` | JWT | Current user profile, roles & live Smart Wallet balance |
| `GET /api/transit/network` | Public | Complete `58`-node Bengaluru transit graph, 3 Metro lines, 10 BMTC routes & 14 hubs |
| `GET /api/transit/bus-routes/{id}/stops` | Public | Ordered `OUTBOUND` / `INBOUND` stops & cumulative km for a BMTC route |
| `GET /api/transit/nearby?lat=&lng=` | Public | Executes `sp_find_nearby_transit_nodes` Haversine search (empty `[]` fallback outside city) |
| `GET /api/transit/fares` | Public | Distance-slab tariff matrix (`BMTC_ORDINARY`, `BMTC_VAJRA_AC`, `BMTC_VAYU_VAJRA`, `NAMMA_METRO`) |
| `POST /api/journeys/search` | Optional JWT | Multi-modal Ride-Leg Dijkstra search + mode comparison + persistence to `journey_plans` |
| `POST /api/journeys/book` | JWT | Executes ACID `sp_book_unified_qr_pass` (`FOR UPDATE` lock) & returns `BTC-QR-...` pass |
| `POST /api/journeys/wallet/topup` | JWT | Adds funds (`Rs. 10 - Rs. 5,000`) to commuter NCMC Smart Wallet |
| `GET /api/journeys/history` | JWT | Commuter Smart Wallet summary, booked QR passes & recent searches |
| `GET /api/feedback` / `POST /api/feedback` | Public / JWT | Paginated commuter ratings (`1-5` stars) for BMTC routes, Metro stations & planner |
| `GET /api/analytics/dashboard` | Public | Live reporting across all 4 MySQL `VIEW`s |
| `GET /api/admin/inventory` | `ROLE_ADMIN` | Full master inventory for routes, stops, fleet, Metro stations, hubs, schedules & tariffs |
| `POST/PUT/DELETE /api/admin/**` | `ROLE_ADMIN` | Full CRUD across `bus-routes`, `bus-stops`, `route-stops`, `buses`, `metro-stations`, `transfer-points`, `schedules`, `fare-rules` & `feedback/{id}/moderate` |
| `GET /api/admin/audit-logs` | `ROLE_ADMIN` | Paginated immutable JSON diff trail populated by MySQL triggers |

---

## 6. Repository Structure

~~~text
BengaluruTransitConnect/
|-- .env.example                                  # Environment variable template (safe to commit)
|-- .gitignore                                    # Excludes .env, target/, node_modules/, dist/
|-- LICENSE                                       # MIT License
|-- README.md                                     # Project documentation & Mermaid architecture diagrams
|-- sql/
|   |-- 01_schema.sql                             # 19 normalized 3NF tables & 89 constraints
|   |-- 02_views_triggers_procs.sql               # 4 Views, 5 Triggers & 3 Stored Procedures
|   |-- 03_seed_bengaluru_data.sql                # Verified 2026 Bengaluru BMTC & Namma Metro dataset
|   |-- 04_viva_demo_queries.sql                  # 10 SQL queries (JOINs, Subqueries, HAVING, Views, Procs)
|   `-- 05_explain_and_security_audit.sql         # 6 EXPLAIN index proofs & constraint count audit
|-- backend/                                      # Java 21 + Spring Boot 3.4.3 REST API (Maven Wrapper)
|   |-- pom.xml
|   |-- mvnw / mvnw.cmd
|   `-- src/
|       |-- main/java/com/bengaluru/transit/      # 60 classes (config, controller, dto, entity, engine, repo, service)
|       |-- main/resources/application.properties # Externalized .env config & ddl-auto=validate
|       `-- test/java/com/bengaluru/transit/      # 10 live MySQL + MockMvc + ACID + RBAC integration tests
|-- frontend/                                     # React 18 + Vite 5 + Tailwind CSS 3 + Leaflet 1.9.4
|   |-- package.json / vite.config.js
|   `-- src/
|       |-- api/transitApi.js                     # Typed fetch wrapper with Bearer JWT & error parsing
|       |-- context/AuthContext.jsx               # Session persistence & Smart Wallet refresh
|       `-- components/                           # Planner, Leaflet Map, Explorer, Wallet, Analytics, Admin Studio
|-- scripts/                                      # Windows PowerShell 5.1 / 7 Automation Scripts
|   |-- setup_mysql.ps1                           # Installs/configures MySQL 8, user btc_app & .env
|   |-- apply_sql.ps1                             # Loads schema, views/triggers/procs & seed data
|   |-- test_backend.ps1                          # Runs 10 JUnit 5 + MySQL integration tests
|   |-- run_backend.ps1                           # Starts Spring Boot API server on :8080
|   |-- run_frontend.ps1                          # Starts Vite React dev server on :5173
|   |-- start_all.ps1                             # Launches full stack (:8080 + :5173) & opens browser
|   |-- verify_phase9_all.ps1                     # 3-Tier verifier (MySQL EXPLAIN + JUnit 10/10 + Vite build)
|   `-- prepare_github_repo.ps1                   # Verifies .env secret hygiene & initializes Git repo
`-- docs/                                         # Phase-by-phase engineering & viva defense manuals
    |-- PHASE1_REQUIREMENTS_AND_ARCHITECTURE.md
    |-- PHASE2_ER_DIAGRAM_AND_NORMALIZATION.md
    |-- PHASE4_6_BACKEND_AND_ROUTING_ENGINE.md
    |-- PHASE5_7_FRONTEND_AND_LEAFLET_MAP.md
    |-- PHASE8_ADMIN_STUDIO_AND_ANALYTICS.md
    |-- PHASE9_TESTING_SECURITY_AND_QUERY_OPTIMIZATION.md
    `-- PHASE10_DIAGRAMS_DEPLOYMENT_AND_VIVA_GUIDE.md
~~~

---

## 7. Quick Start on Windows 10 / 11 (PowerShell)

### Prerequisites
- **Java 21 LTS** (`java -version`)
- **Node.js 20+ / 22 LTS** (`node -v`)
- **MySQL Server 8.x** (`scripts\setup_mysql.ps1` can install `Oracle.MySQL` via `winget` if missing)

### Step 1: Provision MySQL 8 Database & `.env`
~~~powershell
powershell -ExecutionPolicy Bypass -File "$HOME\BengaluruTransitConnect\scripts\setup_mysql.ps1"
powershell -ExecutionPolicy Bypass -File "$HOME\BengaluruTransitConnect\scripts\apply_sql.ps1"
~~~

### Step 2: Run the 3-Tier Automated Verification Suite (MySQL `EXPLAIN` + 10/10 JUnit Tests + Vite Build)
~~~powershell
powershell -ExecutionPolicy Bypass -File "$HOME\BengaluruTransitConnect\scripts\verify_phase9_all.ps1"
~~~

### Step 3: Launch the Full Application (`:8080` Backend + `:5173` Frontend)
~~~powershell
powershell -ExecutionPolicy Bypass -File "$HOME\BengaluruTransitConnect\scripts\start_all.ps1"
~~~
Open **`http://localhost:5173`** in your browser.

---

## 8. Seeded Demo Accounts (`sql/03_seed_bengaluru_data.sql`)

| Role | Email | Password | Smart Card | Initial Balance & Viva Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Transit Admin (`ROLE_ADMIN`)** | `admin@transitconnect.in` | `Admin@123` | `BTC-NCMC-0001` | **Rs. 1,500.00** - Unlocks 8-tab Admin CRUD Studio & Trigger Audit Logs |
| **Commuter (`ROLE_PASSENGER`)** | `arjun.rao@bengaluru.in` | `Pass@123` | `BTC-NCMC-1002` | **Rs. 450.00** - Demonstrates atomic Unified QR Pass booking (`BTC-QR-...`) |
| **Rollback Test (`ROLE_PASSENGER`)** | `kavya.nair@bengaluru.in` | `Pass@123` | `BTC-NCMC-1003` | **Rs. 35.00** - Demonstrates ACID rollback when booking a Rs. 55.00 journey |

---

## 9. License

Released under the [MIT License](LICENSE).