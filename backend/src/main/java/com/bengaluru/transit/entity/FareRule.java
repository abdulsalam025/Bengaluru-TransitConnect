package com.bengaluru.transit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "fare_rules")
public class FareRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "fare_rule_id")
    private Long fareRuleId;

    @Column(name = "service_category", nullable = false, length = 30)
    private String serviceCategory;

    @Column(name = "min_distance_km", nullable = false, precision = 6, scale = 2)
    private BigDecimal minDistanceKm;

    @Column(name = "max_distance_km", nullable = false, precision = 6, scale = 2)
    private BigDecimal maxDistanceKm;

    @Column(name = "fare_inr", nullable = false, precision = 8, scale = 2)
    private BigDecimal fareInr;

    @Column(name = "smart_card_discount_pct", nullable = false, precision = 4, scale = 2)
    private BigDecimal smartCardDiscountPct = BigDecimal.ZERO;

    @Column(name = "source_note", nullable = false, length = 200)
    private String sourceNote;

    public Long getFareRuleId() { return fareRuleId; }
    public void setFareRuleId(Long fareRuleId) { this.fareRuleId = fareRuleId; }
    public String getServiceCategory() { return serviceCategory; }
    public void setServiceCategory(String serviceCategory) { this.serviceCategory = serviceCategory; }
    public BigDecimal getMinDistanceKm() { return minDistanceKm; }
    public void setMinDistanceKm(BigDecimal minDistanceKm) { this.minDistanceKm = minDistanceKm; }
    public BigDecimal getMaxDistanceKm() { return maxDistanceKm; }
    public void setMaxDistanceKm(BigDecimal maxDistanceKm) { this.maxDistanceKm = maxDistanceKm; }
    public BigDecimal getFareInr() { return fareInr; }
    public void setFareInr(BigDecimal fareInr) { this.fareInr = fareInr; }
    public BigDecimal getSmartCardDiscountPct() { return smartCardDiscountPct; }
    public void setSmartCardDiscountPct(BigDecimal smartCardDiscountPct) { this.smartCardDiscountPct = smartCardDiscountPct; }
    public String getSourceNote() { return sourceNote; }
    public void setSourceNote(String sourceNote) { this.sourceNote = sourceNote; }
}