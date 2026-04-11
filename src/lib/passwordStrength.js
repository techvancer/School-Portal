// ============================================================
// PASSWORD STRENGTH - Validate & generate strong passwords
// ============================================================

// Common weak passwords to block
const WEAK_PASSWORDS = [
  'password', '12345678', 'qwerty', 'abc123', '111111',
  'password123', '123456', 'admin', 'letmein', 'welcome',
  'monkey', '1234', 'dragon', 'master', 'sunshine',
  'princess', 'batman', '654321', '123123', '666666'
];

export const passwordStrengthScore = (password) => {
  let score = 0;

  // Length checks
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character type checks
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  return Math.min(score, 7);
};

export const getPasswordStrength = (password) => {
  if (!password || password.length < 8) {
    return { score: 0, label: 'Very Weak', color: 'red' };
  }

  const score = passwordStrengthScore(password);

  if (score <= 2) {
    return { score, label: 'Weak', color: 'red' };
  } else if (score <= 4) {
    return { score, label: 'Fair', color: 'yellow' };
  } else if (score <= 6) {
    return { score, label: 'Good', color: 'blue' };
  } else {
    return { score, label: 'Strong', color: 'green' };
  }
};

export const isPasswordWeak = (password) => {
  // Check against common weak passwords
  if (WEAK_PASSWORDS.includes(password.toLowerCase())) {
    return true;
  }

  // Check if contains email or username (if detected)
  if (password.includes('@') || password.length < 8) {
    return true;
  }

  // Check strength score
  const score = passwordStrengthScore(password);
  return score < 3;
};

export const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password) {
    errors.push('Password is required');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Must contain lowercase letters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Must contain uppercase letters');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Must contain numbers');
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Must contain special characters (!@#$%^&*)');
    }
  }

  if (WEAK_PASSWORDS.includes(password?.toLowerCase())) {
    errors.push('This password is too common. Choose a stronger password');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Generate a strong random password
export const generateSecurePassword = (length = 16) => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const all = uppercase + lowercase + numbers + special;

  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

export default {
  passwordStrengthScore,
  getPasswordStrength,
  isPasswordWeak,
  validatePasswordStrength,
  generateSecurePassword
};
