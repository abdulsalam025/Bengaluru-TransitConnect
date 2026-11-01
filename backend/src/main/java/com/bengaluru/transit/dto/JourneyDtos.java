package com.bengaluru.transit.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class JourneyDtos {
    private JourneyDtos() {}

    public record JourneySearchRequest(
        String sourceNodeKey,
        String destinationNodeKey,
        String optimizationType,
        String routeCategory,
        Double originLat,
        Double originLng,
        String originPlaceName,
        Double destLat,
        Double destLng,
        String destPlaceName
    ) {
        public JourneySearchRequest(
            String sourceNodeKey,
            String destinationNodeKey,
            String optimizationType,
            String routeCategory,
            Double originLat,
            Double originLng
        ) {
            this(
                sourceNodeKey,
                destinationNodeKey,
                optimizationType,
                routeCategory,
                originLat,
                originLng,
                null,
                null,
                null,
                null
            );
        }
    }

    public record JourneyLegDto(
        int legOrder,
        String legMode,
        String routeOrLineCode,
        String routeOrLineName,
        String colorHex,
        String fromNodeKey,
        String fromPointName,
        double fromLat,
        double fromLng,
        String toNodeKey,
        String toPointName,
        double toLat,
        double toLng,
        double distanceKm,
        int durationMins,
        int waitingMins,
        BigDecimal legFareInr,
        int stopsCount,
        List<double[]> polylineCoords
    ) {}

    public record RouteOptionDto(
        Long planId,
        String badgeLabel,
        String optimizationType,
        String routeCategory,
        String sourceNodeKey,
        String sourceName,
        String destinationNodeKey,
        String destinationName,
        int walkingTimeMins,
        int busTimeMins,
        int metroTimeMins,
        int waitingTimeMins,
        int transferTimeMins,
        int totalTimeMins,
        double totalDistanceKm,
        BigDecimal estimatedFareInr,
        int transferCount,
        String dataConfidence,
        String formulaBreakdown,
        List<JourneyLegDto> legs
    ) {}

    public record JourneySearchResponse(
        RouteOptionDto recommended,
        List<RouteOptionDto> alternatives,
        Map<String, RouteOptionDto> modeComparison,
        String dataHonestyNotice
    ) {}

    public record BookingChallengeRequest(
        @NotNull(message = "Plan ID is required")
        Long planId
    ) {}

    public record BookingChallengeResponse(
        Long planId,
        String pinCode,
        String challengeToken,
        long expiresInSeconds
    ) {}

    public record BookPassRequest(
        @NotNull(message = "Plan ID is required")
        Long planId,
        String authMode,
        String password,
        String challengeToken,
        String challengeCode,
        String enteredCode
    ) {
        public BookPassRequest(Long planId) {
            this(planId, null, null, null, null, null);
        }
    }

    public record BookedPassDto(
        Long historyId,
        Long planId,
        String qrPassCode,
        String sourceName,
        String destinationName,
        String optimizationType,
        String routeCategory,
        int totalTimeMins,
        BigDecimal farePaidInr,
        String paymentMethod,
        String passStatus,
        LocalDateTime travelledAt,
        BigDecimal remainingWalletBalanceInr
    ) {}

    public record WalletTopUpRequest(
        @NotNull
        @DecimalMin(value = "10.00", message = "Minimum top-up is Rs. 10")
        @DecimalMax(value = "5000.00", message = "Maximum single top-up is Rs. 5,000")
        BigDecimal amountInr
    ) {}

    public record FeedbackCreateRequest(
        @NotBlank String targetType,
        Long busRouteId,
        Long metroStationId,
        @NotNull @Min(1) @Max(5) Integer rating,
        @NotBlank String comments
    ) {}

    public record FeedbackDto(
        Long feedbackId,
        String passengerName,
        String targetType,
        String targetLabel,
        int rating,
        String comments,
        String reviewStatus,
        LocalDateTime createdAt
    ) {}
}