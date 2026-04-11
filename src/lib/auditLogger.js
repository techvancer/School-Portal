// ============================================================
// AUDIT LOGGER - Security event logging and tracking
// ============================================================

export const LOG_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

export const EVENT_TYPES = {
  // Authentication
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',

  // User Management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  ROLE_CHANGED: 'ROLE_CHANGED',

  // Data Access
  DATA_READ: 'DATA_READ',
  DATA_CREATE: 'DATA_CREATE',
  DATA_UPDATE: 'DATA_UPDATE',
  DATA_DELETE: 'DATA_DELETE',

  // Security Events
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SESSION_TIMEOUT: 'SESSION_TIMEOUT',
  SESSION_HIJACK: 'SESSION_HIJACK',

  // System Events
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

export class AuditLogger {
  constructor() {
    this.logs = this.loadLogs();
    this.maxLogs = 1000;
  }

  loadLogs() {
    try {
      return JSON.parse(localStorage.getItem('auditLogs') || '[]');
    } catch {
      return [];
    }
  }

  saveLogs() {
    try {
      // Keep only latest logs
      const logsToSave = this.logs.slice(-this.maxLogs);
      localStorage.setItem('auditLogs', JSON.stringify(logsToSave));
    } catch {
      console.error('Failed to save audit logs');
    }
  }

  log(eventType, details = {}, level = LOG_LEVELS.LOW) {
    const logEntry = {
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
      eventType,
      level,
      details: {
        ...details,
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    };

    this.logs.push(logEntry);
    this.saveLogs();

    // Log critical events to console
    if (level === LOG_LEVELS.CRITICAL) {
      console.error('CRITICAL SECURITY EVENT:', logEntry);
    }

    return logEntry;
  }

  logLogin(userId, email, success = true, reason = '') {
    return this.log(
      success ? EVENT_TYPES.LOGIN_SUCCESS : EVENT_TYPES.LOGIN_FAILED,
      { userId, email, reason },
      success ? LOG_LEVELS.LOW : LOG_LEVELS.MEDIUM
    );
  }

  logLogout(userId) {
    return this.log(
      EVENT_TYPES.LOGOUT,
      { userId },
      LOG_LEVELS.LOW
    );
  }

  logPasswordChange(userId, email) {
    return this.log(
      EVENT_TYPES.PASSWORD_CHANGE,
      { userId, email },
      LOG_LEVELS.MEDIUM
    );
  }

  logUserCreated(createdBy, newUserId, role) {
    return this.log(
      EVENT_TYPES.USER_CREATED,
      { createdBy, newUserId, role },
      LOG_LEVELS.MEDIUM
    );
  }

  logUserDeleted(deletedBy, deletedUserId) {
    return this.log(
      EVENT_TYPES.USER_DELETED,
      { deletedBy, deletedUserId },
      LOG_LEVELS.HIGH
    );
  }

  logUnauthorizedAccess(userId, resource, action) {
    return this.log(
      EVENT_TYPES.UNAUTHORIZED_ACCESS,
      { userId, resource, action },
      LOG_LEVELS.HIGH
    );
  }

  logDataAccess(userId, action, table, recordId) {
    return this.log(
      action === 'read' ? EVENT_TYPES.DATA_READ :
        action === 'create' ? EVENT_TYPES.DATA_CREATE :
          action === 'update' ? EVENT_TYPES.DATA_UPDATE :
            EVENT_TYPES.DATA_DELETE,
      { userId, table, recordId, action },
      LOG_LEVELS.LOW
    );
  }

  logSuspiciousActivity(userId, description, details = {}) {
    return this.log(
      EVENT_TYPES.SUSPICIOUS_ACTIVITY,
      { userId, description, ...details },
      LOG_LEVELS.HIGH
    );
  }

  logRateLimitExceeded(identifier, endpoint) {
    return this.log(
      EVENT_TYPES.RATE_LIMIT_EXCEEDED,
      { identifier, endpoint },
      LOG_LEVELS.MEDIUM
    );
  }

  logError(errorMessage, context = {}) {
    return this.log(
      EVENT_TYPES.ERROR,
      { errorMessage, ...context },
      LOG_LEVELS.MEDIUM
    );
  }

  generateLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  getLogs(filters = {}) {
    let filtered = [...this.logs];

    // Filter by event type
    if (filters.eventType) {
      filtered = filtered.filter(log => log.eventType === filters.eventType);
    }

    // Filter by level
    if (filters.level) {
      filtered = filtered.filter(log => log.level === filters.level);
    }

    // Filter by date range
    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= start);
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= end);
    }

    // Filter by userId
    if (filters.userId) {
      filtered = filtered.filter(log => log.details?.userId === filters.userId);
    }

    // Sort by timestamp descending
    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getLogsByLevel(level) {
    return this.getLogs({ level });
  }

  getLogsByEventType(eventType) {
    return this.getLogs({ eventType });
  }

  getLogsByUser(userId) {
    return this.getLogs({ userId });
  }

  getLogStatistics() {
    return {
      total: this.logs.length,
      byCritical: this.logs.filter(l => l.level === LOG_LEVELS.CRITICAL).length,
      byHigh: this.logs.filter(l => l.level === LOG_LEVELS.HIGH).length,
      byMedium: this.logs.filter(l => l.level === LOG_LEVELS.MEDIUM).length,
      byLow: this.logs.filter(l => l.level === LOG_LEVELS.LOW).length,
      events: {}
    };
  }

  exportLogs(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    if (format === 'csv') {
      const headers = ['Timestamp', 'Event Type', 'Level', 'Details'];
      const rows = this.logs.map(log => [
        log.timestamp,
        log.eventType,
        log.level,
        JSON.stringify(log.details)
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      return csv;
    }

    return null;
  }

  clearOldLogs(daysOld = 30) {
    const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    this.logs = this.logs.filter(log => new Date(log.timestamp).getTime() > cutoffDate);
    this.saveLogs();
  }

  clearAllLogs() {
    this.logs = [];
    localStorage.removeItem('auditLogs');
  }
}

export const auditLogger = new AuditLogger();

export default auditLogger;
