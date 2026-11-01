-- ============================================================================
-- Phase 9: 05_explain_and_security_audit.sql
-- Bengaluru TransitConnect - MySQL 8 Query Plan (EXPLAIN) Index Verification,
-- Constraint Integrity Audit & Stored Procedure / View Regression Checks
-- ============================================================================

USE bengaluru_transit;

-- 1. Schema & Constraint Summary Audit (19 Normalized Tables -> 89 Constraints)
SELECT
    tc.constraint_type,
    COUNT(*) AS constraint_count
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'bengaluru_transit'
GROUP BY tc.constraint_type
ORDER BY constraint_count DESC;

-- 2. EXPLAIN #1: Stop-to-Route Adjacency Lookup (uses idx_brs_stop_route)
EXPLAIN
SELECT brs.route_id, brs.direction, brs.stop_sequence
FROM bus_route_stops brs
WHERE brs.stop_id = 1;

-- 3. EXPLAIN #2: Ordered Route Stop Sequence (uses uk_route_dir_seq)
EXPLAIN
SELECT brs.stop_sequence, brs.stop_id, brs.distance_from_start_km
FROM bus_route_stops brs
WHERE brs.route_id = 1
  AND brs.direction = 'OUTBOUND'
ORDER BY brs.stop_sequence ASC;

-- 4. EXPLAIN #3: Metro Track Graph Adjacency (uses uk_metro_edge / idx_mc_from)
EXPLAIN
SELECT mc.to_station_id, mc.distance_km, mc.travel_time_mins
FROM metro_connections mc
WHERE mc.from_station_id = 10;

-- 5. EXPLAIN #4: Multi-Modal Skywalk Hub Lookup by BMTC Stop (uses uk_bus_metro_transfer)
EXPLAIN
SELECT tp.hub_name, tp.metro_station_id, tp.walking_time_mins, tp.transfer_buffer_mins
FROM transfer_points tp
WHERE tp.bus_stop_id = 7
  AND tp.is_active = TRUE;

-- 6. EXPLAIN #5: Distance-Slab Tariff Lookup (uses idx_fare_lookup)
EXPLAIN
SELECT fr.fare_inr, fr.smart_card_discount_pct
FROM fare_rules fr
WHERE fr.service_category = 'NAMMA_METRO'
  AND 12.20 > fr.min_distance_km
  AND 12.20 <= fr.max_distance_km;

-- 7. EXPLAIN #6: Passenger Travel History Timeline (uses idx_th_user_date)
EXPLAIN
SELECT th.history_id, th.qr_pass_code, th.fare_paid_inr, th.travelled_at
FROM travel_history th
WHERE th.user_id = 2
ORDER BY th.travelled_at DESC;

-- 8. Analytical Views Regression Check
SELECT COUNT(*) AS popular_corridor_rows FROM v_popular_searched_corridors;
SELECT COUNT(*) AS multimodal_hub_rows FROM v_multimodal_hub_connectivity;
SELECT COUNT(*) AS mode_usage_rows FROM v_transport_mode_usage_report;
SELECT COUNT(*) AS route_feedback_rows FROM v_route_feedback_summary;

-- 9. Stored Procedures Regression Check
CALL sp_calculate_slab_fare('BMTC_ORDINARY', 16.80, FALSE, @bmtc_ord_fare);
CALL sp_calculate_slab_fare('NAMMA_METRO', 12.20, FALSE, @metro_std_fare);
SELECT
    @bmtc_ord_fare AS silk_board_to_kr_puram_bus_inr,
    @metro_std_fare AS kr_pura_to_whitefield_metro_inr,
    ROUND(@bmtc_ord_fare + @metro_std_fare, 2) AS combined_multimodal_fare_inr;