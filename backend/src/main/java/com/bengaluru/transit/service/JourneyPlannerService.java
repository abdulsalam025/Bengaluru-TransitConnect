package com.bengaluru.transit.service;

import com.bengaluru.transit.dto.AuthDtos.UserProfileDto;
import com.bengaluru.transit.dto.JourneyDtos.BookPassRequest;
import com.bengaluru.transit.dto.JourneyDtos.BookedPassDto;
import com.bengaluru.transit.dto.JourneyDtos.BookingChallengeResponse;
import com.bengaluru.transit.dto.JourneyDtos.FeedbackCreateRequest;
import com.bengaluru.transit.dto.JourneyDtos.FeedbackDto;
import com.bengaluru.transit.dto.JourneyDtos.JourneyLegDto;
import com.bengaluru.transit.dto.JourneyDtos.JourneySearchRequest;
import com.bengaluru.transit.dto.JourneyDtos.JourneySearchResponse;
import com.bengaluru.transit.dto.JourneyDtos.RouteOptionDto;
import com.bengaluru.transit.dto.JourneyDtos.WalletTopUpRequest;
import com.bengaluru.transit.entity.BusRoute;
import com.bengaluru.transit.entity.Feedback;
import com.bengaluru.transit.entity.JourneyLeg;
import com.bengaluru.transit.entity.JourneyPlan;
import com.bengaluru.transit.entity.MetroStation;
import com.bengaluru.transit.entity.PassengerWallet;
import com.bengaluru.transit.entity.TravelHistory;
import com.bengaluru.transit.entity.User;
import com.bengaluru.transit.exception.BadRequestException;
import com.bengaluru.transit.exception.ResourceNotFoundException;
import com.bengaluru.transit.graph.TransitGraphEngine;
import com.bengaluru.transit.graph.TransitGraphEngine.ModeFilter;
import com.bengaluru.transit.graph.TransitGraphEngine.OptimizationCriteria;
import com.bengaluru.transit.repository.BusRouteRepository;
import com.bengaluru.transit.repository.FeedbackRepository;
import com.bengaluru.transit.repository.JourneyPlanRepository;
import com.bengaluru.transit.repository.MetroStationRepository;
import com.bengaluru.transit.repository.PassengerWalletRepository;
import com.bengaluru.transit.repository.TransitSqlRepository;
import com.bengaluru.transit.repository.TravelHistoryRepository;
import com.bengaluru.transit.repository.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class JourneyPlannerService {

    private static final long CHALLENGE_TTL_SECONDS = 180L;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final TransitGraphEngine graphEngine;
    private final JourneyPlanRepository journeyPlanRepository;
    private final TravelHistoryRepository travelHistoryRepository;
    private final PassengerWalletRepository walletRepository;
    private final UserRepository userRepository;
    private final BusRouteRepository busRouteRepository;
    private final MetroStationRepository metroStationRepository;
    private final FeedbackRepository feedbackRepository;
    private final TransitSqlRepository transitSqlRepository;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;
    private final byte[] challengeSecretBytes;

    public JourneyPlannerService(
        TransitGraphEngine graphEngine,
        JourneyPlanRepository journeyPlanRepository,
        TravelHistoryRepository travelHistoryRepository,
        PassengerWalletRepository walletRepository,
        UserRepository userRepository,
        BusRouteRepository busRouteRepository,
        MetroStationRepository metroStationRepository,
        FeedbackRepository feedbackRepository,
        TransitSqlRepository transitSqlRepository,
        AuthService authService,
        PasswordEncoder passwordEncoder,
        @Value("${app.jwt.secret}") String jwtSecret
    ) {
        this.graphEngine = graphEngine;
        this.journeyPlanRepository = journeyPlanRepository;
        this.travelHistoryRepository = travelHistoryRepository;
        this.walletRepository = walletRepository;
        this.userRepository = userRepository;
        this.busRouteRepository = busRouteRepository;
        this.metroStationRepository = metroStationRepository;
        this.feedbackRepository = feedbackRepository;
        this.transitSqlRepository = transitSqlRepository;
        this.authService = authService;
        this.passwordEncoder = passwordEncoder;
        this.challengeSecretBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
    }

    @Transactional
    public JourneySearchResponse searchAndSaveJourneys(JourneySearchRequest req, Long optionalUserId) {
        OptimizationCriteria criteria = OptimizationCriteria.fromString(req.optimizationType());
        ModeFilter filter = ModeFilter.fromString(req.routeCategory());

        String src = req.sourceNodeKey() == null ? "" : req.sourceNodeKey().trim().toUpperCase(Locale.ROOT);
        String dst = req.destinationNodeKey() == null ? "" : req.destinationNodeKey().trim().toUpperCase(Locale.ROOT);

        User user = (optionalUserId != null)
            ? userRepository.findById(optionalUserId).orElse(null)
            : null;

        RouteOptionDto primaryRaw = graphEngine.findOptimalRoute(
            src,
            dst,
            criteria,
            filter,
            req.originLat(),
            req.originLng(),
            req.originPlaceName(),
            req.destLat(),
            req.destLng(),
            req.destPlaceName()
        );
        Map<String, Optional<RouteOptionDto>> matrix = graphEngine.computeAllComparisons(
            src,
            dst,
            req.originLat(),
            req.originLng(),
            req.originPlaceName(),
            req.destLat(),
            req.destLng(),
            req.destPlaceName()
        );

        // Persist unique generated options so any card on screen can be booked as a Unified QR Pass
        Map<String, RouteOptionDto> persistedBySignature = new LinkedHashMap<>();
        RouteOptionDto recommended = persistOptionIfNew(primaryRaw, user, persistedBySignature);

        List<RouteOptionDto> alternatives = new ArrayList<>();
        for (String key : List.of("FASTEST_COMBINED", "CHEAPEST_COMBINED", "MIN_TRANSFERS_COMBINED")) {
            Optional<RouteOptionDto> opt = matrix.getOrDefault(key, Optional.empty());
            if (opt.isPresent()) {
                alternatives.add(persistOptionIfNew(opt.get(), user, persistedBySignature));
            }
        }

        Map<String, RouteOptionDto> modeComparison = new LinkedHashMap<>();
        matrix.getOrDefault("FASTEST_COMBINED", Optional.empty())
            .ifPresent(r -> modeComparison.put("COMBINED", persistOptionIfNew(r, user, persistedBySignature)));
        matrix.getOrDefault("FASTEST_BUS_ONLY", Optional.empty())
            .ifPresent(r -> modeComparison.put("BUS_ONLY", persistOptionIfNew(r, user, persistedBySignature)));
        matrix.getOrDefault("FASTEST_METRO_ONLY", Optional.empty())
            .ifPresent(r -> modeComparison.put("METRO_ONLY", persistOptionIfNew(r, user, persistedBySignature)));

        return new JourneySearchResponse(
            recommended,
            alternatives,
            modeComparison,
            "Fares and timings are computed dynamically from MySQL 8 distance slabs, scheduled headways, and multi-modal hub skywalk buffers (not real-time GPS vehicle locations)."
        );
    }

    private RouteOptionDto persistOptionIfNew(
        RouteOptionDto dto,
        User user,
        Map<String, RouteOptionDto> cache
    ) {
        String signature = dto.legs().stream()
            .map(l -> l.legMode() + ":" + l.routeOrLineCode() + ":" + l.fromNodeKey() + "->" + l.toNodeKey())
            .collect(Collectors.joining("|"));

        RouteOptionDto existing = cache.get(signature);
        if (existing != null) {
            // Preserve the caller's badge & optimization label while sharing the persisted planId
            return new RouteOptionDto(
                existing.planId(),
                dto.badgeLabel(),
                dto.optimizationType(),
                dto.routeCategory(),
                dto.sourceNodeKey(),
                dto.sourceName(),
                dto.destinationNodeKey(),
                dto.destinationName(),
                dto.walkingTimeMins(),
                dto.busTimeMins(),
                dto.metroTimeMins(),
                dto.waitingTimeMins(),
                dto.transferTimeMins(),
                dto.totalTimeMins(),
                dto.totalDistanceKm(),
                dto.estimatedFareInr(),
                dto.transferCount(),
                dto.dataConfidence(),
                dto.formulaBreakdown(),
                dto.legs()
            );
        }

        JourneyPlan plan = new JourneyPlan();
        plan.setUser(user);
        plan.setSourceNodeKey(dto.sourceNodeKey());
        plan.setSourceName(dto.sourceName());
        plan.setDestinationNodeKey(dto.destinationNodeKey());
        plan.setDestinationName(dto.destinationName());
        plan.setOptimizationType(dto.optimizationType());
        plan.setRouteCategory(dto.routeCategory());
        plan.setWalkingTimeMins(dto.walkingTimeMins());
        plan.setBusTimeMins(dto.busTimeMins());
        plan.setMetroTimeMins(dto.metroTimeMins());
        plan.setWaitingTimeMins(dto.waitingTimeMins());
        plan.setTransferTimeMins(dto.transferTimeMins());
        plan.setTotalTimeMins(dto.totalTimeMins());
        plan.setTotalDistanceKm(BigDecimal.valueOf(dto.totalDistanceKm()).setScale(2, RoundingMode.HALF_UP));
        plan.setEstimatedFareInr(dto.estimatedFareInr().setScale(2, RoundingMode.HALF_UP));
        plan.setTransferCount(dto.transferCount());

        for (JourneyLegDto legDto : dto.legs()) {
            JourneyLeg leg = new JourneyLeg();
            leg.setLegOrder(legDto.legOrder());
            leg.setLegMode(legDto.legMode());
            leg.setRouteOrLineCode(legDto.routeOrLineCode());
            leg.setRouteOrLineName(legDto.routeOrLineName());
            leg.setColorHex(legDto.colorHex());
            leg.setFromNodeKey(legDto.fromNodeKey());
            leg.setFromPointName(legDto.fromPointName());
            leg.setFromLat(BigDecimal.valueOf(legDto.fromLat()).setScale(6, RoundingMode.HALF_UP));
            leg.setFromLng(BigDecimal.valueOf(legDto.fromLng()).setScale(6, RoundingMode.HALF_UP));
            leg.setToNodeKey(legDto.toNodeKey());
            leg.setToPointName(legDto.toPointName());
            leg.setToLat(BigDecimal.valueOf(legDto.toLat()).setScale(6, RoundingMode.HALF_UP));
            leg.setToLng(BigDecimal.valueOf(legDto.toLng()).setScale(6, RoundingMode.HALF_UP));
            leg.setDistanceKm(BigDecimal.valueOf(legDto.distanceKm()).setScale(2, RoundingMode.HALF_UP));
            leg.setDurationMins(legDto.durationMins());
            leg.setWaitingMins(legDto.waitingMins());
            leg.setLegFareInr(legDto.legFareInr().setScale(2, RoundingMode.HALF_UP));
            leg.setStopsCount(legDto.stopsCount());
            plan.addLeg(leg);
        }

        JourneyPlan saved = journeyPlanRepository.save(plan);
        RouteOptionDto withId = new RouteOptionDto(
            saved.getPlanId(),
            dto.badgeLabel(),
            dto.optimizationType(),
            dto.routeCategory(),
            dto.sourceNodeKey(),
            dto.sourceName(),
            dto.destinationNodeKey(),
            dto.destinationName(),
            dto.walkingTimeMins(),
            dto.busTimeMins(),
            dto.metroTimeMins(),
            dto.waitingTimeMins(),
            dto.transferTimeMins(),
            dto.totalTimeMins(),
            dto.totalDistanceKm(),
            dto.estimatedFareInr(),
            dto.transferCount(),
            dto.dataConfidence(),
            dto.formulaBreakdown(),
            dto.legs()
        );
        cache.put(signature, withId);
        return withId;
    }

    @Transactional(readOnly = true)
    public BookingChallengeResponse issueBookingChallenge(Long userId, Long planId) {
        userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User account not found: " + userId));
        journeyPlanRepository.findById(planId)
            .orElseThrow(() -> new ResourceNotFoundException("Journey plan not found: " + planId));

        String pinCode = String.valueOf(1000 + SECURE_RANDOM.nextInt(9000));
        long expiresAt = Instant.now().getEpochSecond() + CHALLENGE_TTL_SECONDS;
        String payload = userId + ":" + planId + ":" + pinCode + ":" + expiresAt;
        String sig = computeHmacBase64Url(payload);
        String token = expiresAt + "." + sig;
        return new BookingChallengeResponse(planId, pinCode, token, CHALLENGE_TTL_SECONDS);
    }

    @Transactional
    public BookedPassDto bookUnifiedQrPass(Long userId, BookPassRequest req) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User account not found: " + userId));
        verifyBookingAuthentication(user, req);

        JourneyPlan plan = journeyPlanRepository.findById(req.planId())
            .orElseThrow(() -> new ResourceNotFoundException("Journey plan not found: " + req.planId()));

        String datePart = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randPart = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase(Locale.ROOT);
        String qrCode = "BTC-QR-" + datePart + "-" + randPart;

        Long historyId = transitSqlRepository.callBookUnifiedQrPass(userId, plan.getPlanId(), qrCode);
        TravelHistory history = travelHistoryRepository.findById(historyId)
            .orElseThrow(() -> new ResourceNotFoundException("Travel history record missing after booking."));
        PassengerWallet wallet = walletRepository.findByUser_UserId(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Smart wallet not found for user: " + userId));

        return new BookedPassDto(
            history.getHistoryId(),
            plan.getPlanId(),
            history.getQrPassCode(),
            plan.getSourceName(),
            plan.getDestinationName(),
            plan.getOptimizationType(),
            plan.getRouteCategory(),
            plan.getTotalTimeMins(),
            history.getFarePaidInr(),
            history.getPaymentMethod(),
            history.getPassStatus(),
            history.getTravelledAt(),
            wallet.getBalanceInr()
        );
    }

    private void verifyBookingAuthentication(User user, BookPassRequest req) {
        String mode = req.authMode() == null ? "" : req.authMode().trim().toUpperCase(Locale.ROOT);
        if ("PASSWORD".equals(mode)) {
            String rawPwd = req.password() == null ? "" : req.password();
            if (rawPwd.isBlank() || !passwordEncoder.matches(rawPwd, user.getPasswordHash())) {
                throw new BadRequestException(
                    "Authentication failed: incorrect account password. Unified QR Pass booking was cancelled."
                );
            }
            return;
        }
        if ("QUICK_CODE".equals(mode)) {
            String entered = req.enteredCode() == null ? "" : req.enteredCode().trim();
            if (!entered.matches("^\\d{4}$")) {
                throw new BadRequestException(
                    "Authentication failed: please enter the 4-digit security PIN to confirm Unified QR Pass booking."
                );
            }
            String signedToken = req.challengeToken() == null ? "" : req.challengeToken().trim();
            if (!signedToken.isEmpty()) {
                int dotIdx = signedToken.indexOf('.');
                if (dotIdx <= 0 || dotIdx >= signedToken.length() - 1) {
                    throw new BadRequestException("Invalid security challenge token. Please refresh PIN and try again.");
                }
                long expiresAt;
                try {
                    expiresAt = Long.parseLong(signedToken.substring(0, dotIdx));
                } catch (NumberFormatException ex) {
                    throw new BadRequestException("Malformed security challenge token.");
                }
                if (Instant.now().getEpochSecond() > expiresAt) {
                    throw new BadRequestException(
                        "4-digit security PIN expired after 3 minutes. Please click Refresh PIN and confirm again."
                    );
                }
                String providedSig = signedToken.substring(dotIdx + 1);
                String expectedPayload = user.getUserId() + ":" + req.planId() + ":" + entered + ":" + expiresAt;
                String expectedSig = computeHmacBase64Url(expectedPayload);
                if (!MessageDigest.isEqual(
                    expectedSig.getBytes(StandardCharsets.UTF_8),
                    providedSig.getBytes(StandardCharsets.UTF_8)
                )) {
                    throw new BadRequestException(
                        "Authentication failed: 4-digit security PIN did not match. Unified QR Pass booking was cancelled."
                    );
                }
                return;
            }
            String challenge = req.challengeCode() == null ? "" : req.challengeCode().trim();
            if (!challenge.matches("^\\d{4}$") || !challenge.equals(entered)) {
                throw new BadRequestException(
                    "Authentication failed: 4-digit security PIN did not match. Unified QR Pass booking was cancelled."
                );
            }
            return;
        }
        throw new BadRequestException(
            "Short authentication Shield required before booking Unified QR Pass. Please hard-refresh (Ctrl+Shift+R) and confirm with your 4-Digit Security PIN or Account Password."
        );
    }

    private String computeHmacBase64Url(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(challengeSecretBytes, "HmacSHA256"));
            byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to sign booking challenge token", ex);
        }
    }

    @Transactional
    public UserProfileDto topUpSmartWallet(Long userId, WalletTopUpRequest req) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User account not found: " + userId));
        PassengerWallet wallet = walletRepository.findByUser_UserId(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Smart wallet not found for user: " + userId));

        BigDecimal updated = wallet.getBalanceInr().add(req.amountInr()).setScale(2, RoundingMode.HALF_UP);
        if (updated.compareTo(new BigDecimal("25000.00")) > 0) {
            throw new BadRequestException("Maximum Smart Wallet balance cap is Rs. 25,000.00.");
        }
        wallet.setBalanceInr(updated);
        walletRepository.save(wallet);
        return authService.buildUserProfile(user, wallet);
    }

    @Transactional
    public BookedPassDto markPassScanned(Long userId, Long historyId) {
        TravelHistory th = travelHistoryRepository.findById(historyId)
            .orElseThrow(() -> new ResourceNotFoundException("QR Pass record not found: " + historyId));
        if (!th.getUser().getUserId().equals(userId)) {
            throw new BadRequestException("You can only scan QR passes issued to your own account.");
        }
        if ("CANCELLED".equalsIgnoreCase(th.getPassStatus())) {
            throw new BadRequestException("Cancelled QR passes cannot be scanned at transit gates.");
        }
        if (!"USED".equalsIgnoreCase(th.getPassStatus())) {
            th.setPassStatus("USED");
            th = travelHistoryRepository.save(th);
        }
        BigDecimal currentBalance = walletRepository.findByUser_UserId(userId)
            .map(PassengerWallet::getBalanceInr)
            .orElse(BigDecimal.ZERO);

        return new BookedPassDto(
            th.getHistoryId(),
            th.getPlan().getPlanId(),
            th.getQrPassCode(),
            th.getPlan().getSourceName(),
            th.getPlan().getDestinationName(),
            th.getPlan().getOptimizationType(),
            th.getPlan().getRouteCategory(),
            th.getPlan().getTotalTimeMins(),
            th.getFarePaidInr(),
            th.getPaymentMethod(),
            th.getPassStatus(),
            th.getTravelledAt(),
            currentBalance
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getUserHistoryAndWallet(Long userId) {
        PassengerWallet wallet = walletRepository.findByUser_UserId(userId).orElse(null);
        BigDecimal currentBalance = wallet != null ? wallet.getBalanceInr() : BigDecimal.ZERO;

        List<BookedPassDto> passes = travelHistoryRepository.findByUser_UserIdOrderByTravelledAtDesc(userId)
            .stream()
            .map(th -> new BookedPassDto(
                th.getHistoryId(),
                th.getPlan().getPlanId(),
                th.getQrPassCode(),
                th.getPlan().getSourceName(),
                th.getPlan().getDestinationName(),
                th.getPlan().getOptimizationType(),
                th.getPlan().getRouteCategory(),
                th.getPlan().getTotalTimeMins(),
                th.getFarePaidInr(),
                th.getPaymentMethod(),
                th.getPassStatus(),
                th.getTravelledAt(),
                currentBalance
            ))
            .toList();

        List<Map<String, Object>> recentSearches = journeyPlanRepository
            .findTop15ByUser_UserIdOrderByCreatedAtDesc(userId)
            .stream()
            .map(jp -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("planId", jp.getPlanId());
                m.put("sourceNodeKey", jp.getSourceNodeKey());
                m.put("sourceName", jp.getSourceName());
                m.put("destinationNodeKey", jp.getDestinationNodeKey());
                m.put("destinationName", jp.getDestinationName());
                m.put("optimizationType", jp.getOptimizationType());
                m.put("routeCategory", jp.getRouteCategory());
                m.put("totalTimeMins", jp.getTotalTimeMins());
                m.put("estimatedFareInr", jp.getEstimatedFareInr());
                m.put("transferCount", jp.getTransferCount());
                m.put("createdAt", jp.getCreatedAt());
                return m;
            })
            .toList();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("walletCardNumber", wallet != null ? wallet.getSmartCardNo() : "UNASSIGNED");
        res.put("walletBalanceInr", currentBalance);
        res.put("bookedPasses", passes);
        res.put("recentSearches", recentSearches);
        return res;
    }

    @Transactional
    public FeedbackDto submitFeedback(Long userId, FeedbackCreateRequest req) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User account not found: " + userId));

        String targetType = req.targetType().trim().toUpperCase(Locale.ROOT);
        Feedback fb = new Feedback();
        fb.setUser(user);
        fb.setTargetType(targetType);
        fb.setRating(req.rating());
        fb.setComments(req.comments().trim());
        fb.setReviewStatus("PENDING");

        if ("BUS_ROUTE".equals(targetType)) {
            if (req.busRouteId() == null) {
                throw new BadRequestException("busRouteId is required when targetType is BUS_ROUTE.");
            }
            BusRoute route = busRouteRepository.findById(req.busRouteId())
                .orElseThrow(() -> new ResourceNotFoundException("Bus route not found: " + req.busRouteId()));
            fb.setBusRoute(route);
        } else if ("METRO_STATION".equals(targetType)) {
            if (req.metroStationId() == null) {
                throw new BadRequestException("metroStationId is required when targetType is METRO_STATION.");
            }
            MetroStation station = metroStationRepository.findById(req.metroStationId())
                .orElseThrow(() -> new ResourceNotFoundException("Metro station not found: " + req.metroStationId()));
            fb.setMetroStation(station);
        } else if (!"JOURNEY_PLANNER".equals(targetType)) {
            throw new BadRequestException("targetType must be BUS_ROUTE, METRO_STATION, or JOURNEY_PLANNER.");
        }

        Feedback saved = feedbackRepository.save(fb);
        return mapFeedbackDto(saved);
    }

    @Transactional(readOnly = true)
    public Page<FeedbackDto> listFeedback(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 50));
        return feedbackRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(safePage, safeSize))
            .map(this::mapFeedbackDto);
    }

    public FeedbackDto mapFeedbackDto(Feedback fb) {
        String targetLabel = "Multi-Modal Journey Planner";
        if (fb.getBusRoute() != null) {
            targetLabel = "BMTC " + fb.getBusRoute().getRouteNumber() + " - " + fb.getBusRoute().getRouteName();
        } else if (fb.getMetroStation() != null) {
            targetLabel = "Metro " + fb.getMetroStation().getStationName();
        }
        return new FeedbackDto(
            fb.getFeedbackId(),
            fb.getUser().getFullName(),
            fb.getTargetType(),
            targetLabel,
            fb.getRating(),
            fb.getComments(),
            fb.getReviewStatus(),
            fb.getCreatedAt()
        );
    }
}
