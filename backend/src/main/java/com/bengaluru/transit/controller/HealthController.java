package com.bengaluru.transit.controller;

import com.bengaluru.transit.repository.TransitSqlRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final TransitSqlRepository transitSqlRepository;

    public HealthController(TransitSqlRepository transitSqlRepository) {
        this.transitSqlRepository = transitSqlRepository;
    }

    @GetMapping
    public Map<String, Object> health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", "UP");
        out.put("service", "Bengaluru TransitConnect API");
        out.put("javaVersion", System.getProperty("java.version"));
        out.put("timestamp", Instant.now().toString());
        out.put("database", transitSqlRepository.queryDatabaseHealthSnapshot());
        return out;
    }
}