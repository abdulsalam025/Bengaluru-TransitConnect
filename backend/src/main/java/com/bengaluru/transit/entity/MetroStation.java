package com.bengaluru.transit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "metro_stations")
public class MetroStation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "station_id")
    private Long stationId;

    @Column(name = "station_code", nullable = false, unique = true, length = 20)
    private String stationCode;

    @Column(name = "station_name", nullable = false, length = 120)
    private String stationName;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "line_id", nullable = false)
    private MetroLine line;

    @Column(name = "station_order", nullable = false)
    private Integer stationOrder;

    @Column(name = "latitude", nullable = false, precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(name = "longitude", nullable = false, precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(name = "is_interchange", nullable = false)
    private Boolean isInterchange = false;

    @Column(name = "structure_type", nullable = false, length = 20)
    private String structureType = "ELEVATED";

    @Column(name = "has_parking", nullable = false)
    private Boolean hasParking = true;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    public Long getStationId() { return stationId; }
    public void setStationId(Long stationId) { this.stationId = stationId; }
    public String getStationCode() { return stationCode; }
    public void setStationCode(String stationCode) { this.stationCode = stationCode; }
    public String getStationName() { return stationName; }
    public void setStationName(String stationName) { this.stationName = stationName; }
    public MetroLine getLine() { return line; }
    public void setLine(MetroLine line) { this.line = line; }
    public Integer getStationOrder() { return stationOrder; }
    public void setStationOrder(Integer stationOrder) { this.stationOrder = stationOrder; }
    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    public Boolean getIsInterchange() { return isInterchange; }
    public void setIsInterchange(Boolean isInterchange) { this.isInterchange = isInterchange; }
    public String getStructureType() { return structureType; }
    public void setStructureType(String structureType) { this.structureType = structureType; }
    public Boolean getHasParking() { return hasParking; }
    public void setHasParking(Boolean hasParking) { this.hasParking = hasParking; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}