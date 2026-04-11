import { useState, useEffect } from 'react';

// Default initial data for Supervisor/Admin
const initialTeachers = [
    { id: 1, name: 'Ahmed Mahmoud', email: 'ahmed@school.edu', subject: 'Math', classes: 'Grade 7-A, Grade 7-B', exams: 5 },
    { id: 2, name: 'Sara Ali', email: 'sara@school.edu', subject: 'Science', classes: 'Grade 8-A, Grade 8-B', exams: 3 },
    { id: 3, name: 'Nour Khalid', email: 'nour@school.edu', subject: 'English', classes: 'Grade 7-A, Grade 9-B', exams: 1 },
    { id: 4, name: 'Rami Hasan', email: 'rami@school.edu', subject: 'Physics', classes: 'Grade 8-A', exams: 4 },
    { id: 5, name: 'Dalia Saad', email: 'dalia@school.edu', subject: 'Chemistry', classes: 'Grade 9-B', exams: 2 },
    { id: 6, name: 'Faris Nour', email: 'faris@school.edu', subject: 'History', classes: 'Grade 7-B', exams: 0 },
    { id: 7, name: 'Heba Ziad', email: 'heba@school.edu', subject: 'Geography', classes: 'Grade 8-B', exams: 2 },
    { id: 8, name: 'Karim Adel', email: 'karim@school.edu', subject: 'Biology', classes: 'Grade 9-B', exams: 3 },
];

const initialStudents = [
    { id: 'S1001', name: 'Ali Youssef', className: 'Grade 7', section: 'A', average: 88, attendance: 95, performance: 'Good' },
    { id: 'S1002', name: 'Sara Kamel', className: 'Grade 7', section: 'A', average: 92, attendance: 98, performance: 'Excellent' },
    { id: 'S1003', name: 'Omar Said', className: 'Grade 7', section: 'A', average: 58, attendance: 82, performance: 'At Risk' },
    { id: 'S1004', name: 'Laila Mahmoud', className: 'Grade 7', section: 'B', average: 95, attendance: 100, performance: 'Excellent' },
    { id: 'S1005', name: 'Yusuf Nasser', className: 'Grade 7', section: 'B', average: 62, attendance: 75, performance: 'Weak' },
    { id: 'S1006', name: 'Rana Khalil', className: 'Grade 8', section: 'A', average: 65, attendance: 80, performance: 'Weak' },
    { id: 'S1007', name: 'Hana Samir', className: 'Grade 8', section: 'A', average: 78, attendance: 68, performance: 'Average' },
    { id: 'S1008', name: 'Tariq Mansour', className: 'Grade 8', section: 'B', average: 71, attendance: 71, performance: 'Average' },
    { id: 'S1009', name: 'Dina Rashid', className: 'Grade 8', section: 'B', average: 82, attendance: 70, performance: 'Good' },
    { id: 'S1010', name: 'Ahmad Faris', className: 'Grade 9', section: 'B', average: 60, attendance: 78, performance: 'At Risk' },
];

const initialSupervisors = [
    { id: 1, name: 'Khaled Omar', email: 'khaled@school.edu', stage: 'Middle School', teachers: 4 },
    { id: 2, name: 'Lina Hassan', email: 'lina@school.edu', stage: 'High School', teachers: 4 },
];

const initialClasses = [
    { id: 1, name: 'Grade 7', stage: 'Middle School', sections: ['A', 'B'], students: 54, teachers: 4, subjects: 4, curriculum: 'National', gender: 'Mixed' },
    { id: 2, name: 'Grade 8', stage: 'Middle School', sections: ['A', 'B'], students: 60, teachers: 4, subjects: 4, curriculum: 'International', gender: 'Boys' },
    { id: 3, name: 'Grade 9', stage: 'High School', sections: ['B'], students: 32, teachers: 3, subjects: 4, curriculum: 'National', gender: 'Girls' },
];

const initialAssignments = {
    students: [
        { id: 1, student: 'Ali Youssef', class: 'Grade 7', section: 'A', stage: 'Middle School' },
    ],
    subjects: [
        { id: 1, subject: 'Mathematics', class: 'Grade 7', section: 'A' },
    ],
    supervisors: [
        { id: 1, supervisor: 'Khaled Omar', stage: 'Middle School', classesCount: 2 },
    ],
    teachers: [
        { id: 1, teacher: 'Ahmed Mahmoud', subject: 'Mathematics', class: 'Grade 7', section: 'A' },
    ]
};

export const useAppStore = () => {
    const [teachers, setTeachers] = useState(() => JSON.parse(localStorage.getItem('sms_teachers')) || initialTeachers);
    const [students, setStudents] = useState(() => JSON.parse(localStorage.getItem('sms_students')) || initialStudents);
    const [supervisors, setSupervisors] = useState(() => JSON.parse(localStorage.getItem('sms_supervisors')) || initialSupervisors);
    const [classes, setClasses] = useState(() => JSON.parse(localStorage.getItem('sms_classes')) || initialClasses);
    const [assignments, setAssignments] = useState(() => JSON.parse(localStorage.getItem('sms_assignments')) || initialAssignments);

    useEffect(() => {
        localStorage.setItem('sms_teachers', JSON.stringify(teachers));
    }, [teachers]);

    useEffect(() => {
        localStorage.setItem('sms_students', JSON.stringify(students));
    }, [students]);

    useEffect(() => {
        localStorage.setItem('sms_supervisors', JSON.stringify(supervisors));
    }, [supervisors]);

    useEffect(() => {
        localStorage.setItem('sms_classes', JSON.stringify(classes));
    }, [classes]);

    useEffect(() => {
        localStorage.setItem('sms_assignments', JSON.stringify(assignments));
    }, [assignments]);

    return {
        teachers, setTeachers,
        students, setStudents,
        supervisors, setSupervisors,
        classes, setClasses,
        assignments, setAssignments
    };
};
