package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.MetroConnection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MetroConnectionRepository extends JpaRepository<MetroConnection, Long> {
    List<MetroConnection> findAllByOrderByConnectionIdAsc();
}