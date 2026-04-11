// ============================================================
// RATE LIMITER - Brute force protection
// Max 5 attempts, 15-minute lockout
// ============================================================

const LOCK_TIME = 15 * 60 * 1000; // 15 minutes in ms
const MAX_ATTEMPTS = 5;
const ATTEMPT_RESET_TIME = 60 * 60 * 1000; // 1 hour

export class RateLimiter {
  constructor() {
    this.attempts = this.loadAttempts();
  }

  loadAttempts() {
    try {
      const stored = localStorage.getItem('loginAttempts');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  saveAttempts() {
    localStorage.setItem('loginAttempts', JSON.stringify(this.attempts));
  }

  isLocked(email) {
    const key = `locked_${email}`;
    const lockTime = localStorage.getItem(key);
    
    if (!lockTime) return false;
    
    const now = Date.now();
    const remainingTime = parseInt(lockTime) - now;
    
    if (remainingTime > 0) {
      return true;
    }
    
    // Lock expired, clear it
    localStorage.removeItem(key);
    this.clearAttempts(email);
    return false;
  }

  getLockTimeRemaining(email) {
    const key = `locked_${email}`;
    const lockTime = localStorage.getItem(key);
    
    if (!lockTime) return 0;
    
    const remaining = Math.max(0, parseInt(lockTime) - Date.now());
    return remaining;
  }

  recordAttempt(email) {
    if (!this.attempts[email]) {
      this.attempts[email] = {
        count: 0,
        firstAttempt: Date.now(),
        failedAttempts: []
      };
    }

    const attempt = this.attempts[email];
    
    // Reset if more than 1 hour has passed since first attempt
    if (Date.now() - attempt.firstAttempt > ATTEMPT_RESET_TIME) {
      attempt.count = 0;
      attempt.firstAttempt = Date.now();
      attempt.failedAttempts = [];
    }

    attempt.count++;
    attempt.failedAttempts.push({
      timestamp: new Date().toISOString(),
      ip: 'browser' // Can be enhanced with actual IP detection
    });

    this.saveAttempts();

    if (attempt.count >= MAX_ATTEMPTS) {
      this.lockAccount(email);
    }

    return attempt.count;
  }

  lockAccount(email) {
    const lockUntil = Date.now() + LOCK_TIME;
    localStorage.setItem(`locked_${email}`, lockUntil.toString());
  }

  clearAttempts(email) {
    if (this.attempts[email]) {
      delete this.attempts[email];
      this.saveAttempts();
    }
  }

  resetForSuccess(email) {
    this.clearAttempts(email);
    localStorage.removeItem(`locked_${email}`);
  }

  getAttempts(email) {
    return this.attempts[email]?.count || 0;
  }

  getAllAttempts() {
    return this.attempts;
  }
}

export const rateLimiter = new RateLimiter();

export default rateLimiter;
