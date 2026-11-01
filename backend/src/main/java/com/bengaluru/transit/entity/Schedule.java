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
import java.time.LocalTime;

@Entity
@Table(name = "schedules")
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_id")
    private Long scheduleId;

    @Column(name = "transport_mode", nullable = false, length = 15)
    private String transportMode;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "bus_route_id")
    private BusRoute busRoute;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "metro_line_id")
    private MetroLine metroLine;

    @Column(name = "day_type", nullable = false, length = 15)
    private String dayType;

    @Column(name = "first_service_time", nullable = false)
    private LocalTime firstServiceTime;

    @Column(name = "last_service_time", nullable = false)
    private LocalTime lastServiceTime;

    @Column(name = "peak_headway_mins", nullable = false)
    private Integer peakHeadwayMins;

    @Column(name = "offpeak_headway_mins", nullable = false)
    private Integer offpeakHeadwayMins;

    @Column(name = "data_confidence", nullable = false, length = 30)
    private String dataConfidence = "SCHEDULED_SAMPLE";

    @Column(name = "schedule_note", nullable = false, length = 200)
    private String scheduleNote;

    public Long getScheduleId() { return scheduleId; }
    public void setScheduleId(Long scheduleId) { this.scheduleId = scheduleId; }
    public String getTransportMode() { return transportMode; }
    public void setTransportMode(String transportMode) { this.transportMode = transportMode; }
    public BusRoute getBusRoute() { return busRoute; }
    public void setBusRoute(BusRoute busRoute) { this.busRoute = busRoute; }
    public MetroLine getMetroLine() { return metroLine; }
    public void setMetroLine(MetroLine metroLine) { this.metroLine = metroLine; }
    public String getDayType() { return dayType; }
    public void setDayType(String dayType) { this.dayType = dayType; }
    public LocalTime getFirstServiceTime() { return firstServiceTime; }
    public void setFirstServiceTime(LocalTime firstServiceTime) { this.firstServiceTime = firstServiceTime; }
    public LocalTime getLastServiceTime() { return lastServiceTime; }
    public void setLastServiceTime(LocalTime lastServiceTime) { this.lastServiceTime = lastServiceTime; }
    public Integer getPeakHeadwayMins() { return peakHeadwayMins; }
    public void setPeakHeadwayMins(Integer peakHeadwayMins) { this.peakHeadwayMins = peakHeadwayMins; }
    public Integer getOffpeakHeadwayMins() { return offpeakHeadwayMins; }
    public void setOffpeakHeadwayMins(Integer offpeakHeadwayMins) { this.offpeakHeadwayMins = offpeakHeadwayMins; }
    public String getDataConfidence() { return dataConfidence; }
    public void setDataConfidence(String dataConfidence) { this.dataConfidence = dataConfidence; }
    public String getScheduleNote() { return scheduleNote; }
    public void setScheduleNote(String scheduleNote) { this.scheduleNote = scheduleNote; }
}