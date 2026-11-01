package com.bengaluru.transit.controller;

import com.bengaluru.transit.config.AuthenticatedUser;
import com.bengaluru.transit.dto.AuthDtos.UserProfileDto;
import com.bengaluru.transit.dto.JourneyDtos.BookPassRequest;
import com.bengaluru.transit.dto.JourneyDtos.BookedPassDto;
import com.bengaluru.transit.dto.JourneyDtos.BookingChallengeRequest;
import com.bengaluru.transit.dto.JourneyDtos.BookingChallengeResponse;
import com.bengaluru.transit.dto.JourneyDtos.FeedbackCreateRequest;
import com.bengaluru.transit.dto.JourneyDtos.FeedbackDto;
import com.bengaluru.transit.dto.JourneyDtos.JourneySearchRequest;
import com.bengaluru.transit.dto.JourneyDtos.JourneySearchResponse;
import com.bengaluru.transit.dto.JourneyDtos.WalletTopUpRequest;
import com.bengaluru.transit.service.JourneyPlannerService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class JourneyController {

    private final JourneyPlannerService journeyPlannerService;

    public JourneyController(JourneyPlannerService journeyPlannerService) {
        this.journeyPlannerService = journeyPlannerService;
    }

    @PostMapping("/journeys/search")
    public JourneySearchResponse searchJourneys(
        @Valid @RequestBody JourneySearchRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        Long userId = currentUser != null ? currentUser.userId() : null;
        return journeyPlannerService.searchAndSaveJourneys(request, userId);
    }

    @PostMapping("/journeys/book/challenge")
    public BookingChallengeResponse issueBookingChallenge(
        @Valid @RequestBody BookingChallengeRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return journeyPlannerService.issueBookingChallenge(currentUser.userId(), request.planId());
    }

    @PostMapping("/journeys/book")
    @ResponseStatus(HttpStatus.CREATED)
    public BookedPassDto bookUnifiedPass(
        @Valid @RequestBody BookPassRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return journeyPlannerService.bookUnifiedQrPass(currentUser.userId(), request);
    }

    @PatchMapping("/journeys/passes/{historyId}/scan")
    public BookedPassDto scanUnifiedPass(
        @PathVariable Long historyId,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return journeyPlannerService.markPassScanned(currentUser.userId(), historyId);
    }

    @GetMapping("/journeys/history")
    public Map<String, Object> getHistory(@AuthenticationPrincipal AuthenticatedUser currentUser) {
        return journeyPlannerService.getUserHistoryAndWallet(currentUser.userId());
    }

    @PostMapping("/journeys/wallet/topup")
    public UserProfileDto topUpWallet(
        @Valid @RequestBody WalletTopUpRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return journeyPlannerService.topUpSmartWallet(currentUser.userId(), request);
    }

    @GetMapping("/feedback")
    public Page<FeedbackDto> listFeedback(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size
    ) {
        return journeyPlannerService.listFeedback(page, size);
    }

    @PostMapping("/feedback")
    @ResponseStatus(HttpStatus.CREATED)
    public FeedbackDto submitFeedback(
        @Valid @RequestBody FeedbackCreateRequest request,
        @AuthenticationPrincipal AuthenticatedUser currentUser
    ) {
        return journeyPlannerService.submitFeedback(currentUser.userId(), request);
    }
}
