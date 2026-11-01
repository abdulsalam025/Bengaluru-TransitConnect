package com.bengaluru.transit.service;

import com.bengaluru.transit.repository.TransitSqlRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsService {

    private final TransitSqlRepository transitSqlRepository;

    public AnalyticsService(TransitSqlRepository transitSqlRepository) {
        this.transitSqlRepository = transitSqlRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDashboardAnalytics() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("databaseSnapshot", transitSqlRepository.queryDatabaseHealthSnapshot());
        payload.put("popularCorridors", transitSqlRepository.queryPopularCorridorsView());
        payload.put("multimodalHubs", transitSqlRepository.queryHubConnectivityView());
        payload.put("transportModeUsage", transitSqlRepository.queryModeUsageView());
        payload.put("routeFeedbackSummary", transitSqlRepository.queryRouteFeedbackView());
        return payload;
    }
}