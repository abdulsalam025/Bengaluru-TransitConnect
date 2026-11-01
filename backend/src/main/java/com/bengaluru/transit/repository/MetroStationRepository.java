package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.MetroStation;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MetroStationRepository extends JpaRepository<MetroStation, Long> {
    List<MetroStation> findByLine_LineIdOrderByStationOrderAsc(Integer lineId);
    List<MetroStation> findByIsActiveTrueOrderByLine_LineIdAscStationOrderAsc();
    List<MetroStation> findAllByOrderByLine_LineIdAscStationOrderAsc();
}