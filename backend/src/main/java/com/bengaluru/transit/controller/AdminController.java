package com.bengaluru.transit.controller;

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
import com.bengaluru.transit.entity.BusRoute;
import com.bengaluru.transit.entity.BusStop;
import com.bengaluru.transit.entity.CityLandmark;
import com.bengaluru.transit.entity.FareRule;
import com.bengaluru.transit.service.AdminTransitService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminTransitService adminService;

    public AdminController(AdminTransitService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/inventory")
    public Map<String, Object> getInventory() {
        return adminService.getAdminInventorySnapshot();
    }

    @GetMapping("/dbms-schema")
    public Map<String, Object> getDbmsSchemaCatalog() {
        return adminService.getDbmsSchemaCatalog();
    }

    @GetMapping("/dbms-schema/{tableName}")
    public Map<String, Object> getDbmsRelationDetails(
        @PathVariable String tableName,
        @RequestParam(defaultValue = "20") int limit
    ) {
        return adminService.getDbmsRelationDetails(tableName, limit);
    }

    @PostMapping("/bus-stops")
    @ResponseStatus(HttpStatus.CREATED)
    public BusStop createBusStop(@Valid @RequestBody BusStopUpsertRequest req) {
        return adminService.createBusStop(req);
    }

    @PutMapping("/bus-stops/{stopId}")
    public BusStop updateBusStop(@PathVariable Long stopId, @Valid @RequestBody BusStopUpsertRequest req) {
        return adminService.updateBusStop(stopId, req);
    }

    @DeleteMapping("/bus-stops/{stopId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBusStop(@PathVariable Long stopId) {
        adminService.deleteBusStop(stopId);
    }

    @PostMapping("/bus-routes")
    @ResponseStatus(HttpStatus.CREATED)
    public BusRoute createBusRoute(@Valid @RequestBody BusRouteUpsertRequest req) {
        return adminService.createBusRoute(req);
    }

    @PutMapping("/bus-routes/{routeId}")
    public BusRoute updateBusRoute(@PathVariable Long routeId, @Valid @RequestBody BusRouteUpsertRequest req) {
        return adminService.updateBusRoute(routeId, req);
    }

    @DeleteMapping("/bus-routes/{routeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBusRoute(@PathVariable Long routeId) {
        adminService.deleteBusRoute(routeId);
    }

    @PostMapping("/buses")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createBus(@Valid @RequestBody BusUpsertRequest req) {
        return adminService.createBus(req);
    }

    @PutMapping("/buses/{busId}")
    public Map<String, Object> updateBus(@PathVariable Long busId, @Valid @RequestBody BusUpsertRequest req) {
        return adminService.updateBus(busId, req);
    }

    @DeleteMapping("/buses/{busId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBus(@PathVariable Long busId) {
        adminService.deleteBus(busId);
    }

    @PostMapping("/route-stops")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> addRouteStop(@Valid @RequestBody BusRouteStopUpsertRequest req) {
        return adminService.addStopToBusRoute(req);
    }

    @DeleteMapping("/route-stops/{routeStopId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRouteStop(@PathVariable Long routeStopId) {
        adminService.deleteBusRouteStop(routeStopId);
    }

    @PostMapping("/metro-stations")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createMetroStation(@Valid @RequestBody MetroStationUpsertRequest req) {
        return adminService.createMetroStation(req);
    }

    @PutMapping("/metro-stations/{stationId}")
    public Map<String, Object> updateMetroStation(
        @PathVariable Long stationId,
        @Valid @RequestBody MetroStationUpsertRequest req
    ) {
        return adminService.updateMetroStation(stationId, req);
    }

    @PostMapping("/transfer-points")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createTransferPoint(@Valid @RequestBody TransferPointUpsertRequest req) {
        return adminService.createTransferPoint(req);
    }

    @PutMapping("/transfer-points/{transferId}")
    public Map<String, Object> updateTransferPoint(
        @PathVariable Long transferId,
        @Valid @RequestBody TransferPointUpsertRequest req
    ) {
        return adminService.updateTransferPoint(transferId, req);
    }

    @DeleteMapping("/transfer-points/{transferId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTransferPoint(@PathVariable Long transferId) {
        adminService.deleteTransferPoint(transferId);
    }

    @PostMapping("/schedules")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createSchedule(@Valid @RequestBody ScheduleUpsertRequest req) {
        return adminService.createSchedule(req);
    }

    @PutMapping("/schedules/{scheduleId}")
    public Map<String, Object> updateSchedule(
        @PathVariable Long scheduleId,
        @Valid @RequestBody ScheduleUpsertRequest req
    ) {
        return adminService.updateSchedule(scheduleId, req);
    }

    @PostMapping("/fare-rules")
    @ResponseStatus(HttpStatus.CREATED)
    public FareRule createFareRule(@Valid @RequestBody FareRuleUpsertRequest req) {
        return adminService.createFareRule(req);
    }

    @PutMapping("/fare-rules/{fareRuleId}")
    public FareRule updateFareRule(
        @PathVariable Long fareRuleId,
        @Valid @RequestBody FareRuleUpsertRequest req
    ) {
        return adminService.updateFareRule(fareRuleId, req);
    }

    @PatchMapping("/feedback/{feedbackId}/moderate")
    public FeedbackDto moderateFeedback(
        @PathVariable Long feedbackId,
        @Valid @RequestBody FeedbackModerationRequest req
    ) {
        return adminService.moderateFeedback(feedbackId, req);
    }

    @PostMapping("/landmarks")
    @ResponseStatus(HttpStatus.CREATED)
    public CityLandmark createLandmark(@Valid @RequestBody CityLandmarkUpsertRequest req) {
        return adminService.createCityLandmark(req);
    }

    @PutMapping("/landmarks/{landmarkId}")
    public CityLandmark updateLandmark(
        @PathVariable Long landmarkId,
        @Valid @RequestBody CityLandmarkUpsertRequest req
    ) {
        return adminService.updateCityLandmark(landmarkId, req);
    }

    @DeleteMapping("/landmarks/{landmarkId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLandmark(@PathVariable Long landmarkId) {
        adminService.deleteCityLandmark(landmarkId);
    }

    @GetMapping("/audit-logs")
    public Page<AuditLog> getAuditLogs(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return adminService.listAuditLogs(page, size);
    }
}
