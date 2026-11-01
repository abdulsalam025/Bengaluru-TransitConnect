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
import java.time.LocalDateTime;

@Entity
@Table(name = "travel_history")
public class TravelHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "history_id")
    private Long historyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "plan_id", nullable = false)
    private JourneyPlan plan;

    @Column(name = "qr_pass_code", nullable = false, unique = true, length = 40)
    private String qrPassCode;

    @Column(name = "fare_paid_inr", nullable = false, precision = 8, scale = 2)
    private BigDecimal farePaidInr;

    @Column(name = "payment_method", nullable = false, length = 20)
    private String paymentMethod = "SMART_WALLET";

    @Column(name = "pass_status", nullable = false, length = 20)
    private String passStatus = "ACTIVE";

    @Column(name = "travelled_at", insertable = false, updatable = false)
    private LocalDateTime travelledAt;

    public Long getHistoryId() { return historyId; }
    public void setHistoryId(Long historyId) { this.historyId = historyId; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public JourneyPlan getPlan() { return plan; }
    public void setPlan(JourneyPlan plan) { this.plan = plan; }
    public String getQrPassCode() { return qrPassCode; }
    public void setQrPassCode(String qrPassCode) { this.qrPassCode = qrPassCode; }
    public BigDecimal getFarePaidInr() { return farePaidInr; }
    public void setFarePaidInr(BigDecimal farePaidInr) { this.farePaidInr = farePaidInr; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public String getPassStatus() { return passStatus; }
    public void setPassStatus(String passStatus) { this.passStatus = passStatus; }
    public LocalDateTime getTravelledAt() { return travelledAt; }
}