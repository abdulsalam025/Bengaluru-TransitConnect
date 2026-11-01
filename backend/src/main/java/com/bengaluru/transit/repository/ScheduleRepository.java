package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.Schedule;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {
    List<Schedule> findAllByOrderByTransportModeAscScheduleIdAsc();
}