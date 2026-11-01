package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.BusRoute;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusRouteRepository extends JpaRepository<BusRoute, Long> {
    List<BusRoute> findAllByOrderByRouteNumberAsc();
    Optional<BusRoute> findByRouteNumberIgnoreCase(String routeNumber);
}