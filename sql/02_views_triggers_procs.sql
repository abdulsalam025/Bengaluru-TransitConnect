-- ============================================================================
-- Phase 3 (2/4): 02_views_triggers_procs.sql
-- Bengaluru TransitConnect - SQL Views, Audit/Safety Triggers & Stored Procedures
-- ============================================================================

USE bengaluru_transit;

-- ============================================================================
-- PART A: SQL VIEWS (Analytics, Connectivity & Left-Join Reporting)
-- ============================================================================

DROP VIEW IF EXISTS v_popular_searched_corridors;
CREATE VIEW v_popular_searched_corridors AS
SELECT
    jp.source_name,
    jp.destination_name,
    COUNT(jp.plan_id) AS total_searches,
    COUNT(th.history_id) AS total_booked_passes,
    ROUND(AVG(jp.total_time_mins), 1) AS avg_estimated_time_mins,
    ROUND(MIN(jp.total_time_mins), 0) AS fastest_time_mins,
    ROUND(AVG(jp.estimated_fare_inr), 2) AS avg_estimated_fare_inr,
    ROUND(MIN(jp.estimated_fare_inr), 2) AS cheapest_fare_inr
FROM journey_plans jp
LEFT JOIN travel_history th ON th.plan_id = jp.plan_id
GROUP BY jp.source_name, jp.destination_name;

DROP VIEW IF EXISTS v_multimodal_hub_connectivity;
CREATE VIEW v_multimodal_hub_connectivity AS
SELECT
    tp.transfer_id,
    tp.hub_name,
    bs.stop_code AS bmtc_stop_code,
    bs.stop_name AS bmtc_stop_name,
    ms.station_code AS metro_station_code,
    ms.station_name AS metro_station_name,
    ml.line_name AS metro_line_name,
    ml.color_hex AS metro_line_color,
    tp.walking_distance_m,
    tp.walking_time_mins,
    tp.transfer_buffer_mins,
    tp.has_skywalk,
    COUNT(DISTINCT brs.route_id) AS connected_bmtc_routes
FROM transfer_points tp
INNER JOIN bus_stops bs ON bs.stop_id = tp.bus_stop_id
INNER JOIN metro_stations ms ON ms.station_id = tp.metro_station_id
INNER JOIN metro_lines ml ON ml.line_id = ms.line_id
LEFT JOIN bus_route_stops brs ON brs.stop_id = bs.stop_id
WHERE tp.is_active = TRUE
GROUP BY
    tp.transfer_id,
    tp.hub_name,
    bs.stop_code,
    bs.stop_name,
    ms.station_code,
    ms.station_name,
    ml.line_name,
    ml.color_hex,
    tp.walking_distance_m,
    tp.walking_time_mins,
    tp.transfer_buffer_mins,
    tp.has_skywalk;

DROP VIEW IF EXISTS v_transport_mode_usage_report;
CREATE VIEW v_transport_mode_usage_report AS
SELECT
    jp.route_category,
    COUNT(jp.plan_id) AS generated_plans_count,
    COUNT(th.history_id) AS booked_passes_count,
    ROUND(AVG(jp.total_time_mins), 1) AS avg_total_time_mins,
    ROUND(AVG(jp.estimated_fare_inr), 2) AS avg_fare_inr,
    ROUND(AVG(jp.transfer_count), 2) AS avg_transfers
FROM journey_plans jp
LEFT JOIN travel_history th ON th.plan_id = jp.plan_id
GROUP BY jp.route_category;

DROP VIEW IF EXISTS v_route_feedback_summary;
CREATE VIEW v_route_feedback_summary AS
SELECT
    br.route_id,
    br.route_number,
    br.route_name,
    br.service_type,
    COUNT(fb.feedback_id) AS total_reviews,
    ROUND(COALESCE(AVG(fb.rating), 0.0), 2) AS avg_rating
FROM bus_routes br
LEFT JOIN feedback fb ON fb.bus_route_id = br.route_id
GROUP BY br.route_id, br.route_number, br.route_name, br.service_type;

-- ============================================================================
-- PART B: MYSQL TRIGGERS (JSON Audit Logging & Wallet Integrity Guard)
-- ============================================================================

DROP TRIGGER IF EXISTS trg_bus_routes_after_insert;
DROP TRIGGER IF EXISTS trg_bus_routes_after_update;
DROP TRIGGER IF EXISTS trg_bus_routes_after_delete;
DROP TRIGGER IF EXISTS trg_fare_rules_after_update;
DROP TRIGGER IF EXISTS trg_wallet_balance_guard;

DELIMITER $$

CREATE TRIGGER trg_bus_routes_after_insert
AFTER INSERT ON bus_routes
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (actor_user_id, table_name, operation_type, record_identifier, old_payload, new_payload)
    VALUES (
        NULL,
        'bus_routes',
        'INSERT',
        NEW.route_number,
        NULL,
        JSON_OBJECT(
            'route_id', NEW.route_id,
            'route_number', NEW.route_number,
            'route_name', NEW.route_name,
            'service_type', NEW.service_type,
            'total_distance_km', NEW.total_distance_km,
            'is_active', NEW.is_active
        )
    );
END$$

CREATE TRIGGER trg_bus_routes_after_update
AFTER UPDATE ON bus_routes
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (actor_user_id, table_name, operation_type, record_identifier, old_payload, new_payload)
    VALUES (
        NULL,
        'bus_routes',
        'UPDATE',
        NEW.route_number,
        JSON_OBJECT(
            'route_name', OLD.route_name,
            'service_type', OLD.service_type,
            'total_distance_km', OLD.total_distance_km,
            'is_active', OLD.is_active
        ),
        JSON_OBJECT(
            'route_name', NEW.route_name,
            'service_type', NEW.service_type,
            'total_distance_km', NEW.total_distance_km,
            'is_active', NEW.is_active
        )
    );
END$$

CREATE TRIGGER trg_bus_routes_after_delete
AFTER DELETE ON bus_routes
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (actor_user_id, table_name, operation_type, record_identifier, old_payload, new_payload)
    VALUES (
        NULL,
        'bus_routes',
        'DELETE',
        OLD.route_number,
        JSON_OBJECT(
            'route_id', OLD.route_id,
            'route_number', OLD.route_number,
            'route_name', OLD.route_name,
            'service_type', OLD.service_type
        ),
        NULL
    );
END$$

CREATE TRIGGER trg_fare_rules_after_update
AFTER UPDATE ON fare_rules
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (actor_user_id, table_name, operation_type, record_identifier, old_payload, new_payload)
    VALUES (
        NULL,
        'fare_rules',
        'UPDATE',
        CONCAT(NEW.service_category, ':', NEW.min_distance_km, '-', NEW.max_distance_km, 'km'),
        JSON_OBJECT('fare_inr', OLD.fare_inr, 'smart_card_discount_pct', OLD.smart_card_discount_pct),
        JSON_OBJECT('fare_inr', NEW.fare_inr, 'smart_card_discount_pct', NEW.smart_card_discount_pct)
    );
END$$

CREATE TRIGGER trg_wallet_balance_guard
BEFORE UPDATE ON passenger_wallets
FOR EACH ROW
BEGIN
    IF NEW.balance_inr < 0.00 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Insufficient Smart Wallet balance for Unified Transit Pass';
    END IF;
END$$

-- ============================================================================
-- PART C: STORED PROCEDURES (Haversine Geolocation, Slab Fare & ACID Booking)
-- ============================================================================

DROP PROCEDURE IF EXISTS sp_find_nearby_transit_nodes$$
CREATE PROCEDURE sp_find_nearby_transit_nodes(
    IN p_lat DECIMAL(9, 6),
    IN p_lng DECIMAL(9, 6),
    IN p_radius_km DECIMAL(6, 2),
    IN p_limit INT
)
BEGIN
    SELECT
        node_type,
        node_key,
        code,
        display_name,
        corridor_or_area,
        latitude,
        longitude,
        ROUND(distance_km, 2) AS distance_km,
        GREATEST(1, CEIL(distance_km * 12.5)) AS estimated_walk_mins
    FROM (
        SELECT
            'BUS_STOP' AS node_type,
            CONCAT('BUS_', bs.stop_id) AS node_key,
            bs.stop_code AS code,
            bs.stop_name AS display_name,
            bs.area_name AS corridor_or_area,
            bs.latitude,
            bs.longitude,
            (
                6371.0 * 2.0 * ASIN(
                    SQRT(
                        POWER(SIN(RADIANS(bs.latitude - p_lat) / 2.0), 2) +
                        COS(RADIANS(p_lat)) * COS(RADIANS(bs.latitude)) *
                        POWER(SIN(RADIANS(bs.longitude - p_lng) / 2.0), 2)
                    )
                )
            ) AS distance_km
        FROM bus_stops bs
        WHERE bs.is_active = TRUE

        UNION ALL

        SELECT
            'METRO_STATION' AS node_type,
            CONCAT('METRO_', ms.station_id) AS node_key,
            ms.station_code AS code,
            ms.station_name AS display_name,
            ml.line_name AS corridor_or_area,
            ms.latitude,
            ms.longitude,
            (
                6371.0 * 2.0 * ASIN(
                    SQRT(
                        POWER(SIN(RADIANS(ms.latitude - p_lat) / 2.0), 2) +
                        COS(RADIANS(p_lat)) * COS(RADIANS(ms.latitude)) *
                        POWER(SIN(RADIANS(ms.longitude - p_lng) / 2.0), 2)
                    )
                )
            ) AS distance_km
        FROM metro_stations ms
        INNER JOIN metro_lines ml ON ml.line_id = ms.line_id
        WHERE ms.is_active = TRUE
    ) AS combined_nodes
    WHERE distance_km <= p_radius_km
    ORDER BY distance_km ASC
    LIMIT p_limit;
END$$

DROP PROCEDURE IF EXISTS sp_calculate_slab_fare$$
CREATE PROCEDURE sp_calculate_slab_fare(
    IN p_service_category VARCHAR(30),
    IN p_distance_km DECIMAL(6, 2),
    IN p_use_smart_card BOOLEAN,
    OUT p_final_fare DECIMAL(8, 2)
)
BEGIN
    DECLARE v_base_fare DECIMAL(8, 2) DEFAULT 0.00;
    DECLARE v_discount_pct DECIMAL(4, 2) DEFAULT 0.00;

    SELECT fr.fare_inr, fr.smart_card_discount_pct
    INTO v_base_fare, v_discount_pct
    FROM fare_rules fr
    WHERE fr.service_category = p_service_category
      AND p_distance_km >= fr.min_distance_km
      AND p_distance_km < fr.max_distance_km
    ORDER BY fr.min_distance_km ASC
    LIMIT 1;

    IF v_base_fare = 0.00 THEN
        SELECT fr.fare_inr, fr.smart_card_discount_pct
        INTO v_base_fare, v_discount_pct
        FROM fare_rules fr
        WHERE fr.service_category = p_service_category
        ORDER BY fr.max_distance_km DESC
        LIMIT 1;
    END IF;

    IF p_use_smart_card = TRUE AND v_discount_pct > 0.00 THEN
        SET p_final_fare = ROUND(v_base_fare * (1.0 - (v_discount_pct / 100.0)), 2);
    ELSE
        SET p_final_fare = v_base_fare;
    END IF;
END$$

DROP PROCEDURE IF EXISTS sp_book_unified_qr_pass$$
CREATE PROCEDURE sp_book_unified_qr_pass(
    IN p_user_id BIGINT,
    IN p_plan_id BIGINT,
    IN p_qr_code VARCHAR(40),
    OUT p_history_id BIGINT
)
BEGIN
    DECLARE v_fare DECIMAL(8, 2);
    DECLARE v_balance DECIMAL(10, 2);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT jp.estimated_fare_inr
    INTO v_fare
    FROM journey_plans jp
    WHERE jp.plan_id = p_plan_id
    LOCK IN SHARE MODE;

    IF v_fare IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Requested journey plan does not exist';
    END IF;

    SELECT pw.balance_inr
    INTO v_balance
    FROM passenger_wallets pw
    WHERE pw.user_id = p_user_id
    FOR UPDATE;

    IF v_balance IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Passenger Smart Wallet not found';
    END IF;

    IF v_balance < v_fare THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Insufficient Smart Wallet balance - transaction rolled back';
    END IF;

    UPDATE passenger_wallets
    SET balance_inr = balance_inr - v_fare
    WHERE user_id = p_user_id;

    INSERT INTO travel_history (user_id, plan_id, qr_pass_code, fare_paid_inr, payment_method, pass_status)
    VALUES (p_user_id, p_plan_id, p_qr_code, v_fare, 'SMART_WALLET', 'ACTIVE');

    SET p_history_id = LAST_INSERT_ID();

    COMMIT;
END$$

DELIMITER ;