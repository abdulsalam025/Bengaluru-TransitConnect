package com.bengaluru.transit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "bus_stops")
public class BusStop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "stop_id")
    private Long stopId;

    @Column(name = "stop_code", nullable = false, unique = true, length = 24)
    private String stopCode;

    @Column(name = "stop_name", nullable = false, length = 120)
    private String stopName;

    @Column(name = "area_name", nullable = false, length = 100)
    private String areaName;

    @Column(name = "latitude", nullable = false, precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(name = "longitude", nullable = false, precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(name = "has_shelter", nullable = false)
    private Boolean hasShelter = true;

    @Column(name = "is_interchange_hub", nullable = false)
    private Boolean isInterchangeHub = false;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    public Long getStopId() { return stopId; }
    public void setStopId(Long stopId) { this.stopId = stopId; }
    public String getStopCode() { return stopCode; }
    public void setStopCode(String stopCode) { this.stopCode = stopCode; }
    public String getStopName() { return stopName; }
    public void setStopName(String stopName) { this.stopName = stopName; }
    public String getAreaName() { return areaName; }
    public void setAreaName(String areaName) { this.areaName = areaName; }
    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    public Boolean getHasShelter() { return hasShelter; }
    public void setHasShelter(Boolean hasShelter) { this.hasShelter = hasShelter; }
    public Boolean getIsInterchangeHub() { return isInterchangeHub; }
    public void setIsInterchangeHub(Boolean isInterchangeHub) { this.isInterchangeHub = isInterchangeHub; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}