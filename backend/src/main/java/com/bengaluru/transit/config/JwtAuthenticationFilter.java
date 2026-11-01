package com.bengaluru.transit.config;

import com.bengaluru.transit.entity.Role;
import com.bengaluru.transit.entity.User;
import com.bengaluru.transit.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(7).trim();
        try {
            Claims claims = jwtService.parseClaims(token);
            String email = claims.getSubject();
            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                Optional<User> optUser = userRepository.findByEmailIgnoreCase(email);
                if (optUser.isPresent() && Boolean.TRUE.equals(optUser.get().getIsActive())) {
                    User dbUser = optUser.get();
                    List<String> roleNames = dbUser.getRoles().stream()
                        .map(Role::getRoleName)
                        .sorted()
                        .toList();
                    AuthenticatedUser principal = new AuthenticatedUser(
                        dbUser.getUserId(),
                        dbUser.getEmail(),
                        dbUser.getFullName(),
                        true,
                        roleNames
                    );
                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        principal, null, principal.getAuthorities()
                    );
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        } catch (JwtException | IllegalArgumentException ignored) {
            // Invalid or expired JWT leaves SecurityContext anonymous so protected endpoints return 401
        }
        filterChain.doFilter(request, response);
    }
}