// ============================================================
// VALIDATION MODULE - Input Validation & Sanitization
// Security: Prevents XSS, SQL injection, and invalid data
// ============================================================

// Email validation
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Password validation (minimum requirements)
export const validatePassword = (password) => {
  return password && password.length >= 8;
};

// Safe string (no special characters that could be XSS vectors)
export const sanitizeInput = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>\"']/g, '') // Remove dangerous characters
    .trim()
    .substring(0, 500); // Limit length
};

// Sanitize output (prevent XSS when displaying user input)
export const sanitizeOutput = (str) => {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

// Validate name (letters, spaces, hyphens, apostrophes)
export const validateName = (name) => {
  const re = /^[a-zA-Z\s\-'ء-ي]{2,100}$/;
  return re.test(name);
};

// Validate phone number (basic format)
export const validatePhone = (phone) => {
  const re = /^[0-9\+\-\(\)\s]{7,20}$/;
  return re.test(phone);
};

// Validate text input (no SQL keywords)
export const validateText = (text) => {
  const sqlKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'UNION', 'SELECT'];
  const upperText = text.toUpperCase();
  return !sqlKeywords.some(keyword => upperText.includes(keyword));
};

// Validate number
export const validateNumber = (num) => {
  return !isNaN(num) && num !== '';
};

// Validate URL format
export const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Validate date format (YYYY-MM-DD)
export const validateDate = (date) => {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  return re.test(date);
};

// Escape HTML characters
export const escapeHtml = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
};

export default {
  validateEmail,
  validatePassword,
  sanitizeInput,
  sanitizeOutput,
  validateName,
  validatePhone,
  validateText,
  validateNumber,
  validateUrl,
  validateDate,
  escapeHtml
};
