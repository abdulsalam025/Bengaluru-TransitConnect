# Phase 4 & Phase 6: Spring Boot 3.4 Backend & Multi-Modal Graph Optimization Engine

## 1. Layered Backend Architecture (`backend/src/main/java/com/bengaluru/transit`)

| Package | Responsibility | Key Classes |
| :--- | :--- | :--- |
| `config/` | Stateless JWT security, BCrypt hashing, CORS, RBAC (`ROLE_PASSENGER`, `ROLE_ADMIN`) | `SecurityConfig`, `JwtService`, `JwtAuthenticationFilter`, `AuthenticatedUser` |
| `entity/` | 18 JPA entities mapped 1-to-1 to MySQL 8 normalized (`3NF`) tables (`ddl-auto=none`) | `User`, `Role`, `PassengerWallet`, `BusRoute`, `Bus`, `BusStop`, `BusRouteStop`, `MetroLine`, `MetroStation`, `MetroConnection`, `Schedule`, `TransferPoint`, `FareRule`, `JourneyPlan`, `JourneyLeg`, `TravelHistory`, `Feedback`, `AuditLog` |
| `repository/` | 17 Spring Data JPA interfaces + `JdbcTemplate` Stored Procedure & View caller | `*Repository`, `TransitSqlRepository` |
| `graph/` | Phase 6 Multi-Modal Ride-Leg Graph & Dijkstra/BFS Optimizer | `TransitGraphEngine` |
| `service/` | `@Transactional` business logic, wallet top-ups, ACID QR pass booking, Admin CRUD | `AuthService`, `TransitNetworkService`, `JourneyPlannerService`, `AnalyticsService`, `AdminTransitService` |
| `controller/` | Validated REST endpoints returning structured JSON DTOs | `HealthController`, `AuthController`, `TransitController`, `JourneyController`, `AnalyticsController`, `AdminController` |
| `dto/` | Immutable Java 21 `record` payloads with Jakarta Bean Validation | `AuthDtos`, `TransitDtos`, `JourneyDtos`, `AdminDtos` |
| `exception/` | Translates Validation, Auth, Duplicate-Key (`409`), and MySQL `SQLSTATE '45000'` (`400`) | `GlobalExceptionHandler`, `BadRequestException`, `ResourceNotFoundException` |

---

## 2. Phase 6 Multi-Modal Ride-Leg Graph Algorithm

### Why Hop-by-Hop Dijkstra Fails on Real Indian Transit Fares
Both BMTC and Namma Metro use **sub-additive distance-slab tariffs** (`fare_rules`):
- Six 2.8 km hops priced individually would cost `6 x Rs. 12 = Rs. 72`.
- One continuous 16.8 km ride on `BMTC 500-D` (`Silk Board -> KR Puram`) actually costs **`Rs. 25.00`** (`12-20 km` `BMTC_ORDINARY` slab).

### Ride-Leg Macro-Edge Expansion
`TransitGraphEngine` queries live active rows from MySQL on each request (reflecting Admin updates immediately) and constructs a directed **Ride-Leg Graph**:
1. **BMTC Continuous Ride Edges**: Every `(boardStop_i -> alightStop_j)` pair ($j > i$) along each active `OUTBOUND` / `INBOUND` route sequence carries exact cumulative ride minutes, headway wait (`schedules`), exact slab fare (`fare_rules`), stop count, and intermediate `[lat, lng]` `polylineCoords` for Leaflet.
2. **Namma Metro Line Ride Edges + Paid-Concourse Interchanges**: Every reachable station pair on each operational Metro line (`Purple`, `Green`, `Yellow`) carries exact rail minutes, distance, station `polylineCoords`, and unified BMRCL distance-slab pricing across internal interchanges (`Majestic` and `RV Road`).
3. **Multi-Modal Hub Transfer Edges**: Bidirectional skywalk/footpath connectors from `transfer_points` (`walking_time_mins + transfer_buffer_mins`, `Rs. 0` transfer fee, `transfers + 1`).

### Exact Total Journey Time Invariant
Every computed route satisfies:
~~~text
Total Time = Walking Time + Bus Time + Metro Time + Waiting Time + Transfer Time
~~~

### Verified Bengaluru Benchmark (`Silk Board Junction` -> `Whitefield (Kadugodi)`)
- **FASTEST (`COMBINED`)**: `BMTC 500-D` (`Silk Board -> KR Puram`, `Rs. 25`) + `KR Puram Skywalk` (`4m`) + `Purple Line` (`KR Pura -> Whitefield`, `Rs. 30`) = **`Rs. 55.00 | 1 Transfer`**, beating both `BUS_ONLY` (`500-CA` Vajra road traffic) and `METRO_ONLY` (`Yellow -> Green -> Purple` western detour).
- **CHEAPEST (`COMBINED`)**: `BMTC 500-D` Ordinary + `Marathahalli` transfer + `BMTC 335-G` Ordinary = **`Rs. 36.00`** (saving Rs. 19 over Metro+Bus).

---

## 3. REST API Summary

| Method & Endpoint | Access | Description |
| :--- | :--- | :--- |
| `GET /api/health` | Public | Live JVM + MySQL 8 health snapshot & active network counts |
| `POST /api/auth/register` | Public | Register passenger + create `BTC-NCMC-*` Smart Wallet |
| `POST /api/auth/login` | Public | Authenticate with BCrypt & receive signed JWT |
| `GET /api/auth/me` | Authenticated | Current user profile, roles & live Smart Wallet balance |
| `GET /api/transit/network` | Public | All active Metro lines, stations, BMTC routes, stops & hubs |
| `GET /api/transit/bus-routes/{id}/stops` | Public | Ordered stop sequence & coordinates for a BMTC route |
| `GET /api/transit/nearby?lat=&lng=` | Public | Calls `sp_find_nearby_transit_nodes` Haversine procedure |
| `GET /api/transit/fares` | Public | Distance-slab tariff rules from `fare_rules` |
| `POST /api/journeys/search` | Public / Auth | Computes `recommended`, `alternatives` & `modeComparison`, persists `journey_plans` + `journey_legs` |
| `POST /api/journeys/book` | Authenticated | Calls `sp_book_unified_qr_pass` (ACID debit + QR pass) |
| `GET /api/journeys/history` | Authenticated | Booked QR passes (`travel_history`) & recent searches |
| `POST /api/journeys/wallet/topup` | Authenticated | Recharge Smart Wallet balance |
| `GET /api/feedback` / `POST /api/feedback` | Public / Auth | Paginated passenger reviews & feedback submission |
| `GET /api/analytics/dashboard` | Public | Queries all 4 MySQL analytical `VIEW`s |
| `/api/admin/**` | `ROLE_ADMIN` | Full CRUD for stops, routes, buses, stations, hubs, schedules, fares, feedback moderation & trigger `audit_logs` |