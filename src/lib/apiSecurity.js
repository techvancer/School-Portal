// ============================================================
// API SECURITY - Request validation, rate limiting, headers
// ============================================================

const API_RATE_LIMIT = 100; // requests per minute
const API_WINDOW = 60 * 1000; // 1 minute in ms

let requestLog = [];

// Security headers to add to all requests
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

// Check if API rate limit exceeded
export const isRateLimited = () => {
  const now = Date.now();
  
  // Remove old requests outside the window
  requestLog = requestLog.filter(time => now - time < API_WINDOW);
  
  return requestLog.length >= API_RATE_LIMIT;
};

// Log API request
export const logApiRequest = () => {
  requestLog.push(Date.now());
};

// Validate API request object
export const validateApiRequest = (method, endpoint, data = null) => {
  const errors = [];

  // Validate method
  if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
    errors.push('Invalid HTTP method');
  }

  // Validate endpoint
  if (!endpoint || typeof endpoint !== 'string') {
    errors.push('Invalid endpoint');
  }

  // Validate data if provided
  if (data && typeof data !== 'object') {
    errors.push('Invalid request data');
  }

  // Check for SQL injection patterns
  const suspiciousPatterns = [
    /union\s+select/gi,
    /drop\s+table/gi,
    /insert\s+into/gi,
    /delete\s+from/gi,
    /update\s+[a-z]+\s+set/gi,
    /exec\s*\(/gi,
    /execute\s*\(/gi,
    /<script/gi
  ];

  const dataStr = JSON.stringify(data || {});
  if (suspiciousPatterns.some(pattern => pattern.test(dataStr))) {
    errors.push('Suspicious data pattern detected');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Intercept and secure fetch
export const secureApiFetch = async (url, options = {}) => {
  // Check rate limit
  if (isRateLimited()) {
    throw new Error('API rate limit exceeded. Please try again later.');
  }

  logApiRequest();

  // Add security headers
  const headers = {
    ...options.headers,
    ...securityHeaders,
    'Content-Type': 'application/json'
  };

  // Validate request
  const method = options.method || 'GET';
  const validation = validateApiRequest(method, url, options.body);
  
  if (!validation.isValid) {
    throw new Error(`Invalid API request: ${validation.errors.join(', ')}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    // Check for success
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error('API Security Error:', error);
    throw error;
  }
};

// Safe JSON parse
export const safeJsonParse = (jsonString, fallback = null) => {
  try {
    return JSON.parse(jsonString);
  } catch {
    console.error('Invalid JSON detected');
    return fallback;
  }
};

// Check for suspicious response data
export const validateResponseData = (data) => {
  if (typeof data === 'string') {
    // Check for script tags or other XSS vectors
    if (/<script|javascript:|on\w+\s*=/gi.test(data)) {
      console.warn('Suspicious data in response');
      return false;
    }
  }
  return true;
};

export default {
  securityHeaders,
  isRateLimited,
  logApiRequest,
  validateApiRequest,
  secureApiFetch,
  safeJsonParse,
  validateResponseData
};
