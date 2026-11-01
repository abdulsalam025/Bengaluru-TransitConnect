package com.bengaluru.transit.controller;

import com.bengaluru.transit.dto.TransitDtos.NearbyNodeDto;
import com.bengaluru.transit.dto.TransitDtos.NetworkOverviewDto;
import com.bengaluru.transit.dto.TransitDtos.PlaceSuggestionDto;
import com.bengaluru.transit.entity.FareRule;
import com.bengaluru.transit.service.TransitNetworkService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transit")
public class TransitController {

    private final TransitNetworkService transitNetworkService;

    public TransitController(TransitNetworkService transitNetworkService) {
        this.transitNetworkService = transitNetworkService;
    }

    @GetMapping("/network")
    public NetworkOverviewDto getNetwork() {
        return transitNetworkService.getNetworkOverview();
    }

    @GetMapping("/bus-routes/{routeId}/stops")
    public Map<String, Object> getBusRouteStops(
        @PathVariable Long routeId,
        @RequestParam(defaultValue = "OUTBOUND") String direction
    ) {
        return transitNetworkService.getBusRouteCorridorDetails(routeId, direction);
    }

    @GetMapping("/nearby")
    public List<NearbyNodeDto> getNearbyNodes(
        @RequestParam double lat,
        @RequestParam double lng,
        @RequestParam(defaultValue = "2.5") double radiusKm,
        @RequestParam(defaultValue = "8") int limit
    ) {
        return transitNetworkService.findNearbyNodes(lat, lng, radiusKm, limit);
    }

    @GetMapping("/places")
    public List<PlaceSuggestionDto> searchPlaces(
        @RequestParam(defaultValue = "") String q,
        @RequestParam(defaultValue = "") String category,
        @RequestParam(defaultValue = "60") int limit
    ) {
        return transitNetworkService.searchPlaces(q, category, limit);
    }

    @GetMapping("/fares")
    public List<FareRule> getFareRules() {
        return transitNetworkService.listFareRules();
    }
}