# Phase 2: ER Diagram, 3NF Relational Schema & Normalization Proof
## Bengaluru TransitConnect (MySQL 8.x)

---

## 1. Relationship Cardinality Design (Viva Showcase)

To satisfy strict relational database evaluation criteria, the schema explicitly models **all three cardinalities**:

1. **One-to-One (`1:1`)**:
   - `users (1) <---> (1) passenger_wallets` (`passenger_wallets.user_id` is both `UNIQUE` and a `FOREIGN KEY` referencing `users.user_id`). Isolates high-concurrency financial wallet locks (`SELECT ... FOR UPDATE`) from user profile updates.
2. **One-to-Many (`1:N`)**:
   - `metro_lines (1) ---> (N) metro_stations`
   - `bus_routes (1) ---> (N) buses`
   - `journey_plans (1) ---> (N) journey_legs`
   - `users (1) ---> (N) travel_history`, `feedback`, `audit_logs`
3. **Many-to-Many (`M:N`)**:
   - `users (M) <---> (N) roles` resolved via junction table **`user_roles (user_id, role_id)`**.
   - `bus_routes (M) <---> (N) bus_stops` resolved via junction table **`bus_route_stops (route_id, stop_id, direction, stop_sequence, ...)`**.
   - `bus_stops (M) <---> (N) metro_stations` resolved via multi-modal **`transfer_points`**.

---

## 2. Entity-Relationship (ER) Diagram (Mermaid)

~~~mermaid
erDiagram
    USERS ||--o| PASSENGER_WALLETS : "owns (1:1)"
    USERS ||--o{ USER_ROLES : "assigned"
    ROLES ||--o{ USER_ROLES : "grants"
    USERS ||--o{ JOURNEY_PLANS : "searches"
    USERS ||--o{ TRAVEL_HISTORY : "books"
    USERS ||--o{ FEEDBACK : "submits"
    USERS ||--o{ AUDIT_LOGS : "triggers"

    BUS_ROUTES ||--o{ BUSES : "operates (1:N)"
    BUS_ROUTES ||--o{ BUS_ROUTE_STOPS : "traverses"
    BUS_STOPS ||--o{ BUS_ROUTE_STOPS : "served_by"
    BUS_ROUTES ||--o{ SCHEDULES : "runs_on"

    METRO_LINES ||--o{ METRO_STATIONS : "contains (1:N)"
    METRO_LINES ||--o{ SCHEDULES : "runs_on"
    METRO_STATIONS ||--o{ METRO_CONNECTIONS : "from_station"
    METRO_STATIONS ||--o{ METRO_CONNECTIONS : "to_station"

    BUS_STOPS ||--o{ TRANSFER_POINTS : "links_bus_stop"
    METRO_STATIONS ||--o{ TRANSFER_POINTS : "links_metro_station"

    JOURNEY_PLANS ||--|{ JOURNEY_LEGS : "decomposes_into (1:N)"
    JOURNEY_PLANS ||--o{ TRAVEL_HISTORY : "recorded_as"

    USERS {
        BIGINT user_id PK
        VARCHAR full_name
        VARCHAR email UK
        VARCHAR phone UK
        VARCHAR password_hash
        BOOLEAN is_active
        DATETIME created_at
    }
    ROLES {
        INT role_id PK
        VARCHAR role_name UK
    }
    USER_ROLES {
        BIGINT user_id PK,FK
        INT role_id PK,FK
    }
    PASSENGER_WALLETS {
        BIGINT wallet_id PK
        BIGINT user_id UK,FK
        VARCHAR smart_card_no UK
        DECIMAL balance_inr
        DATETIME updated_at
    }
    BUS_ROUTES {
        BIGINT route_id PK
        VARCHAR route_number UK
        VARCHAR route_name
        ENUM service_type
        VARCHAR origin_name
        VARCHAR destination_name
        BOOLEAN is_active
    }
    BUSES {
        BIGINT bus_id PK
        BIGINT route_id FK
        VARCHAR registration_no UK
        ENUM bus_type
        INT seating_capacity
        ENUM operational_status
    }
    BUS_STOPS {
        BIGINT stop_id PK
        VARCHAR stop_code UK
        VARCHAR stop_name
        VARCHAR area_name
        DECIMAL latitude
        DECIMAL longitude
        BOOLEAN is_interchange_hub
    }
    BUS_ROUTE_STOPS {
        BIGINT id PK
        BIGINT route_id FK
        BIGINT stop_id FK
        ENUM direction
        INT stop_sequence
        DECIMAL distance_from_start_km
        INT travel_mins_from_prev
    }
    METRO_LINES {
        INT line_id PK
        VARCHAR line_code UK
        VARCHAR line_name
        VARCHAR color_hex
        DECIMAL total_length_km
    }
    METRO_STATIONS {
        BIGINT station_id PK
        VARCHAR station_code UK
        VARCHAR station_name
        INT line_id FK
        INT station_order
        DECIMAL latitude
        DECIMAL longitude
        BOOLEAN is_interchange
    }
    METRO_CONNECTIONS {
        BIGINT connection_id PK
        BIGINT from_station_id FK
        BIGINT to_station_id FK
        INT line_id FK
        DECIMAL distance_km
        INT travel_time_mins
        BOOLEAN is_interchange_walk
    }
    SCHEDULES {
        BIGINT schedule_id PK
        ENUM transport_mode
        BIGINT bus_route_id FK
        INT metro_line_id FK
        ENUM day_type
        TIME first_service_time
        TIME last_service_time
        INT peak_headway_mins
        INT offpeak_headway_mins
    }
    TRANSFER_POINTS {
        BIGINT transfer_id PK
        VARCHAR hub_name
        BIGINT bus_stop_id FK
        BIGINT metro_station_id FK
        INT walking_distance_m
        INT walking_time_mins
        INT transfer_buffer_mins
    }
    FARE_RULES {
        BIGINT fare_rule_id PK
        ENUM service_category
        DECIMAL min_distance_km
        DECIMAL max_distance_km
        DECIMAL fare_inr
        VARCHAR source_note
    }
    JOURNEY_PLANS {
        BIGINT plan_id PK
        BIGINT user_id FK
        VARCHAR source_name
        VARCHAR destination_name
        ENUM optimization_type
        INT walking_time_mins
        INT bus_time_mins
        INT metro_time_mins
        INT waiting_time_mins
        INT transfer_time_mins
        INT total_time_mins
        DECIMAL estimated_fare_inr
        INT transfer_count
    }
    JOURNEY_LEGS {
        BIGINT leg_id PK
        BIGINT plan_id FK
        INT leg_order
        ENUM leg_mode
        VARCHAR route_or_line_code
        VARCHAR from_point_name
        VARCHAR to_point_name
        DECIMAL distance_km
        INT duration_mins
        DECIMAL leg_fare_inr
    }
    TRAVEL_HISTORY {
        BIGINT history_id PK
        BIGINT user_id FK
        BIGINT plan_id FK
        VARCHAR qr_pass_code UK
        DECIMAL fare_paid_inr
        ENUM pass_status
        DATETIME travelled_at
    }
    FEEDBACK {
        BIGINT feedback_id PK
        BIGINT user_id FK
        ENUM target_type
        BIGINT bus_route_id FK
        BIGINT metro_station_id FK
        TINYINT rating
        TEXT comments
        ENUM review_status
    }
    AUDIT_LOGS {
        BIGINT log_id PK
        BIGINT actor_user_id FK
        VARCHAR table_name
        VARCHAR operation_type
        VARCHAR record_identifier
        JSON old_payload
        JSON new_payload
        DATETIME created_at
    }
~~~

---

## 3. Complete 19-Table Inventory

| # | Table Name | Primary Key | Key Foreign Keys & Constraints | Purpose |
|---:|---|---|---|---|
| 1 | `roles` | `role_id` | `UNIQUE(role_name)` | RBAC role definitions (`ROLE_PASSENGER`, `ROLE_ADMIN`) |
| 2 | `users` | `user_id` | `UNIQUE(email)`, `UNIQUE(phone)` | Authenticated passenger & admin accounts |
| 3 | `user_roles` | `(user_id, role_id)` | FKs -> `users`, `roles` | `M:N` user-to-role mapping |
| 4 | `passenger_wallets` | `wallet_id` | `UNIQUE(user_id)` FK -> `users`, `CHECK(balance_inr >= 0)` | `1:1` transit wallet for ACID pass booking |
| 5 | `bus_routes` | `route_id` | `UNIQUE(route_number)` | BMTC route master (`500-D`, `335-E`, `KIA-8`, etc.) |
| 6 | `buses` | `bus_id` | FK -> `bus_routes`, `UNIQUE(registration_no)` | Assigned BMTC vehicles (`KA-57-F-...`) |
| 7 | `bus_stops` | `stop_id` | `UNIQUE(stop_code)`, `INDEX(latitude, longitude)` | Geolocation & metadata of BMTC stops |
| 8 | `bus_route_stops` | `id` | FKs -> `bus_routes`, `bus_stops`; `UNIQUE(route_id, direction, stop_sequence)` | Ordered `M:N` stop sequence & inter-stop timings |
| 9 | `metro_lines` | `line_id` | `UNIQUE(line_code)` | Namma Metro Purple & Green Line metadata |
| 10 | `metro_stations` | `station_id` | FK -> `metro_lines`, `UNIQUE(station_code)` | Ordered Namma Metro stations & coordinates |
| 11 | `metro_connections` | `connection_id` | FKs -> `metro_stations (from, to)`, `metro_lines` | Directed rail & interchange graph edges |
| 12 | `schedules` | `schedule_id` | FKs -> `bus_routes` / `metro_lines` | Scheduled first/last train-bus & peak/off-peak headways |
| 13 | `transfer_points` | `transfer_id` | FKs -> `bus_stops`, `metro_stations` | Multi-modal walking distance & buffer times at hubs |
| 14 | `fare_rules` | `fare_rule_id` | `CHECK(max_distance_km > min_distance_km)` | Distance-slab fares by service category |
| 15 | `journey_plans` | `plan_id` | FK -> `users` (nullable for guest searches) | Computed total journey breakdown & optimization type |
| 16 | `journey_legs` | `leg_id` | FK -> `journey_plans`, `UNIQUE(plan_id, leg_order)` | Step-by-step walk/bus/metro/transfer segments |
| 17 | `travel_history` | `history_id` | FKs -> `users`, `journey_plans`, `UNIQUE(qr_pass_code)` | Booked passes & passenger trip logs |
| 18 | `feedback` | `feedback_id` | FKs -> `users`, `bus_routes`, `metro_stations`, `CHECK(rating BETWEEN 1 AND 5)` | Passenger reviews & admin moderation |
| 19 | `audit_logs` | `log_id` | FK -> `users` (nullable for DB trigger actor) | Immutable audit trail populated by MySQL Triggers |

---

## 4. Step-by-Step Normalization Proof (`UNF -> 1NF -> 2NF -> 3NF`)

### Unnormalized Form (`UNF`) - Why Naive Design Fails
Imagine storing an entire BMTC route in a single spreadsheet-style table:
`raw_transit_sheet(route_number, service_type, depot_name, depot_phone, stop_names_csv, stop_coords_csv, bus_reg_numbers_csv)`
- Violates atomicity (`stop_names_csv = "Silk Board, Agara, Bellandur, Marathahalli, KR Puram"`).
- Cannot query *"all routes passing through Marathahalli"* with an index.

### First Normal Form (`1NF`) - Atomic Values & Repeating Groups Removed
Flatten repeating stops into atomic rows with composite primary key `(route_id, direction, stop_sequence)`:
`route_stop_1nf(route_id, direction, stop_sequence, route_number, service_type, stop_id, stop_name, stop_lat, stop_lng, travel_mins)`
- **Remaining Anomaly (Partial Dependency)**: `route_number` and `service_type` depend *only* on `route_id` (part of the composite key), not on `(route_id, direction, stop_sequence)`. Updating `service_type` would require updating 30 rows!

### Second Normal Form (`2NF`) - Eliminate Partial Dependencies
Decompose partial dependencies into separate master relations:
- `bus_routes(route_id PK, route_number, route_name, service_type, ...)`
- `bus_stops(stop_id PK, stop_code, stop_name, area_name, latitude, longitude, ...)`
- `bus_route_stops(id PK, route_id FK, stop_id FK, direction, stop_sequence, distance_from_start_km, travel_mins_from_prev)`

### Third Normal Form (`3NF` / `BCNF`) - Eliminate Transitive Dependencies
Check non-key -> non-key transitive functional dependencies:
1. In `metro_stations`: if `line_name` and `color_hex` were stored inside `metro_stations`, we would have `station_id -> line_id -> (line_name, color_hex)`. Moving `(line_name, color_hex)` into **`metro_lines`** removes the transitive dependency.
2. In `journey_plans`: storing calculated distance-slab fare policies inside every route would duplicate tariff slabs (`service_category, distance_km -> fare_inr`). Extracting **`fare_rules`** ensures updating a BMTC/Metro slab updates future fare calculations in one place while `travel_history.fare_paid_inr` preserves historical paid amounts accurately.
3. Every determinant in our 19 tables is a candidate key (**3NF / BCNF satisfied**).