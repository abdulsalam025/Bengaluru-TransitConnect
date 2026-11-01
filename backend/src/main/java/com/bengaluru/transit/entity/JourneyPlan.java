package com.bengaluru.transit.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "journey_plans")
public class JourneyPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "plan_id")
    private Long planId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "source_node_key", nullable = false, length = 40)
    private String sourceNodeKey;

    @Column(name = "source_name", nullable = false, length = 120)
    private String sourceName;

    @Column(name = "destination_node_key", nullable = false, length = 40)
    private String destinationNodeKey;

    @Column(name = "destination_name", nullable = false, length = 120)
    private String destinationName;

    @Column(name = "optimization_type", nullable = false, length = 20)
    private String optimizationType;

    @Column(name = "route_category", nullable = false, length = 20)
    private String routeCategory;

    @Column(name = "walking_time_mins", nullable = false)
    private Integer walkingTimeMins = 0;

    @Column(name = "bus_time_mins", nullable = false)
    private Integer busTimeMins = 0;

    @Column(name = "metro_time_mins", nullable = false)
    private Integer metroTimeMins = 0;

    @Column(name = "waiting_time_mins", nullable = false)
    private Integer waitingTimeMins = 0;

    @Column(name = "transfer_time_mins", nullable = false)
    private Integer transferTimeMins = 0;

    @Column(name = "total_time_mins", nullable = false)
    private Integer totalTimeMins;

    @Column(name = "total_distance_km", nullable = false, precision = 7, scale = 2)
    private BigDecimal totalDistanceKm;

    @Column(name = "estimated_fare_inr", nullable = false, precision = 8, scale = 2)
    private BigDecimal estimatedFareInr;

    @Column(name = "transfer_count", nullable = false)
    private Integer transferCount = 0;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("legOrder ASC")
    private List<JourneyLeg> legs = new ArrayList<>();

    public Long getPlanId() { return planId; }
    public void setPlanId(Long planId) { this.planId = planId; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getSourceNodeKey() { return sourceNodeKey; }
    public void setSourceNodeKey(String sourceNodeKey) { this.sourceNodeKey = sourceNodeKey; }
    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }
    public String getDestinationNodeKey() { return destinationNodeKey; }
    public void setDestinationNodeKey(String destinationNodeKey) { this.destinationNodeKey = destinationNodeKey; }
    public String getDestinationName() { return destinationName; }
    public void setDestinationName(String destinationName) { this.destinationName = destinationName; }
    public String getOptimizationType() { return optimizationType; }
    public void setOptimizationType(String optimizationType) { this.optimizationType = optimizationType; }
    public String getRouteCategory() { return routeCategory; }
    public void setRouteCategory(String routeCategory) { this.routeCategory = routeCategory; }
    public Integer getWalkingTimeMins() { return walkingTimeMins; }
    public void setWalkingTimeMins(Integer walkingTimeMins) { this.walkingTimeMins = walkingTimeMins; }
    public Integer getBusTimeMins() { return busTimeMins; }
    public void setBusTimeMins(Integer busTimeMins) { this.busTimeMins = busTimeMins; }
    public Integer getMetroTimeMins() { return metroTimeMins; }
    public void setMetroTimeMins(Integer metroTimeMins) { this.metroTimeMins = metroTimeMins; }
    public Integer getWaitingTimeMins() { return waitingTimeMins; }
    public void setWaitingTimeMins(Integer waitingTimeMins) { this.waitingTimeMins = waitingTimeMins; }
    public Integer getTransferTimeMins() { return transferTimeMins; }
    public void setTransferTimeMins(Integer transferTimeMins) { this.transferTimeMins = transferTimeMins; }
    public Integer getTotalTimeMins() { return totalTimeMins; }
    public void setTotalTimeMins(Integer totalTimeMins) { this.totalTimeMins = totalTimeMins; }
    public BigDecimal getTotalDistanceKm() { return totalDistanceKm; }
    public void setTotalDistanceKm(BigDecimal totalDistanceKm) { this.totalDistanceKm = totalDistanceKm; }
    public BigDecimal getEstimatedFareInr() { return estimatedFareInr; }
    public void setEstimatedFareInr(BigDecimal estimatedFareInr) { this.estimatedFareInr = estimatedFareInr; }
    public Integer getTransferCount() { return transferCount; }
    public void setTransferCount(Integer transferCount) { this.transferCount = transferCount; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<JourneyLeg> getLegs() { return legs; }
    public void setLegs(List<JourneyLeg> legs) { this.legs = legs; }
    public void addLeg(JourneyLeg leg) {
        leg.setPlan(this);
        this.legs.add(leg);
    }
}