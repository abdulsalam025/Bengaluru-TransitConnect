package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.Bus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusRepository extends JpaRepository<Bus, Long> {
    List<Bus> findAllByOrderByRegistrationNoAsc();
}