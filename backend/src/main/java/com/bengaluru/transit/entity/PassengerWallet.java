package com.bengaluru.transit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "passenger_wallets")
public class PassengerWallet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "wallet_id")
    private Long walletId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "smart_card_no", nullable = false, unique = true, length = 24)
    private String smartCardNo;

    @Column(name = "balance_inr", nullable = false, precision = 10, scale = 2)
    private BigDecimal balanceInr = BigDecimal.ZERO;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getWalletId() { return walletId; }
    public void setWalletId(Long walletId) { this.walletId = walletId; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getSmartCardNo() { return smartCardNo; }
    public void setSmartCardNo(String smartCardNo) { this.smartCardNo = smartCardNo; }
    public BigDecimal getBalanceInr() { return balanceInr; }
    public void setBalanceInr(BigDecimal balanceInr) { this.balanceInr = balanceInr; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}