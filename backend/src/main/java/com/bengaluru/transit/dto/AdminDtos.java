package com.bengaluru.transit.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public final class AdminDtos {
    private AdminDtos() {}

    public record BusRouteUpsertRequest(
        @NotBlank String routeNumber,
        @NotBlank String routeName,
        @NotBlank String serviceType,
        @NotBlank String originName,
        @NotBlank String destinationName,
        @NotNull @DecimalMin("0.50") BigDecimal totalDistanceKm,
        Boolean isActive
    ) {}

    public record BusStopUpsertRequest(
        @NotBlank String stopCode,
        @NotBlank String stopName,
        @NotBlank String areaName,
        @NotNull BigDecimal latitude,
        @NotNull BigDecimal longitude,
        Boolean hasShelter,
        Boolean isInterchangeHub,
        Boolean isActive
    ) {}

    public record BusUpsertRequest(
        @NotNull Long routeId,
        @NotBlank String registrationNo,
        @NotBlank String busType,
        @NotNull @Min(15) @Max(90) Integer seatingCapacity,
        @NotBlank String depotName,
        @NotBlank String operationalStatus
    ) {}

    public record BusRouteStopUpsertRequest(
        @NotNull Long routeId,
        @NotNull Long stopId,
        @NotBlank String direction,
        @NotNull @Min(1) Integer stopSequence,
        @NotNull @DecimalMin("0.00") BigDecimal distanceFromStartKm,
        @NotNull @Min(0) Integer travelMinsFromPrev
    ) {}

    public record MetroStationUpsertRequest(
        @NotBlank String stationCode,
        @NotBlank String stationName,
        @NotNull Integer lineId,
        @NotNull @Min(1) Integer stationOrder,
        @NotNull BigDecimal latitude,
        @NotNull BigDecimal longitude,
        Boolean isInterchange,
        @NotBlank String structureType,
        Boolean hasParking,
        Boolean isActive
    ) {}

    public record ScheduleUpsertRequest(
        @NotBlank String transportMode,
        Long busRouteId,
        Integer metroLineId,
        @NotBlank String dayType,
        @NotBlank String firstServiceTime,
        @NotBlank String lastServiceTime,
        @NotNull @Min(2) @Max(120) Integer peakHeadwayMins,
        @NotNull @Min(3) @Max(180) Integer offpeakHeadwayMins,
        String dataConfidence,
        @NotBlank String scheduleNote
    ) {}

    public record TransferPointUpsertRequest(
        @NotBlank String hubName,
        @NotNull Long busStopId,
        @NotNull Long metroStationId,
        @NotNull @Min(10) @Max(2000) Integer walkingDistanceM,
        @NotNull @Min(1) @Max(30) Integer walkingTimeMins,
        @NotNull @Min(1) @Max(20) Integer transferBufferMins,
        Boolean hasSkywalk,
        Boolean isActive
    ) {}

    public record FareRuleUpsertRequest(
        @NotBlank String serviceCategory,
        @NotNull @DecimalMin("0.00") BigDecimal minDistanceKm,
        @NotNull @DecimalMin("0.50") BigDecimal maxDistanceKm,
        @NotNull @DecimalMin("0.00") BigDecimal fareInr,
        @NotNull @DecimalMin("0.00") BigDecimal smartCardDiscountPct,
        @NotBlank String sourceNote
    ) {}

    public record FeedbackModerationRequest(
        @NotBlank String reviewStatus
    ) {}

    public record CityLandmarkUpsertRequest(
        @NotBlank String landmarkName,
        @NotBlank String category,
        @NotBlank String areaName,
        @NotBlank String streetAddress,
        @NotBlank String pincode,
        @NotNull BigDecimal latitude,
        @NotNull BigDecimal longitude,
        Boolean isActive
    ) {}
}
