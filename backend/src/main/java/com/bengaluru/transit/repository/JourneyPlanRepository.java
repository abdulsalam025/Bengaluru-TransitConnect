package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.JourneyPlan;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JourneyPlanRepository extends JpaRepository<JourneyPlan, Long> {
    List<JourneyPlan> findTop15ByUser_UserIdOrderByCreatedAtDesc(Long userId);
    List<JourneyPlan> findTop20ByOrderByCreatedAtDesc();
}