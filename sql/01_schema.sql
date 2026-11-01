-- ============================================================================
-- Phase 3 (1/4): 01_schema.sql
-- Bengaluru TransitConnect - 19 Normalized (3NF) MySQL 8 Tables, Constraints & Indexes
-- ============================================================================

USE bengaluru_transit;

-- 1. ROLES (RBAC Master)
CREATE TABLE IF NOT EXISTS roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(40) NOT NULL,
    description VARCHAR(180) NOT NULL,
    CONSTRAINT uk_roles_name UNIQUE (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. USERS (Authenticated Passengers & Administrators)
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    preferred_language VARCHAR(20) NOT NULL DEFAULT 'en',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT uk_users_phone UNIQUE (phone),
    INDEX idx_users_active_created (is_active, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. USER_ROLES (Many-to-Many Junction: users <-> roles)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    role_id INT NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. PASSENGER_WALLETS (One-to-One with users for ACID Unified Pass Transactions)
CREATE TABLE IF NOT EXISTS passenger_wallets (
    wallet_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    smart_card_no VARCHAR(24) NOT NULL,
    balance_inr DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_wallet_user UNIQUE (user_id),
    CONSTRAINT uk_wallet_card UNIQUE (smart_card_no),
    CONSTRAINT chk_wallet_non_negative CHECK (balance_inr >= 0.00),
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. BUS_ROUTES (BMTC Route Master)
CREATE TABLE IF NOT EXISTS bus_routes (
    route_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    route_number VARCHAR(25) NOT NULL,
    route_name VARCHAR(160) NOT NULL,
    service_type ENUM('ORDINARY', 'VAJRA_AC', 'VAYU_VAJRA', 'METRO_FEEDER') NOT NULL,
    origin_name VARCHAR(120) NOT NULL,
    destination_name VARCHAR(120) NOT NULL,
    total_distance_km DECIMAL(6, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_bus_routes_number UNIQUE (route_number),
    CONSTRAINT chk_bus_route_dist CHECK (total_distance_km > 0.00),
    INDEX idx_bus_routes_service_active (service_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. BUSES (BMTC Fleet Vehicles Assigned to Routes - 1:N)
CREATE TABLE IF NOT EXISTS buses (
    bus_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    route_id BIGINT NOT NULL,
    registration_no VARCHAR(20) NOT NULL,
    bus_type ENUM('NON_AC_DIESEL', 'ELECTRIC_NON_AC', 'VAJRA_VOLVO_AC', 'VAYU_VAJRA_AC') NOT NULL,
    seating_capacity INT NOT NULL,
    depot_name VARCHAR(80) NOT NULL,
    operational_status ENUM('ACTIVE', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT uk_buses_reg UNIQUE (registration_no),
    CONSTRAINT chk_buses_capacity CHECK (seating_capacity BETWEEN 15 AND 90),
    CONSTRAINT fk_buses_route FOREIGN KEY (route_id) REFERENCES bus_routes (route_id) ON DELETE RESTRICT,
    INDEX idx_buses_route_status (route_id, operational_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. BUS_STOPS (BMTC Geolocation & Stop Metadata)
CREATE TABLE IF NOT EXISTS bus_stops (
    stop_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    stop_code VARCHAR(24) NOT NULL,
    stop_name VARCHAR(120) NOT NULL,
    area_name VARCHAR(100) NOT NULL,
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL,
    has_shelter BOOLEAN NOT NULL DEFAULT TRUE,
    is_interchange_hub BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_bus_stops_code UNIQUE (stop_code),
    CONSTRAINT chk_bus_stops_lat CHECK (latitude BETWEEN 12.500000 AND 13.500000),
    CONSTRAINT chk_bus_stops_lng CHECK (longitude BETWEEN 77.200000 AND 78.000000),
    INDEX idx_bus_stops_coords (latitude, longitude),
    INDEX idx_bus_stops_name (stop_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. BUS_ROUTE_STOPS (Ordered M:N Junction: bus_routes <-> bus_stops)
CREATE TABLE IF NOT EXISTS bus_route_stops (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    route_id BIGINT NOT NULL,
    stop_id BIGINT NOT NULL,
    direction ENUM('OUTBOUND', 'INBOUND') NOT NULL DEFAULT 'OUTBOUND',
    stop_sequence INT NOT NULL,
    distance_from_start_km DECIMAL(6, 2) NOT NULL,
    travel_mins_from_prev INT NOT NULL DEFAULT 0,
    CONSTRAINT uk_route_dir_seq UNIQUE (route_id, direction, stop_sequence),
    CONSTRAINT uk_route_dir_stop UNIQUE (route_id, direction, stop_id),
    CONSTRAINT chk_brs_seq CHECK (stop_sequence >= 1),
    CONSTRAINT chk_brs_dist CHECK (distance_from_start_km >= 0.00),
    CONSTRAINT chk_brs_mins CHECK (travel_mins_from_prev >= 0),
    CONSTRAINT fk_brs_route FOREIGN KEY (route_id) REFERENCES bus_routes (route_id) ON DELETE CASCADE,
    CONSTRAINT fk_brs_stop FOREIGN KEY (stop_id) REFERENCES bus_stops (stop_id) ON DELETE RESTRICT,
    INDEX idx_brs_stop_route (stop_id, route_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. METRO_LINES (BMRCL Namma Metro Corridors)
CREATE TABLE IF NOT EXISTS metro_lines (
    line_id INT AUTO_INCREMENT PRIMARY KEY,
    line_code VARCHAR(20) NOT NULL,
    line_name VARCHAR(100) NOT NULL,
    color_hex VARCHAR(10) NOT NULL,
    corridor_summary VARCHAR(180) NOT NULL,
    total_length_km DECIMAL(6, 2) NOT NULL,
    operational_status ENUM('OPERATIONAL', 'UNDER_CONSTRUCTION') NOT NULL DEFAULT 'OPERATIONAL',
    opened_year INT NOT NULL,
    CONSTRAINT uk_metro_lines_code UNIQUE (line_code),
    CONSTRAINT chk_metro_line_len CHECK (total_length_km > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. METRO_STATIONS (Ordered Namma Metro Stations - 1:N from metro_lines)
CREATE TABLE IF NOT EXISTS metro_stations (
    station_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    station_code VARCHAR(20) NOT NULL,
    station_name VARCHAR(120) NOT NULL,
    line_id INT NOT NULL,
    station_order INT NOT NULL,
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL,
    is_interchange BOOLEAN NOT NULL DEFAULT FALSE,
    structure_type ENUM('ELEVATED', 'UNDERGROUND', 'AT_GRADE') NOT NULL DEFAULT 'ELEVATED',
    has_parking BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_metro_station_code UNIQUE (station_code),
    CONSTRAINT uk_metro_line_order UNIQUE (line_id, station_order),
    CONSTRAINT chk_metro_station_order CHECK (station_order >= 1),
    CONSTRAINT chk_metro_lat CHECK (latitude BETWEEN 12.500000 AND 13.500000),
    CONSTRAINT chk_metro_lng CHECK (longitude BETWEEN 77.200000 AND 78.000000),
    CONSTRAINT fk_ms_line FOREIGN KEY (line_id) REFERENCES metro_lines (line_id) ON DELETE RESTRICT,
    INDEX idx_metro_stations_coords (latitude, longitude),
    INDEX idx_metro_stations_name (station_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. METRO_CONNECTIONS (Directed Rail & Platform-Interchange Graph Edges)
CREATE TABLE IF NOT EXISTS metro_connections (
    connection_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    from_station_id BIGINT NOT NULL,
    to_station_id BIGINT NOT NULL,
    line_id INT NOT NULL,
    distance_km DECIMAL(5, 2) NOT NULL,
    travel_time_mins INT NOT NULL,
    is_interchange_walk BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uk_metro_edge UNIQUE (from_station_id, to_station_id, line_id),
    CONSTRAINT chk_mc_dist CHECK (distance_km >= 0.00),
    CONSTRAINT chk_mc_time CHECK (travel_time_mins >= 1),
    CONSTRAINT fk_mc_from FOREIGN KEY (from_station_id) REFERENCES metro_stations (station_id) ON DELETE CASCADE,
    CONSTRAINT fk_mc_to FOREIGN KEY (to_station_id) REFERENCES metro_stations (station_id) ON DELETE CASCADE,
    CONSTRAINT fk_mc_line FOREIGN KEY (line_id) REFERENCES metro_lines (line_id) ON DELETE RESTRICT,
    INDEX idx_mc_from (from_station_id),
    INDEX idx_mc_to (to_station_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. SCHEDULES (Scheduled Service Windows & Headway Frequencies)
CREATE TABLE IF NOT EXISTS schedules (
    schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transport_mode ENUM('BUS', 'METRO') NOT NULL,
    bus_route_id BIGINT NULL,
    metro_line_id INT NULL,
    day_type ENUM('WEEKDAY', 'WEEKEND') NOT NULL,
    first_service_time TIME NOT NULL,
    last_service_time TIME NOT NULL,
    peak_headway_mins INT NOT NULL,
    offpeak_headway_mins INT NOT NULL,
    data_confidence ENUM('SCHEDULED_SAMPLE', 'OFFICIAL_PUBLISHED') NOT NULL DEFAULT 'SCHEDULED_SAMPLE',
    schedule_note VARCHAR(200) NOT NULL,
    CONSTRAINT chk_sched_peak CHECK (peak_headway_mins BETWEEN 2 AND 120),
    CONSTRAINT chk_sched_offpeak CHECK (offpeak_headway_mins BETWEEN 3 AND 180),
    CONSTRAINT fk_sched_bus FOREIGN KEY (bus_route_id) REFERENCES bus_routes (route_id) ON DELETE CASCADE,
    CONSTRAINT fk_sched_metro FOREIGN KEY (metro_line_id) REFERENCES metro_lines (line_id) ON DELETE CASCADE,
    INDEX idx_sched_mode_day (transport_mode, day_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. TRANSFER_POINTS (Multi-Modal BMTC <-> Namma Metro Interchange Hubs)
CREATE TABLE IF NOT EXISTS transfer_points (
    transfer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    hub_name VARCHAR(120) NOT NULL,
    bus_stop_id BIGINT NOT NULL,
    metro_station_id BIGINT NOT NULL,
    walking_distance_m INT NOT NULL,
    walking_time_mins INT NOT NULL,
    transfer_buffer_mins INT NOT NULL DEFAULT 3,
    has_skywalk BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_bus_metro_transfer UNIQUE (bus_stop_id, metro_station_id),
    CONSTRAINT chk_tp_walk_dist CHECK (walking_distance_m BETWEEN 10 AND 2000),
    CONSTRAINT chk_tp_walk_mins CHECK (walking_time_mins BETWEEN 1 AND 30),
    CONSTRAINT chk_tp_buffer CHECK (transfer_buffer_mins BETWEEN 1 AND 20),
    CONSTRAINT fk_tp_bus_stop FOREIGN KEY (bus_stop_id) REFERENCES bus_stops (stop_id) ON DELETE CASCADE,
    CONSTRAINT fk_tp_metro_station FOREIGN KEY (metro_station_id) REFERENCES metro_stations (station_id) ON DELETE CASCADE,
    INDEX idx_tp_hub_active (is_active, hub_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. FARE_RULES (Distance-Slab Tariff Table by Mode & Service Type)
CREATE TABLE IF NOT EXISTS fare_rules (
    fare_rule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_category ENUM('BMTC_ORDINARY', 'BMTC_VAJRA_AC', 'BMTC_VAYU_VAJRA', 'NAMMA_METRO') NOT NULL,
    min_distance_km DECIMAL(6, 2) NOT NULL,
    max_distance_km DECIMAL(6, 2) NOT NULL,
    fare_inr DECIMAL(8, 2) NOT NULL,
    smart_card_discount_pct DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    source_note VARCHAR(200) NOT NULL,
    CONSTRAINT chk_fare_slab_bounds CHECK (max_distance_km > min_distance_km AND min_distance_km >= 0.00),
    CONSTRAINT chk_fare_positive CHECK (fare_inr >= 0.00),
    CONSTRAINT chk_discount_pct CHECK (smart_card_discount_pct BETWEEN 0.00 AND 50.00),
    INDEX idx_fare_lookup (service_category, min_distance_km, max_distance_km)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. JOURNEY_PLANS (Computed Multi-Modal Journey Options & Time/Fare Breakdown)
CREATE TABLE IF NOT EXISTS journey_plans (
    plan_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NULL,
    source_node_key VARCHAR(40) NOT NULL,
    source_name VARCHAR(120) NOT NULL,
    destination_node_key VARCHAR(40) NOT NULL,
    destination_name VARCHAR(120) NOT NULL,
    optimization_type ENUM('FASTEST', 'CHEAPEST', 'MIN_TRANSFERS') NOT NULL,
    route_category ENUM('BUS_ONLY', 'METRO_ONLY', 'COMBINED') NOT NULL,
    walking_time_mins INT NOT NULL DEFAULT 0,
    bus_time_mins INT NOT NULL DEFAULT 0,
    metro_time_mins INT NOT NULL DEFAULT 0,
    waiting_time_mins INT NOT NULL DEFAULT 0,
    transfer_time_mins INT NOT NULL DEFAULT 0,
    total_time_mins INT NOT NULL,
    total_distance_km DECIMAL(7, 2) NOT NULL,
    estimated_fare_inr DECIMAL(8, 2) NOT NULL,
    transfer_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_jp_total_time CHECK (total_time_mins >= 1),
    CONSTRAINT chk_jp_fare CHECK (estimated_fare_inr >= 0.00),
    CONSTRAINT chk_jp_transfers CHECK (transfer_count >= 0),
    CONSTRAINT fk_jp_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL,
    INDEX idx_jp_corridor (source_name, destination_name),
    INDEX idx_jp_user_created (user_id, created_at),
    INDEX idx_jp_category_opt (route_category, optimization_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. JOURNEY_LEGS (Step-by-Step Segments Inside a Journey Plan - 1:N)
CREATE TABLE IF NOT EXISTS journey_legs (
    leg_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plan_id BIGINT NOT NULL,
    leg_order INT NOT NULL,
    leg_mode ENUM('WALK', 'BUS', 'METRO', 'TRANSFER') NOT NULL,
    route_or_line_code VARCHAR(30) NOT NULL,
    route_or_line_name VARCHAR(140) NOT NULL,
    color_hex VARCHAR(10) NOT NULL DEFAULT '#2563EB',
    from_node_key VARCHAR(40) NOT NULL,
    from_point_name VARCHAR(120) NOT NULL,
    from_lat DECIMAL(9, 6) NOT NULL,
    from_lng DECIMAL(9, 6) NOT NULL,
    to_node_key VARCHAR(40) NOT NULL,
    to_point_name VARCHAR(120) NOT NULL,
    to_lat DECIMAL(9, 6) NOT NULL,
    to_lng DECIMAL(9, 6) NOT NULL,
    distance_km DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    duration_mins INT NOT NULL,
    waiting_mins INT NOT NULL DEFAULT 0,
    leg_fare_inr DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    stops_count INT NOT NULL DEFAULT 0,
    CONSTRAINT uk_plan_leg_order UNIQUE (plan_id, leg_order),
    CONSTRAINT chk_jl_order CHECK (leg_order >= 1),
    CONSTRAINT chk_jl_duration CHECK (duration_mins >= 1),
    CONSTRAINT fk_jl_plan FOREIGN KEY (plan_id) REFERENCES journey_plans (plan_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. TRAVEL_HISTORY (Passenger Booked Journeys & Unified QR Passes)
CREATE TABLE IF NOT EXISTS travel_history (
    history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    qr_pass_code VARCHAR(40) NOT NULL,
    fare_paid_inr DECIMAL(8, 2) NOT NULL,
    payment_method ENUM('SMART_WALLET', 'UPI_SIMULATED') NOT NULL DEFAULT 'SMART_WALLET',
    pass_status ENUM('ACTIVE', 'USED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    travelled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_th_qr_code UNIQUE (qr_pass_code),
    CONSTRAINT chk_th_fare CHECK (fare_paid_inr >= 0.00),
    CONSTRAINT fk_th_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_th_plan FOREIGN KEY (plan_id) REFERENCES journey_plans (plan_id) ON DELETE RESTRICT,
    INDEX idx_th_user_date (user_id, travelled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. FEEDBACK (Passenger Reviews for Routes, Stations & Journey Planner)
CREATE TABLE IF NOT EXISTS feedback (
    feedback_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    target_type ENUM('BUS_ROUTE', 'METRO_STATION', 'JOURNEY_PLANNER') NOT NULL,
    bus_route_id BIGINT NULL,
    metro_station_id BIGINT NULL,
    rating TINYINT NOT NULL,
    comments TEXT NOT NULL,
    review_status ENUM('PENDING', 'REVIEWED', 'RESOLVED') NOT NULL DEFAULT 'PENDING',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT fk_fb_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_fb_route FOREIGN KEY (bus_route_id) REFERENCES bus_routes (route_id) ON DELETE SET NULL,
    CONSTRAINT fk_fb_station FOREIGN KEY (metro_station_id) REFERENCES metro_stations (station_id) ON DELETE SET NULL,
    INDEX idx_fb_status_created (review_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. AUDIT_LOGS (Trigger-Populated Immutable Database Audit Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_user_id BIGINT NULL,
    table_name VARCHAR(64) NOT NULL,
    operation_type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    record_identifier VARCHAR(80) NOT NULL,
    old_payload JSON NULL,
    new_payload JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (user_id) ON DELETE SET NULL,
    INDEX idx_audit_table_time (table_name, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. CITY_LANDMARKS (Comprehensive Bengaluru Government Offices, Famous Places, Colleges, Schools, Tech Parks, Hospitals, Malls & Neighborhoods with Full Addresses)
DROP TABLE IF EXISTS city_landmarks;
CREATE TABLE city_landmarks (
    landmark_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    landmark_name VARCHAR(140) NOT NULL,
    category ENUM(
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
    ) NOT NULL,
    area_name VARCHAR(100) NOT NULL,
    street_address VARCHAR(240) NOT NULL,
    pincode VARCHAR(10) NOT NULL DEFAULT '560001',
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_city_landmark_name UNIQUE (landmark_name),
    CONSTRAINT chk_landmark_lat CHECK (latitude BETWEEN 12.500000 AND 13.500000),
    CONSTRAINT chk_landmark_lng CHECK (longitude BETWEEN 77.200000 AND 78.000000),
    INDEX idx_landmarks_search (landmark_name, area_name, category),
    INDEX idx_landmarks_pincode (pincode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;