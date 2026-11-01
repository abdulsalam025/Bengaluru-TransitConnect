package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.TransferPoint;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransferPointRepository extends JpaRepository<TransferPoint, Long> {
    List<TransferPoint> findByIsActiveTrueOrderByHubNameAsc();
    List<TransferPoint> findAllByOrderByHubNameAsc();
}