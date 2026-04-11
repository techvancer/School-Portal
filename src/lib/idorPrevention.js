// ============================================================
// IDOR PREVENTION - Insecure Direct Object Reference Protection
// ============================================================

// Check if user owns the resource
export const checkResourceOwnership = (userId, ownerId) => {
  return userId && ownerId && userId.toString() === ownerId.toString();
};

// Check if user role can access resource
export const checkRolePermission = (userRole, requiredRoles = []) => {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.includes(userRole);
};

// Safe resource access (ownership + role check)
export const validateResourceAccess = (user, resource, requiredRoles = []) => {
  if (!user || !resource) {
    return { allowed: false, reason: 'User or resource not found' };
  }

  // Admin can access everything
  if (user.role === 'Admin') {
    return { allowed: true };
  }

  // Check ownership
  if (resource.userid && !checkResourceOwnership(user.id, resource.userid)) {
    return { allowed: false, reason: 'Access denied: Not the resource owner' };
  }

  // Check role permission
  if (!checkRolePermission(user.role, requiredRoles)) {
    return { allowed: false, reason: 'Access denied: Insufficient privileges' };
  }

  return { allowed: true };
};

// Filter resources based on user role
export const filterResourcesByRole = (resources, user) => {
  if (!Array.isArray(resources)) {
    return [];
  }

  // Admin sees everything
  if (user.role === 'Admin') {
    return resources;
  }

  // Filter based on ownership and role
  return resources.filter(resource => {
    // User owns it
    if (checkResourceOwnership(user.id, resource.userid)) {
      return true;
    }

    // Supervisor can see all
    if (user.role === 'Supervisor') {
      return true;
    }

    // Teachers can only see their own
    if (user.role === 'Teacher') {
      return resource.userid === user.id;
    }

    return false;
  });
};

// Log unauthorized access attempts
export const logUnauthorizedAccess = (user, resourceId, action) => {
  const log = {
    timestamp: new Date().toISOString(),
    userId: user?.id,
    userRole: user?.role,
    resourceId,
    action,
    ipAddress: 'unknown',
    severity: 'HIGH'
  };

  try {
    const logs = JSON.parse(localStorage.getItem('securityLogs') || '[]');
    logs.push(log);
    // Keep only last 100 logs
    if (logs.length > 100) {
      logs.shift();
    }
    localStorage.setItem('securityLogs', JSON.stringify(logs));
  } catch {
    console.error('Failed to log unauthorized access');
  }

  console.warn('Unauthorized access attempt:', log);
};

// Safe redirect after denied access
export const safeRedirect = (router, deniedReason) => {
  console.warn('Access denied:', deniedReason);
  
  // Redirect based on current location to prevent redirect loops
  if (window.location.pathname.includes('/admin')) {
    router.push('/admin/dashboard');
  } else if (window.location.pathname.includes('/supervisor')) {
    router.push('/supervisor/dashboard');
  } else {
    router.push('/dashboard');
  }
};

// Higher-order component validator
export const requireResourceAccess = (resource, requiredRoles = []) => {
  return (user) => {
    return validateResourceAccess(user, resource, requiredRoles);
  };
};

// Validate query parameters for IDOR
export const validateQueryParams = (params, allowedKeys = []) => {
  const errors = [];

  if (!params) {
    return { valid: false, errors: ['No parameters provided'] };
  }

  // Check for suspicious patterns
  Object.entries(params).forEach(([key, value]) => {
    // Check if key is in whitelist
    if (allowedKeys.length > 0 && !allowedKeys.includes(key)) {
      errors.push(`Unexpected parameter: ${key}`);
    }

    // Check for SQL injection patterns
    if (typeof value === 'string' && /^[\d]+$/.test(value)) {
      // Numeric ID is ok
    } else if (typeof value === 'string' && value.length > 1000) {
      errors.push(`Parameter too long: ${key}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

export default {
  checkResourceOwnership,
  checkRolePermission,
  validateResourceAccess,
  filterResourcesByRole,
  logUnauthorizedAccess,
  safeRedirect,
  requireResourceAccess,
  validateQueryParams
};
