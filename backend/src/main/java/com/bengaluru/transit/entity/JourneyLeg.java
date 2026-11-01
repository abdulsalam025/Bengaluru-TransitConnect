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
@Table(name = "journey_legs")
public class JourneyLeg {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "leg_id")
    private Long legId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private JourneyPlan plan;

    @Column(name = "leg_order", nullable = false)
    private Integer legOrder;

    @Column(name = "leg_mode", nullable = false, length = 15)
    private String legMode;

    @Column(name = "route_or_line_code", nullable = false, length = 30)
    private String routeOrLineCode;

    @Column(name = "route_or_line_name", nullable = false, length = 140)
    private String routeOrLineName;

    @Column(name = "color_hex", nullable = false, length = 10)
    private String colorHex = "#2563EB";

    @Column(name = "from_node_key", nullable = false, length = 40)
    private String fromNodeKey;

    @Column(name = "from_point_name", nullable = false, length = 120)
    private String fromPointName;

    @Column(name = "from_lat", nullable = false, precision = 9, scale = 6)
    private BigDecimal fromLat;

    @Column(name = "from_lng", nullable = false, precision = 9, scale = 6)
    private BigDecimal fromLng;

    @Column(name = "to_node_key", nullable = false, length = 40)
    private String toNodeKey;

    @Column(name = "to_point_name", nullable = false, length = 120)
    private String toPointName;

    @Column(name = "to_lat", nullable = false, precision = 9, scale = 6)
    private BigDecimal toLat;

    @Column(name = "to_lng", nullable = false, precision = 9, scale = 6)
    private BigDecimal toLng;

    @Column(name = "distance_km", nullable = false, precision = 6, scale = 2)
    private BigDecimal distanceKm = BigDecimal.ZERO;

    @Column(name = "duration_mins", nullable = false)
    private Integer durationMins;

    @Column(name = "waiting_mins", nullable = false)
    private Integer waitingMins = 0;

    @Column(name = "leg_fare_inr", nullable = false, precision = 8, scale = 2)
    private BigDecimal legFareInr = BigDecimal.ZERO;

    @Column(name = "stops_count", nullable = false)
    private Integer stopsCount = 0;

    public Long getLegId() { return legId; }
    public void setLegId(Long legId) { this.legId = legId; }
    public JourneyPlan getPlan() { return plan; }
    public void setPlan(JourneyPlan plan) { this.plan = plan; }
    public Integer getLegOrder() { return legOrder; }
    public void setLegOrder(Integer legOrder) { this.legOrder = legOrder; }
    public String getLegMode() { return legMode; }
    public void setLegMode(String legMode) { this.legMode = legMode; }
    public String getRouteOrLineCode() { return routeOrLineCode; }
    public void setRouteOrLineCode(String routeOrLineCode) { this.routeOrLineCode = routeOrLineCode; }
    public String getRouteOrLineName() { return routeOrLineName; }
    public void setRouteOrLineName(String routeOrLineName) { this.routeOrLineName = routeOrLineName; }
    public String getColorHex() { return colorHex; }
    public void setColorHex(String colorHex) { this.colorHex = colorHex; }
    public String getFromNodeKey() { return fromNodeKey; }
    public void setFromNodeKey(String fromNodeKey) { this.fromNodeKey = fromNodeKey; }
    public String getFromPointName() { return fromPointName; }
    public void setFromPointName(String fromPointName) { this.fromPointName = fromPointName; }
    public BigDecimal getFromLat() { return fromLat; }
    public void setFromLat(BigDecimal fromLat) { this.fromLat = fromLat; }
    public BigDecimal getFromLng() { return fromLng; }
    public void setFromLng(BigDecimal fromLng) { this.fromLng = fromLng; }
    public String getToNodeKey() { return toNodeKey; }
    public void setToNodeKey(String toNodeKey) { this.toNodeKey = toNodeKey; }
    public String getToPointName() { return toPointName; }
    public void setToPointName(String toPointName) { this.toPointName = toPointName; }
    public BigDecimal getToLat() { return toLat; }
    public void setToLat(BigDecimal toLat) { this.toLat = toLat; }
    public BigDecimal getToLng() { return toLng; }
    public void setToLng(BigDecimal toLng) { this.toLng = toLng; }
    public BigDecimal getDistanceKm() { return distanceKm; }
    public void setDistanceKm(BigDecimal distanceKm) { this.distanceKm = distanceKm; }
    public Integer getDurationMins() { return durationMins; }
    public void setDurationMins(Integer durationMins) { this.durationMins = durationMins; }
    public Integer getWaitingMins() { return waitingMins; }
    public void setWaitingMins(Integer waitingMins) { this.waitingMins = waitingMins; }
    public BigDecimal getLegFareInr() { return legFareInr; }
    public void setLegFareInr(BigDecimal legFareInr) { this.legFareInr = legFareInr; }
    public Integer getStopsCount() { return stopsCount; }
    public void setStopsCount(Integer stopsCount) { this.stopsCount = stopsCount; }
}