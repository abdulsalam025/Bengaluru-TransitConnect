package com.bengaluru.transit.service;

import com.bengaluru.transit.dto.TransitDtos.BusRouteSummaryDto;
import com.bengaluru.transit.dto.TransitDtos.MetroLineOverviewDto;
import com.bengaluru.transit.dto.TransitDtos.MetroStationPointDto;
import com.bengaluru.transit.dto.TransitDtos.NearbyNodeDto;
import com.bengaluru.transit.dto.TransitDtos.NetworkOverviewDto;
import com.bengaluru.transit.dto.TransitDtos.PlaceSuggestionDto;
import com.bengaluru.transit.dto.TransitDtos.TransferHubDto;
import com.bengaluru.transit.dto.TransitDtos.TransitNodeDto;
import com.bengaluru.transit.entity.Bus;
import com.bengaluru.transit.entity.BusRoute;
import com.bengaluru.transit.entity.BusRouteStop;
import com.bengaluru.transit.entity.BusStop;
import com.bengaluru.transit.entity.CityLandmark;
import com.bengaluru.transit.entity.FareRule;
import com.bengaluru.transit.entity.MetroLine;
import com.bengaluru.transit.entity.MetroStation;
import com.bengaluru.transit.entity.Schedule;
import com.bengaluru.transit.entity.TransferPoint;
import com.bengaluru.transit.exception.ResourceNotFoundException;
import com.bengaluru.transit.repository.BusRepository;
import com.bengaluru.transit.repository.BusRouteRepository;
import com.bengaluru.transit.repository.BusRouteStopRepository;
import com.bengaluru.transit.repository.BusStopRepository;
import com.bengaluru.transit.repository.CityLandmarkRepository;
import com.bengaluru.transit.repository.FareRuleRepository;
import com.bengaluru.transit.repository.MetroLineRepository;
import com.bengaluru.transit.repository.MetroStationRepository;
import com.bengaluru.transit.repository.ScheduleRepository;
import com.bengaluru.transit.repository.TransferPointRepository;
import com.bengaluru.transit.repository.TransitSqlRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransitNetworkService {

    private final BusStopRepository busStopRepository;
    private final BusRouteRepository busRouteRepository;
    private final BusRepository busRepository;
    private final BusRouteStopRepository busRouteStopRepository;
    private final MetroLineRepository metroLineRepository;
    private final MetroStationRepository metroStationRepository;
    private final TransferPointRepository transferPointRepository;
    private final FareRuleRepository fareRuleRepository;
    private final ScheduleRepository scheduleRepository;
    private final TransitSqlRepository transitSqlRepository;
    private final CityLandmarkRepository cityLandmarkRepository;

    public TransitNetworkService(
        BusStopRepository busStopRepository,
        BusRouteRepository busRouteRepository,
        BusRepository busRepository,
        BusRouteStopRepository busRouteStopRepository,
        MetroLineRepository metroLineRepository,
        MetroStationRepository metroStationRepository,
        TransferPointRepository transferPointRepository,
        FareRuleRepository fareRuleRepository,
        ScheduleRepository scheduleRepository,
        TransitSqlRepository transitSqlRepository,
        CityLandmarkRepository cityLandmarkRepository
    ) {
        this.busStopRepository = busStopRepository;
        this.busRouteRepository = busRouteRepository;
        this.busRepository = busRepository;
        this.busRouteStopRepository = busRouteStopRepository;
        this.metroLineRepository = metroLineRepository;
        this.metroStationRepository = metroStationRepository;
        this.transferPointRepository = transferPointRepository;
        this.fareRuleRepository = fareRuleRepository;
        this.scheduleRepository = scheduleRepository;
        this.transitSqlRepository = transitSqlRepository;
        this.cityLandmarkRepository = cityLandmarkRepository;
    }

    @Transactional(readOnly = true)
    public NetworkOverviewDto getNetworkOverview() {
        List<TransitNodeDto> nodes = new ArrayList<>();

        List<MetroLine> lines = metroLineRepository.findAllByOrderByLineIdAsc();
        List<MetroLineOverviewDto> lineDtos = new ArrayList<>();
        for (MetroLine line : lines) {
            List<MetroStation> stations = metroStationRepository.findByLine_LineIdOrderByStationOrderAsc(line.getLineId());
            List<MetroStationPointDto> stationPoints = new ArrayList<>();
            for (MetroStation ms : stations) {
                if (!Boolean.TRUE.equals(ms.getIsActive())) {
                    continue;
                }
                stationPoints.add(new MetroStationPointDto(
                    ms.getStationId(),
                    "METRO_" + ms.getStationId(),
                    ms.getStationCode(),
                    ms.getStationName(),
                    ms.getStationOrder(),
                    ms.getLatitude().doubleValue(),
                    ms.getLongitude().doubleValue(),
                    Boolean.TRUE.equals(ms.getIsInterchange()),
                    ms.getStructureType()
                ));
                boolean isOperational = "OPERATIONAL".equalsIgnoreCase(line.getOperationalStatus());
                if (isOperational) {
                    nodes.add(new TransitNodeDto(
                        "METRO_" + ms.getStationId(),
                        "METRO_STATION",
                        ms.getStationCode(),
                        ms.getStationName(),
                        line.getLineName(),
                        line.getColorHex(),
                        ms.getLatitude().doubleValue(),
                        ms.getLongitude().doubleValue(),
                        Boolean.TRUE.equals(ms.getIsInterchange())
                    ));
                }
            }
            lineDtos.add(new MetroLineOverviewDto(
                line.getLineId(),
                line.getLineCode(),
                line.getLineName(),
                line.getColorHex(),
                line.getCorridorSummary(),
                line.getTotalLengthKm(),
                "OPERATIONAL".equalsIgnoreCase(line.getOperationalStatus()),
                stationPoints
            ));
        }

        for (BusStop bs : busStopRepository.findByIsActiveTrueOrderByStopNameAsc()) {
            nodes.add(new TransitNodeDto(
                "BUS_" + bs.getStopId(),
                "BUS_STOP",
                bs.getStopCode(),
                bs.getStopName(),
                bs.getAreaName(),
                "#2563EB",
                bs.getLatitude().doubleValue(),
                bs.getLongitude().doubleValue(),
                Boolean.TRUE.equals(bs.getIsInterchangeHub())
            ));
        }

        Map<Long, Integer> activeBusCountByRoute = new HashMap<>();
        for (Bus bus : busRepository.findAllByOrderByRegistrationNoAsc()) {
            if ("ACTIVE".equalsIgnoreCase(bus.getOperationalStatus())) {
                activeBusCountByRoute.merge(bus.getRoute().getRouteId(), 1, Integer::sum);
            }
        }

        Map<Long, Schedule> scheduleByRoute = new HashMap<>();
        for (Schedule sc : scheduleRepository.findAllByOrderByTransportModeAscScheduleIdAsc()) {
            if ("BUS".equalsIgnoreCase(sc.getTransportMode()) && sc.getBusRoute() != null) {
                scheduleByRoute.putIfAbsent(sc.getBusRoute().getRouteId(), sc);
            }
        }

        List<BusRouteSummaryDto> routeSummaries = new ArrayList<>();
        for (BusRoute route : busRouteRepository.findAllByOrderByRouteNumberAsc()) {
            Schedule sc = scheduleByRoute.get(route.getRouteId());
            routeSummaries.add(new BusRouteSummaryDto(
                route.getRouteId(),
                route.getRouteNumber(),
                route.getRouteName(),
                route.getServiceType(),
                route.getOriginName(),
                route.getDestinationName(),
                route.getTotalDistanceKm(),
                Boolean.TRUE.equals(route.getIsActive()),
                activeBusCountByRoute.getOrDefault(route.getRouteId(), 0),
                sc != null ? sc.getPeakHeadwayMins() : null,
                sc != null ? sc.getOffpeakHeadwayMins() : null,
                sc != null ? sc.getDataConfidence() : "SCHEDULED_SAMPLE"
            ));
        }

        List<TransferHubDto> hubs = new ArrayList<>();
        for (TransferPoint tp : transferPointRepository.findByIsActiveTrueOrderByHubNameAsc()) {
            hubs.add(new TransferHubDto(
                tp.getTransferId(),
                tp.getHubName(),
                "BUS_" + tp.getBusStop().getStopId(),
                tp.getBusStop().getStopName(),
                "METRO_" + tp.getMetroStation().getStationId(),
                tp.getMetroStation().getStationName(),
                tp.getMetroStation().getLine().getLineName(),
                tp.getMetroStation().getLine().getColorHex(),
                tp.getWalkingDistanceM(),
                tp.getWalkingTimeMins(),
                tp.getTransferBufferMins(),
                Boolean.TRUE.equals(tp.getHasSkywalk()),
                tp.getMetroStation().getLatitude().doubleValue(),
                tp.getMetroStation().getLongitude().doubleValue()
            ));
        }

        return new NetworkOverviewDto(
            nodes,
            lineDtos,
            routeSummaries,
            hubs,
            "Sample BMTC & Namma Metro schedules/fares modeled on published 2026 Bengaluru corridors (Purple, Green, and Yellow Lines operational). Values are labeled SCHEDULED_SAMPLE / OFFICIAL_PUBLISHED and are NOT live GPS telemetry."
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getBusRouteCorridorDetails(Long routeId, String direction) {
        BusRoute route = busRouteRepository.findById(routeId)
            .orElseThrow(() -> new ResourceNotFoundException("Bus route not found: " + routeId));
        String dir = (direction == null || direction.isBlank())
            ? "OUTBOUND"
            : direction.trim().toUpperCase(Locale.ROOT);
        List<BusRouteStop> stops = busRouteStopRepository
            .findByRoute_RouteIdAndDirectionOrderByStopSequenceAsc(routeId, dir);

        List<Map<String, Object>> stopItems = new ArrayList<>();
        for (BusRouteStop brs : stops) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("routeStopId", brs.getId());
            m.put("stopSequence", brs.getStopSequence());
            m.put("nodeKey", "BUS_" + brs.getStop().getStopId());
            m.put("stopCode", brs.getStop().getStopCode());
            m.put("stopName", brs.getStop().getStopName());
            m.put("areaName", brs.getStop().getAreaName());
            m.put("latitude", brs.getStop().getLatitude());
            m.put("longitude", brs.getStop().getLongitude());
            m.put("distanceFromStartKm", brs.getDistanceFromStartKm());
            m.put("travelMinsFromPrev", brs.getTravelMinsFromPrev());
            stopItems.add(m);
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("routeId", route.getRouteId());
        res.put("routeNumber", route.getRouteNumber());
        res.put("routeName", route.getRouteName());
        res.put("serviceType", route.getServiceType());
        res.put("direction", dir);
        res.put("stops", stopItems);
        return res;
    }

    @Transactional(readOnly = true)
    public List<NearbyNodeDto> findNearbyNodes(double lat, double lng, double radiusKm, int limit) {
        double safeRadius = Math.max(0.2, Math.min(radiusKm, 25.0));
        int safeLimit = Math.max(1, Math.min(limit, 25));
        return transitSqlRepository.callNearbyTransitNodes(lat, lng, safeRadius, safeLimit);
    }

    @Transactional(readOnly = true)
    public List<PlaceSuggestionDto> searchPlaces(String rawQuery, int limit) {
        return searchPlaces(rawQuery, "", limit);
    }

    @Transactional(readOnly = true)
    public List<PlaceSuggestionDto> searchPlaces(String rawQuery, String rawCategory, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 400));
        String q = rawQuery == null ? "" : rawQuery.trim().toLowerCase(Locale.ROOT);
        String[] tokens = q.isEmpty() ? new String[0] : q.split("[\\s,+]+");
        String catFilter = rawCategory == null ? "" : rawCategory.trim().toUpperCase(Locale.ROOT);
        if ("ALL".equals(catFilter)) {
            catFilter = "";
        }

        boolean includeLandmarks = catFilter.isEmpty()
            || (!"METRO_STATION".equals(catFilter) && !"BUS_STOP".equals(catFilter));
        boolean includeMetro = catFilter.isEmpty() || "METRO_STATION".equals(catFilter);
        boolean includeBus = catFilter.isEmpty() || "BUS_STOP".equals(catFilter);

        List<PlaceSuggestionDto> candidates = new ArrayList<>();

        // 1. Comprehensive Bengaluru Landmarks (Govt Offices, Famous Places, Colleges, Schools, Tech Parks, Hospitals, Malls, Neighborhoods)
        if (includeLandmarks) {
            try {
                List<CityLandmark> landmarks = cityLandmarkRepository.findActiveByOptionalCategory(catFilter);
                for (CityLandmark lm : landmarks) {
                    String catLabel = formatLandmarkCategory(lm.getCategory());
                    String streetAddr = lm.getStreetAddress() != null ? lm.getStreetAddress() : lm.getAreaName();
                    String pin = lm.getPincode() != null && !lm.getPincode().isBlank() ? lm.getPincode() : "";
                    String fullAddress = pin.isEmpty() ? streetAddr : (streetAddr + " - " + pin);
                    String searchable = (
                        lm.getLandmarkName() + " "
                        + lm.getAreaName() + " "
                        + fullAddress + " "
                        + lm.getCategory() + " "
                        + catLabel
                    ).toLowerCase(Locale.ROOT);

                    if (matchesAllTokens(searchable, tokens)) {
                        candidates.add(new PlaceSuggestionDto(
                            "LANDMARK_" + lm.getLandmarkId(),
                            "LANDMARK",
                            lm.getCategory(),
                            lm.getLandmarkName(),
                            lm.getAreaName() + " - " + catLabel,
                            fullAddress,
                            lm.getLatitude().doubleValue(),
                            lm.getLongitude().doubleValue(),
                            null
                        ));
                    }
                }
            } catch (DataAccessException ignored) {
                // Graceful fallback if city_landmarks DDL has not been reloaded yet
            }
        }

        // 2. Operational Namma Metro Stations
        if (includeMetro) {
            for (MetroStation ms : metroStationRepository.findByIsActiveTrueOrderByLine_LineIdAscStationOrderAsc()) {
                if (!"OPERATIONAL".equalsIgnoreCase(ms.getLine().getOperationalStatus())) {
                    continue;
                }
                String sub = ms.getLine().getLineName() + " (" + ms.getStationCode() + ")";
                String metroAddr = "Namma Metro " + ms.getLine().getLineName() + " Station (" + ms.getStationCode() + "), "
                    + ms.getStationName() + ", Bengaluru";
                String searchable = (
                    ms.getStationName() + " " + ms.getStationCode() + " " + ms.getLine().getLineName() + " metro station"
                ).toLowerCase(Locale.ROOT);
                if (matchesAllTokens(searchable, tokens)) {
                    candidates.add(new PlaceSuggestionDto(
                        "METRO_" + ms.getStationId(),
                        "METRO_STATION",
                        "METRO_STATION",
                        ms.getStationName(),
                        sub,
                        metroAddr,
                        ms.getLatitude().doubleValue(),
                        ms.getLongitude().doubleValue(),
                        "METRO_" + ms.getStationId()
                    ));
                }
            }
        }

        // 3. Active BMTC Bus Stops
        if (includeBus) {
            for (BusStop bs : busStopRepository.findByIsActiveTrueOrderByStopNameAsc()) {
                String sub = "BMTC Stop - " + bs.getAreaName() + " (" + bs.getStopCode() + ")";
                String busAddr = "BMTC Bus Stop (" + bs.getStopCode() + "), " + bs.getStopName()
                    + ", " + bs.getAreaName() + ", Bengaluru";
                String searchable = (
                    bs.getStopName() + " " + bs.getAreaName() + " " + bs.getStopCode() + " bmtc bus stop"
                ).toLowerCase(Locale.ROOT);
                if (matchesAllTokens(searchable, tokens)) {
                    candidates.add(new PlaceSuggestionDto(
                        "BUS_" + bs.getStopId(),
                        "BUS_STOP",
                        "BUS_STOP",
                        bs.getStopName(),
                        sub,
                        busAddr,
                        bs.getLatitude().doubleValue(),
                        bs.getLongitude().doubleValue(),
                        "BUS_" + bs.getStopId()
                    ));
                }
            }
        }

        if (!q.isEmpty()) {
            candidates.sort(Comparator
                .comparingInt((PlaceSuggestionDto p) -> relevanceRank(p, q))
                .thenComparing(PlaceSuggestionDto::name));
        }

        return candidates.size() > safeLimit ? candidates.subList(0, safeLimit) : candidates;
    }

    private boolean matchesAllTokens(String searchableLower, String[] tokens) {
        if (tokens.length == 0) {
            return true;
        }
        for (String token : tokens) {
            if (!token.isEmpty() && !searchableLower.contains(token)) {
                return false;
            }
        }
        return true;
    }

    private int relevanceRank(PlaceSuggestionDto item, String q) {
        String nameLower = item.name().toLowerCase(Locale.ROOT);
        if (nameLower.equals(q)) {
            return 0;
        }
        if (nameLower.startsWith(q)) {
            return 1;
        }
        if (nameLower.contains(q)) {
            return 2;
        }
        String addrLower = item.address() != null ? item.address().toLowerCase(Locale.ROOT) : "";
        if (addrLower.contains(q)) {
            return 3;
        }
        return 4;
    }

    private String formatLandmarkCategory(String rawCategory) {
        if (rawCategory == null) {
            return "Landmark";
        }
        return switch (rawCategory.toUpperCase(Locale.ROOT)) {
            case "GOVT_OFFICE" -> "Govt Office";
            case "FAMOUS_PLACE" -> "Famous Place";
            case "COLLEGE" -> "College / University";
            case "SCHOOL" -> "School / PU College";
            case "TECH_PARK" -> "Tech Park";
            case "HOSPITAL" -> "Hospital";
            case "MALL_MARKET" -> "Mall / Market";
            case "HERITAGE_PARK" -> "Park / Lake";
            case "RAILWAY_HUB" -> "Railway / Transit Hub";
            case "NEIGHBORHOOD" -> "Neighborhood / Area";
            default -> "Landmark";
        };
    }

    @Transactional(readOnly = true)
    public List<FareRule> listFareRules() {
        return fareRuleRepository.findAllByOrderByServiceCategoryAscMinDistanceKmAsc();
    }

    @Transactional(readOnly = true)
    public List<Schedule> listSchedules() {
        return scheduleRepository.findAllByOrderByTransportModeAscScheduleIdAsc();
    }
}