package com.bengaluru.transit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
class TransitConnectIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String loginAndExtractToken(String email, String password) throws Exception {
        MvcResult loginRes = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(String.format("{\"email\":\"%s\",\"password\":\"%s\"}", email, password)))
            .andExpect(status().isOk())
            .andReturn();
        return objectMapper.readTree(loginRes.getResponse().getContentAsString())
            .get("accessToken").asText();
    }

    @Test
    void t01_healthNetworkFareAndAnalyticsViewsReturnLiveMysqlData() throws Exception {
        mockMvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"))
            .andExpect(jsonPath("$.database.metroStationCount").value(31))
            .andExpect(jsonPath("$.database.busStopCount").value(45))
            .andExpect(jsonPath("$.database.busRouteCount").value(13))
            .andExpect(jsonPath("$.database.transferHubCount").value(15));

        mockMvc.perform(get("/api/transit/network"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.nodes.length()").value(76))
            .andExpect(jsonPath("$.metroLines.length()").value(3))
            .andExpect(jsonPath("$.metroLines[0].stations").isArray())
            .andExpect(jsonPath("$.busRoutes.length()").value(13))
            .andExpect(jsonPath("$.transferHubs.length()").value(15));

        mockMvc.perform(get("/api/transit/fares"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(18));

        mockMvc.perform(get("/api/analytics/dashboard"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.popularCorridors").isArray())
            .andExpect(jsonPath("$.multimodalHubs.length()").value(15))
            .andExpect(jsonPath("$.transportModeUsage").isArray())
            .andExpect(jsonPath("$.routeFeedbackSummary.length()").value(13));
    }

    @Test
    void t02_geolocationStoredProcedureFindsNearestNodesAndRejectsInvalidCoords() throws Exception {
        mockMvc.perform(get("/api/transit/nearby")
                .param("lat", "12.9172")
                .param("lng", "77.6228")
                .param("radiusKm", "1.5")
                .param("limit", "5"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].nodeKey").value("BUS_1"))
            .andExpect(jsonPath("$[0].displayName").value("Silk Board Junction"));

        // Outside-Bengaluru GPS coordinates return empty nearby list for clean manual fallback
        mockMvc.perform(get("/api/transit/nearby")
                .param("lat", "45.0000")
                .param("lng", "77.6228"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));

        // Admin creation of a bus stop outside Bengaluru bounding box is rejected with HTTP 400
        String adminToken = loginAndExtractToken("admin@transitconnect.in", "Admin@123");
        mockMvc.perform(post("/api/admin/bus-stops")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "stopCode": "BMTC-OUT",
                      "stopName": "Invalid Outside Bengaluru Stop",
                      "areaName": "OutOfBounds",
                      "latitude": 45.000000,
                      "longitude": 77.622800,
                      "hasShelter": true,
                      "isInterchangeHub": false,
                      "isActive": true
                    }
                    """))
            .andExpect(status().isBadRequest());
    }

    @Test
    void t03_multiModalOptimizerComputesFastestCheapestMinTransfersAndModeComparison() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/journeys/search")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "sourceNodeKey": "BUS_1",
                      "destinationNodeKey": "METRO_14",
                      "optimizationType": "FASTEST",
                      "routeCategory": "COMBINED"
                    }
                    """))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode root = objectMapper.readTree(res.getResponse().getContentAsString());
        JsonNode rec = root.get("recommended");

        int walk = rec.get("walkingTimeMins").asInt();
        int bus = rec.get("busTimeMins").asInt();
        int metro = rec.get("metroTimeMins").asInt();
        int wait = rec.get("waitingTimeMins").asInt();
        int transfer = rec.get("transferTimeMins").asInt();
        int total = rec.get("totalTimeMins").asInt();

        assertThat(walk + bus + metro + wait + transfer).isEqualTo(total);
        assertThat(rec.get("transferCount").asInt()).isEqualTo(1);
        assertThat(new BigDecimal(rec.get("estimatedFareInr").asText()))
            .isEqualByComparingTo(new BigDecimal("55.00"));
        assertThat(rec.get("legs").get(0).get("routeOrLineCode").asText()).isEqualTo("500-D");
        assertThat(rec.get("legs").get(2).get("routeOrLineCode").asText()).isEqualTo("PURPLE");

        int combinedTime = root.path("modeComparison").path("COMBINED").path("totalTimeMins").asInt();
        int busOnlyTime = root.path("modeComparison").path("BUS_ONLY").path("totalTimeMins").asInt();
        int metroOnlyTime = root.path("modeComparison").path("METRO_ONLY").path("totalTimeMins").asInt();
        assertThat(combinedTime).isLessThan(busOnlyTime);
        assertThat(combinedTime).isLessThan(metroOnlyTime);

        JsonNode alternatives = root.get("alternatives");
        BigDecimal cheapestFare = new BigDecimal(alternatives.get(1).get("estimatedFareInr").asText());
        assertThat(cheapestFare).isLessThan(new BigDecimal("55.00"));

        mockMvc.perform(post("/api/journeys/search")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"sourceNodeKey":"BUS_1","destinationNodeKey":"BUS_1","optimizationType":"FASTEST","routeCategory":"COMBINED"}
                    """))
            .andExpect(status().isBadRequest());
    }

    @Test
    @Transactional
    void t04_authRegistrationCreatesNcmcWalletBlocksDuplicatesAndRejectsBadPassword() throws Exception {
        String registerPayload = """
            {
              "fullName": "Rohan Kulkarni",
              "email": "rohan.phase9@bengaluru.in",
              "phone": "9880099112",
              "password": "User@1234",
              "preferredLanguage": "en"
            }
            """;

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerPayload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.user.walletBalanceInr").value(250.0))
            .andExpect(jsonPath("$.user.roles[0]").value("ROLE_PASSENGER"));

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerPayload))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(Matchers.containsString("already exists")));

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"rohan.phase9@bengaluru.in","password":"WrongPassword@99"}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(Matchers.containsString("Invalid email address or password")));
    }

    @Test
    void t05_rbacSecurityUnauthenticated401AndPassenger403Guards() throws Exception {
        mockMvc.perform(get("/api/admin/inventory"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.status").value(401));

        mockMvc.perform(get("/api/journeys/history"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.status").value(401));

        String passengerToken = loginAndExtractToken("arjun.rao@bengaluru.in", "Pass@123");

        mockMvc.perform(get("/api/admin/inventory")
                .header("Authorization", "Bearer " + passengerToken))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.status").value(403));

        mockMvc.perform(get("/api/admin/audit-logs")
                .header("Authorization", "Bearer " + passengerToken))
            .andExpect(status().isForbidden());
    }

    @Test
    void t06_acidSmartWalletInsufficientBalanceRollbackLeavesZeroSideEffects() throws Exception {
        String kavyaToken = loginAndExtractToken("kavya.nair@bengaluru.in", "Pass@123");

        Integer beforeHistoryCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM travel_history WHERE user_id = (SELECT user_id FROM users WHERE email = 'kavya.nair@bengaluru.in')",
            Integer.class
        );

        mockMvc.perform(post("/api/journeys/book")
                .header("Authorization", "Bearer " + kavyaToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "planId": 1,
                      "authMode": "PASSWORD",
                      "password": "Pass@123"
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(
                Matchers.containsString("Insufficient Smart Wallet balance")
            ));

        mockMvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + kavyaToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.walletBalanceInr").value(35.0));

        Integer afterHistoryCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM travel_history WHERE user_id = (SELECT user_id FROM users WHERE email = 'kavya.nair@bengaluru.in')",
            Integer.class
        );
        assertThat(afterHistoryCount).isEqualTo(beforeHistoryCount);
    }

    @Test
    void t07_acidSmartWalletTopUpAndUnifiedQrBookingCommitAtomically() throws Exception {
        String tempEmail = "acid.commit.phase9@bengaluru.in";
        Long tempUserId = null;
        Long createdPlanId = null;

        try {
            MvcResult reg = mockMvc.perform(post("/api/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "fullName": "ACID Commit Tester",
                          "email": "acid.commit.phase9@bengaluru.in",
                          "phone": "9880099777",
                          "password": "User@1234",
                          "preferredLanguage": "en"
                        }
                        """))
                .andExpect(status().isCreated())
                .andReturn();

            JsonNode regRoot = objectMapper.readTree(reg.getResponse().getContentAsString());
            String token = regRoot.get("accessToken").asText();
            tempUserId = regRoot.path("user").path("userId").asLong();

            // 1. Top up Rs. 100.00 -> Rs. 250.00 + Rs. 100.00 = Rs. 350.00
            mockMvc.perform(post("/api/journeys/wallet/topup")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"amountInr\": 100.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.walletBalanceInr").value(350.0));

            // 2. Search Silk Board -> Whitefield (Rs. 55.00)
            MvcResult searchRes = mockMvc.perform(post("/api/journeys/search")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "sourceNodeKey": "BUS_1",
                          "destinationNodeKey": "METRO_14",
                          "optimizationType": "FASTEST",
                          "routeCategory": "COMBINED"
                        }
                        """))
                .andExpect(status().isOk())
                .andReturn();
            createdPlanId = objectMapper.readTree(searchRes.getResponse().getContentAsString())
                .path("recommended").path("planId").asLong();

            // 3. Request server-signed 4-digit security challenge & book Unified QR Pass
            MvcResult challengeRes = mockMvc.perform(post("/api/journeys/book/challenge")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"planId\": " + createdPlanId + "}"))
                .andExpect(status().isOk())
                .andReturn();
            JsonNode chRoot = objectMapper.readTree(challengeRes.getResponse().getContentAsString());
            String pinCode = chRoot.get("pinCode").asText();
            String challengeToken = chRoot.get("challengeToken").asText();

            mockMvc.perform(post("/api/journeys/book")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "planId": %d,
                          "authMode": "QUICK_CODE",
                          "challengeToken": "%s",
                          "enteredCode": "%s"
                        }
                        """.formatted(createdPlanId, challengeToken, pinCode)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.qrPassCode").value(Matchers.startsWith("BTC-QR-")))
                .andExpect(jsonPath("$.farePaidInr").value(55.0))
                .andExpect(jsonPath("$.remainingWalletBalanceInr").value(295.0));

            // 4. Confirm travel_history and wallet endpoint reflect the committed transaction
            mockMvc.perform(get("/api/journeys/history")
                    .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.walletBalanceInr").value(295.0))
                .andExpect(jsonPath("$.bookedPasses.length()").value(1));
        } finally {
            if (tempUserId != null) {
                jdbcTemplate.update("DELETE FROM travel_history WHERE user_id = ?", tempUserId);
                jdbcTemplate.update("DELETE FROM journey_plans WHERE user_id = ?", tempUserId);
                jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", tempUserId);
            } else if (createdPlanId != null) {
                jdbcTemplate.update("DELETE FROM journey_plans WHERE plan_id = ?", createdPlanId);
            }
            jdbcTemplate.update("DELETE FROM users WHERE email = ?", tempEmail);
        }
    }

    @Test
    @Transactional
    void t08_passengerFeedbackValidationAndAdminModerationWorkflow() throws Exception {
        String passengerToken = loginAndExtractToken("arjun.rao@bengaluru.in", "Pass@123");
        String adminToken = loginAndExtractToken("admin@transitconnect.in", "Admin@123");

        mockMvc.perform(post("/api/feedback")
                .header("Authorization", "Bearer " + passengerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "targetType": "BUS_ROUTE",
                      "busRouteId": 1,
                      "rating": 6,
                      "comments": "Out of range rating test"
                    }
                    """))
            .andExpect(status().isBadRequest());

        MvcResult fbRes = mockMvc.perform(post("/api/feedback")
                .header("Authorization", "Bearer " + passengerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "targetType": "BUS_ROUTE",
                      "busRouteId": 1,
                      "rating": 5,
                      "comments": "Clean KR Puram interchange signage on 500-D!"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.reviewStatus").value("PENDING"))
            .andReturn();

        long feedbackId = objectMapper.readTree(fbRes.getResponse().getContentAsString())
            .get("feedbackId").asLong();

        mockMvc.perform(patch("/api/admin/feedback/" + feedbackId + "/moderate")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reviewStatus\": \"RESOLVED\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.reviewStatus").value("RESOLVED"));
    }

    @Test
    void t09_adminCrudFiresMysqlTriggersInCommittedOrder() throws Exception {
        String adminToken = loginAndExtractToken("admin@transitconnect.in", "Admin@123");
        Long routeId = null;

        try {
            MvcResult createRes = mockMvc.perform(post("/api/admin/bus-routes")
                    .header("Authorization", "Bearer " + adminToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "routeNumber": "500-P9",
                          "routeName": "Silk Board - Bellandur Phase 9 Shuttle",
                          "serviceType": "ORDINARY",
                          "originName": "Silk Board Junction",
                          "destinationName": "Bellandur Gate",
                          "totalDistanceKm": 7.40,
                          "isActive": true
                        }
                        """))
                .andExpect(status().isCreated())
                .andReturn();
            routeId = objectMapper.readTree(createRes.getResponse().getContentAsString())
                .get("routeId").asLong();

            mockMvc.perform(put("/api/admin/bus-routes/" + routeId)
                    .header("Authorization", "Bearer " + adminToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "routeNumber": "500-P9",
                          "routeName": "Silk Board - Bellandur Phase 9 Express",
                          "serviceType": "VAJRA_AC",
                          "originName": "Silk Board Junction",
                          "destinationName": "Bellandur Gate",
                          "totalDistanceKm": 7.60,
                          "isActive": false
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceType").value("VAJRA_AC"));

            mockMvc.perform(delete("/api/admin/bus-routes/" + routeId)
                    .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());
            routeId = null;

            mockMvc.perform(get("/api/admin/audit-logs?page=0&size=5")
                    .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].recordIdentifier").value("500-P9"))
                .andExpect(jsonPath("$.content[0].operationType").value("DELETE"))
                .andExpect(jsonPath("$.content[1].operationType").value("UPDATE"))
                .andExpect(jsonPath("$.content[2].operationType").value("INSERT"));
        } finally {
            if (routeId != null) {
                jdbcTemplate.update("DELETE FROM bus_routes WHERE route_id = ?", routeId);
            }
            jdbcTemplate.update("DELETE FROM audit_logs WHERE record_identifier = '500-P9'");
        }
    }

    @Test
    void t10_mysqlExplainPlansConfirmIndexUsageWithoutFullTableScans() {
        List<String> indexedQueries = List.of(
            "EXPLAIN SELECT brs.route_id, brs.direction, brs.stop_sequence FROM bus_route_stops brs WHERE brs.stop_id = 1",
            "EXPLAIN SELECT brs.stop_sequence, brs.stop_id FROM bus_route_stops brs WHERE brs.route_id = 1 AND brs.direction = 'OUTBOUND' ORDER BY brs.stop_sequence ASC",
            "EXPLAIN SELECT mc.to_station_id, mc.distance_km FROM metro_connections mc WHERE mc.from_station_id = 10",
            "EXPLAIN SELECT tp.hub_name, tp.metro_station_id FROM transfer_points tp WHERE tp.bus_stop_id = 7 AND tp.is_active = TRUE",
            "EXPLAIN SELECT fr.fare_inr FROM fare_rules fr WHERE fr.service_category = 'NAMMA_METRO' AND 12.20 > fr.min_distance_km AND 12.20 <= fr.max_distance_km",
            "EXPLAIN SELECT th.history_id, th.qr_pass_code FROM travel_history th WHERE th.user_id = 2 ORDER BY th.travelled_at DESC"
        );

        for (String sql : indexedQueries) {
            List<Map<String, Object>> planRows = jdbcTemplate.queryForList(sql);
            assertThat(planRows).isNotEmpty();
            Map<String, Object> row = planRows.get(0);
            Object chosenKey = row.get("key");
            String accessType = String.valueOf(row.get("type"));

            assertThat(chosenKey)
                .as("Expected MySQL optimizer to choose an index for query: %s", sql)
                .isNotNull();
            assertThat(accessType)
                .as("Expected indexed lookup (not full table scan ALL) for query: %s", sql)
                .isNotEqualToIgnoringCase("ALL");
        }
    }

    @Test
    @Transactional
    void t11_southWestShortcutAndGpsMultiCandidateAvoidMajesticLoop() throws Exception {
        // 1. Station-to-Station: Jayanagar [METRO_20] -> Mysuru Road [METRO_3]
        // Direct BMTC 60-A shortcut must beat the northern Majestic Metro loop in both time and fare!
        MvcResult stationRes = mockMvc.perform(post("/api/journeys/search")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "sourceNodeKey": "METRO_20",
                      "destinationNodeKey": "METRO_3",
                      "optimizationType": "FASTEST",
                      "routeCategory": "COMBINED"
                    }
                    """))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode stRoot = objectMapper.readTree(stationRes.getResponse().getContentAsString());
        int shortcutMins = stRoot.path("recommended").path("totalTimeMins").asInt();
        int metroLoopMins = stRoot.path("modeComparison").path("METRO_ONLY").path("totalTimeMins").asInt();
        BigDecimal shortcutFare = new BigDecimal(stRoot.path("recommended").path("estimatedFareInr").asText());
        BigDecimal metroLoopFare = new BigDecimal(
            stRoot.path("modeComparison").path("METRO_ONLY").path("estimatedFareInr").asText()
        );

        assertThat(shortcutMins).isLessThan(metroLoopMins);
        assertThat(shortcutFare).isLessThan(metroLoopFare);
        assertThat(stRoot.path("modeComparison").path("BUS_ONLY").isMissingNode()).isFalse();

        // 2. GPS Origin in Hanumantha Nagar (12.9420, 77.5620) -> Mysuru Road [METRO_3]
        // Even if sourceNodeKey initially passed is METRO_20 (Jayanagar, 2.04 km SE),
        // Multi-Candidate GPS Super-Source must pick Hanumanthanagar [BUS_24] + BMTC 60-A (~19-21 mins)
        // instead of the 55-minute Majestic loop!
        MvcResult gpsRes = mockMvc.perform(post("/api/journeys/search")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "sourceNodeKey": "METRO_20",
                      "destinationNodeKey": "METRO_3",
                      "optimizationType": "FASTEST",
                      "routeCategory": "COMBINED",
                      "originLat": 12.942000,
                      "originLng": 77.562000
                    }
                    """))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode gpsRoot = objectMapper.readTree(gpsRes.getResponse().getContentAsString());
        JsonNode gpsRec = gpsRoot.path("recommended");
        assertThat(gpsRec.path("sourceNodeKey").asText()).isEqualTo("BUS_24");
        assertThat(gpsRec.path("totalTimeMins").asInt()).isLessThanOrEqualTo(24);
        assertThat(new BigDecimal(gpsRec.path("estimatedFareInr").asText()))
            .isLessThanOrEqualTo(new BigDecimal("15.00"));

        // 3. True Bus + Metro West Shortcut: Banashankari [METRO_22] -> Kengeri [METRO_2]
        // BMTC 401-K to Mysuru Road + Purple Line to Kengeri beats Green+Purple via Majestic!
        MvcResult bskRes = mockMvc.perform(post("/api/journeys/search")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "sourceNodeKey": "METRO_22",
                      "destinationNodeKey": "METRO_2",
                      "optimizationType": "FASTEST",
                      "routeCategory": "COMBINED"
                    }
                    """))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode bskRoot = objectMapper.readTree(bskRes.getResponse().getContentAsString());
        int bskCombined = bskRoot.path("recommended").path("totalTimeMins").asInt();
        int bskMetroOnly = bskRoot.path("modeComparison").path("METRO_ONLY").path("totalTimeMins").asInt();
        assertThat(bskCombined).isLessThan(bskMetroOnly);
    }

    @Test
    @Transactional
    void t12_specificPlaceAutocompleteAndDoorToDoorRoutingWorkEndToEnd() throws Exception {
        // 1. Place autocomplete searches MySQL city_landmarks + stations + bus stops
        mockMvc.perform(get("/api/transit/places?q=Phoenix"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].placeType").value("LANDMARK"))
            .andExpect(jsonPath("$[0].name").value("Phoenix Mall of Asia"))
            .andExpect(jsonPath("$[1].name").value("Phoenix Marketcity Bengaluru"));

        // 2. Full Door-to-Door Custom Origin -> Custom Destination (no fixed dropdown keys needed)
        MvcResult doorRes = mockMvc.perform(post("/api/journeys/search")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "optimizationType": "FASTEST",
                      "routeCategory": "COMBINED",
                      "originLat": 12.941000,
                      "originLng": 77.565500,
                      "originPlaceName": "BMS College of Engineering",
                      "destLat": 12.995800,
                      "destLng": 77.696400,
                      "destPlaceName": "Phoenix Marketcity Bengaluru"
                    }
                    """))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode root = objectMapper.readTree(doorRes.getResponse().getContentAsString());
        JsonNode rec = root.path("recommended");

        assertThat(rec.path("sourceName").asText()).startsWith("BMS College of Engineering (via ");
        assertThat(rec.path("destinationName").asText()).startsWith("Phoenix Marketcity Bengaluru (via ");

        int sumParts = rec.path("walkingTimeMins").asInt()
            + rec.path("busTimeMins").asInt()
            + rec.path("metroTimeMins").asInt()
            + rec.path("waitingTimeMins").asInt()
            + rec.path("transferTimeMins").asInt();
        assertThat(rec.path("totalTimeMins").asInt()).isEqualTo(sumParts);

        JsonNode legs = rec.path("legs");
        assertThat(legs.size()).isGreaterThanOrEqualTo(3);
        assertThat(legs.get(0).path("legMode").asText()).isEqualTo("WALK");
        assertThat(legs.get(0).path("routeOrLineCode").asText()).isEqualTo("FIRST_MILE");
        assertThat(legs.get(legs.size() - 1).path("legMode").asText()).isEqualTo("WALK");
        assertThat(legs.get(legs.size() - 1).path("routeOrLineCode").asText()).isEqualTo("LAST_MILE");

        // All 3 mode tabs (Combined, Bus Only, Metro Only) must resolve cleanly for custom places
        assertThat(root.path("modeComparison").path("COMBINED").isMissingNode()).isFalse();
        assertThat(root.path("modeComparison").path("BUS_ONLY").isMissingNode()).isFalse();
        assertThat(root.path("modeComparison").path("METRO_ONLY").isMissingNode()).isFalse();
        assertThat(rec.path("walkingTimeMins").asInt()).isLessThanOrEqualTo(10);

        // 3. BMS College of Engineering -> Phoenix Mall of Asia (Byatarayanapura NH-44):
        // Uses exact nearest BMTC stops (BMS College + Byatarayanapura Mall of Asia) with <= 10 min total walk!
        MvcResult mallAsiaRes = mockMvc.perform(post("/api/journeys/search")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "optimizationType": "FASTEST",
                      "routeCategory": "COMBINED",
                      "originLat": 12.941000,
                      "originLng": 77.565500,
                      "originPlaceName": "BMS College of Engineering",
                      "destLat": 13.070600,
                      "destLng": 77.591600,
                      "destPlaceName": "Phoenix Mall of Asia"
                    }
                    """))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode mallAsiaRec = objectMapper.readTree(mallAsiaRes.getResponse().getContentAsString())
            .path("recommended");
        assertThat(mallAsiaRec.path("walkingTimeMins").asInt()).isLessThanOrEqualTo(10);
        assertThat(mallAsiaRec.path("destinationName").asText()).contains("Byatarayanapura");

        // 4. Even for an inner residential pin (>1.5 km from any trunk hub, e.g. Sahakaranagar),
        // Local BMTC Feeder Connector keeps passenger walking <= 10 mins total!
        MvcResult innerPinRes = mockMvc.perform(post("/api/journeys/search")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "optimizationType": "FASTEST",
                      "routeCategory": "COMBINED",
                      "originLat": 12.941000,
                      "originLng": 77.565500,
                      "originPlaceName": "BMS College of Engineering",
                      "destLat": 13.062800,
                      "destLng": 77.580600,
                      "destPlaceName": "Sahakaranagar Main Road"
                    }
                    """))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode innerRec = objectMapper.readTree(innerPinRes.getResponse().getContentAsString())
            .path("recommended");
        assertThat(innerRec.path("walkingTimeMins").asInt()).isLessThanOrEqualTo(10);
        int innerParts = innerRec.path("walkingTimeMins").asInt()
            + innerRec.path("busTimeMins").asInt()
            + innerRec.path("metroTimeMins").asInt()
            + innerRec.path("waitingTimeMins").asInt()
            + innerRec.path("transferTimeMins").asInt();
        assertThat(innerRec.path("totalTimeMins").asInt()).isEqualTo(innerParts);
    }

    @Test
    void t13_megaPlacesDirectoryAddressesAndShortBookingAuthentication() throws Exception {
        // 1. Verify comprehensive Bengaluru categories & full street addresses + PIN codes
        mockMvc.perform(get("/api/transit/places?category=GOVT_OFFICE&limit=100"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(40)))
            .andExpect(jsonPath("$[0].address").isNotEmpty());

        mockMvc.perform(get("/api/transit/places?category=SCHOOL&limit=100"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(45)));

        mockMvc.perform(get("/api/transit/places?category=COLLEGE&limit=100"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(55)));

        mockMvc.perform(get("/api/transit/places?category=FAMOUS_PLACE&limit=100"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(35)));

        // Multi-token search across institution name, area, street address, and RTO code
        mockMvc.perform(get("/api/transit/places").param("q", "NPS Indiranagar"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("National Public School (NPS) Indiranagar"))
            .andExpect(jsonPath("$[0].address").value(org.hamcrest.Matchers.containsString("560008")));

        mockMvc.perform(get("/api/transit/places").param("q", "RTO KA-01"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("RTO Bengaluru Central (KA-01 Koramangala)"))
            .andExpect(jsonPath("$[0].address").value(org.hamcrest.Matchers.containsString("Koramangala")));

        // 2. Verify Short Authentication before booking Unified QR Pass prevents accidental clicks
        String passengerToken = loginAndExtractToken("arjun.rao@bengaluru.in", "Pass@123");
        Long userId = jdbcTemplate.queryForObject(
            "SELECT user_id FROM users WHERE email = 'arjun.rao@bengaluru.in'", Long.class
        );
        java.math.BigDecimal initialBalance = jdbcTemplate.queryForObject(
            "SELECT balance_inr FROM passenger_wallets WHERE user_id = ?", java.math.BigDecimal.class, userId
        );

        MvcResult searchRes = mockMvc.perform(post("/api/journeys/search")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "optimizationType": "FASTEST",
                      "routeCategory": "COMBINED",
                      "originLat": 12.979667,
                      "originLng": 77.590667,
                      "originPlaceName": "Vidhana Soudha (State Secretariat)",
                      "destLat": 12.969300,
                      "destLng": 77.599800,
                      "destPlaceName": "Bishop Cotton Boys School"
                    }
                    """))
            .andExpect(status().isOk())
            .andReturn();
        long planId = objectMapper.readTree(searchRes.getResponse().getContentAsString())
            .path("recommended").path("planId").asLong();

        Long bookedHistoryId = null;
        try {
            // Unauthenticated 1-click call without authMode -> HTTP 400 & zero wallet debit!
            mockMvc.perform(post("/api/journeys/book")
                    .header("Authorization", "Bearer " + passengerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"planId\": " + planId + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                    org.hamcrest.Matchers.containsString("Short authentication Shield required")
                ));

            // Server-issued HMAC challenge with mismatched 4-digit PIN -> HTTP 400 & zero wallet debit
            MvcResult chRes = mockMvc.perform(post("/api/journeys/book/challenge")
                    .header("Authorization", "Bearer " + passengerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"planId\": " + planId + "}"))
                .andExpect(status().isOk())
                .andReturn();
            JsonNode chJson = objectMapper.readTree(chRes.getResponse().getContentAsString());
            String issuedPin = chJson.get("pinCode").asText();
            String issuedToken = chJson.get("challengeToken").asText();
            String wrongPin = "9999".equals(issuedPin) ? "0000" : "9999";

            mockMvc.perform(post("/api/journeys/book")
                    .header("Authorization", "Bearer " + passengerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "planId": %d,
                          "authMode": "QUICK_CODE",
                          "challengeToken": "%s",
                          "enteredCode": "%s"
                        }
                        """.formatted(planId, issuedToken, wrongPin)))
                .andExpect(status().isBadRequest());

            // Wrong account password -> HTTP 400 & zero wallet debit
            mockMvc.perform(post("/api/journeys/book")
                    .header("Authorization", "Bearer " + passengerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "planId": %d,
                          "authMode": "PASSWORD",
                          "password": "WrongPassword999"
                        }
                        """.formatted(planId)))
                .andExpect(status().isBadRequest());

            java.math.BigDecimal afterFailedAuthBalance = jdbcTemplate.queryForObject(
                "SELECT balance_inr FROM passenger_wallets WHERE user_id = ?", java.math.BigDecimal.class, userId
            );
            assertThat(afterFailedAuthBalance).isEqualByComparingTo(initialBalance);

            // Correct BCrypt account password -> HTTP 200 OK & ACID Unified QR Pass issued
            MvcResult okBook = mockMvc.perform(post("/api/journeys/book")
                    .header("Authorization", "Bearer " + passengerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "planId": %d,
                          "authMode": "PASSWORD",
                          "password": "Pass@123"
                        }
                        """.formatted(planId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.qrPassCode").value(org.hamcrest.Matchers.startsWith("BTC-QR-")))
                .andReturn();

            bookedHistoryId = objectMapper.readTree(okBook.getResponse().getContentAsString())
                .path("historyId").asLong();
        } finally {
            if (bookedHistoryId != null) {
                jdbcTemplate.update("DELETE FROM travel_history WHERE history_id = ?", bookedHistoryId);
            }
            jdbcTemplate.update(
                "UPDATE passenger_wallets SET balance_inr = ? WHERE user_id = ?",
                initialBalance,
                userId
            );
        }
    }

    @Test
    void t14_passScanAndAdminLandmarksCrudWork() throws Exception {
        String passengerToken = loginAndExtractToken("arjun.rao@bengaluru.in", "Pass@123");
        String adminToken = loginAndExtractToken("admin@transitconnect.in", "Admin@123");

        Long userId = jdbcTemplate.queryForObject(
            "SELECT user_id FROM users WHERE email = 'arjun.rao@bengaluru.in'", Long.class
        );
        java.math.BigDecimal initialBalance = jdbcTemplate.queryForObject(
            "SELECT balance_inr FROM passenger_wallets WHERE user_id = ?", java.math.BigDecimal.class, userId
        );
        Long bookedHistoryId = null;
        Long createdLandmarkId = null;

        try {
            // 1. Admin inventory now includes cityLandmarks (300 seeded entries)
            mockMvc.perform(get("/api/admin/inventory")
                    .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cityLandmarks").isArray());

            // 2. Admin creates, updates, and deletes a Bengaluru place with audit logging
            MvcResult createLmRes = mockMvc.perform(post("/api/admin/landmarks")
                    .header("Authorization", "Bearer " + adminToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "landmarkName": "TransitConnect Mobility Innovation Lab",
                          "category": "TECH_PARK",
                          "areaName": "MG Road",
                          "streetAddress": "42 Mahatma Gandhi Road, Ashok Nagar, Bengaluru",
                          "pincode": "560001",
                          "latitude": 12.975600,
                          "longitude": 77.606600,
                          "isActive": true
                        }
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.landmarkName").value("TransitConnect Mobility Innovation Lab"))
                .andReturn();

            createdLandmarkId = objectMapper.readTree(createLmRes.getResponse().getContentAsString())
                .get("landmarkId").asLong();

            mockMvc.perform(put("/api/admin/landmarks/" + createdLandmarkId)
                    .header("Authorization", "Bearer " + adminToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "landmarkName": "TransitConnect Mobility Innovation Lab",
                          "category": "TECH_PARK",
                          "areaName": "MG Road / Trinity",
                          "streetAddress": "42 Mahatma Gandhi Road, Near Trinity Circle, Bengaluru",
                          "pincode": "560001",
                          "latitude": 12.975600,
                          "longitude": 77.606600,
                          "isActive": true
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.areaName").value("MG Road / Trinity"));

            mockMvc.perform(delete("/api/admin/landmarks/" + createdLandmarkId)
                    .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());
            createdLandmarkId = null;

            // 3. Passenger books pass & scans it at transit gate (ACTIVE -> USED)
            MvcResult searchRes = mockMvc.perform(post("/api/journeys/search")
                    .header("Authorization", "Bearer " + passengerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "optimizationType": "FASTEST",
                          "routeCategory": "COMBINED",
                          "originLat": 12.979667,
                          "originLng": 77.590667,
                          "originPlaceName": "Vidhana Soudha (State Secretariat)",
                          "destLat": 12.969300,
                          "destLng": 77.599800,
                          "destPlaceName": "Bishop Cotton Boys School"
                        }
                        """))
                .andExpect(status().isOk())
                .andReturn();
            long planId = objectMapper.readTree(searchRes.getResponse().getContentAsString())
                .path("recommended").path("planId").asLong();

            MvcResult bookRes = mockMvc.perform(post("/api/journeys/book")
                    .header("Authorization", "Bearer " + passengerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "planId": %d,
                          "authMode": "PASSWORD",
                          "password": "Pass@123"
                        }
                        """.formatted(planId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.passStatus").value("ACTIVE"))
                .andReturn();

            bookedHistoryId = objectMapper.readTree(bookRes.getResponse().getContentAsString())
                .path("historyId").asLong();

            mockMvc.perform(patch("/api/journeys/passes/" + bookedHistoryId + "/scan")
                    .header("Authorization", "Bearer " + passengerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passStatus").value("USED"));
        } finally {
            if (createdLandmarkId != null) {
                jdbcTemplate.update("DELETE FROM city_landmarks WHERE landmark_id = ?", createdLandmarkId);
            }
            jdbcTemplate.update(
                "DELETE FROM audit_logs WHERE table_name = 'city_landmarks' AND new_payload LIKE '%TransitConnect Mobility Innovation Lab%'"
            );
            jdbcTemplate.update(
                "DELETE FROM audit_logs WHERE table_name = 'city_landmarks' AND old_payload LIKE '%TransitConnect Mobility Innovation Lab%'"
            );
            if (bookedHistoryId != null) {
                jdbcTemplate.update("DELETE FROM travel_history WHERE history_id = ?", bookedHistoryId);
            }
            jdbcTemplate.update(
                "UPDATE passenger_wallets SET balance_inr = ? WHERE user_id = ?",
                initialBalance,
                userId
            );
        }
    }

    @Test
    void t15_adminDbmsSchemaCatalogReturnsAll20Tables4ViewsAndAttributes() throws Exception {
        String passengerToken = loginAndExtractToken("arjun.rao@bengaluru.in", "Pass@123");
        String adminToken = loginAndExtractToken("admin@transitconnect.in", "Admin@123");

        // 1. Non-admin passenger is blocked with HTTP 403 Forbidden
        mockMvc.perform(get("/api/admin/dbms-schema")
                .header("Authorization", "Bearer " + passengerToken))
            .andExpect(status().isForbidden());

        // 2. Admin receives all 20 base tables + 4 SQL views + attributes + FK metadata
        mockMvc.perform(get("/api/admin/dbms-schema")
                .header("Authorization", "Bearer " + adminToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.baseTableCount").value(20))
            .andExpect(jsonPath("$.viewCount").value(4))
            .andExpect(jsonPath("$.totalRelationCount").value(24))
            .andExpect(jsonPath("$.relations").isArray())
            .andExpect(jsonPath("$.relations[0].attributes").isArray());

        // 3. Admin can inspect CREATE TABLE DDL & masked sample rows for users, while invalid names return 404
        mockMvc.perform(get("/api/admin/dbms-schema/users?limit=5")
                .header("Authorization", "Bearer " + adminToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tableName").value("users"))
            .andExpect(jsonPath("$.createDdl").isString())
            .andExpect(jsonPath("$.sampleRows[0].password_hash").value("[BCrypt $2a$10$ Hash Protected]"));

        mockMvc.perform(get("/api/admin/dbms-schema/non_existent_sql_table")
                .header("Authorization", "Bearer " + adminToken))
            .andExpect(status().isNotFound());
    }
}
