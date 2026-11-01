package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.FareRule;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FareRuleRepository extends JpaRepository<FareRule, Long> {
    List<FareRule> findAllByOrderByServiceCategoryAscMinDistanceKmAsc();
}