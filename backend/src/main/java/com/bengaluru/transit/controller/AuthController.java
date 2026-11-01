package com.bengaluru.transit.controller;

import com.bengaluru.transit.config.AuthenticatedUser;
import com.bengaluru.transit.dto.AuthDtos.AuthResponse;
import com.bengaluru.transit.dto.AuthDtos.LoginRequest;
import com.bengaluru.transit.dto.AuthDtos.RegisterRequest;
import com.bengaluru.transit.dto.AuthDtos.UserProfileDto;
import com.bengaluru.transit.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public UserProfileDto currentUser(@AuthenticationPrincipal AuthenticatedUser user) {
        return authService.getProfile(user.userId());
    }
}