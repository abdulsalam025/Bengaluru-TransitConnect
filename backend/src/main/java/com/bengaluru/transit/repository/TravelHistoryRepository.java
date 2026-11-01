package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.TravelHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TravelHistoryRepository extends JpaRepository<TravelHistory, Long> {
    List<TravelHistory> findByUser_UserIdOrderByTravelledAtDesc(Long userId);
}