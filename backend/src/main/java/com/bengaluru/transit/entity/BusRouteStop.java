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
@Table(name = "bus_route_stops")
public class BusRouteStop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "route_id", nullable = false)
    private BusRoute route;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "stop_id", nullable = false)
    private BusStop stop;

    @Column(name = "direction", nullable = false, length = 15)
    private String direction = "OUTBOUND";

    @Column(name = "stop_sequence", nullable = false)
    private Integer stopSequence;

    @Column(name = "distance_from_start_km", nullable = false, precision = 6, scale = 2)
    private BigDecimal distanceFromStartKm;

    @Column(name = "travel_mins_from_prev", nullable = false)
    private Integer travelMinsFromPrev = 0;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public BusRoute getRoute() { return route; }
    public void setRoute(BusRoute route) { this.route = route; }
    public BusStop getStop() { return stop; }
    public void setStop(BusStop stop) { this.stop = stop; }
    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }
    public Integer getStopSequence() { return stopSequence; }
    public void setStopSequence(Integer stopSequence) { this.stopSequence = stopSequence; }
    public BigDecimal getDistanceFromStartKm() { return distanceFromStartKm; }
    public void setDistanceFromStartKm(BigDecimal distanceFromStartKm) { this.distanceFromStartKm = distanceFromStartKm; }
    public Integer getTravelMinsFromPrev() { return travelMinsFromPrev; }
    public void setTravelMinsFromPrev(Integer travelMinsFromPrev) { this.travelMinsFromPrev = travelMinsFromPrev; }
}