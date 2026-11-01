package com.bengaluru.transit.service;

import com.bengaluru.transit.dto.AdminDtos.BusRouteStopUpsertRequest;
import com.bengaluru.transit.dto.AdminDtos.BusRouteUpsertRequest;
import com.bengaluru.transit.dto.AdminDtos.BusStopUpsertRequest;
import com.bengaluru.transit.dto.AdminDtos.BusUpsertRequest;
import com.bengaluru.transit.dto.AdminDtos.CityLandmarkUpsertRequest;
import com.bengaluru.transit.dto.AdminDtos.FareRuleUpsertRequest;
import com.bengaluru.transit.dto.AdminDtos.FeedbackModerationRequest;
import com.bengaluru.transit.dto.AdminDtos.MetroStationUpsertRequest;
import com.bengaluru.transit.dto.AdminDtos.ScheduleUpsertRequest;
import com.bengaluru.transit.dto.AdminDtos.TransferPointUpsertRequest;
import com.bengaluru.transit.dto.JourneyDtos.FeedbackDto;
import com.bengaluru.transit.entity.AuditLog;
import com.bengaluru.transit.entity.Bus;
import com.bengaluru.transit.entity.BusRoute;
import com.bengaluru.transit.entity.BusRouteStop;
import com.bengaluru.transit.entity.BusStop;
import com.bengaluru.transit.entity.CityLandmark;
import com.bengaluru.transit.entity.FareRule;
import com.bengaluru.transit.entity.Feedback;
import com.bengaluru.transit.entity.MetroLine;
import com.bengaluru.transit.entity.MetroStation;
import com.bengaluru.transit.entity.Schedule;
import com.bengaluru.transit.entity.TransferPoint;
import com.bengaluru.transit.exception.BadRequestException;
import com.bengaluru.transit.exception.ResourceNotFoundException;
import com.bengaluru.transit.repository.AuditLogRepository;
import com.bengaluru.transit.repository.BusRepository;
import com.bengaluru.transit.repository.BusRouteRepository;
import com.bengaluru.transit.repository.BusRouteStopRepository;
import com.bengaluru.transit.repository.BusStopRepository;
import com.bengaluru.transit.repository.CityLandmarkRepository;
import com.bengaluru.transit.repository.FareRuleRepository;
import com.bengaluru.transit.repository.FeedbackRepository;
import com.bengaluru.transit.repository.MetroLineRepository;
import com.bengaluru.transit.repository.MetroStationRepository;
import com.bengaluru.transit.repository.ScheduleRepository;
import com.bengaluru.transit.repository.TransferPointRepository;
import com.bengaluru.transit.repository.TransitSqlRepository;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminTransitService {

    private final BusStopRepository busStopRepository;
    private final BusRouteRepository busRouteRepository;
    private final BusRepository busRepository;
    private final BusRouteStopRepository busRouteStopRepository;
    private final MetroLineRepository metroLineRepository;
    private final MetroStationRepository metroStationRepository;
    private final TransferPointRepository transferPointRepository;
    private final ScheduleRepository scheduleRepository;
    private final FareRuleRepository fareRuleRepository;
    private final FeedbackRepository feedbackRepository;
    private final AuditLogRepository auditLogRepository;
    private final CityLandmarkRepository cityLandmarkRepository;
    private final TransitSqlRepository transitSqlRepository;
    private final JourneyPlannerService journeyPlannerService;

    public AdminTransitService(
        BusStopRepository busStopRepository,
        BusRouteRepository busRouteRepository,
        BusRepository busRepository,
        BusRouteStopRepository busRouteStopRepository,
        MetroLineRepository metroLineRepository,
        MetroStationRepository metroStationRepository,
        TransferPointRepository transferPointRepository,
        ScheduleRepository scheduleRepository,
        FareRuleRepository fareRuleRepository,
        FeedbackRepository feedbackRepository,
        AuditLogRepository auditLogRepository,
        CityLandmarkRepository cityLandmarkRepository,
        TransitSqlRepository transitSqlRepository,
        JourneyPlannerService journeyPlannerService
    ) {
        this.busStopRepository = busStopRepository;
        this.busRouteRepository = busRouteRepository;
        this.busRepository = busRepository;
        this.busRouteStopRepository = busRouteStopRepository;
        this.metroLineRepository = metroLineRepository;
        this.metroStationRepository = metroStationRepository;
        this.transferPointRepository = transferPointRepository;
        this.scheduleRepository = scheduleRepository;
        this.fareRuleRepository = fareRuleRepository;
        this.feedbackRepository = feedbackRepository;
        this.auditLogRepository = auditLogRepository;
        this.cityLandmarkRepository = cityLandmarkRepository;
        this.transitSqlRepository = transitSqlRepository;
        this.journeyPlannerService = journeyPlannerService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDbmsSchemaCatalog() {
        return transitSqlRepository.queryCompleteDbmsSchemaCatalog();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDbmsRelationDetails(String tableName, int limit) {
        Map<String, Object> details = transitSqlRepository.queryRelationDetails(tableName, limit);
        if (details == null) {
            throw new ResourceNotFoundException("SQL table or view not found in bengaluru_transit: " + tableName);
        }
        return details;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAdminInventorySnapshot() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("busStops", busStopRepository.findAllByOrderByStopNameAsc());
        payload.put("busRoutes", busRouteRepository.findAllByOrderByRouteNumberAsc());
        payload.put("buses", busRepository.findAllByOrderByRegistrationNoAsc().stream().map(this::mapBus).toList());
        payload.put("metroLines", metroLineRepository.findAllByOrderByLineIdAsc());
        payload.put("metroStations", metroStationRepository.findAllByOrderByLine_LineIdAscStationOrderAsc()
            .stream().map(this::mapStation).toList());
        payload.put("transferPoints", transferPointRepository.findAllByOrderByHubNameAsc()
            .stream().map(this::mapTransfer).toList());
        payload.put("schedules", scheduleRepository.findAllByOrderByTransportModeAscScheduleIdAsc()
            .stream().map(this::mapSchedule).toList());
        payload.put("fareRules", fareRuleRepository.findAllByOrderByServiceCategoryAscMinDistanceKmAsc());
        payload.put("cityLandmarks", cityLandmarkRepository.findAllByOrderByLandmarkNameAsc());
        return payload;
    }

    // ---- BUS STOPS ----
    @Transactional
    public BusStop createBusStop(BusStopUpsertRequest req) {
        BusStop stop = new BusStop();
        applyBusStop(stop, req);
        return busStopRepository.save(stop);
    }

    @Transactional
    public BusStop updateBusStop(Long stopId, BusStopUpsertRequest req) {
        BusStop stop = busStopRepository.findById(stopId)
            .orElseThrow(() -> new ResourceNotFoundException("Bus stop not found: " + stopId));
        applyBusStop(stop, req);
        return busStopRepository.save(stop);
    }

    @Transactional
    public void deleteBusStop(Long stopId) {
        BusStop stop = busStopRepository.findById(stopId)
            .orElseThrow(() -> new ResourceNotFoundException("Bus stop not found: " + stopId));
        busStopRepository.delete(stop);
    }

    private void applyBusStop(BusStop stop, BusStopUpsertRequest req) {
        stop.setStopCode(req.stopCode().trim().toUpperCase(Locale.ROOT));
        stop.setStopName(req.stopName().trim());
        stop.setAreaName(req.areaName().trim());
        stop.setLatitude(req.latitude());
        stop.setLongitude(req.longitude());
        stop.setHasShelter(req.hasShelter() == null || req.hasShelter());
        stop.setIsInterchangeHub(Boolean.TRUE.equals(req.isInterchangeHub()));
        stop.setIsActive(req.isActive() == null || req.isActive());
    }

    // ---- BUS ROUTES (Fires MySQL Audit Triggers on INSERT / UPDATE / DELETE) ----
    @Transactional
    public BusRoute createBusRoute(BusRouteUpsertRequest req) {
        BusRoute route = new BusRoute();
        applyBusRoute(route, req);
        return busRouteRepository.save(route);
    }

    @Transactional
    public BusRoute updateBusRoute(Long routeId, BusRouteUpsertRequest req) {
        BusRoute route = busRouteRepository.findById(routeId)
            .orElseThrow(() -> new ResourceNotFoundException("Bus route not found: " + routeId));
        applyBusRoute(route, req);
        return busRouteRepository.save(route);
    }

    @Transactional
    public void deleteBusRoute(Long routeId) {
        BusRoute route = busRouteRepository.findById(routeId)
            .orElseThrow(() -> new ResourceNotFoundException("Bus route not found: " + routeId));
        busRouteRepository.delete(route);
    }

    private void applyBusRoute(BusRoute route, BusRouteUpsertRequest req) {
        route.setRouteNumber(req.routeNumber().trim().toUpperCase(Locale.ROOT));
        route.setRouteName(req.routeName().trim());
        route.setServiceType(req.serviceType().trim().toUpperCase(Locale.ROOT));
        route.setOriginName(req.originName().trim());
        route.setDestinationName(req.destinationName().trim());
        route.setTotalDistanceKm(req.totalDistanceKm());
        route.setIsActive(req.isActive() == null || req.isActive());
    }

    // ---- BUS FLEET ----
    @Transactional
    public Map<String, Object> createBus(BusUpsertRequest req) {
        Bus bus = new Bus();
        applyBus(bus, req);
        return mapBus(busRepository.save(bus));
    }

    @Transactional
    public Map<String, Object> updateBus(Long busId, BusUpsertRequest req) {
        Bus bus = busRepository.findById(busId)
            .orElseThrow(() -> new ResourceNotFoundException("Bus vehicle not found: " + busId));
        applyBus(bus, req);
        return mapBus(busRepository.save(bus));
    }

    @Transactional
    public void deleteBus(Long busId) {
        Bus bus = busRepository.findById(busId)
            .orElseThrow(() -> new ResourceNotFoundException("Bus vehicle not found: " + busId));
        busRepository.delete(bus);
    }

    private void applyBus(Bus bus, BusUpsertRequest req) {
        BusRoute route = busRouteRepository.findById(req.routeId())
            .orElseThrow(() -> new ResourceNotFoundException("Bus route not found: " + req.routeId()));
        bus.setRoute(route);
        bus.setRegistrationNo(req.registrationNo().trim().toUpperCase(Locale.ROOT));
        bus.setBusType(req.busType().trim().toUpperCase(Locale.ROOT));
        bus.setSeatingCapacity(req.seatingCapacity());
        bus.setDepotName(req.depotName().trim());
        bus.setOperationalStatus(req.operationalStatus().trim().toUpperCase(Locale.ROOT));
    }

    // ---- ORDERED BUS ROUTE STOPS ----
    @Transactional
    public Map<String, Object> addStopToBusRoute(BusRouteStopUpsertRequest req) {
        BusRoute route = busRouteRepository.findById(req.routeId())
            .orElseThrow(() -> new ResourceNotFoundException("Bus route not found: " + req.routeId()));
        BusStop stop = busStopRepository.findById(req.stopId())
            .orElseThrow(() -> new ResourceNotFoundException("Bus stop not found: " + req.stopId()));

        BusRouteStop brs = new BusRouteStop();
        brs.setRoute(route);
        brs.setStop(stop);
        brs.setDirection(req.direction().trim().toUpperCase(Locale.ROOT));
        brs.setStopSequence(req.stopSequence());
        brs.setDistanceFromStartKm(req.distanceFromStartKm());
        brs.setTravelMinsFromPrev(req.travelMinsFromPrev());
        BusRouteStop saved = busRouteStopRepository.save(brs);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("routeStopId", saved.getId());
        res.put("routeId", route.getRouteId());
        res.put("routeNumber", route.getRouteNumber());
        res.put("stopId", stop.getStopId());
        res.put("stopName", stop.getStopName());
        res.put("direction", saved.getDirection());
        res.put("stopSequence", saved.getStopSequence());
        return res;
    }

    @Transactional
    public void deleteBusRouteStop(Long routeStopId) {
        BusRouteStop brs = busRouteStopRepository.findById(routeStopId)
            .orElseThrow(() -> new ResourceNotFoundException("Route stop mapping not found: " + routeStopId));
        busRouteStopRepository.delete(brs);
    }

    // ---- METRO STATIONS ----
    @Transactional
    public Map<String, Object> createMetroStation(MetroStationUpsertRequest req) {
        MetroStation station = new MetroStation();
        applyMetroStation(station, req);
        return mapStation(metroStationRepository.save(station));
    }

    @Transactional
    public Map<String, Object> updateMetroStation(Long stationId, MetroStationUpsertRequest req) {
        MetroStation station = metroStationRepository.findById(stationId)
            .orElseThrow(() -> new ResourceNotFoundException("Metro station not found: " + stationId));
        applyMetroStation(station, req);
        return mapStation(metroStationRepository.save(station));
    }

    private void applyMetroStation(MetroStation station, MetroStationUpsertRequest req) {
        MetroLine line = metroLineRepository.findById(req.lineId())
            .orElseThrow(() -> new ResourceNotFoundException("Metro line not found: " + req.lineId()));
        station.setStationCode(req.stationCode().trim().toUpperCase(Locale.ROOT));
        station.setStationName(req.stationName().trim());
        station.setLine(line);
        station.setStationOrder(req.stationOrder());
        station.setLatitude(req.latitude());
        station.setLongitude(req.longitude());
        station.setIsInterchange(Boolean.TRUE.equals(req.isInterchange()));
        station.setStructureType(req.structureType().trim().toUpperCase(Locale.ROOT));
        station.setHasParking(Boolean.TRUE.equals(req.hasParking()));
        station.setIsActive(req.isActive() == null || req.isActive());
    }

    // ---- TRANSFER POINTS ----
    @Transactional
    public Map<String, Object> createTransferPoint(TransferPointUpsertRequest req) {
        TransferPoint tp = new TransferPoint();
        applyTransferPoint(tp, req);
        return mapTransfer(transferPointRepository.save(tp));
    }

    @Transactional
    public Map<String, Object> updateTransferPoint(Long transferId, TransferPointUpsertRequest req) {
        TransferPoint tp = transferPointRepository.findById(transferId)
            .orElseThrow(() -> new ResourceNotFoundException("Transfer point not found: " + transferId));
        applyTransferPoint(tp, req);
        return mapTransfer(transferPointRepository.save(tp));
    }

    @Transactional
    public void deleteTransferPoint(Long transferId) {
        TransferPoint tp = transferPointRepository.findById(transferId)
            .orElseThrow(() -> new ResourceNotFoundException("Transfer point not found: " + transferId));
        transferPointRepository.delete(tp);
    }

    private void applyTransferPoint(TransferPoint tp, TransferPointUpsertRequest req) {
        BusStop bs = busStopRepository.findById(req.busStopId())
            .orElseThrow(() -> new ResourceNotFoundException("Bus stop not found: " + req.busStopId()));
        MetroStation ms = metroStationRepository.findById(req.metroStationId())
            .orElseThrow(() -> new ResourceNotFoundException("Metro station not found: " + req.metroStationId()));
        tp.setHubName(req.hubName().trim());
        tp.setBusStop(bs);
        tp.setMetroStation(ms);
        tp.setWalkingDistanceM(req.walkingDistanceM());
        tp.setWalkingTimeMins(req.walkingTimeMins());
        tp.setTransferBufferMins(req.transferBufferMins());
        tp.setHasSkywalk(Boolean.TRUE.equals(req.hasSkywalk()));
        tp.setIsActive(req.isActive() == null || req.isActive());
    }

    // ---- SCHEDULES ----
    @Transactional
    public Map<String, Object> createSchedule(ScheduleUpsertRequest req) {
        Schedule sc = new Schedule();
        applySchedule(sc, req);
        return mapSchedule(scheduleRepository.save(sc));
    }

    @Transactional
    public Map<String, Object> updateSchedule(Long scheduleId, ScheduleUpsertRequest req) {
        Schedule sc = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new ResourceNotFoundException("Schedule not found: " + scheduleId));
        applySchedule(sc, req);
        return mapSchedule(scheduleRepository.save(sc));
    }

    private void applySchedule(Schedule sc, ScheduleUpsertRequest req) {
        String mode = req.transportMode().trim().toUpperCase(Locale.ROOT);
        sc.setTransportMode(mode);
        if ("BUS".equals(mode)) {
            if (req.busRouteId() == null) {
                throw new BadRequestException("busRouteId is required when transportMode is BUS.");
            }
            BusRoute route = busRouteRepository.findById(req.busRouteId())
                .orElseThrow(() -> new ResourceNotFoundException("Bus route not found: " + req.busRouteId()));
            sc.setBusRoute(route);
            sc.setMetroLine(null);
        } else if ("METRO".equals(mode)) {
            if (req.metroLineId() == null) {
                throw new BadRequestException("metroLineId is required when transportMode is METRO.");
            }
            MetroLine line = metroLineRepository.findById(req.metroLineId())
                .orElseThrow(() -> new ResourceNotFoundException("Metro line not found: " + req.metroLineId()));
            sc.setMetroLine(line);
            sc.setBusRoute(null);
        } else {
            throw new BadRequestException("transportMode must be BUS or METRO.");
        }
        sc.setDayType(req.dayType().trim().toUpperCase(Locale.ROOT));
        sc.setFirstServiceTime(LocalTime.parse(req.firstServiceTime().trim()));
        sc.setLastServiceTime(LocalTime.parse(req.lastServiceTime().trim()));
        sc.setPeakHeadwayMins(req.peakHeadwayMins());
        sc.setOffpeakHeadwayMins(req.offpeakHeadwayMins());
        sc.setDataConfidence(
            (req.dataConfidence() == null || req.dataConfidence().isBlank())
                ? "SCHEDULED_SAMPLE"
                : req.dataConfidence().trim().toUpperCase(Locale.ROOT)
        );
        sc.setScheduleNote(req.scheduleNote());
    }

    // ---- FARE RULES (Fires trg_fare_rules_after_update on UPDATE) ----
    @Transactional
    public FareRule createFareRule(FareRuleUpsertRequest req) {
        if (req.maxDistanceKm().compareTo(req.minDistanceKm()) <= 0) {
            throw new BadRequestException("maxDistanceKm must be strictly greater than minDistanceKm.");
        }
        FareRule rule = new FareRule();
        applyFareRule(rule, req);
        return fareRuleRepository.save(rule);
    }

    @Transactional
    public FareRule updateFareRule(Long fareRuleId, FareRuleUpsertRequest req) {
        if (req.maxDistanceKm().compareTo(req.minDistanceKm()) <= 0) {
            throw new BadRequestException("maxDistanceKm must be strictly greater than minDistanceKm.");
        }
        FareRule rule = fareRuleRepository.findById(fareRuleId)
            .orElseThrow(() -> new ResourceNotFoundException("Fare rule not found: " + fareRuleId));
        applyFareRule(rule, req);
        return fareRuleRepository.save(rule);
    }

    private void applyFareRule(FareRule rule, FareRuleUpsertRequest req) {
        rule.setServiceCategory(req.serviceCategory().trim().toUpperCase(Locale.ROOT));
        rule.setMinDistanceKm(req.minDistanceKm());
        rule.setMaxDistanceKm(req.maxDistanceKm());
        rule.setFareInr(req.fareInr());
        rule.setSmartCardDiscountPct(req.smartCardDiscountPct());
        rule.setSourceNote(req.sourceNote());
    }

    // ---- FEEDBACK MODERATION & AUDIT LOGS ----
    @Transactional
    public FeedbackDto moderateFeedback(Long feedbackId, FeedbackModerationRequest req) {
        Feedback fb = feedbackRepository.findById(feedbackId)
            .orElseThrow(() -> new ResourceNotFoundException("Feedback entry not found: " + feedbackId));
        String status = req.reviewStatus().trim().toUpperCase(Locale.ROOT);
        if (!List.of("PENDING", "REVIEWED", "RESOLVED").contains(status)) {
            throw new BadRequestException("reviewStatus must be PENDING, REVIEWED, or RESOLVED.");
        }
        fb.setReviewStatus(status);
        return journeyPlannerService.mapFeedbackDto(feedbackRepository.save(fb));
    }

    @Transactional
    public CityLandmark createCityLandmark(CityLandmarkUpsertRequest req) {
        String name = req.landmarkName().trim();
        if (cityLandmarkRepository.existsByLandmarkNameIgnoreCase(name)) {
            throw new BadRequestException("Bengaluru place already exists: " + name);
        }
        CityLandmark lm = new CityLandmark();
        applyLandmarkFields(lm, req);
        CityLandmark saved = cityLandmarkRepository.save(lm);
        recordLandmarkAudit("INSERT", String.valueOf(saved.getLandmarkId()), null, landmarkJson(saved));
        return saved;
    }

    @Transactional
    public CityLandmark updateCityLandmark(Long landmarkId, CityLandmarkUpsertRequest req) {
        CityLandmark lm = cityLandmarkRepository.findById(landmarkId)
            .orElseThrow(() -> new ResourceNotFoundException("Bengaluru landmark not found: " + landmarkId));
        String nextName = req.landmarkName().trim();
        if (!lm.getLandmarkName().equalsIgnoreCase(nextName)
            && cityLandmarkRepository.existsByLandmarkNameIgnoreCase(nextName)) {
            throw new BadRequestException("Another Bengaluru place already uses name: " + nextName);
        }
        String beforeJson = landmarkJson(lm);
        applyLandmarkFields(lm, req);
        CityLandmark saved = cityLandmarkRepository.save(lm);
        recordLandmarkAudit("UPDATE", String.valueOf(saved.getLandmarkId()), beforeJson, landmarkJson(saved));
        return saved;
    }

    @Transactional
    public void deleteCityLandmark(Long landmarkId) {
        CityLandmark lm = cityLandmarkRepository.findById(landmarkId)
            .orElseThrow(() -> new ResourceNotFoundException("Bengaluru landmark not found: " + landmarkId));
        String beforeJson = landmarkJson(lm);
        cityLandmarkRepository.delete(lm);
        recordLandmarkAudit("DELETE", String.valueOf(landmarkId), beforeJson, null);
    }

    private void applyLandmarkFields(CityLandmark lm, CityLandmarkUpsertRequest req) {
        List<String> validCategories = List.of(
            "GOVT_OFFICE", "FAMOUS_PLACE", "COLLEGE", "SCHOOL", "TECH_PARK",
            "HOSPITAL", "MALL_MARKET", "HERITAGE_PARK", "RAILWAY_HUB", "NEIGHBORHOOD"
        );
        String cat = req.category().trim().toUpperCase(Locale.ROOT);
        if (!validCategories.contains(cat)) {
            throw new BadRequestException("Invalid landmark category: " + cat);
        }
        double lat = req.latitude().doubleValue();
        double lng = req.longitude().doubleValue();
        if (lat < 12.50 || lat > 13.50 || lng < 77.20 || lng > 78.00) {
            throw new BadRequestException(
                "Coordinates must lie within Greater Bengaluru bounds (lat 12.50..13.50, lng 77.20..78.00)."
            );
        }
        String pin = req.pincode().trim();
        if (!pin.matches("^[0-9]{6}$")) {
            throw new BadRequestException("PIN code must be a 6-digit Bengaluru postal code (e.g., 560001).");
        }
        lm.setLandmarkName(req.landmarkName().trim());
        lm.setCategory(cat);
        lm.setAreaName(req.areaName().trim());
        lm.setStreetAddress(req.streetAddress().trim());
        lm.setPincode(pin);
        lm.setLatitude(req.latitude());
        lm.setLongitude(req.longitude());
        lm.setIsActive(req.isActive() == null || req.isActive());
    }

    private String landmarkJson(CityLandmark lm) {
        String safeName = lm.getLandmarkName().replace("\\", "\\\\").replace("\"", "\\\"");
        String safeArea = lm.getAreaName().replace("\\", "\\\\").replace("\"", "\\\"");
        return String.format(
            Locale.US,
            "{\"landmarkId\":%d,\"landmarkName\":\"%s\",\"category\":\"%s\",\"areaName\":\"%s\",\"pincode\":\"%s\",\"isActive\":%s}",
            lm.getLandmarkId() != null ? lm.getLandmarkId() : 0L,
            safeName,
            lm.getCategory(),
            safeArea,
            lm.getPincode(),
            Boolean.TRUE.equals(lm.getIsActive()) ? "true" : "false"
        );
    }

    private void recordLandmarkAudit(String op, String id, String oldJson, String newJson) {
        AuditLog log = new AuditLog();
        log.setTableName("city_landmarks");
        log.setOperationType(op);
        log.setRecordIdentifier(id);
        log.setOldPayload(oldJson);
        log.setNewPayload(newJson);
        auditLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> listAuditLogs(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 50));
        return auditLogRepository.findAllByOrderByLogIdDesc(PageRequest.of(safePage, safeSize));
    }

    private Map<String, Object> mapBus(Bus b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("busId", b.getBusId());
        m.put("routeId", b.getRoute().getRouteId());
        m.put("routeNumber", b.getRoute().getRouteNumber());
        m.put("registrationNo", b.getRegistrationNo());
        m.put("busType", b.getBusType());
        m.put("seatingCapacity", b.getSeatingCapacity());
        m.put("depotName", b.getDepotName());
        m.put("operationalStatus", b.getOperationalStatus());
        return m;
    }

    private Map<String, Object> mapStation(MetroStation s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("stationId", s.getStationId());
        m.put("stationCode", s.getStationCode());
        m.put("stationName", s.getStationName());
        m.put("lineId", s.getLine().getLineId());
        m.put("lineName", s.getLine().getLineName());
        m.put("colorHex", s.getLine().getColorHex());
        m.put("stationOrder", s.getStationOrder());
        m.put("latitude", s.getLatitude());
        m.put("longitude", s.getLongitude());
        m.put("isInterchange", s.getIsInterchange());
        m.put("structureType", s.getStructureType());
        m.put("hasParking", s.getHasParking());
        m.put("isActive", s.getIsActive());
        return m;
    }

    private Map<String, Object> mapTransfer(TransferPoint tp) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("transferId", tp.getTransferId());
        m.put("hubName", tp.getHubName());
        m.put("busStopId", tp.getBusStop().getStopId());
        m.put("busStopName", tp.getBusStop().getStopName());
        m.put("metroStationId", tp.getMetroStation().getStationId());
        m.put("metroStationName", tp.getMetroStation().getStationName());
        m.put("walkingDistanceM", tp.getWalkingDistanceM());
        m.put("walkingTimeMins", tp.getWalkingTimeMins());
        m.put("transferBufferMins", tp.getTransferBufferMins());
        m.put("hasSkywalk", tp.getHasSkywalk());
        m.put("isActive", tp.getIsActive());
        return m;
    }

    private Map<String, Object> mapSchedule(Schedule sc) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("scheduleId", sc.getScheduleId());
        m.put("transportMode", sc.getTransportMode());
        m.put("busRouteId", sc.getBusRoute() != null ? sc.getBusRoute().getRouteId() : null);
        m.put("busRouteNumber", sc.getBusRoute() != null ? sc.getBusRoute().getRouteNumber() : null);
        m.put("metroLineId", sc.getMetroLine() != null ? sc.getMetroLine().getLineId() : null);
        m.put("metroLineName", sc.getMetroLine() != null ? sc.getMetroLine().getLineName() : null);
        m.put("dayType", sc.getDayType());
        m.put("firstServiceTime", sc.getFirstServiceTime().toString());
        m.put("lastServiceTime", sc.getLastServiceTime().toString());
        m.put("peakHeadwayMins", sc.getPeakHeadwayMins());
        m.put("offpeakHeadwayMins", sc.getOffpeakHeadwayMins());
        m.put("dataConfidence", sc.getDataConfidence());
        m.put("scheduleNote", sc.getScheduleNote());
        return m;
    }
}
