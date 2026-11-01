package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.BusStop;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusStopRepository extends JpaRepository<BusStop, Long> {
    List<BusStop> findByIsActiveTrueOrderByStopNameAsc();
    List<BusStop> findAllByOrderByStopNameAsc();
}