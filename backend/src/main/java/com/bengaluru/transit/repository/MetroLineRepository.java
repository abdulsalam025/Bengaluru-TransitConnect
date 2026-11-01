package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.MetroLine;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MetroLineRepository extends JpaRepository<MetroLine, Integer> {
    List<MetroLine> findAllByOrderByLineIdAsc();
}