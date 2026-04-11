// ============================================================
// FORM VALIDATION - Specific validators for each form type
// ============================================================

import { validateEmail, validatePhone, validateText, validateNumber, validateDate, validateName } from './validation';

export const validateStudent = (student) => {
  const errors = {};

  // First Name validation
  if (!student.studentfirstname_ar && !student.studentfirstname_en) {
    errors.firstName = 'Student first name is required';
  } else if (student.studentfirstname_ar && !validateName(student.studentfirstname_ar)) {
    errors.firstName = 'Invalid first name format';
  }

  // Father's Name
  if (student.studentfathersname_ar && !validateName(student.studentfathersname_ar)) {
    errors.fathersName = 'Invalid father\'s name format';
  }

  // Grandfather's Name
  if (student.studentgrandfathersname_ar && !validateName(student.studentgrandfathersname_ar)) {
    errors.grandfathersName = 'Invalid grandfather\'s name format';
  }

  // Surname
  if (!student.studentsurname_ar && !student.studentsurname_en) {
    errors.surname = 'Surname is required';
  }

  // Parent Name
  if (student.parentname_ar && !validateName(student.parentname_ar)) {
    errors.parentName = 'Invalid parent name format';
  }

  // Enrollment Number
  if (student.enrollnumber && !validateText(student.enrollnumber)) {
    errors.enrollnumber = 'Invalid enrollment number';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateTeacher = (teacher) => {
  const errors = {};

  // Employee Name
  if (!teacher.employeename && !teacher.employeename_en) {
    errors.name = 'Employee name is required';
  } else if (teacher.employeename && !validateName(teacher.employeename)) {
    errors.name = 'Invalid name format';
  }

  // Email validation
  if (teacher.email && !validateEmail(teacher.email)) {
    errors.email = 'Invalid email format';
  }

  // Phone validation
  if (teacher.phone && !validatePhone(teacher.phone)) {
    errors.phone = 'Invalid phone number';
  }

  // Status validation
  if (teacher.status && !['Active', 'Inactive', 'On Leave'].includes(teacher.status)) {
    errors.status = 'Invalid status';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateExam = (exam) => {
  const errors = {};

  // Exam name
  if (!exam.examname) {
    errors.examname = 'Exam name is required';
  } else if (exam.examname.length > 200) {
    errors.examname = 'Exam name too long';
  }

  // Class validation
  if (!exam.classid) {
    errors.classid = 'Class is required';
  } else if (!validateNumber(exam.classid)) {
    errors.classid = 'Invalid class';
  }

  // Subject validation
  if (!exam.subjectid) {
    errors.subjectid = 'Subject is required';
  }

  // Date validation
  if (!exam.examdate) {
    errors.examdate = 'Exam date is required';
  } else if (!validateDate(exam.examdate)) {
    errors.examdate = 'Invalid date format (use YYYY-MM-DD)';
  }

  // Time validation
  if (exam.examtime && !/^\d{2}:\d{2}$/.test(exam.examtime)) {
    errors.examtime = 'Invalid time format';
  }

  // Total marks
  if (!exam.totalmarks) {
    errors.totalmarks = 'Total marks is required';
  } else if (!validateNumber(exam.totalmarks) || exam.totalmarks < 0) {
    errors.totalmarks = 'Invalid marks';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateMarks = (marks) => {
  const errors = {};

  // Student ID
  if (!marks.studentid) {
    errors.studentid = 'Student is required';
  }

  // Exam ID
  if (!marks.examid) {
    errors.examid = 'Exam is required';
  }

  // Marks obtained
  if (!marks.marksobtained && marks.marksobtained !== 0) {
    errors.marksobtained = 'Marks obtained is required';
  } else if (!validateNumber(marks.marksobtained)) {
    errors.marksobtained = 'Marks must be a number';
  } else if (marks.marksobtained < 0) {
    errors.marksobtained = 'Marks cannot be negative';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateAssignment = (assignment) => {
  const errors = {};

  // Title
  if (!assignment.title) {
    errors.title = 'Assignment title is required';
  } else if (assignment.title.length > 300) {
    errors.title = 'Title too long';
  }

  // Description
  if (!assignment.description) {
    errors.description = 'Description is required';
  } else if (assignment.description.length > 5000) {
    errors.description = 'Description too long';
  }

  // Due date
  if (!assignment.duedate) {
    errors.duedate = 'Due date is required';
  } else if (!validateDate(assignment.duedate)) {
    errors.duedate = 'Invalid date format';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateAttendance = (attendance) => {
  const errors = {};

  // Date
  if (!attendance.attendancedate) {
    errors.attendancedate = 'Attendance date is required';
  } else if (!validateDate(attendance.attendancedate)) {
    errors.attendancedate = 'Invalid date format';
  }

  // Status
  const validStatuses = ['Present', 'Absent', 'Late', 'Excused'];
  if (!attendance.status || !validStatuses.includes(attendance.status)) {
    errors.status = 'Invalid attendance status';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export default {
  validateStudent,
  validateTeacher,
  validateExam,
  validateMarks,
  validateAssignment,
  validateAttendance
};
