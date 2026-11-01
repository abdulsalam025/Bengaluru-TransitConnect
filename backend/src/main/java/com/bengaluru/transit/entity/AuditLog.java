package com.bengaluru.transit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    private Long logId;

    @Column(name = "actor_user_id")
    private Long actorUserId;

    @Column(name = "table_name", nullable = false, length = 64)
    private String tableName;

    @Column(name = "operation_type", nullable = false, length = 15)
    private String operationType;

    @Column(name = "record_identifier", nullable = false, length = 80)
    private String recordIdentifier;

    @Column(name = "old_payload", columnDefinition = "JSON")
    private String oldPayload;

    @Column(name = "new_payload", columnDefinition = "JSON")
    private String newPayload;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getLogId() { return logId; }
    public void setLogId(Long logId) { this.logId = logId; }
    public Long getActorUserId() { return actorUserId; }
    public void setActorUserId(Long actorUserId) { this.actorUserId = actorUserId; }
    public String getTableName() { return tableName; }
    public void setTableName(String tableName) { this.tableName = tableName; }
    public String getOperationType() { return operationType; }
    public void setOperationType(String operationType) { this.operationType = operationType; }
    public String getRecordIdentifier() { return recordIdentifier; }
    public void setRecordIdentifier(String recordIdentifier) { this.recordIdentifier = recordIdentifier; }
    public String getOldPayload() { return oldPayload; }
    public void setOldPayload(String oldPayload) { this.oldPayload = oldPayload; }
    public String getNewPayload() { return newPayload; }
    public void setNewPayload(String newPayload) { this.newPayload = newPayload; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}