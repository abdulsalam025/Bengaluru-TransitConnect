package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.BusRouteStop;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusRouteStopRepository extends JpaRepository<BusRouteStop, Long> {
    List<BusRouteStop> findByRoute_RouteIdAndDirectionOrderByStopSequenceAsc(Long routeId, String direction);
    List<BusRouteStop> findAllByOrderByRoute_RouteIdAscDirectionAscStopSequenceAsc();
}