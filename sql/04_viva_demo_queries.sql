-- ============================================================================
-- Phase 3 (4/4): 04_viva_demo_queries.sql
-- Bengaluru TransitConnect - 10 Viva-Ready SQL Queries (JOINs, Subqueries, Views,
-- Stored Procedures, EXPLAIN Index Analysis & Trigger Audit Verification)
-- ============================================================================

USE bengaluru_transit;

-- Q1. INNER JOIN: Ordered stop-by-stop timetable & cumulative distance along BMTC 500-D (OUTBOUND)
SELECT
    br.route_number,
    brs.stop_sequence,
    bs.stop_code,
    bs.stop_name,
    bs.area_name,
    brs.distance_from_start_km,
    brs.travel_mins_from_prev
FROM bus_route_stops brs
INNER JOIN bus_routes br ON br.route_id = brs.route_id
INNER JOIN bus_stops bs ON bs.stop_id = brs.stop_id
WHERE br.route_number = '500-D'
  AND brs.direction = 'OUTBOUND'
ORDER BY brs.stop_sequence ASC;

-- Q2. LEFT JOIN: Show ALL BMTC routes with fleet count & average passenger rating (including unrated routes)
SELECT
    br.route_number,
    br.service_type,
    COUNT(DISTINCT b.bus_id) AS assigned_buses,
    COUNT(DISTINCT fb.feedback_id) AS review_count,
    ROUND(COALESCE(AVG(fb.rating), 0), 2) AS avg_rating
FROM bus_routes br
LEFT JOIN buses b ON b.route_id = br.route_id AND b.operational_status = 'ACTIVE'
LEFT JOIN feedback fb ON fb.bus_route_id = br.route_id
GROUP BY br.route_id, br.route_number, br.service_type
ORDER BY assigned_buses DESC, br.route_number ASC;

-- Q3. MULTI-TABLE JOIN + AGGREGATION: Multi-modal transfer hubs ranked by connected BMTC routes
SELECT
    hub_name,
    bmtc_stop_name,
    metro_station_name,
    metro_line_name,
    walking_distance_m,
    walking_time_mins + transfer_buffer_mins AS total_transfer_mins,
    has_skywalk,
    connected_bmtc_routes
FROM v_multimodal_hub_connectivity
ORDER BY connected_bmtc_routes DESC, walking_distance_m ASC;

-- Q4. SUBQUERY: Find journey plans that are BOTH faster and cheaper than the overall platform average
SELECT
    plan_id,
    source_name,
    destination_name,
    optimization_type,
    route_category,
    total_time_mins,
    estimated_fare_inr
FROM journey_plans
WHERE total_time_mins <= (SELECT AVG(total_time_mins) FROM journey_plans)
  AND estimated_fare_inr <= (SELECT AVG(estimated_fare_inr) FROM journey_plans);

-- Q5. GROUP BY + HAVING: Find BMTC stops served by 3 or more distinct bus routes (Major Bus Hubs)
SELECT
    bs.stop_code,
    bs.stop_name,
    bs.area_name,
    COUNT(DISTINCT brs.route_id) AS serving_routes_count
FROM bus_stops bs
INNER JOIN bus_route_stops brs ON brs.stop_id = bs.stop_id
GROUP BY bs.stop_id, bs.stop_code, bs.stop_name, bs.area_name
HAVING COUNT(DISTINCT brs.route_id) >= 3
ORDER BY serving_routes_count DESC, bs.stop_name ASC;

-- Q6. ANALYTICS VIEWS: Popular Corridors & Mode Split Reports
SELECT * FROM v_popular_searched_corridors ORDER BY total_searches DESC;
SELECT * FROM v_transport_mode_usage_report ORDER BY generated_plans_count DESC;

-- Q7. STORED PROCEDURE (Haversine Geolocation): Nearest stops & Metro stations within 2.5 km of Silk Board
CALL sp_find_nearby_transit_nodes(12.917200, 77.622800, 2.50, 8);

-- Q8. STORED PROCEDURE (Slab Fare Calculation with 5% Smart Card Discount)
CALL sp_calculate_slab_fare('NAMMA_METRO', 12.20, TRUE, @metro_smart_fare);
SELECT @metro_smart_fare AS kr_pura_to_whitefield_smartcard_fare_inr;

-- Q9. QUERY OPTIMIZATION (EXPLAIN Index Usage Verification)
EXPLAIN
SELECT brs.route_id, brs.direction, brs.stop_sequence
FROM bus_route_stops brs
WHERE brs.stop_id = 1;

-- Q10. TRIGGER AUDIT VERIFICATION: Inspect JSON records auto-captured by trg_bus_routes_after_insert
SELECT
    log_id,
    table_name,
    operation_type,
    record_identifier,
    JSON_EXTRACT(new_payload, '$.service_type') AS service_type,
    created_at
FROM audit_logs
ORDER BY log_id ASC
LIMIT 10;