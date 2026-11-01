package com.bengaluru.transit.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public final class AuthDtos {
    private AuthDtos() {}

    public record RegisterRequest(
        @NotBlank(message = "Full name is required")
        @Size(min = 2, max = 100)
        String fullName,

        @NotBlank(message = "Email is required")
        @Email(message = "Valid email is required")
        String email,

        @NotBlank(message = "Phone number is required")
        @Pattern(regexp = "^[0-9+\\-]{10,15}$", message = "Enter a valid 10-15 digit phone number")
        String phone,

        @NotBlank(message = "Password is required")
        @Size(min = 6, max = 64, message = "Password must be at least 6 characters")
        String password,

        String preferredLanguage
    ) {}

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password
    ) {}

    public record UserProfileDto(
        Long userId,
        String fullName,
        String email,
        String phone,
        String preferredLanguage,
        List<String> roles,
        String smartCardNo,
        BigDecimal walletBalanceInr
    ) {}

    public record AuthResponse(
        String accessToken,
        String tokenType,
        long expiresInMs,
        UserProfileDto user
    ) {}
}