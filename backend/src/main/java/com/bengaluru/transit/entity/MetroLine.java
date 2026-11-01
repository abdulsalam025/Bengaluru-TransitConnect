package com.bengaluru.transit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "metro_lines")
public class MetroLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "line_id")
    private Integer lineId;

    @Column(name = "line_code", nullable = false, unique = true, length = 20)
    private String lineCode;

    @Column(name = "line_name", nullable = false, length = 100)
    private String lineName;

    @Column(name = "color_hex", nullable = false, length = 10)
    private String colorHex;

    @Column(name = "corridor_summary", nullable = false, length = 180)
    private String corridorSummary;

    @Column(name = "total_length_km", nullable = false, precision = 6, scale = 2)
    private BigDecimal totalLengthKm;

    @Column(name = "operational_status", nullable = false, length = 30)
    private String operationalStatus = "OPERATIONAL";

    @Column(name = "opened_year", nullable = false)
    private Integer openedYear;

    public Integer getLineId() { return lineId; }
    public void setLineId(Integer lineId) { this.lineId = lineId; }
    public String getLineCode() { return lineCode; }
    public void setLineCode(String lineCode) { this.lineCode = lineCode; }
    public String getLineName() { return lineName; }
    public void setLineName(String lineName) { this.lineName = lineName; }
    public String getColorHex() { return colorHex; }
    public void setColorHex(String colorHex) { this.colorHex = colorHex; }
    public String getCorridorSummary() { return corridorSummary; }
    public void setCorridorSummary(String corridorSummary) { this.corridorSummary = corridorSummary; }
    public BigDecimal getTotalLengthKm() { return totalLengthKm; }
    public void setTotalLengthKm(BigDecimal totalLengthKm) { this.totalLengthKm = totalLengthKm; }
    public String getOperationalStatus() { return operationalStatus; }
    public void setOperationalStatus(String operationalStatus) { this.operationalStatus = operationalStatus; }
    public Integer getOpenedYear() { return openedYear; }
    public void setOpenedYear(Integer openedYear) { this.openedYear = openedYear; }
}