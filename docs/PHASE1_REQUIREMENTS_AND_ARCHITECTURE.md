# Phase 1: Requirement Analysis, Use-Case Model & System Architecture
## Bengaluru TransitConnect - Integrated BMTC Bus & Namma Metro Journey Planning System

---

## 1. Problem Statement & Academic Objective

Bengaluru commuters rely on two major public transport backbones operated independently:
1. **BMTC (Bengaluru Metropolitan Transport Corporation)** - surface bus corridors (`Ordinary`, `Vajra AC`, `Vayu Vajra Airport`, and `Metro Feeder` services).
2. **Namma Metro (BMRCL)** - high-frequency rapid rail corridors (**Purple Line**: Challaghatta to Whitefield/Kadugodi; **Green Line**: Nagasandra/Madavara to Silk Institute).

Currently, planning a multi-modal trip (for example, **Silk Board Junction -> KR Puram Interchange via BMTC 500-D -> Whitefield via Namma Metro Purple Line**) requires checking separate maps, fare charts, and transfer distances manually.

**Bengaluru TransitConnect** solves this as a **MySQL 8 database-centric web platform** combining:
- Normalized relational storage (`3NF`) for stops, stations, routes, schedules, fare slabs, transfer hubs, users, wallets, and audit trails.
- Graph-based multi-modal pathfinding (**Dijkstra's Algorithm** & **BFS / Transfer-Weighted Search**) over relational transit edges loaded from MySQL.
- Interactive **Leaflet + OpenStreetMap** visualization with graceful manual fallback when GPS permission is denied.

---

## 2. Functional Requirements

| Module | ID | Requirement Summary | Actor |
|---|---|---|---|
| **Authentication & RBAC** | `FR-01` | Register, login/logout with BCrypt password hashing and JWT-protected REST endpoints. | Passenger, Admin |
| **Passenger Dashboard** | `FR-02` | Search origin/destination, detect GPS coordinates (or choose manually), view nearby BMTC stops & Metro stations via Haversine SQL calculation, and inspect recent history. | Passenger |
| **Multi-Modal Planner** | `FR-03` | Compute BMTC-only, Metro-only, and Combined (BMTC + Metro) routes with explicit `Walk + Bus + Metro + Waiting + Transfer` duration and slab-based fare breakdowns. | Passenger |
| **Route Optimization** | `FR-04` | Rank and filter candidate journeys by **Fastest Route** (min total time), **Cheapest Route** (min total fare), and **Minimum Transfers** (fewest mode/route switches). | Passenger |
| **Unified QR Pass (ACID)** | `FR-05` | Atomically debit `passenger_wallets`, persist `journey_plans` + `journey_legs`, and issue a verifiable `travel_history` QR pass with automatic `ROLLBACK` on insufficient balance. | Passenger |
| **Interactive Map** | `FR-06` | Render BMTC stops, Namma Metro Purple/Green stations, interchange callouts, and color-coded route polylines on OpenStreetMap via Leaflet. | Passenger |
| **Admin Studio** | `FR-07` | CRUD operations for bus routes, buses, stops, metro lines/stations, schedules, transfer hubs, and fare rules, with automatic MySQL `TRIGGER` logging into `audit_logs`. | Admin |
| **Analytics & Reports** | `FR-08` | SQL Views and aggregate reports for top searched corridors, busiest transfer hubs, mode split, average estimated travel duration, and passenger feedback ratings. | Admin |

---

## 3. Data Honesty & Non-Functional Requirements

1. **MySQL 8 Single Source of Truth**: Zero hardcoded JavaScript route arrays; every stop, line, edge, fare rule, and history record resides in MySQL 8.
2. **Clear Data Provenance Labels**:
   - `SCHEDULED` - Headway/first-last timings stored in `schedules`.
   - `ESTIMATED` - Calculated travel, walking, waiting, and transfer durations.
   - *No fabricated "live GPS bus telemetry"* is claimed without a real live feed.
3. **GPS-Denied Resilience**: Full station/stop search dropdown and map click-to-pin fallback whenever browser geolocation is declined.
4. **Environment-Driven Secrets**: Database URL, username, password, and JWT signing secret are injected via environment variables (`DB_URL`, `DB_USER`, `DB_PASS`, `JWT_SECRET`).

---

## 4. Use-Case Diagram (Mermaid)

~~~mermaid
flowchart LR
    P(["Passenger"])
    A(["Administrator"])

    subgraph BTC["Bengaluru TransitConnect Platform"]
        UC1("Register / Login (BCrypt + JWT)")
        UC2("Find Nearby BMTC Stops & Metro Stations")
        UC3("Plan Multi-Modal Journey (Fastest / Cheapest / Min Transfers)")
        UC4("Inspect Time, Fare & Map Polyline Breakdown")
        UC5("Book Unified Journey Pass (ACID Wallet Transaction)")
        UC6("Submit Route / Station Feedback")
        UC7("Manage Routes, Buses, Metro Stations & Transfers")
        UC8("Configure Fare Rules & Headway Schedules")
        UC9("Inspect SQL Analytics Views & Trigger Audit Logs")
    end

    P --> UC1
    P --> UC2
    P --> UC3
    P --> UC4
    P --> UC5
    P --> UC6

    A --> UC1
    A --> UC7
    A --> UC8
    A --> UC9
~~~

---

## 5. Three-Tier System Architecture Diagram

~~~mermaid
flowchart TB
    subgraph Client["Presentation Layer (React 18 + Vite + Tailwind CSS + Leaflet)"]
        UI_Dash["Passenger Dashboard & Route Cards"]
        UI_Map["Leaflet + OpenStreetMap Polyline View"]
        UI_Admin["Protected Admin Studio & SQL Analytics Charts"]
    end

    subgraph Server["Application Layer (Java 21 + Spring Boot 3 REST API)"]
        Sec["Spring Security + JWT Filter (ROLE_PASSENGER / ROLE_ADMIN)"]
        Ctrl["REST Controllers (/api/auth, /api/transit, /api/journeys, /api/admin, /api/analytics)"]
        Svc["Service Layer + Multi-Modal Graph Engine (Dijkstra + BFS)"]
        Repo["Spring Data JPA Repositories + Native SQL / Stored Proc Callers"]
    end

    subgraph DB["Persistence Layer (MySQL 8.x Relational DBMS)"]
        Tables["19 Normalized 3NF Tables (PK, FK, UNIQUE, CHECK)"]
        Views["SQL Views (v_popular_routes, v_hub_connectivity, v_mode_usage)"]
        Procs["Stored Procedures (sp_nearby_transit_nodes, sp_calculate_slab_fare)"]
        Trigs["Triggers (trg_bus_routes_audit, trg_fare_rules_audit, trg_wallet_guard)"]
    end

    UI_Dash <-->|"JSON over HTTP"| Sec
    UI_Map <-->|"GeoJSON / LatLng"| Sec
    UI_Admin <-->|"Admin JWT"| Sec
    Sec --> Ctrl --> Svc --> Repo
    Repo <-->|"JDBC / HikariCP Transactions"| Tables
    Repo --> Views
    Repo --> Procs
    Tables --> Trigs
~~~

---

## 6. GitHub-Ready Monorepo Directory Layout

~~~text
BengaluruTransitConnect/
|-- README.md
|-- .gitignore
|-- .env.example
|-- docs/
|   |-- PHASE1_REQUIREMENTS_AND_ARCHITECTURE.md
|   |-- PHASE2_ER_DIAGRAM_AND_NORMALIZATION.md
|   `-- API_DOCUMENTATION.md
|-- sql/
|   |-- 01_schema.sql                  # 3NF DDL, PK/FK/CHECK constraints & composite indexes
|   |-- 02_views_triggers_procs.sql    # Views, audit triggers & Haversine/fare stored procedures
|   |-- 03_seed_bengaluru_data.sql     # Verified Namma Metro Purple/Green + key BMTC corridors
|   `-- 04_viva_demo_queries.sql       # Ready-to-run JOINs, subqueries, EXPLAIN & ACID demos
|-- scripts/
|   |-- setup_mysql.ps1                # Detects or installs MySQL 8 on Windows & initializes DB
|   |-- run_backend.ps1                # Starts Java 21 Spring Boot server via Maven Wrapper
|   `-- run_frontend.ps1               # Starts Vite + React development server
|-- backend/                           # Java 21 + Spring Boot 3.4 layered REST API
|   |-- pom.xml
|   |-- mvnw.cmd
|   `-- src/
|       |-- main/java/com/bengaluru/transit/
|       |   |-- config/                # SecurityConfig, CorsConfig, JwtAuthenticationFilter
|       |   |-- controller/            # Auth, TransitNode, JourneyPlanner, Admin, Analytics
|       |   |-- dto/                   # Validated Request/Response DTOs
|       |   |-- entity/                # JPA Entities mapped cleanly to 3NF MySQL schema
|       |   |-- exception/             # GlobalExceptionHandler & ApiError payloads
|       |   |-- graph/                 # TransitGraphBuilder, DijkstraRouter & TransferOptimizer
|       |   |-- repository/            # JPA + Native SQL Repositories
|       |   `-- service/               # Transactional Business Services
|       `-- test/java/com/bengaluru/transit/
`-- frontend/                          # React 18 + Vite + Tailwind CSS + Leaflet
    |-- package.json
    |-- vite.config.js
    `-- src/
        |-- api/                       # Axios REST client with JWT interceptor
        |-- components/                # Navbar, RouteSearchPanel, RouteComparisonCard, TransitMap
        |-- context/                   # AuthContext & Geolocation fallback state
        `-- pages/                     # PlannerPage, NetworkMapPage, PassesPage, AnalyticsPage, AdminPage
~~~