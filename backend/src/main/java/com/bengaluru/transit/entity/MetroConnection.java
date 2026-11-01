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
@Table(name = "metro_connections")
public class MetroConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "connection_id")
    private Long connectionId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "from_station_id", nullable = false)
    private MetroStation fromStation;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "to_station_id", nullable = false)
    private MetroStation toStation;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "line_id", nullable = false)
    private MetroLine line;

    @Column(name = "distance_km", nullable = false, precision = 5, scale = 2)
    private BigDecimal distanceKm;

    @Column(name = "travel_time_mins", nullable = false)
    private Integer travelTimeMins;

    @Column(name = "is_interchange_walk", nullable = false)
    private Boolean isInterchangeWalk = false;

    public Long getConnectionId() { return connectionId; }
    public void setConnectionId(Long connectionId) { this.connectionId = connectionId; }
    public MetroStation getFromStation() { return fromStation; }
    public void setFromStation(MetroStation fromStation) { this.fromStation = fromStation; }
    public MetroStation getToStation() { return toStation; }
    public void setToStation(MetroStation toStation) { this.toStation = toStation; }
    public MetroLine getLine() { return line; }
    public void setLine(MetroLine line) { this.line = line; }
    public BigDecimal getDistanceKm() { return distanceKm; }
    public void setDistanceKm(BigDecimal distanceKm) { this.distanceKm = distanceKm; }
    public Integer getTravelTimeMins() { return travelTimeMins; }
    public void setTravelTimeMins(Integer travelTimeMins) { this.travelTimeMins = travelTimeMins; }
    public Boolean getIsInterchangeWalk() { return isInterchangeWalk; }
    public void setIsInterchangeWalk(Boolean isInterchangeWalk) { this.isInterchangeWalk = isInterchangeWalk; }
}