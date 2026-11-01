package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.CityLandmark;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CityLandmarkRepository extends JpaRepository<CityLandmark, Long> {

    List<CityLandmark> findAllByOrderByLandmarkNameAsc();

    List<CityLandmark> findByIsActiveTrueOrderByLandmarkNameAsc();

    boolean existsByLandmarkNameIgnoreCase(String landmarkName);

    @Query("""
        SELECT l FROM CityLandmark l
        WHERE l.isActive = true
          AND (:category IS NULL OR :category = '' OR UPPER(l.category) = UPPER(:category))
        ORDER BY l.landmarkName ASC
        """)
    List<CityLandmark> findActiveByOptionalCategory(@Param("category") String category);

    @Query("""
        SELECT l FROM CityLandmark l
        WHERE l.isActive = true
          AND (
               LOWER(l.landmarkName) LIKE LOWER(CONCAT('%', :q, '%'))
            OR LOWER(l.areaName) LIKE LOWER(CONCAT('%', :q, '%'))
            OR LOWER(l.streetAddress) LIKE LOWER(CONCAT('%', :q, '%'))
            OR LOWER(l.pincode) LIKE LOWER(CONCAT('%', :q, '%'))
            OR LOWER(l.category) LIKE LOWER(CONCAT('%', :q, '%'))
          )
        ORDER BY l.landmarkName ASC
        """)
    List<CityLandmark> searchActiveLandmarks(@Param("q") String q);
}
