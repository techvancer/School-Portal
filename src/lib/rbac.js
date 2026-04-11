// ============================================================
// RBAC - Role-Based Access Control
// 4 Roles: Admin, Supervisor, Teacher, GM
// ============================================================

// Permission definitions
export const PERMISSIONS = {
  // User Management
  CREATE_USER: 'create_user',
  EDIT_USER: 'edit_user',
  DELETE_USER: 'delete_user',
  VIEW_USERS: 'view_users',

  // Student Management
  CREATE_STUDENT: 'create_student',
  EDIT_STUDENT: 'edit_student',
  DELETE_STUDENT: 'delete_student',
  VIEW_STUDENTS: 'view_students',
  ENROLL_STUDENT: 'enroll_student',

  // Teacher Management
  CREATE_TEACHER: 'create_teacher',
  EDIT_TEACHER: 'edit_teacher',
  DELETE_TEACHER: 'delete_teacher',
  VIEW_TEACHERS: 'view_teachers',

  // Exam Management
  CREATE_EXAM: 'create_exam',
  EDIT_EXAM: 'edit_exam',
  DELETE_EXAM: 'delete_exam',
  VIEW_EXAMS: 'view_exams',

  // Marks Management
  UPLOAD_MARKS: 'upload_marks',
  EDIT_MARKS: 'edit_marks',
  VIEW_MARKS: 'view_marks',

  // Reports
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',

  // Attendance
  CREATE_ATTENDANCE: 'create_attendance',
  VIEW_ATTENDANCE: 'view_attendance',

  // Admin Functions
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_ROLES: 'manage_roles',
  VIEW_DASHBOARD: 'view_dashboard'
};

// Role-Permission Matrix
export const ROLE_PERMISSIONS = {
  Admin: [
    PERMISSIONS.CREATE_USER,
    PERMISSIONS.EDIT_USER,
    PERMISSIONS.DELETE_USER,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.CREATE_STUDENT,
    PERMISSIONS.EDIT_STUDENT,
    PERMISSIONS.DELETE_STUDENT,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.ENROLL_STUDENT,
    PERMISSIONS.CREATE_TEACHER,
    PERMISSIONS.EDIT_TEACHER,
    PERMISSIONS.DELETE_TEACHER,
    PERMISSIONS.VIEW_TEACHERS,
    PERMISSIONS.CREATE_EXAM,
    PERMISSIONS.EDIT_EXAM,
    PERMISSIONS.DELETE_EXAM,
    PERMISSIONS.VIEW_EXAMS,
    PERMISSIONS.UPLOAD_MARKS,
    PERMISSIONS.EDIT_MARKS,
    PERMISSIONS.VIEW_MARKS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.CREATE_ATTENDANCE,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  Supervisor: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.ENROLL_STUDENT,
    PERMISSIONS.VIEW_TEACHERS,
    PERMISSIONS.VIEW_EXAMS,
    PERMISSIONS.VIEW_MARKS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.CREATE_ATTENDANCE,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  Teacher: [
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.CREATE_EXAM,
    PERMISSIONS.EDIT_EXAM,
    PERMISSIONS.VIEW_EXAMS,
    PERMISSIONS.UPLOAD_MARKS,
    PERMISSIONS.EDIT_MARKS,
    PERMISSIONS.VIEW_MARKS,
    PERMISSIONS.CREATE_ATTENDANCE,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  GM: [
    PERMISSIONS.VIEW_DASHBOARD
  ]
};

// Role Hierarchy (higher = more privileges)
export const ROLE_HIERARCHY = {
  Admin: 4,
  Supervisor: 3,
  Teacher: 2,
  GM: 1
};

// Check if user has permission
export const hasPermission = (user, permission) => {
  if (!user || !user.role) {
    return false;
  }

  if (!ROLE_PERMISSIONS[user.role]) {
    return false;
  }

  return ROLE_PERMISSIONS[user.role].includes(permission);
};

// Check if user has all permissions
export const hasAllPermissions = (user, permissions = []) => {
  return permissions.every(permission => hasPermission(user, permission));
};

// Check if user has any permission
export const hasAnyPermission = (user, permissions = []) => {
  return permissions.some(permission => hasPermission(user, permission));
};

// Check if user's role is higher than target role
export const isRoleHigherThan = (userRole, targetRole) => {
  return (ROLE_HIERARCHY[userRole] || 0) > (ROLE_HIERARCHY[targetRole] || 0);
};

// Get all permissions for a role
export const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

// Get all roles
export const getAllRoles = () => {
  return Object.keys(ROLE_PERMISSIONS);
};

// Validate user can assign/modify role
export const canManageRole = (userRole, targetRole) => {
  // Only Admin can manage roles
  if (userRole !== 'Admin') {
    return false;
  }

  // Admin can manage any role
  return true;
};

// Require permission middleware
export const requirePermission = (permission) => {
  return (user) => {
    return hasPermission(user, permission);
  };
};

// Require role middleware
export const requireRole = (allowedRoles = []) => {
  return (user) => {
    return allowedRoles.includes(user?.role);
  };
};

// Enforce permission on resource
export const enforcePermission = (user, action, resource) => {
  const permissionMap = {
    'create': `CREATE_${resource.toUpperCase()}`,
    'edit': `EDIT_${resource.toUpperCase()}`,
    'delete': `DELETE_${resource.toUpperCase()}`,
    'view': `VIEW_${resource.toUpperCase()}`
  };

  const requiredPermission = permissionMap[action];
  if (!requiredPermission) {
    return { allowed: false, reason: 'Invalid action' };
  }

  if (!hasPermission(user, PERMISSIONS[requiredPermission])) {
    return { allowed: false, reason: `Missing permission: ${requiredPermission}` };
  }

  return { allowed: true };
};

export default {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isRoleHigherThan,
  getRolePermissions,
  getAllRoles,
  canManageRole,
  requirePermission,
  requireRole,
  enforcePermission
};
