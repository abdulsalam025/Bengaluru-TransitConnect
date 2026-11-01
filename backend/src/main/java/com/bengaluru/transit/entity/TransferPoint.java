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

@Entity
@Table(name = "transfer_points")
public class TransferPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "transfer_id")
    private Long transferId;

    @Column(name = "hub_name", nullable = false, length = 120)
    private String hubName;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "bus_stop_id", nullable = false)
    private BusStop busStop;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "metro_station_id", nullable = false)
    private MetroStation metroStation;

    @Column(name = "walking_distance_m", nullable = false)
    private Integer walkingDistanceM;

    @Column(name = "walking_time_mins", nullable = false)
    private Integer walkingTimeMins;

    @Column(name = "transfer_buffer_mins", nullable = false)
    private Integer transferBufferMins = 3;

    @Column(name = "has_skywalk", nullable = false)
    private Boolean hasSkywalk = false;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    public Long getTransferId() { return transferId; }
    public void setTransferId(Long transferId) { this.transferId = transferId; }
    public String getHubName() { return hubName; }
    public void setHubName(String hubName) { this.hubName = hubName; }
    public BusStop getBusStop() { return busStop; }
    public void setBusStop(BusStop busStop) { this.busStop = busStop; }
    public MetroStation getMetroStation() { return metroStation; }
    public void setMetroStation(MetroStation metroStation) { this.metroStation = metroStation; }
    public Integer getWalkingDistanceM() { return walkingDistanceM; }
    public void setWalkingDistanceM(Integer walkingDistanceM) { this.walkingDistanceM = walkingDistanceM; }
    public Integer getWalkingTimeMins() { return walkingTimeMins; }
    public void setWalkingTimeMins(Integer walkingTimeMins) { this.walkingTimeMins = walkingTimeMins; }
    public Integer getTransferBufferMins() { return transferBufferMins; }
    public void setTransferBufferMins(Integer transferBufferMins) { this.transferBufferMins = transferBufferMins; }
    public Boolean getHasSkywalk() { return hasSkywalk; }
    public void setHasSkywalk(Boolean hasSkywalk) { this.hasSkywalk = hasSkywalk; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}