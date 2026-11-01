package com.bengaluru.transit.repository;

import com.bengaluru.transit.dto.TransitDtos.NearbyNodeDto;
import java.sql.CallableStatement;
import java.sql.ResultSetMetaData;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class TransitSqlRepository {

    private final JdbcTemplate jdbcTemplate;

    public TransitSqlRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<NearbyNodeDto> callNearbyTransitNodes(double lat, double lng, double radiusKm, int limit) {
        return jdbcTemplate.query(
            "CALL sp_find_nearby_transit_nodes(?, ?, ?, ?)",
            (rs, rowNum) -> new NearbyNodeDto(
                rs.getString("node_type"),
                rs.getString("node_key"),
                rs.getString("code"),
                rs.getString("display_name"),
                rs.getString("corridor_or_area"),
                rs.getDouble("latitude"),
                rs.getDouble("longitude"),
                rs.getDouble("distance_km"),
                rs.getInt("estimated_walk_mins")
            ),
            lat, lng, radiusKm, limit
        );
    }

    public Long callBookUnifiedQrPass(Long userId, Long planId, String qrPassCode) {
        return jdbcTemplate.execute(
            "{CALL sp_book_unified_qr_pass(?, ?, ?, ?)}",
            (CallableStatement cs) -> {
                cs.setLong(1, userId);
                cs.setLong(2, planId);
                cs.setString(3, qrPassCode);
                cs.registerOutParameter(4, Types.BIGINT);
                cs.execute();
                return cs.getLong(4);
            }
        );
    }

    public List<Map<String, Object>> queryPopularCorridorsView() {
        return jdbcTemplate.queryForList(
            "SELECT * FROM v_popular_searched_corridors ORDER BY total_searches DESC, fastest_time_mins ASC LIMIT 12"
        );
    }

    public List<Map<String, Object>> queryHubConnectivityView() {
        return jdbcTemplate.queryForList(
            "SELECT * FROM v_multimodal_hub_connectivity ORDER BY connected_bmtc_routes DESC, walking_distance_m ASC"
        );
    }

    public List<Map<String, Object>> queryModeUsageView() {
        return jdbcTemplate.queryForList(
            "SELECT * FROM v_transport_mode_usage_report ORDER BY generated_plans_count DESC"
        );
    }

    public List<Map<String, Object>> queryRouteFeedbackView() {
        return jdbcTemplate.queryForList(
            "SELECT * FROM v_route_feedback_summary ORDER BY avg_rating DESC, total_reviews DESC"
        );
    }

    public Map<String, Object> queryDatabaseHealthSnapshot() {
        return jdbcTemplate.queryForMap(
            "SELECT VERSION() AS mysqlVersion, DATABASE() AS databaseName, " +
            "(SELECT COUNT(*) FROM metro_stations WHERE is_active = TRUE) AS metroStationCount, " +
            "(SELECT COUNT(*) FROM bus_stops WHERE is_active = TRUE) AS busStopCount, " +
            "(SELECT COUNT(*) FROM bus_routes WHERE is_active = TRUE) AS busRouteCount, " +
            "(SELECT COUNT(*) FROM transfer_points WHERE is_active = TRUE) AS transferHubCount"
        );
    }

    public Map<String, Object> queryCompleteDbmsSchemaCatalog() {
        String dbName = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
        String mysqlVersion = jdbcTemplate.queryForObject("SELECT VERSION()", String.class);
        Integer totalConstraints = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE()",
            Integer.class
        );

        // 1. Foreign Key map keyed by "tableName.columnName"
        Map<String, Map<String, String>> fkLookup = new HashMap<>();
        jdbcTemplate.query(
            "SELECT TABLE_NAME AS tbl_name, COLUMN_NAME AS col_name, " +
            "CONSTRAINT_NAME AS fk_name, REFERENCED_TABLE_NAME AS ref_tbl, REFERENCED_COLUMN_NAME AS ref_col " +
            "FROM information_schema.KEY_COLUMN_USAGE " +
            "WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL",
            rs -> {
                String key = rs.getString("tbl_name") + "." + rs.getString("col_name");
                Map<String, String> fkInfo = new LinkedHashMap<>();
                fkInfo.put("constraintName", rs.getString("fk_name"));
                fkInfo.put("referencedTable", rs.getString("ref_tbl"));
                fkInfo.put("referencedColumn", rs.getString("ref_col"));
                fkInfo.put("target", rs.getString("ref_tbl") + "(" + rs.getString("ref_col") + ")");
                fkLookup.put(key, fkInfo);
            }
        );

        // 2. Columns grouped by tableName
        Map<String, List<Map<String, Object>>> columnsByTable = new LinkedHashMap<>();
        final int[] totalAttributesHolder = new int[] { 0 };
        jdbcTemplate.query(
            "SELECT TABLE_NAME AS tbl_name, ORDINAL_POSITION AS ord_pos, COLUMN_NAME AS col_name, " +
            "COLUMN_TYPE AS col_type, IS_NULLABLE AS is_null, COALESCE(COLUMN_KEY, '') AS col_key, " +
            "COLUMN_DEFAULT AS col_def, COALESCE(EXTRA, '') AS extra_val " +
            "FROM information_schema.COLUMNS " +
            "WHERE TABLE_SCHEMA = DATABASE() " +
            "ORDER BY TABLE_NAME, ORDINAL_POSITION",
            rs -> {
                String tbl = rs.getString("tbl_name");
                String col = rs.getString("col_name");
                Map<String, String> fk = fkLookup.get(tbl + "." + col);

                Map<String, Object> attr = new LinkedHashMap<>();
                attr.put("ordinalPosition", rs.getInt("ord_pos"));
                attr.put("columnName", col);
                attr.put("columnType", rs.getString("col_type"));
                attr.put("isNullable", "YES".equalsIgnoreCase(rs.getString("is_null")));
                attr.put("columnKey", rs.getString("col_key"));
                attr.put("columnDefault", rs.getString("col_def"));
                attr.put("extra", rs.getString("extra_val"));
                attr.put("foreignKeyTarget", fk != null ? fk.get("target") : null);
                attr.put("referencedTable", fk != null ? fk.get("referencedTable") : null);
                attr.put("referencedColumn", fk != null ? fk.get("referencedColumn") : null);

                columnsByTable.computeIfAbsent(tbl, k -> new ArrayList<>()).add(attr);
                totalAttributesHolder[0]++;
            }
        );

        // 3. Relations (20 Base Tables + 4 SQL Views) with exact row counts
        List<Map<String, Object>> relations = new ArrayList<>();
        int baseTableCount = 0;
        int viewCount = 0;

        List<Map<String, String>> rawTables = jdbcTemplate.query(
            "SELECT TABLE_NAME AS tbl_name, TABLE_TYPE AS tbl_type, COALESCE(ENGINE, 'VIEW') AS eng_val " +
            "FROM information_schema.TABLES " +
            "WHERE TABLE_SCHEMA = DATABASE() " +
            "ORDER BY CASE WHEN TABLE_TYPE = 'BASE TABLE' THEN 0 ELSE 1 END, TABLE_NAME",
            (rs, rowNum) -> {
                Map<String, String> m = new LinkedHashMap<>();
                m.put("tableName", rs.getString("tbl_name"));
                m.put("tableType", rs.getString("tbl_type"));
                m.put("engine", rs.getString("eng_val"));
                return m;
            }
        );

        for (Map<String, String> rt : rawTables) {
            String tblName = rt.get("tableName");
            String tblType = rt.get("tableType");
            if ("BASE TABLE".equalsIgnoreCase(tblType)) {
                baseTableCount++;
            } else {
                viewCount++;
            }

            long rowCount = 0L;
            if (tblName != null && tblName.matches("^[a-zA-Z0-9_]+$")) {
                Long cnt = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM `" + tblName + "`", Long.class);
                rowCount = cnt != null ? cnt : 0L;
            }

            List<Map<String, Object>> attrs = columnsByTable.getOrDefault(tblName, List.of());
            Map<String, Object> rel = new LinkedHashMap<>();
            rel.put("tableName", tblName);
            rel.put("tableType", tblType);
            rel.put("engine", rt.get("engine"));
            rel.put("rowCount", rowCount);
            rel.put("attributeCount", attrs.size());
            rel.put("attributes", attrs);
            relations.add(rel);
        }

        // 4. Triggers & Stored Procedures metadata
        List<Map<String, Object>> triggers = jdbcTemplate.query(
            "SELECT TRIGGER_NAME AS trg_name, ACTION_TIMING AS timing_val, " +
            "EVENT_MANIPULATION AS event_val, EVENT_OBJECT_TABLE AS tbl_val " +
            "FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() " +
            "ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME",
            (rs, rowNum) -> {
                Map<String, Object> t = new LinkedHashMap<>();
                t.put("triggerName", rs.getString("trg_name"));
                t.put("timing", rs.getString("timing_val"));
                t.put("event", rs.getString("event_val"));
                t.put("tableName", rs.getString("tbl_val"));
                return t;
            }
        );

        List<Map<String, Object>> routines = jdbcTemplate.query(
            "SELECT ROUTINE_NAME AS r_name, ROUTINE_TYPE AS r_type " +
            "FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() " +
            "ORDER BY ROUTINE_NAME",
            (rs, rowNum) -> {
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("routineName", rs.getString("r_name"));
                r.put("routineType", rs.getString("r_type"));
                return r;
            }
        );

        Map<String, Object> catalog = new LinkedHashMap<>();
        catalog.put("databaseName", dbName);
        catalog.put("mysqlVersion", mysqlVersion);
        catalog.put("baseTableCount", baseTableCount);
        catalog.put("viewCount", viewCount);
        catalog.put("totalRelationCount", relations.size());
        catalog.put("totalAttributeCount", totalAttributesHolder[0]);
        catalog.put("totalConstraintCount", totalConstraints != null ? totalConstraints : 0);
        catalog.put("triggers", triggers);
        catalog.put("routines", routines);
        catalog.put("relations", relations);
        return catalog;
    }

    public Map<String, Object> queryRelationDetails(String requestedTable, int limit) {
        if (requestedTable == null || !requestedTable.matches("^[a-zA-Z0-9_]+$")) {
            return null;
        }
        Set<String> validRelations = new LinkedHashSet<>(
            jdbcTemplate.queryForList(
                "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
                String.class
            )
        );

        String canonicalName = null;
        for (String valid : validRelations) {
            if (valid.equalsIgnoreCase(requestedTable)) {
                canonicalName = valid;
                break;
            }
        }
        if (canonicalName == null) {
            return null;
        }

        int safeLimit = Math.max(0, Math.min(limit, 50));

        String createDdl = jdbcTemplate.query(
            "SHOW CREATE TABLE `" + canonicalName + "`",
            rs -> {
                if (!rs.next()) {
                    return "";
                }
                ResultSetMetaData meta = rs.getMetaData();
                return meta.getColumnCount() >= 2 ? rs.getString(2) : "";
            }
        );

        List<Map<String, Object>> sampleRows = new ArrayList<>();
        if (safeLimit > 0) {
            sampleRows = jdbcTemplate.query(
                "SELECT * FROM `" + canonicalName + "` LIMIT " + safeLimit,
                (rs, rowNum) -> {
                    ResultSetMetaData meta = rs.getMetaData();
                    int colCount = meta.getColumnCount();
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= colCount; i++) {
                        String label = meta.getColumnLabel(i);
                        if ("password_hash".equalsIgnoreCase(label)) {
                            row.put(label, "[BCrypt $2a$10$ Hash Protected]");
                        } else {
                            Object val = rs.getObject(i);
                            row.put(label, val != null ? String.valueOf(val) : null);
                        }
                    }
                    return row;
                }
            );
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tableName", canonicalName.toLowerCase(Locale.ROOT).equals(canonicalName) ? canonicalName : canonicalName);
        result.put("createDdl", createDdl);
        result.put("sampleRows", sampleRows);
        return result;
    }
}
