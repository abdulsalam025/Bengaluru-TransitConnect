package com.bengaluru.transit.service;

import com.bengaluru.transit.config.JwtService;
import com.bengaluru.transit.dto.AuthDtos.AuthResponse;
import com.bengaluru.transit.dto.AuthDtos.LoginRequest;
import com.bengaluru.transit.dto.AuthDtos.RegisterRequest;
import com.bengaluru.transit.dto.AuthDtos.UserProfileDto;
import com.bengaluru.transit.entity.PassengerWallet;
import com.bengaluru.transit.entity.Role;
import com.bengaluru.transit.entity.User;
import com.bengaluru.transit.exception.BadRequestException;
import com.bengaluru.transit.exception.ResourceNotFoundException;
import com.bengaluru.transit.repository.PassengerWalletRepository;
import com.bengaluru.transit.repository.RoleRepository;
import com.bengaluru.transit.repository.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PassengerWalletRepository walletRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
        UserRepository userRepository,
        RoleRepository roleRepository,
        PassengerWalletRepository walletRepository,
        PasswordEncoder passwordEncoder,
        JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.walletRepository = walletRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String normalizedEmail = req.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BadRequestException("An account with email '" + normalizedEmail + "' already exists.");
        }
        String cleanPhone = (req.phone() == null || req.phone().isBlank()) ? null : req.phone().trim();
        if (cleanPhone != null && userRepository.existsByPhone(cleanPhone)) {
            throw new BadRequestException("An account with phone number '" + cleanPhone + "' already exists.");
        }

        Role passengerRole = roleRepository.findByRoleName("ROLE_PASSENGER")
            .orElseThrow(() -> new ResourceNotFoundException("ROLE_PASSENGER is missing in database."));

        User user = new User();
        user.setFullName(req.fullName().trim());
        user.setEmail(normalizedEmail);
        user.setPhone(cleanPhone);
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setPreferredLanguage(
            (req.preferredLanguage() == null || req.preferredLanguage().isBlank())
                ? "en"
                : req.preferredLanguage().trim().toLowerCase(Locale.ROOT)
        );
        user.setIsActive(true);
        user.getRoles().add(passengerRole);

        User saved = userRepository.save(user);

        PassengerWallet wallet = new PassengerWallet();
        wallet.setUser(saved);
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase(Locale.ROOT);
        wallet.setSmartCardNo("BTC-NCMC-" + suffix);
        wallet.setBalanceInr(new BigDecimal("250.00"));
        walletRepository.save(wallet);

        UserProfileDto profile = buildUserProfile(saved, wallet);
        String token = jwtService.generateToken(saved.getUserId(), saved.getEmail(), profile.roles());
        return new AuthResponse(token, "Bearer", jwtService.getExpirationMs(), profile);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        String normalizedEmail = req.email().trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
            .orElseThrow(() -> new BadRequestException("Invalid email address or password."));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new BadRequestException("This passenger account is currently deactivated.");
        }
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new BadRequestException("Invalid email address or password.");
        }

        PassengerWallet wallet = walletRepository.findByUser_UserId(user.getUserId()).orElse(null);
        UserProfileDto profile = buildUserProfile(user, wallet);
        String token = jwtService.generateToken(user.getUserId(), user.getEmail(), profile.roles());
        return new AuthResponse(token, "Bearer", jwtService.getExpirationMs(), profile);
    }

    @Transactional(readOnly = true)
    public UserProfileDto getProfile(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User account not found: " + userId));
        PassengerWallet wallet = walletRepository.findByUser_UserId(userId).orElse(null);
        return buildUserProfile(user, wallet);
    }

    public UserProfileDto buildUserProfile(User user, PassengerWallet wallet) {
        List<String> roles = user.getRoles().stream()
            .map(Role::getRoleName)
            .sorted()
            .toList();
        return new UserProfileDto(
            user.getUserId(),
            user.getFullName(),
            user.getEmail(),
            user.getPhone(),
            user.getPreferredLanguage(),
            roles,
            wallet != null ? wallet.getSmartCardNo() : "UNASSIGNED",
            wallet != null ? wallet.getBalanceInr() : BigDecimal.ZERO
        );
    }
}