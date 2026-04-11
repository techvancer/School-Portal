// ============================================================
// SESSION MANAGER - Session timeout, activity tracking, hijacking detection
// ============================================================

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_WARNING = 25 * 60 * 1000; // 25 minutes warning
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

export class SessionManager {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.lastActivity = Date.now();
    this.warningShown = false;
    this.activities = [];
    
    this.initializeSession();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  initializeSession() {
    // Store session info
    sessionStorage.setItem('sessionId', this.sessionId);
    sessionStorage.setItem('sessionStart', Date.now().toString());
    
    // Start activity tracking
    this.attachActivityListeners();
    this.startSessionCheck();
  }

  attachActivityListeners() {
    // Track user activity
    const events = ['click', 'keydown', 'scroll', 'touchmove', 'mousemove'];
    
    events.forEach(event => {
      document.addEventListener(event, () => this.recordActivity(), { passive: true });
    });
  }

  recordActivity() {
    const now = Date.now();
    this.lastActivity = now;
    this.warningShown = false;
    
    this.activities.push({
      timestamp: new Date().toISOString(),
      type: 'user_activity'
    });

    // Keep only last 100 activities
    if (this.activities.length > 100) {
      this.activities.shift();
    }

    sessionStorage.setItem('lastActivity', now.toString());
  }

  startSessionCheck() {
    setInterval(() => {
      this.checkSessionValidity();
    }, SESSION_CHECK_INTERVAL);
  }

  checkSessionValidity() {
    const now = Date.now();
    const lastActivity = parseInt(sessionStorage.getItem('lastActivity') || '0');
    const inactivityTime = now - lastActivity;

    // Check for hijacking
    const storedSessionId = sessionStorage.getItem('sessionId');
    if (storedSessionId !== this.sessionId) {
      console.warn('Session hijacking detected!');
      this.terminateSession('hijacking_detected');
      return;
    }

    // Session expired
    if (inactivityTime > SESSION_TIMEOUT) {
      this.terminateSession('timeout');
      return;
    }

    // Show warning
    if (inactivityTime > INACTIVITY_WARNING && !this.warningShown) {
      this.warningShown = true;
      const remainingTime = Math.round((SESSION_TIMEOUT - inactivityTime) / 1000 / 60);
      document.dispatchEvent(new CustomEvent('sessionWarning', {
        detail: { remainingMinutes: remainingTime }
      }));
    }
  }

  terminateSession(reason = 'manual') {
    this.logSessionTermination(reason);
    sessionStorage.clear();
    localStorage.removeItem('sessionId');
    
    // Dispatch logout event
    document.dispatchEvent(new CustomEvent('sessionTerminated', {
      detail: { reason }
    }));
  }

  logSessionTermination(reason) {
    const log = {
      sessionId: this.sessionId,
      startTime: sessionStorage.getItem('sessionStart'),
      endTime: new Date().toISOString(),
      reason,
      activitiesCount: this.activities.length,
      duration: Date.now() - parseInt(sessionStorage.getItem('sessionStart') || '0')
    };

    try {
      const logs = JSON.parse(localStorage.getItem('sessionLogs') || '[]');
      logs.push(log);
      if (logs.length > 50) {
        logs.shift();
      }
      localStorage.setItem('sessionLogs', JSON.stringify(logs));
    } catch {
      console.error('Failed to log session termination');
    }
  }

  extendSession() {
    this.recordActivity();
    sessionStorage.setItem('lastActivity', Date.now().toString());
  }

  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      startTime: new Date(parseInt(sessionStorage.getItem('sessionStart') || '0')),
      lastActivity: new Date(parseInt(sessionStorage.getItem('lastActivity') || '0')),
      duration: Date.now() - parseInt(sessionStorage.getItem('sessionStart') || '0'),
      activitiesCount: this.activities.length
    };
  }

  getSessionHealth() {
    const now = Date.now();
    const lastActivity = parseInt(sessionStorage.getItem('lastActivity') || '0');
    const inactivityTime = now - lastActivity;
    const healthPercent = Math.max(0, 100 - (inactivityTime / SESSION_TIMEOUT * 100));

    return {
      healthy: healthPercent > 50,
      healthPercent: Math.round(healthPercent),
      warningLevel: inactivityTime > INACTIVITY_WARNING
    };
  }

  validateSessionIntegrity(user) {
    const storedSessionId = sessionStorage.getItem('sessionId');
    
    if (!storedSessionId || storedSessionId !== this.sessionId) {
      return false;
    }

    // Check for suspicious changes
    const now = Date.now();
    const lastActivity = parseInt(sessionStorage.getItem('lastActivity') || '0');
    
    if (now - lastActivity > SESSION_TIMEOUT) {
      return false;
    }

    return true;
  }

  getAllSessions() {
    try {
      return JSON.parse(localStorage.getItem('sessionLogs') || '[]');
    } catch {
      return [];
    }
  }

  clearOldSessions() {
    try {
      const logs = JSON.parse(localStorage.getItem('sessionLogs') || '[]');
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const filtered = logs.filter(log => parseInt(log.startTime) > oneWeekAgo);
      localStorage.setItem('sessionLogs', JSON.stringify(filtered));
    } catch {
      console.error('Failed to clear old sessions');
    }
  }
}

export const sessionManager = new SessionManager();

export default sessionManager;
