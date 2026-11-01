package com.bengaluru.transit.dto;

import java.math.BigDecimal;
import java.util.List;

public final class TransitDtos {
    private TransitDtos() {}

    public record TransitNodeDto(
        String nodeKey,
        String nodeType,
        String code,
        String name,
        String corridorOrArea,
        String colorHex,
        double latitude,
        double longitude,
        boolean interchange
    ) {}

    public record PlaceSuggestionDto(
        String placeId,
        String placeType,
        String category,
        String name,
        String subtitle,
        String address,
        double latitude,
        double longitude,
        String nodeKey
    ) {}

    public record NearbyNodeDto(
        String nodeType,
        String nodeKey,
        String code,
        String displayName,
        String corridorOrArea,
        double latitude,
        double longitude,
        double distanceKm,
        int estimatedWalkMins
    ) {}

    public record MetroStationPointDto(
        Long stationId,
        String nodeKey,
        String stationCode,
        String stationName,
        int stationOrder,
        double latitude,
        double longitude,
        boolean interchange,
        String structureType
    ) {}

    public record MetroLineOverviewDto(
        Integer lineId,
        String lineCode,
        String lineName,
        String colorHex,
        String corridorSummary,
        BigDecimal totalLengthKm,
        boolean operational,
        List<MetroStationPointDto> stations
    ) {}

    public record BusRouteSummaryDto(
        Long routeId,
        String routeNumber,
        String routeName,
        String serviceType,
        String originName,
        String destinationName,
        BigDecimal totalDistanceKm,
        boolean active,
        int activeFleetCount,
        Integer peakHeadwayMins,
        Integer offpeakHeadwayMins,
        String dataConfidence
    ) {}

    public record TransferHubDto(
        Long transferId,
        String hubName,
        String busNodeKey,
        String busStopName,
        String metroNodeKey,
        String metroStationName,
        String metroLineName,
        String metroColorHex,
        int walkingDistanceM,
        int walkingTimeMins,
        int transferBufferMins,
        boolean hasSkywalk,
        double latitude,
        double longitude
    ) {}

    public record NetworkOverviewDto(
        List<TransitNodeDto> nodes,
        List<MetroLineOverviewDto> metroLines,
        List<BusRouteSummaryDto> busRoutes,
        List<TransferHubDto> transferHubs,
        String dataDisclaimer
    ) {}
}