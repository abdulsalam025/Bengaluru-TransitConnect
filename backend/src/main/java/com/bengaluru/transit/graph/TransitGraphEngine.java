package com.bengaluru.transit.graph;

import com.bengaluru.transit.dto.JourneyDtos.JourneyLegDto;
import com.bengaluru.transit.dto.JourneyDtos.RouteOptionDto;
import com.bengaluru.transit.entity.BusRoute;
import com.bengaluru.transit.entity.BusRouteStop;
import com.bengaluru.transit.entity.BusStop;
import com.bengaluru.transit.entity.FareRule;
import com.bengaluru.transit.entity.MetroConnection;
import com.bengaluru.transit.entity.MetroLine;
import com.bengaluru.transit.entity.MetroStation;
import com.bengaluru.transit.entity.Schedule;
import com.bengaluru.transit.entity.TransferPoint;
import com.bengaluru.transit.exception.BadRequestException;
import com.bengaluru.transit.exception.ResourceNotFoundException;
import com.bengaluru.transit.repository.BusRouteRepository;
import com.bengaluru.transit.repository.BusRouteStopRepository;
import com.bengaluru.transit.repository.BusStopRepository;
import com.bengaluru.transit.repository.FareRuleRepository;
import com.bengaluru.transit.repository.MetroConnectionRepository;
import com.bengaluru.transit.repository.MetroLineRepository;
import com.bengaluru.transit.repository.MetroStationRepository;
import com.bengaluru.transit.repository.ScheduleRepository;
import com.bengaluru.transit.repository.TransferPointRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.PriorityQueue;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Multi-modal transit route optimizer backed 100% by live MySQL 8 entities.
 *
 * Builds an on-demand Ride-Leg Graph where every continuous BMTC Bus ride or
 * Namma Metro line ride carries its exact distance-slab fare from fare_rules,
 * headway wait estimate from schedules, intermediate stop polyline coordinates,
 * and hub transfer buffers from transfer_points.
 *
 * Supports three optimization criteria:
 *  - FASTEST       : Dijkstra minimizing total door-to-door minutes
 *  - CHEAPEST      : Dijkstra minimizing total monetary fare (INR), tie-breaking on time
 *  - MIN_TRANSFERS : Lexicographic BFS/Dijkstra minimizing transfer count, tie-breaking on time
 */
@Component
public class TransitGraphEngine {

    private static final String BMTC_BLUE = "#2563EB";
    private static final String VAJRA_CYAN = "#0284C7";
    private static final String TRANSFER_AMBER = "#F59E0B";
    private static final String WALK_SLATE = "#64748B";
    private static final int SAME_BUS_STOP_TRANSFER_MINS = 4;

    public enum OptimizationCriteria {
        FASTEST,
        CHEAPEST,
        MIN_TRANSFERS;

        public static OptimizationCriteria fromString(String raw) {
            if (raw == null || raw.isBlank()) {
                return FASTEST;
            }
            try {
                return OptimizationCriteria.valueOf(raw.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                throw new BadRequestException("Unsupported optimizationType: " + raw
                    + ". Allowed values: FASTEST, CHEAPEST, MIN_TRANSFERS");
            }
        }
    }

    public enum ModeFilter {
        COMBINED,
        BUS_ONLY,
        METRO_ONLY;

        public static ModeFilter fromString(String raw) {
            if (raw == null || raw.isBlank()) {
                return COMBINED;
            }
            try {
                return ModeFilter.valueOf(raw.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                throw new BadRequestException("Unsupported routeCategory: " + raw
                    + ". Allowed values: COMBINED, BUS_ONLY, METRO_ONLY");
            }
        }
    }

    public record GraphNode(
        String nodeKey,
        String nodeType,
        String code,
        String name,
        String corridorOrArea,
        double latitude,
        double longitude
    ) {}

    private record RideEdge(
        String fromNodeKey,
        String toNodeKey,
        String edgeMode,          // BUS, METRO, TRANSFER, WALK
        String serviceCategory,   // BMTC_ORDINARY, BMTC_VAJRA_AC, BMTC_VAYU_VAJRA, NAMMA_METRO, TRANSFER
        String routeOrLineCode,
        String routeOrLineName,
        String colorHex,
        double distanceKm,
        int inVehicleMins,
        int waitingMins,
        int transferMins,
        BigDecimal standaloneFareInr,
        int stopsCount,
        List<double[]> polylineCoords
    ) {}

    private record NetworkSnapshot(
        Map<String, GraphNode> nodes,
        List<RideEdge> busRideEdges,
        List<RideEdge> metroRideEdges,
        List<RideEdge> metroInterchangeEdges,
        List<RideEdge> hubTransferEdges,
        List<FareRule> fareRules
    ) {}

    private record SearchState(
        String nodeKey,
        String lastEdgeMode,
        int ridesTaken,
        int transfers,
        int walkingMins,
        int busMins,
        int metroMins,
        int waitingMins,
        int transferMins,
        double totalDistanceKm,
        double consecutiveMetroKm,
        BigDecimal totalFareInr,
        SearchState parent,
        RideEdge incomingEdge
    ) {
        int totalTimeMins() {
            return walkingMins + busMins + metroMins + waitingMins + transferMins;
        }
    }

    private final BusStopRepository busStopRepository;
    private final BusRouteRepository busRouteRepository;
    private final BusRouteStopRepository busRouteStopRepository;
    private final MetroLineRepository metroLineRepository;
    private final MetroStationRepository metroStationRepository;
    private final MetroConnectionRepository metroConnectionRepository;
    private final TransferPointRepository transferPointRepository;
    private final ScheduleRepository scheduleRepository;
    private final FareRuleRepository fareRuleRepository;

    public TransitGraphEngine(
        BusStopRepository busStopRepository,
        BusRouteRepository busRouteRepository,
        BusRouteStopRepository busRouteStopRepository,
        MetroLineRepository metroLineRepository,
        MetroStationRepository metroStationRepository,
        MetroConnectionRepository metroConnectionRepository,
        TransferPointRepository transferPointRepository,
        ScheduleRepository scheduleRepository,
        FareRuleRepository fareRuleRepository
    ) {
        this.busStopRepository = busStopRepository;
        this.busRouteRepository = busRouteRepository;
        this.busRouteStopRepository = busRouteStopRepository;
        this.metroLineRepository = metroLineRepository;
        this.metroStationRepository = metroStationRepository;
        this.metroConnectionRepository = metroConnectionRepository;
        this.transferPointRepository = transferPointRepository;
        this.scheduleRepository = scheduleRepository;
        this.fareRuleRepository = fareRuleRepository;
    }

    public NetworkSnapshot loadSnapshot() {
        Map<String, GraphNode> nodes = new LinkedHashMap<>();

        List<BusStop> activeBusStops = busStopRepository.findByIsActiveTrueOrderByStopNameAsc();
        Map<Long, BusStop> busStopById = new HashMap<>();
        for (BusStop bs : activeBusStops) {
            busStopById.put(bs.getStopId(), bs);
            String key = "BUS_" + bs.getStopId();
            nodes.put(key, new GraphNode(
                key,
                "BUS_STOP",
                bs.getStopCode(),
                bs.getStopName(),
                bs.getAreaName(),
                bs.getLatitude().doubleValue(),
                bs.getLongitude().doubleValue()
            ));
        }

        List<MetroStation> activeStations = metroStationRepository.findByIsActiveTrueOrderByLine_LineIdAscStationOrderAsc();
        Map<Long, MetroStation> stationById = new HashMap<>();
        for (MetroStation ms : activeStations) {
            if (!"OPERATIONAL".equalsIgnoreCase(ms.getLine().getOperationalStatus())) {
                continue;
            }
            stationById.put(ms.getStationId(), ms);
            String key = "METRO_" + ms.getStationId();
            nodes.put(key, new GraphNode(
                key,
                "METRO_STATION",
                ms.getStationCode(),
                ms.getStationName(),
                ms.getLine().getLineName(),
                ms.getLatitude().doubleValue(),
                ms.getLongitude().doubleValue()
            ));
        }

        List<FareRule> fareRules = fareRuleRepository.findAllByOrderByServiceCategoryAscMinDistanceKmAsc();
        List<Schedule> schedules = scheduleRepository.findAllByOrderByTransportModeAscScheduleIdAsc();

        Map<Long, Integer> busWaitByRouteId = new HashMap<>();
        Map<Integer, Integer> metroWaitByLineId = new HashMap<>();
        for (Schedule sc : schedules) {
            if (!"WEEKDAY".equalsIgnoreCase(sc.getDayType())) {
                continue;
            }
            int estimatedWait = Math.max(2, Math.round(sc.getPeakHeadwayMins() / 2.5f));
            if ("BUS".equalsIgnoreCase(sc.getTransportMode()) && sc.getBusRoute() != null) {
                busWaitByRouteId.putIfAbsent(sc.getBusRoute().getRouteId(), estimatedWait);
            } else if ("METRO".equalsIgnoreCase(sc.getTransportMode()) && sc.getMetroLine() != null) {
                metroWaitByLineId.putIfAbsent(sc.getMetroLine().getLineId(), estimatedWait);
            }
        }

        // 1. Expand ordered BMTC route stops into exact continuous Ride-Leg Edges
        List<RideEdge> busRideEdges = new ArrayList<>();
        List<BusRoute> routes = busRouteRepository.findAllByOrderByRouteNumberAsc();
        for (BusRoute route : routes) {
            if (!Boolean.TRUE.equals(route.getIsActive())) {
                continue;
            }
            String category = mapBusServiceToFareCategory(route.getServiceType());
            String color = ("VAJRA_AC".equalsIgnoreCase(route.getServiceType())
                || "VAYU_VAJRA".equalsIgnoreCase(route.getServiceType())) ? VAJRA_CYAN : BMTC_BLUE;
            int waitMins = busWaitByRouteId.getOrDefault(route.getRouteId(), 4);

            for (String direction : List.of("OUTBOUND", "INBOUND")) {
                List<BusRouteStop> seq = busRouteStopRepository
                    .findByRoute_RouteIdAndDirectionOrderByStopSequenceAsc(route.getRouteId(), direction);
                if (seq.size() < 2) {
                    continue;
                }
                for (int i = 0; i < seq.size(); i++) {
                    BusStop boardStop = busStopById.get(seq.get(i).getStop().getStopId());
                    if (boardStop == null) {
                        continue;
                    }
                    int cumulativeMins = 0;
                    List<double[]> coords = new ArrayList<>();
                    coords.add(new double[]{
                        boardStop.getLatitude().doubleValue(),
                        boardStop.getLongitude().doubleValue()
                    });

                    for (int j = i + 1; j < seq.size(); j++) {
                        BusRouteStop stepStop = seq.get(j);
                        BusStop alightStop = busStopById.get(stepStop.getStop().getStopId());
                        if (alightStop == null) {
                            break;
                        }
                        cumulativeMins += stepStop.getTravelMinsFromPrev();
                        coords.add(new double[]{
                            alightStop.getLatitude().doubleValue(),
                            alightStop.getLongitude().doubleValue()
                        });

                        double distKm = Math.max(
                            0.2,
                            stepStop.getDistanceFromStartKm().doubleValue()
                                - seq.get(i).getDistanceFromStartKm().doubleValue()
                        );
                        BigDecimal fare = lookupSlabFare(fareRules, category, distKm);
                        String legTitle = "BMTC " + route.getRouteNumber() + " ("
                            + boardStop.getStopName() + " -> " + alightStop.getStopName() + ")";

                        busRideEdges.add(new RideEdge(
                            "BUS_" + boardStop.getStopId(),
                            "BUS_" + alightStop.getStopId(),
                            "BUS",
                            category,
                            route.getRouteNumber(),
                            legTitle,
                            color,
                            round2(distKm),
                            Math.max(1, cumulativeMins),
                            waitMins,
                            0,
                            fare,
                            j - i,
                            new ArrayList<>(coords)
                        ));
                    }
                }
            }
        }

        // 2. Expand Namma Metro lines into continuous same-line Ride-Leg Edges + Concourse Interchanges
        List<RideEdge> metroRideEdges = new ArrayList<>();
        List<RideEdge> metroInterchangeEdges = new ArrayList<>();
        List<MetroConnection> allConnections = metroConnectionRepository.findAllByOrderByConnectionIdAsc();

        Map<Integer, Map<Long, List<MetroConnection>>> lineAdj = new HashMap<>();
        for (MetroConnection conn : allConnections) {
            MetroStation from = stationById.get(conn.getFromStation().getStationId());
            MetroStation to = stationById.get(conn.getToStation().getStationId());
            if (from == null || to == null) {
                continue;
            }
            if (Boolean.TRUE.equals(conn.getIsInterchangeWalk())) {
                List<double[]> walkCoords = List.of(
                    new double[]{from.getLatitude().doubleValue(), from.getLongitude().doubleValue()},
                    new double[]{to.getLatitude().doubleValue(), to.getLongitude().doubleValue()}
                );
                metroInterchangeEdges.add(new RideEdge(
                    "METRO_" + from.getStationId(),
                    "METRO_" + to.getStationId(),
                    "METRO_INTERCHANGE",
                    "TRANSFER",
                    "INTERCHANGE",
                    "Metro Concourse Interchange (" + from.getStationName() + " -> " + to.getStationName() + ")",
                    TRANSFER_AMBER,
                    conn.getDistanceKm().doubleValue(),
                    0,
                    0,
                    conn.getTravelTimeMins(),
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    0,
                    walkCoords
                ));
            } else {
                lineAdj
                    .computeIfAbsent(conn.getLine().getLineId(), k -> new HashMap<>())
                    .computeIfAbsent(from.getStationId(), k -> new ArrayList<>())
                    .add(conn);
            }
        }

        for (MetroLine line : metroLineRepository.findAllByOrderByLineIdAsc()) {
            if (!"OPERATIONAL".equalsIgnoreCase(line.getOperationalStatus())) {
                continue;
            }
            List<MetroStation> lineStations = metroStationRepository
                .findByLine_LineIdOrderByStationOrderAsc(line.getLineId());
            Map<Long, List<MetroConnection>> adj = lineAdj.getOrDefault(line.getLineId(), Map.of());
            int waitMins = metroWaitByLineId.getOrDefault(line.getLineId(), 3);

            for (MetroStation startStation : lineStations) {
                if (!stationById.containsKey(startStation.getStationId())) {
                    continue;
                }
                buildMetroLineReachability(
                    line, startStation, adj, stationById, fareRules, waitMins, metroRideEdges
                );
            }
        }

        // 3. Multi-modal Hub Transfer Edges (BMTC <-> Namma Metro)
        List<RideEdge> hubTransferEdges = new ArrayList<>();
        for (TransferPoint tp : transferPointRepository.findByIsActiveTrueOrderByHubNameAsc()) {
            BusStop bs = busStopById.get(tp.getBusStop().getStopId());
            MetroStation ms = stationById.get(tp.getMetroStation().getStationId());
            if (bs == null || ms == null) {
                continue;
            }
            double distKm = round2(tp.getWalkingDistanceM() / 1000.0);
            int totalTransferMins = tp.getWalkingTimeMins() + tp.getTransferBufferMins();
            String code = Boolean.TRUE.equals(tp.getHasSkywalk()) ? "SKYWALK" : "HUB_WALK";
            String labelSuffix = Boolean.TRUE.equals(tp.getHasSkywalk()) ? " Skywalk" : " Footpath";

            List<double[]> busToMetroCoords = List.of(
                new double[]{bs.getLatitude().doubleValue(), bs.getLongitude().doubleValue()},
                new double[]{ms.getLatitude().doubleValue(), ms.getLongitude().doubleValue()}
            );
            List<double[]> metroToBusCoords = List.of(
                new double[]{ms.getLatitude().doubleValue(), ms.getLongitude().doubleValue()},
                new double[]{bs.getLatitude().doubleValue(), bs.getLongitude().doubleValue()}
            );

            hubTransferEdges.add(new RideEdge(
                "BUS_" + bs.getStopId(),
                "METRO_" + ms.getStationId(),
                "TRANSFER",
                "TRANSFER",
                code,
                tp.getHubName() + labelSuffix + " (" + bs.getStopName() + " -> " + ms.getStationName() + ")",
                TRANSFER_AMBER,
                distKm,
                0,
                0,
                totalTransferMins,
                BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                0,
                busToMetroCoords
            ));

            hubTransferEdges.add(new RideEdge(
                "METRO_" + ms.getStationId(),
                "BUS_" + bs.getStopId(),
                "TRANSFER",
                "TRANSFER",
                code,
                tp.getHubName() + labelSuffix + " (" + ms.getStationName() + " -> " + bs.getStopName() + ")",
                TRANSFER_AMBER,
                distKm,
                0,
                0,
                totalTransferMins,
                BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                0,
                metroToBusCoords
            ));
        }

        return new NetworkSnapshot(
            nodes,
            busRideEdges,
            metroRideEdges,
            metroInterchangeEdges,
            hubTransferEdges,
            fareRules
        );
    }

    public RouteOptionDto findOptimalRoute(
        String sourceNodeKey,
        String destinationNodeKey,
        OptimizationCriteria criteria,
        ModeFilter modeFilter,
        Double originLat,
        Double originLng
    ) {
        return findOptimalRoute(
            sourceNodeKey, destinationNodeKey, criteria, modeFilter,
            originLat, originLng, null, null, null, null
        );
    }

    public RouteOptionDto findOptimalRoute(
        String sourceNodeKey,
        String destinationNodeKey,
        OptimizationCriteria criteria,
        ModeFilter modeFilter,
        Double originLat,
        Double originLng,
        String originPlaceName,
        Double destLat,
        Double destLng,
        String destPlaceName
    ) {
        NetworkSnapshot snapshot = loadSnapshot();
        ResolvedEndpoints ep = resolveAndValidateEndpoints(
            snapshot, sourceNodeKey, destinationNodeKey,
            originLat, originLng, originPlaceName,
            destLat, destLng, destPlaceName
        );
        return solveGraph(snapshot, ep, criteria, modeFilter)
            .orElseThrow(() -> new BadRequestException(
                "No connected " + modeFilter.name() + " transit route found between "
                    + ep.originDisplayLabel() + " and " + ep.destDisplayLabel() + "."
            ));
    }

    public Map<String, Optional<RouteOptionDto>> computeAllComparisons(
        String sourceNodeKey,
        String destinationNodeKey,
        Double originLat,
        Double originLng
    ) {
        return computeAllComparisons(
            sourceNodeKey, destinationNodeKey, originLat, originLng, null, null, null, null
        );
    }

    public Map<String, Optional<RouteOptionDto>> computeAllComparisons(
        String sourceNodeKey,
        String destinationNodeKey,
        Double originLat,
        Double originLng,
        String originPlaceName,
        Double destLat,
        Double destLng,
        String destPlaceName
    ) {
        NetworkSnapshot snapshot = loadSnapshot();
        ResolvedEndpoints ep = resolveAndValidateEndpoints(
            snapshot, sourceNodeKey, destinationNodeKey,
            originLat, originLng, originPlaceName,
            destLat, destLng, destPlaceName
        );

        Map<String, Optional<RouteOptionDto>> results = new LinkedHashMap<>();
        results.put("FASTEST_COMBINED", solveGraph(
            snapshot, ep, OptimizationCriteria.FASTEST, ModeFilter.COMBINED));
        results.put("CHEAPEST_COMBINED", solveGraph(
            snapshot, ep, OptimizationCriteria.CHEAPEST, ModeFilter.COMBINED));
        results.put("MIN_TRANSFERS_COMBINED", solveGraph(
            snapshot, ep, OptimizationCriteria.MIN_TRANSFERS, ModeFilter.COMBINED));
        results.put("FASTEST_BUS_ONLY", solveGraph(
            snapshot, ep, OptimizationCriteria.FASTEST, ModeFilter.BUS_ONLY));
        results.put("FASTEST_METRO_ONLY", solveGraph(
            snapshot, ep, OptimizationCriteria.FASTEST, ModeFilter.METRO_ONLY));
        return results;
    }

    private static final String DEST_SINK_KEY = "__DEST_SINK__";
    private static final double MAX_DIRECT_WALK_KM = 0.75;
    private static final double LOCAL_STOP_WALK_KM = 0.25;
    private static final int LOCAL_STOP_WALK_MINS = 4;
    private static final int LOCAL_FEEDER_WAIT_MINS = 3;

    private record ResolvedEndpoints(
        String fallbackSourceKey,
        String fallbackDestKey,
        boolean hasCustomOrigin,
        Double originLat,
        Double originLng,
        String originPlaceName,
        boolean hasCustomDest,
        Double destLat,
        Double destLng,
        String destPlaceName,
        String originDisplayLabel,
        String destDisplayLabel
    ) {}

    private ResolvedEndpoints resolveAndValidateEndpoints(
        NetworkSnapshot snapshot,
        String rawSourceKey,
        String rawDestKey,
        Double originLat,
        Double originLng,
        String originPlaceName,
        Double destLat,
        Double destLng,
        String destPlaceName
    ) {
        String srcKey = rawSourceKey == null ? "" : rawSourceKey.trim().toUpperCase(Locale.ROOT);
        String dstKey = rawDestKey == null ? "" : rawDestKey.trim().toUpperCase(Locale.ROOT);

        boolean hasCustomOrigin = originLat != null && originLng != null;
        boolean hasCustomDest = destLat != null && destLng != null;

        if ((originLat == null) != (originLng == null)) {
            throw new BadRequestException("Both originLat and originLng must be provided together.");
        }
        if ((destLat == null) != (destLng == null)) {
            throw new BadRequestException("Both destLat and destLng must be provided together.");
        }
        if (hasCustomOrigin) {
            validateBengaluruCoords(originLat, originLng, "Origin");
        }
        if (hasCustomDest) {
            validateBengaluruCoords(destLat, destLng, "Destination");
        }

        if (srcKey.isEmpty() && !hasCustomOrigin) {
            throw new BadRequestException("Origin stop/station or specific origin place is required.");
        }
        if (dstKey.isEmpty() && !hasCustomDest) {
            throw new BadRequestException("Destination stop/station or specific destination place is required.");
        }

        if (!srcKey.isEmpty() && !snapshot.nodes.containsKey(srcKey)) {
            throw new ResourceNotFoundException("Origin transit node not found or inactive: " + srcKey);
        }
        if (!dstKey.isEmpty() && !snapshot.nodes.containsKey(dstKey)) {
            throw new ResourceNotFoundException("Destination transit node not found or inactive: " + dstKey);
        }

        if (!hasCustomOrigin && !hasCustomDest && srcKey.equalsIgnoreCase(dstKey)) {
            throw new BadRequestException("Origin and destination cannot be the same transit node.");
        }

        if (srcKey.isEmpty()) {
            srcKey = findClosestNodeKey(snapshot, originLat, originLng, null, dstKey.isEmpty() ? null : dstKey);
        }
        if (dstKey.isEmpty()) {
            dstKey = findClosestNodeKey(snapshot, destLat, destLng, null, hasCustomOrigin ? null : srcKey);
        }

        double startLat = hasCustomOrigin ? originLat : snapshot.nodes.get(srcKey).latitude();
        double startLng = hasCustomOrigin ? originLng : snapshot.nodes.get(srcKey).longitude();
        double endLat = hasCustomDest ? destLat : snapshot.nodes.get(dstKey).latitude();
        double endLng = hasCustomDest ? destLng : snapshot.nodes.get(dstKey).longitude();

        if (haversineKm(startLat, startLng, endLat, endLng) < 0.12) {
            throw new BadRequestException(
                "Origin and destination are within 120 meters (direct 2-minute walk, no transit ride needed)."
            );
        }

        String cleanOriginPlace = cleanLabel(originPlaceName);
        String cleanDestPlace = cleanLabel(destPlaceName);

        String originLabel = cleanOriginPlace != null
            ? cleanOriginPlace
            : snapshot.nodes.get(srcKey).name();
        String destLabel = cleanDestPlace != null
            ? cleanDestPlace
            : snapshot.nodes.get(dstKey).name();

        return new ResolvedEndpoints(
            srcKey,
            dstKey,
            hasCustomOrigin,
            originLat,
            originLng,
            cleanOriginPlace,
            hasCustomDest,
            destLat,
            destLng,
            cleanDestPlace,
            originLabel,
            destLabel
        );
    }

    private void validateBengaluruCoords(double lat, double lng, String fieldLabel) {
        if (Double.isNaN(lat) || Double.isNaN(lng)
            || lat < 12.50 || lat > 13.50 || lng < 77.20 || lng > 78.00) {
            throw new BadRequestException(
                fieldLabel + " coordinates must lie within Greater Bengaluru (lat 12.50..13.50, lng 77.20..78.00)."
            );
        }
    }

    private String findClosestNodeKey(
        NetworkSnapshot snapshot,
        double lat,
        double lng,
        String requiredType,
        String excludeKey
    ) {
        String bestKey = null;
        double bestDist = Double.MAX_VALUE;
        for (GraphNode nd : snapshot.nodes.values()) {
            if (excludeKey != null && nd.nodeKey().equalsIgnoreCase(excludeKey)) {
                continue;
            }
            if (requiredType != null && !requiredType.equalsIgnoreCase(nd.nodeType())) {
                continue;
            }
            double d = haversineKm(lat, lng, nd.latitude(), nd.longitude());
            if (d < bestDist) {
                bestDist = d;
                bestKey = nd.nodeKey();
            }
        }
        return bestKey;
    }

    private Set<String> collectNearbyCandidateKeys(
        NetworkSnapshot snapshot,
        double lat,
        double lng,
        String explicitKey,
        String excludeFixedEndpointKey
    ) {
        Set<String> keys = new LinkedHashSet<>();
        if (explicitKey != null && !explicitKey.isEmpty()
            && (excludeFixedEndpointKey == null || !explicitKey.equalsIgnoreCase(excludeFixedEndpointKey))) {
            keys.add(explicitKey);
        }

        double minDistKm = Double.MAX_VALUE;
        for (GraphNode nd : snapshot.nodes.values()) {
            if (excludeFixedEndpointKey != null && nd.nodeKey().equalsIgnoreCase(excludeFixedEndpointKey)) {
                continue;
            }
            double d = haversineKm(lat, lng, nd.latitude(), nd.longitude());
            if (d < minDistKm) {
                minDistKm = d;
            }
        }

        if (minDistKm <= 10.0) {
            double maxCandidateRadiusKm = Math.min(4.8, Math.max(2.4, minDistKm + 1.8));
            for (GraphNode nd : snapshot.nodes.values()) {
                if (excludeFixedEndpointKey != null && nd.nodeKey().equalsIgnoreCase(excludeFixedEndpointKey)) {
                    continue;
                }
                double d = haversineKm(lat, lng, nd.latitude(), nd.longitude());
                if (d <= maxCandidateRadiusKm) {
                    keys.add(nd.nodeKey());
                }
            }
            // Guarantee both BUS_ONLY and METRO_ONLY comparisons have a candidate access/egress stop
            String nearestBus = findClosestNodeKey(snapshot, lat, lng, "BUS_STOP", excludeFixedEndpointKey);
            if (nearestBus != null) {
                GraphNode nb = snapshot.nodes.get(nearestBus);
                if (haversineKm(lat, lng, nb.latitude(), nb.longitude()) <= 10.0) {
                    keys.add(nearestBus);
                }
            }
            String nearestMetro = findClosestNodeKey(snapshot, lat, lng, "METRO_STATION", excludeFixedEndpointKey);
            if (nearestMetro != null) {
                GraphNode nm = snapshot.nodes.get(nearestMetro);
                if (haversineKm(lat, lng, nm.latitude(), nm.longitude()) <= 10.0) {
                    keys.add(nearestMetro);
                }
            }
        }
        return keys;
    }

    private Optional<RouteOptionDto> solveGraph(
        NetworkSnapshot snapshot,
        ResolvedEndpoints ep,
        OptimizationCriteria criteria,
        ModeFilter modeFilter
    ) {
        String fixedDestExclusion = ep.hasCustomDest() ? null : ep.fallbackDestKey();
        String fixedSrcExclusion = ep.hasCustomOrigin() ? null : ep.fallbackSourceKey();

        // 1. Multi-Candidate Origin Super-Source
        Set<String> candidateStartKeys = new LinkedHashSet<>();
        if (ep.hasCustomOrigin()) {
            candidateStartKeys.addAll(collectNearbyCandidateKeys(
                snapshot,
                ep.originLat(),
                ep.originLng(),
                ep.fallbackSourceKey(),
                fixedDestExclusion
            ));
        } else {
            candidateStartKeys.add(ep.fallbackSourceKey());
        }

        // 2. Multi-Candidate Destination Super-Sink (for door-to-door custom destinations)
        Set<String> candidateDestKeys = new LinkedHashSet<>();
        if (ep.hasCustomDest()) {
            candidateDestKeys.addAll(collectNearbyCandidateKeys(
                snapshot,
                ep.destLat(),
                ep.destLng(),
                ep.fallbackDestKey(),
                fixedSrcExclusion
            ));
        } else {
            candidateDestKeys.add(ep.fallbackDestKey());
        }

        if (candidateStartKeys.isEmpty() || candidateDestKeys.isEmpty()) {
            return Optional.empty();
        }

        String effectiveGoalKey = ep.hasCustomDest() ? DEST_SINK_KEY : ep.fallbackDestKey();
        int defaultEgressWalkMins = ep.hasCustomDest() ? 0 : 2;

        Map<String, List<RideEdge>> adj = buildFilteredAdjacency(
            snapshot, candidateStartKeys, candidateDestKeys, ep, modeFilter
        );

        Comparator<SearchState> comparator = buildComparator(criteria);
        PriorityQueue<SearchState> pq = new PriorityQueue<>(comparator);
        Map<String, SearchState> bestByStateKey = new HashMap<>();

        double minOriginDistKm = Double.MAX_VALUE;
        if (ep.hasCustomOrigin()) {
            for (String sk : candidateStartKeys) {
                GraphNode sn = snapshot.nodes.get(sk);
                if (sn == null) {
                    continue;
                }
                if (modeFilter == ModeFilter.BUS_ONLY && !"BUS_STOP".equals(sn.nodeType())) {
                    continue;
                }
                if (modeFilter == ModeFilter.METRO_ONLY && !"METRO_STATION".equals(sn.nodeType())) {
                    continue;
                }
                double d = haversineKm(ep.originLat(), ep.originLng(), sn.latitude(), sn.longitude());
                if (d < minOriginDistKm) {
                    minOriginDistKm = d;
                }
            }
        }
        boolean originHasWalkableStop = minOriginDistKm <= MAX_DIRECT_WALK_KM;
        double maxOriginFeederKm = Math.min(4.8, Math.max(2.5, minOriginDistKm + 1.8));

        for (String startNodeKey : candidateStartKeys) {
            GraphNode startNode = snapshot.nodes.get(startNodeKey);
            if (startNode == null || (!ep.hasCustomDest() && startNodeKey.equalsIgnoreCase(ep.fallbackDestKey()))) {
                continue;
            }
            if (modeFilter == ModeFilter.METRO_ONLY && !"METRO_STATION".equals(startNode.nodeType()) && ep.hasCustomOrigin()) {
                continue;
            }
            int accessWalkMins = 2;
            int initRides = 0;
            int initBusMins = 0;
            int initWaitMins = 0;
            String initMode = "START";
            BigDecimal initFare = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            double originWalkKm = 0.0;

            if (ep.hasCustomOrigin()) {
                originWalkKm = haversineKm(ep.originLat(), ep.originLng(), startNode.latitude(), startNode.longitude());
                if (modeFilter == ModeFilter.METRO_ONLY) {
                    if (originWalkKm > 3.2) {
                        continue;
                    }
                    accessWalkMins = Math.max(1, (int) Math.ceil(originWalkKm * 12.5));
                } else if (originHasWalkableStop) {
                    if (originWalkKm > MAX_DIRECT_WALK_KM) {
                        continue;
                    }
                    accessWalkMins = Math.max(1, (int) Math.ceil(originWalkKm * 12.5));
                } else {
                    if (originWalkKm > maxOriginFeederKm) {
                        continue;
                    }
                    double feederKm = Math.max(0.50, round2(originWalkKm - LOCAL_STOP_WALK_KM));
                    accessWalkMins = LOCAL_STOP_WALK_MINS;
                    initRides = 1;
                    initBusMins = Math.max(3, (int) Math.ceil(feederKm * 2.6));
                    initWaitMins = LOCAL_FEEDER_WAIT_MINS;
                    initMode = "ORIGIN_FEEDER";
                    initFare = lookupSlabFare(snapshot.fareRules(), "BMTC_ORDINARY", feederKm);
                }
            }
            int baseWalkingMins = accessWalkMins + defaultEgressWalkMins;

            SearchState initial = new SearchState(
                startNodeKey,
                initMode,
                initRides,
                0,
                baseWalkingMins,
                initBusMins,
                0,
                initWaitMins,
                0,
                round2(originWalkKm),
                0.0,
                initFare,
                null,
                null
            );
            pq.add(initial);
            bestByStateKey.put(startNodeKey + "|" + initMode, initial);
        }

        SearchState goalState = null;

        while (!pq.isEmpty()) {
            SearchState current = pq.poll();
            if (current.nodeKey().equals(effectiveGoalKey)) {
                if (current.ridesTaken() > 0) {
                    goalState = current;
                    break;
                }
                continue;
            }
            if (current.transfers() > 4 || current.ridesTaken() > 6) {
                continue;
            }

            for (RideEdge edge : adj.getOrDefault(current.nodeKey(), List.of())) {
                if ("DEST_WALK".equals(edge.edgeMode()) || "DEST_FEEDER".equals(edge.edgeMode())) {
                    // Only transition from alighting stop to custom destination after a real transit ride
                    if (current.ridesTaken() == 0
                        || "ORIGIN_FEEDER".equals(current.lastEdgeMode())
                        || "TRANSFER".equals(current.lastEdgeMode())
                        || "METRO_INTERCHANGE".equals(current.lastEdgeMode())) {
                        continue;
                    }
                    boolean isFeeder = "DEST_FEEDER".equals(edge.edgeMode());
                    int addRides = isFeeder ? 1 : 0;
                    int addTransfers = isFeeder ? 1 : 0;
                    int addWalk = isFeeder ? LOCAL_STOP_WALK_MINS : edge.inVehicleMins();
                    int addBus = isFeeder ? edge.inVehicleMins() : 0;
                    int addWait = isFeeder ? edge.waitingMins() : 0;
                    int addTransferMins = isFeeder ? edge.transferMins() : 0;

                    SearchState sinkCandidate = new SearchState(
                        DEST_SINK_KEY,
                        edge.edgeMode(),
                        current.ridesTaken() + addRides,
                        current.transfers() + addTransfers,
                        current.walkingMins() + addWalk,
                        current.busMins() + addBus,
                        current.metroMins(),
                        current.waitingMins() + addWait,
                        current.transferMins() + addTransferMins,
                        round2(current.totalDistanceKm() + edge.distanceKm()),
                        0.0,
                        current.totalFareInr().add(edge.standaloneFareInr()),
                        current,
                        edge
                    );
                    String sinkKey = DEST_SINK_KEY + "|" + edge.edgeMode();
                    SearchState bestSink = bestByStateKey.get(sinkKey);
                    if (bestSink == null || comparator.compare(sinkCandidate, bestSink) < 0) {
                        bestByStateKey.put(sinkKey, sinkCandidate);
                        pq.add(sinkCandidate);
                    }
                    continue;
                }

                // Prevent redundant back-and-forth transfer walks without boarding a vehicle
                if (("TRANSFER".equals(edge.edgeMode()) || "METRO_INTERCHANGE".equals(edge.edgeMode()))
                    && ("TRANSFER".equals(current.lastEdgeMode())
                        || "METRO_INTERCHANGE".equals(current.lastEdgeMode())
                        || "ORIGIN_FEEDER".equals(current.lastEdgeMode()))) {
                    continue;
                }
                // Avoid immediate U-turn to previous node
                if (current.parent() != null && current.parent().nodeKey().equals(edge.toNodeKey())) {
                    continue;
                }

                int nextRides = current.ridesTaken();
                int nextTransfers = current.transfers();
                int nextWalk = current.walkingMins();
                int nextBus = current.busMins();
                int nextMetro = current.metroMins();
                int nextWait = current.waitingMins();
                int nextTransferMins = current.transferMins();
                double nextMetroKm = current.consecutiveMetroKm();
                BigDecimal nextFare = current.totalFareInr();

                if ("BUS".equals(edge.edgeMode())) {
                    nextRides += 1;
                    nextBus += edge.inVehicleMins();
                    nextWait += edge.waitingMins();
                    if ("BUS".equals(current.lastEdgeMode()) || "ORIGIN_FEEDER".equals(current.lastEdgeMode())) {
                        // Bus-to-Bus transfer at the same BMTC stop
                        nextTransfers += 1;
                        nextTransferMins += SAME_BUS_STOP_TRANSFER_MINS;
                    }
                    nextMetroKm = 0.0;
                    nextFare = nextFare.add(edge.standaloneFareInr());
                } else if ("METRO".equals(edge.edgeMode())) {
                    if ("METRO".equals(current.lastEdgeMode())) {
                        // Already covered by direct same-line ride edges
                        continue;
                    }
                    nextRides += 1;
                    nextMetro += edge.inVehicleMins();
                    nextWait += edge.waitingMins();
                    if ("ORIGIN_FEEDER".equals(current.lastEdgeMode())) {
                        nextTransfers += 1;
                        nextTransferMins += 3;
                    }
                    if ("METRO_INTERCHANGE".equals(current.lastEdgeMode()) && current.consecutiveMetroKm() > 0.0) {
                        // Unified BMRCL paid-concourse fare across connected Metro lines
                        double prevKm = current.consecutiveMetroKm();
                        double combinedKm = prevKm + edge.distanceKm();
                        BigDecimal prevMetroFare = lookupSlabFare(snapshot.fareRules(), "NAMMA_METRO", prevKm);
                        BigDecimal combinedMetroFare = lookupSlabFare(snapshot.fareRules(), "NAMMA_METRO", combinedKm);
                        nextFare = nextFare.subtract(prevMetroFare).add(combinedMetroFare);
                        nextMetroKm = combinedKm;
                    } else {
                        nextFare = nextFare.add(edge.standaloneFareInr());
                        nextMetroKm = edge.distanceKm();
                    }
                } else if ("METRO_INTERCHANGE".equals(edge.edgeMode())) {
                    if (!"METRO".equals(current.lastEdgeMode())) {
                        continue;
                    }
                    nextTransfers += 1;
                    nextTransferMins += edge.transferMins();
                } else if ("TRANSFER".equals(edge.edgeMode())) {
                    int pureHubWalkMins = Math.max(2, edge.transferMins() - 2);
                    if ("START".equals(current.lastEdgeMode())) {
                        if (!ep.hasCustomOrigin()) {
                            nextWalk = Math.max(2, nextWalk - 2 + pureHubWalkMins);
                        } else {
                            nextWalk += pureHubWalkMins;
                        }
                    } else if (!ep.hasCustomDest() && edge.toNodeKey().equals(ep.fallbackDestKey())) {
                        nextWalk = Math.max(2, nextWalk - 2 + pureHubWalkMins);
                    } else {
                        nextTransfers += 1;
                        nextTransferMins += edge.transferMins();
                    }
                    nextMetroKm = 0.0;
                }

                SearchState candidate = new SearchState(
                    edge.toNodeKey(),
                    edge.edgeMode(),
                    nextRides,
                    nextTransfers,
                    nextWalk,
                    nextBus,
                    nextMetro,
                    nextWait,
                    nextTransferMins,
                    round2(current.totalDistanceKm() + edge.distanceKm()),
                    nextMetroKm,
                    nextFare,
                    current,
                    edge
                );

                String stateKey = candidate.nodeKey() + "|" + candidate.lastEdgeMode();
                SearchState existing = bestByStateKey.get(stateKey);
                if (existing == null || comparator.compare(candidate, existing) < 0) {
                    bestByStateKey.put(stateKey, candidate);
                    pq.add(candidate);
                }
            }
        }

        if (goalState == null) {
            return Optional.empty();
        }
        return Optional.of(reconstructOption(snapshot, goalState, ep, criteria, modeFilter));
    }

    private Map<String, List<RideEdge>> buildFilteredAdjacency(
        NetworkSnapshot snapshot,
        Set<String> startKeys,
        Set<String> destKeys,
        ResolvedEndpoints ep,
        ModeFilter modeFilter
    ) {
        Map<String, List<RideEdge>> adj = new HashMap<>();
        if (modeFilter == ModeFilter.COMBINED || modeFilter == ModeFilter.BUS_ONLY) {
            for (RideEdge edge : snapshot.busRideEdges()) {
                adj.computeIfAbsent(edge.fromNodeKey(), k -> new ArrayList<>()).add(edge);
            }
        }
        if (modeFilter == ModeFilter.COMBINED || modeFilter == ModeFilter.METRO_ONLY) {
            for (RideEdge edge : snapshot.metroRideEdges()) {
                adj.computeIfAbsent(edge.fromNodeKey(), k -> new ArrayList<>()).add(edge);
            }
            for (RideEdge edge : snapshot.metroInterchangeEdges()) {
                adj.computeIfAbsent(edge.fromNodeKey(), k -> new ArrayList<>()).add(edge);
            }
        }
        for (RideEdge hubEdge : snapshot.hubTransferEdges()) {
            if (modeFilter == ModeFilter.COMBINED) {
                adj.computeIfAbsent(hubEdge.fromNodeKey(), k -> new ArrayList<>()).add(hubEdge);
            } else {
                // In BUS_ONLY or METRO_ONLY, permit walking across a connected terminal hub ONLY
                // at an origin candidate or fixed destination if user picked an opposite-mode endpoint
                if (startKeys.contains(hubEdge.fromNodeKey())
                    || (!ep.hasCustomDest() && destKeys.contains(hubEdge.toNodeKey()))) {
                    adj.computeIfAbsent(hubEdge.fromNodeKey(), k -> new ArrayList<>()).add(hubEdge);
                }
            }
        }

        if (ep.hasCustomDest()) {
            String targetLabel = ep.destPlaceName() != null ? ep.destPlaceName() : "Selected Destination";
            double minDestDistKm = Double.MAX_VALUE;
            for (String dk : destKeys) {
                GraphNode dn = snapshot.nodes.get(dk);
                if (dn == null) {
                    continue;
                }
                if (modeFilter == ModeFilter.BUS_ONLY && !"BUS_STOP".equals(dn.nodeType())) {
                    continue;
                }
                if (modeFilter == ModeFilter.METRO_ONLY && !"METRO_STATION".equals(dn.nodeType())) {
                    continue;
                }
                double d = haversineKm(dn.latitude(), dn.longitude(), ep.destLat(), ep.destLng());
                if (d < minDestDistKm) {
                    minDestDistKm = d;
                }
            }
            boolean destHasWalkableStop = minDestDistKm <= MAX_DIRECT_WALK_KM;
            double maxDestFeederKm = Math.min(4.8, Math.max(2.5, minDestDistKm + 1.8));

            for (String alightKey : destKeys) {
                GraphNode alightNode = snapshot.nodes.get(alightKey);
                if (alightNode == null) {
                    continue;
                }
                if (modeFilter == ModeFilter.BUS_ONLY && !"BUS_STOP".equals(alightNode.nodeType())) {
                    continue;
                }
                if (modeFilter == ModeFilter.METRO_ONLY && !"METRO_STATION".equals(alightNode.nodeType())) {
                    continue;
                }
                double walkKm = haversineKm(
                    alightNode.latitude(), alightNode.longitude(), ep.destLat(), ep.destLng()
                );
                if (modeFilter == ModeFilter.METRO_ONLY) {
                    if (walkKm > 3.2) {
                        continue;
                    }
                } else if (destHasWalkableStop) {
                    if (walkKm > MAX_DIRECT_WALK_KM) {
                        continue;
                    }
                } else if (walkKm > maxDestFeederKm) {
                    continue;
                }
                boolean useDestFeeder = !destHasWalkableStop
                    && walkKm > MAX_DIRECT_WALK_KM
                    && (modeFilter == ModeFilter.COMBINED || modeFilter == ModeFilter.BUS_ONLY);

                if (useDestFeeder) {
                    double feederKm = Math.max(0.50, round2(walkKm - LOCAL_STOP_WALK_KM));
                    int feederBusMins = Math.max(3, (int) Math.ceil(feederKm * 2.6));
                    int feederTransferMins = "METRO_STATION".equals(alightNode.nodeType())
                        ? 3
                        : SAME_BUS_STOP_TRANSFER_MINS;
                    BigDecimal feederFare = lookupSlabFare(snapshot.fareRules(), "BMTC_ORDINARY", feederKm);
                    List<double[]> coords = List.of(
                        new double[]{alightNode.latitude(), alightNode.longitude()},
                        new double[]{ep.destLat(), ep.destLng()}
                    );
                    adj.computeIfAbsent(alightKey, k -> new ArrayList<>()).add(new RideEdge(
                        alightKey,
                        DEST_SINK_KEY,
                        "DEST_FEEDER",
                        "BMTC_ORDINARY",
                        "FEEDER",
                        clampLength("BMTC Local Feeder (" + alightNode.name() + " -> Nearest Stop to " + targetLabel + ")", 138),
                        BMTC_BLUE,
                        round2(walkKm),
                        feederBusMins,
                        LOCAL_FEEDER_WAIT_MINS,
                        feederTransferMins,
                        feederFare,
                        2,
                        coords
                    ));
                } else {
                    int walkMins = Math.max(1, (int) Math.ceil(walkKm * 12.5));
                    List<double[]> coords = List.of(
                        new double[]{alightNode.latitude(), alightNode.longitude()},
                        new double[]{ep.destLat(), ep.destLng()}
                    );
                    adj.computeIfAbsent(alightKey, k -> new ArrayList<>()).add(new RideEdge(
                        alightKey,
                        DEST_SINK_KEY,
                        "DEST_WALK",
                        "WALK",
                        "LAST_MILE",
                        clampLength("Last-Mile Walk from " + alightNode.name() + " to " + targetLabel, 138),
                        WALK_SLATE,
                        round2(walkKm),
                        walkMins,
                        0,
                        0,
                        BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                        0,
                        coords
                    ));
                }
            }
        }
        return adj;
    }

    private Comparator<SearchState> buildComparator(OptimizationCriteria criteria) {
        return switch (criteria) {
            case FASTEST -> Comparator
                .comparingInt(SearchState::totalTimeMins)
                .thenComparingInt(SearchState::transfers)
                .thenComparing(SearchState::totalFareInr);
            case CHEAPEST -> Comparator
                .comparing(SearchState::totalFareInr)
                .thenComparingInt(SearchState::totalTimeMins)
                .thenComparingInt(SearchState::transfers);
            case MIN_TRANSFERS -> Comparator
                .comparingInt(SearchState::transfers)
                .thenComparingInt(SearchState::totalTimeMins)
                .thenComparing(SearchState::totalFareInr);
        };
    }

    private RouteOptionDto reconstructOption(
        NetworkSnapshot snapshot,
        SearchState goalState,
        ResolvedEndpoints ep,
        OptimizationCriteria criteria,
        ModeFilter modeFilter
    ) {
        List<RideEdge> rawEdges = new ArrayList<>();
        SearchState cursor = goalState;
        while (cursor.incomingEdge() != null) {
            rawEdges.add(cursor.incomingEdge());
            cursor = cursor.parent();
        }
        Collections.reverse(rawEdges);

        RideEdge destEgressEdge = null;
        if (!rawEdges.isEmpty()) {
            String lastMode = rawEdges.get(rawEdges.size() - 1).edgeMode();
            if ("DEST_WALK".equals(lastMode) || "DEST_FEEDER".equals(lastMode)) {
                destEgressEdge = rawEdges.remove(rawEdges.size() - 1);
            }
        }

        GraphNode sourceNode = snapshot.nodes().get(cursor.nodeKey());
        GraphNode destNode = destEgressEdge != null
            ? snapshot.nodes().get(destEgressEdge.fromNodeKey())
            : snapshot.nodes().get(goalState.nodeKey());
        boolean usedOriginFeeder = "ORIGIN_FEEDER".equals(cursor.lastEdgeMode());

        double originWalkKm = 0.0;
        int accessWalkMins = 2;
        if (ep.hasCustomOrigin()) {
            originWalkKm = haversineKm(ep.originLat(), ep.originLng(), sourceNode.latitude(), sourceNode.longitude());
            if (originWalkKm <= 10.0) {
                accessWalkMins = usedOriginFeeder
                    ? LOCAL_STOP_WALK_MINS
                    : Math.max(1, (int) Math.ceil(originWalkKm * 12.5));
            }
        }

        List<JourneyLegDto> legs = new ArrayList<>();
        int legOrder = 1;

        if (ep.hasCustomOrigin() && originWalkKm >= 0.05 && originWalkKm <= 10.0) {
            String originPointLabel = ep.originPlaceName() != null
                ? clampLength(ep.originPlaceName(), 115)
                : "Selected GPS Location";

            if (usedOriginFeeder) {
                double ratio = Math.min(0.45, LOCAL_STOP_WALK_KM / Math.max(0.50, originWalkKm));
                double localLat = ep.originLat() + (sourceNode.latitude() - ep.originLat()) * ratio;
                double localLng = ep.originLng() + (sourceNode.longitude() - ep.originLng()) * ratio;
                double feederKm = Math.max(0.50, round2(originWalkKm - LOCAL_STOP_WALK_KM));
                int feederBusMins = Math.max(3, (int) Math.ceil(feederKm * 2.6));
                BigDecimal feederFare = lookupSlabFare(snapshot.fareRules(), "BMTC_ORDINARY", feederKm);
                String localStopLabel = clampLength("Nearest BMTC Stop (" + originPointLabel + ")", 115);

                legs.add(new JourneyLegDto(
                    legOrder++,
                    "WALK",
                    "FIRST_MILE",
                    clampLength("First-Mile Walk from " + originPointLabel + " to Nearest Bus Stop", 138),
                    WALK_SLATE,
                    "GPS_ORIGIN",
                    originPointLabel,
                    ep.originLat(),
                    ep.originLng(),
                    "LOCAL_STOP_ORIG",
                    localStopLabel,
                    localLat,
                    localLng,
                    LOCAL_STOP_WALK_KM,
                    LOCAL_STOP_WALK_MINS,
                    0,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    0,
                    List.of(
                        new double[]{ep.originLat(), ep.originLng()},
                        new double[]{localLat, localLng}
                    )
                ));

                legs.add(new JourneyLegDto(
                    legOrder++,
                    "BUS",
                    "FEEDER",
                    clampLength("BMTC Local Feeder (" + localStopLabel + " -> " + sourceNode.name() + ")", 138),
                    BMTC_BLUE,
                    "LOCAL_STOP_ORIG",
                    localStopLabel,
                    localLat,
                    localLng,
                    sourceNode.nodeKey(),
                    clampLength(sourceNode.name(), 118),
                    sourceNode.latitude(),
                    sourceNode.longitude(),
                    feederKm,
                    feederBusMins,
                    LOCAL_FEEDER_WAIT_MINS,
                    feederFare,
                    2,
                    List.of(
                        new double[]{localLat, localLng},
                        new double[]{sourceNode.latitude(), sourceNode.longitude()}
                    )
                ));

                if (!rawEdges.isEmpty()) {
                    int xferMins = "METRO".equals(rawEdges.get(0).edgeMode()) ? 3 : SAME_BUS_STOP_TRANSFER_MINS;
                    legs.add(new JourneyLegDto(
                        legOrder++,
                        "TRANSFER",
                        "FEEDER_XFER",
                        clampLength("Transit Transfer at " + sourceNode.name(), 138),
                        TRANSFER_AMBER,
                        sourceNode.nodeKey(),
                        clampLength(sourceNode.name(), 118),
                        sourceNode.latitude(),
                        sourceNode.longitude(),
                        sourceNode.nodeKey(),
                        clampLength(sourceNode.name(), 118),
                        sourceNode.latitude(),
                        sourceNode.longitude(),
                        0.05,
                        xferMins,
                        0,
                        BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                        0,
                        List.of(new double[]{sourceNode.latitude(), sourceNode.longitude()})
                    ));
                }
            } else {
                legs.add(new JourneyLegDto(
                    legOrder++,
                    "WALK",
                    "FIRST_MILE",
                    clampLength("First-Mile Walk from " + originPointLabel + " to " + sourceNode.name(), 138),
                    WALK_SLATE,
                    "GPS_ORIGIN",
                    originPointLabel,
                    ep.originLat(),
                    ep.originLng(),
                    sourceNode.nodeKey(),
                    clampLength(sourceNode.name(), 118),
                    sourceNode.latitude(),
                    sourceNode.longitude(),
                    round2(originWalkKm),
                    accessWalkMins,
                    0,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    0,
                    List.of(
                        new double[]{ep.originLat(), ep.originLng()},
                        new double[]{sourceNode.latitude(), sourceNode.longitude()}
                    )
                ));
            }
        }

        double runningMetroKm = 0.0;
        for (int i = 0; i < rawEdges.size(); i++) {
            RideEdge edge = rawEdges.get(i);
            GraphNode from = snapshot.nodes().get(edge.fromNodeKey());
            GraphNode to = snapshot.nodes().get(edge.toNodeKey());

            // Insert explicit same-stop Bus-to-Bus transfer leg when two BUS rides meet
            if (i > 0 && "BUS".equals(rawEdges.get(i - 1).edgeMode()) && "BUS".equals(edge.edgeMode())) {
                legs.add(new JourneyLegDto(
                    legOrder++,
                    "TRANSFER",
                    "BUS_BAY",
                    clampLength("Bus Bay Transfer at " + from.name(), 138),
                    TRANSFER_AMBER,
                    from.nodeKey(),
                    clampLength(from.name(), 118),
                    from.latitude(),
                    from.longitude(),
                    from.nodeKey(),
                    clampLength(from.name(), 118),
                    from.latitude(),
                    from.longitude(),
                    0.05,
                    SAME_BUS_STOP_TRANSFER_MINS,
                    0,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    0,
                    List.of(new double[]{from.latitude(), from.longitude()})
                ));
            }

            boolean isTerminalHubWalk = "TRANSFER".equals(edge.edgeMode())
                && ((i == 0 && !usedOriginFeeder) || (destEgressEdge == null && i == rawEdges.size() - 1));
            String displayMode = isTerminalHubWalk
                ? "WALK"
                : ("METRO_INTERCHANGE".equals(edge.edgeMode()) ? "TRANSFER" : edge.edgeMode());
            String displayColor = isTerminalHubWalk ? WALK_SLATE : edge.colorHex();
            int duration = ("BUS".equals(edge.edgeMode()) || "METRO".equals(edge.edgeMode()))
                ? edge.inVehicleMins()
                : (isTerminalHubWalk ? Math.max(2, edge.transferMins() - 2) : edge.transferMins());

            BigDecimal legFare = edge.standaloneFareInr();
            if ("METRO".equals(edge.edgeMode())) {
                if (runningMetroKm > 0.0) {
                    BigDecimal before = lookupSlabFare(snapshot.fareRules(), "NAMMA_METRO", runningMetroKm);
                    runningMetroKm += edge.distanceKm();
                    BigDecimal after = lookupSlabFare(snapshot.fareRules(), "NAMMA_METRO", runningMetroKm);
                    legFare = after.subtract(before).max(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
                } else {
                    runningMetroKm = edge.distanceKm();
                }
            } else if (!"METRO_INTERCHANGE".equals(edge.edgeMode())) {
                runningMetroKm = 0.0;
            }

            legs.add(new JourneyLegDto(
                legOrder++,
                displayMode,
                edge.routeOrLineCode(),
                clampLength(edge.routeOrLineName(), 138),
                displayColor,
                from.nodeKey(),
                clampLength(from.name(), 118),
                from.latitude(),
                from.longitude(),
                to.nodeKey(),
                clampLength(to.name(), 118),
                to.latitude(),
                to.longitude(),
                edge.distanceKm(),
                duration,
                edge.waitingMins(),
                legFare,
                edge.stopsCount(),
                edge.polylineCoords()
            ));
        }

        if (destEgressEdge != null) {
            String destPointLabel = ep.destPlaceName() != null
                ? clampLength(ep.destPlaceName(), 115)
                : "Selected Destination Pin";

            if ("DEST_FEEDER".equals(destEgressEdge.edgeMode())) {
                double totalEgressKm = destEgressEdge.distanceKm();
                double walkRatio = Math.min(0.45, LOCAL_STOP_WALK_KM / Math.max(0.50, totalEgressKm));
                double localLat = ep.destLat() - (ep.destLat() - destNode.latitude()) * walkRatio;
                double localLng = ep.destLng() - (ep.destLng() - destNode.longitude()) * walkRatio;
                double feederKm = Math.max(0.50, round2(totalEgressKm - LOCAL_STOP_WALK_KM));
                String localStopLabel = clampLength("Nearest BMTC Stop (" + destPointLabel + ")", 115);

                legs.add(new JourneyLegDto(
                    legOrder++,
                    "TRANSFER",
                    "FEEDER_XFER",
                    clampLength("Feeder Bus Transfer at " + destNode.name(), 138),
                    TRANSFER_AMBER,
                    destNode.nodeKey(),
                    clampLength(destNode.name(), 118),
                    destNode.latitude(),
                    destNode.longitude(),
                    destNode.nodeKey(),
                    clampLength(destNode.name(), 118),
                    destNode.latitude(),
                    destNode.longitude(),
                    0.05,
                    destEgressEdge.transferMins(),
                    0,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    0,
                    List.of(new double[]{destNode.latitude(), destNode.longitude()})
                ));

                legs.add(new JourneyLegDto(
                    legOrder++,
                    "BUS",
                    "FEEDER",
                    destEgressEdge.routeOrLineName(),
                    BMTC_BLUE,
                    destNode.nodeKey(),
                    clampLength(destNode.name(), 118),
                    destNode.latitude(),
                    destNode.longitude(),
                    "LOCAL_STOP_DEST",
                    localStopLabel,
                    localLat,
                    localLng,
                    feederKm,
                    destEgressEdge.inVehicleMins(),
                    destEgressEdge.waitingMins(),
                    destEgressEdge.standaloneFareInr(),
                    2,
                    List.of(
                        new double[]{destNode.latitude(), destNode.longitude()},
                        new double[]{localLat, localLng}
                    )
                ));

                legs.add(new JourneyLegDto(
                    legOrder++,
                    "WALK",
                    "LAST_MILE",
                    clampLength("Last-Mile Walk from Nearest Bus Stop to " + destPointLabel, 138),
                    WALK_SLATE,
                    "LOCAL_STOP_DEST",
                    localStopLabel,
                    localLat,
                    localLng,
                    "DEST_PIN",
                    destPointLabel,
                    ep.destLat(),
                    ep.destLng(),
                    LOCAL_STOP_WALK_KM,
                    LOCAL_STOP_WALK_MINS,
                    0,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    0,
                    List.of(
                        new double[]{localLat, localLng},
                        new double[]{ep.destLat(), ep.destLng()}
                    )
                ));
            } else if (destEgressEdge.distanceKm() >= 0.05) {
                legs.add(new JourneyLegDto(
                    legOrder++,
                    "WALK",
                    "LAST_MILE",
                    destEgressEdge.routeOrLineName(),
                    WALK_SLATE,
                    destNode.nodeKey(),
                    clampLength(destNode.name(), 118),
                    destNode.latitude(),
                    destNode.longitude(),
                    "DEST_PIN",
                    destPointLabel,
                    ep.destLat(),
                    ep.destLng(),
                    destEgressEdge.distanceKm(),
                    destEgressEdge.inVehicleMins(),
                    0,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    0,
                    destEgressEdge.polylineCoords()
                ));
            }
        }

        String formattedSourceName = (ep.hasCustomOrigin() && ep.originPlaceName() != null)
            ? formatPlaceViaStop(ep.originPlaceName(), sourceNode.name())
            : sourceNode.name();
        String formattedDestName = ep.hasCustomDest()
            ? formatPlaceViaStop(
                ep.destPlaceName() != null ? ep.destPlaceName() : "Selected Destination Pin",
                destNode.name()
            )
            : destNode.name();

        int totalTime = goalState.totalTimeMins();
        String badge = buildBadgeLabel(criteria, modeFilter, goalState);
        String formula = String.format(
            Locale.ROOT,
            "%d min Total = %d min Walk + %d min Bus + %d min Metro + %d min Wait + %d min Transfer",
            totalTime,
            goalState.walkingMins(),
            goalState.busMins(),
            goalState.metroMins(),
            goalState.waitingMins(),
            goalState.transferMins()
        );

        return new RouteOptionDto(
            null,
            badge,
            criteria.name(),
            modeFilter.name(),
            sourceNode.nodeKey(),
            formattedSourceName,
            destNode.nodeKey(),
            formattedDestName,
            goalState.walkingMins(),
            goalState.busMins(),
            goalState.metroMins(),
            goalState.waitingMins(),
            goalState.transferMins(),
            totalTime,
            goalState.totalDistanceKm(),
            goalState.totalFareInr(),
            goalState.transfers(),
            "SCHEDULED_AND_ESTIMATED",
            formula,
            legs
        );
    }

    private String cleanLabel(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim().replaceAll("\\s+", " ");
        return trimmed.isEmpty() ? null : clampLength(trimmed, 80);
    }

    private String formatPlaceViaStop(String placeName, String stopName) {
        if (placeName.equalsIgnoreCase(stopName)) {
            return clampLength(stopName, 118);
        }
        return clampLength(placeName + " (via " + stopName + ")", 118);
    }

    private String clampLength(String text, int maxLen) {
        if (text == null || text.length() <= maxLen) {
            return text;
        }
        return text.substring(0, maxLen - 3) + "...";
    }

    private void buildMetroLineReachability(
        MetroLine line,
        MetroStation start,
        Map<Long, List<MetroConnection>> adj,
        Map<Long, MetroStation> stationById,
        List<FareRule> fareRules,
        int waitMins,
        List<RideEdge> outEdges
    ) {
        record Step(MetroStation station, double distKm, int mins, int stops, List<double[]> coords) {}
        Map<Long, Integer> bestStops = new HashMap<>();
        PriorityQueue<Step> queue = new PriorityQueue<>(Comparator.comparingInt(Step::mins));

        List<double[]> initialCoords = new ArrayList<>();
        initialCoords.add(new double[]{start.getLatitude().doubleValue(), start.getLongitude().doubleValue()});
        queue.add(new Step(start, 0.0, 0, 0, initialCoords));
        bestStops.put(start.getStationId(), 0);

        String shortCode = line.getLineCode().replace("_LINE", "");
        while (!queue.isEmpty()) {
            Step cur = queue.poll();
            if (cur.stops() > 0) {
                BigDecimal fare = lookupSlabFare(fareRules, "NAMMA_METRO", cur.distKm());
                String lineLabel = line.getLineName().startsWith("Namma Metro")
                    ? line.getLineName()
                    : "Namma Metro " + line.getLineName();
                String title = lineLabel
                    + " (" + start.getStationName() + " -> " + cur.station().getStationName() + ")";
                outEdges.add(new RideEdge(
                    "METRO_" + start.getStationId(),
                    "METRO_" + cur.station().getStationId(),
                    "METRO",
                    "NAMMA_METRO",
                    shortCode,
                    title,
                    line.getColorHex(),
                    round2(cur.distKm()),
                    cur.mins(),
                    waitMins,
                    0,
                    fare,
                    cur.stops(),
                    cur.coords()
                ));
            }
            for (MetroConnection conn : adj.getOrDefault(cur.station().getStationId(), List.of())) {
                MetroStation next = stationById.get(conn.getToStation().getStationId());
                if (next == null || bestStops.containsKey(next.getStationId())) {
                    continue;
                }
                bestStops.put(next.getStationId(), cur.stops() + 1);
                List<double[]> nextCoords = new ArrayList<>(cur.coords());
                nextCoords.add(new double[]{next.getLatitude().doubleValue(), next.getLongitude().doubleValue()});
                queue.add(new Step(
                    next,
                    cur.distKm() + conn.getDistanceKm().doubleValue(),
                    cur.mins() + conn.getTravelTimeMins(),
                    cur.stops() + 1,
                    nextCoords
                ));
            }
        }
    }

    private String mapBusServiceToFareCategory(String serviceType) {
        if ("VAJRA_AC".equalsIgnoreCase(serviceType)) {
            return "BMTC_VAJRA_AC";
        }
        if ("VAYU_VAJRA".equalsIgnoreCase(serviceType)) {
            return "BMTC_VAYU_VAJRA";
        }
        return "BMTC_ORDINARY";
    }

    private BigDecimal lookupSlabFare(List<FareRule> rules, String category, double distanceKm) {
        BigDecimal fallback = BigDecimal.valueOf(20.00).setScale(2, RoundingMode.HALF_UP);
        for (FareRule rule : rules) {
            if (!category.equalsIgnoreCase(rule.getServiceCategory())) {
                continue;
            }
            double min = rule.getMinDistanceKm().doubleValue();
            double max = rule.getMaxDistanceKm().doubleValue();
            fallback = rule.getFareInr();
            if (distanceKm >= min && distanceKm <= max) {
                return rule.getFareInr().setScale(2, RoundingMode.HALF_UP);
            }
        }
        return fallback.setScale(2, RoundingMode.HALF_UP);
    }

    private String buildBadgeLabel(OptimizationCriteria criteria, ModeFilter filter, SearchState goal) {
        if (filter == ModeFilter.BUS_ONLY) {
            return "Bus-Only (" + goal.totalTimeMins() + "m)";
        }
        if (filter == ModeFilter.METRO_ONLY) {
            return "Metro-Only (" + goal.totalTimeMins() + "m)";
        }
        return switch (criteria) {
            case FASTEST -> "Fastest Multi-Modal";
            case CHEAPEST -> "Lowest Fare (Rs. " + goal.totalFareInr().toPlainString() + ")";
            case MIN_TRANSFERS -> "Minimum Transfers (" + goal.transfers() + ")";
        };
    }

    public static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double r = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0);
        return r * 2.0 * Math.asin(Math.sqrt(a));
    }

    private static double round2(double val) {
        return Math.round(val * 100.0) / 100.0;
    }
}