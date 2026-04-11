export const classesData = [
    { id: 1, name: 'Grade 7', section: 'A', subject: 'Mathematics', students: 28, days: 'Mon, Wed, Thu' },
    { id: 2, name: 'Grade 7', section: 'B', subject: 'Mathematics', students: 26, days: 'Mon, Tue, Fri' },
    { id: 3, name: 'Grade 8', section: 'A', subject: 'Mathematics', students: 30, days: 'Tue, Wed, Thu' },
    { id: 4, name: 'Grade 8', section: 'C', subject: 'Mathematics', students: 25, days: 'Mon, Thu, Fri' },
    { id: 5, name: 'Grade 9', section: 'B', subject: 'Mathematics', students: 32, days: 'Mon, Wed, Fri' },
];

export const studentsData = [
    { id: 'S1001', name: 'Ali Youssef', className: 'Grade 7', section: 'A', average: 88, attendance: 95 },
    { id: 'S1002', name: 'Sara Kamel', className: 'Grade 7', section: 'A', average: 92, attendance: 98 },
    { id: 'S1003', name: 'Omar Said', className: 'Grade 7', section: 'A', average: 58, attendance: 82 },
    { id: 'S1004', name: 'Laila Mahmoud', className: 'Grade 7', section: 'B', average: 95, attendance: 100 },
    { id: 'S1005', name: 'Yusuf Nasser', className: 'Grade 7', section: 'B', average: 62, attendance: 75 },
    { id: 'S1006', name: 'Rana Khalil', className: 'Grade 8', section: 'A', average: 65, attendance: 80 },
    { id: 'S1007', name: 'Hana Samir', className: 'Grade 8', section: 'A', average: 78, attendance: 68 },
    { id: 'S1008', name: 'Tariq Mansour', className: 'Grade 8', section: 'B', average: 71, attendance: 71 },
    { id: 'S1009', name: 'Dina Rashid', className: 'Grade 8', section: 'B', average: 82, attendance: 70 },
    { id: 'S1010', name: 'Ahmad Faris', className: 'Grade 9', section: 'B', average: 60, attendance: 78 },
];

export const examsData = [
    {
        id: 'E1',
        name: 'Q1 Math Term Test',
        date: '2024-10-15',
        type: 'Midterm',
        className: 'Grade 7',
        section: 'A',
        status: 'Upcoming',
        submitted: false,
        questions: [
            { id: 'q1_e1', text: 'Solve: 3x + 5 = 20', videoUrl: 'https://www.youtube.com/watch?v=l3XzepN03KQ' },
            { id: 'q2_e1', text: 'Find the area of a rectangle with length 8cm and width 5cm', videoUrl: 'https://www.youtube.com/watch?v=7Uos1ED3KHI' },
            { id: 'q3_e1', text: 'Simplify: 4(2x - 3) + 5x', videoUrl: 'https://www.youtube.com/watch?v=fGThIRpWEE4' }
        ]
    },
    {
        id: 'E2',
        name: 'Algebra Quiz 1',
        date: '2024-10-10',
        type: 'Quiz',
        className: 'Grade 7',
        section: 'B',
        status: 'Today',
        submitted: false,
        questions: [
            { id: 'q1_e2', text: 'Evaluate: 2x² when x = 3', videoUrl: 'https://www.youtube.com/watch?v=NybHckSEQBI' },
            { id: 'q2_e2', text: 'Solve the equation: 2x - 7 = 13', videoUrl: 'https://www.youtube.com/watch?v=l3XzepN03KQ' }
        ]
    },
    {
        id: 'E3',
        name: 'Geometry Basics',
        date: '2024-09-25',
        type: 'Assignment',
        className: 'Grade 8',
        section: 'A',
        status: 'Past',
        submitted: true,
        questions: [
            { id: 'q1_e3', text: 'Find the perimeter of a triangle with sides 5, 7, and 9', videoUrl: 'https://www.youtube.com/watch?v=7Uos1ED3KHI' },
            { id: 'q2_e3', text: 'Calculate the area of a circle with radius 6cm', videoUrl: 'https://www.youtube.com/watch?v=fGThIRpWEE4' },
            { id: 'q3_e3', text: 'What is the sum of interior angles of a pentagon?', videoUrl: 'https://www.youtube.com/watch?v=NybHckSEQBI' },
            { id: 'q4_e3', text: 'Find the hypotenuse of a right triangle with legs 3 and 4', videoUrl: 'https://www.youtube.com/watch?v=l3XzepN03KQ' }
        ]
    },
    {
        id: 'E4',
        name: 'Calculus Intro',
        date: '2024-09-20',
        type: 'Final',
        className: 'Grade 9',
        section: 'B',
        status: 'Past',
        submitted: true,
        questions: [
            { id: 'q1_e4', text: 'Find the derivative of f(x) = x²', videoUrl: 'https://www.youtube.com/watch?v=fGThIRpWEE4' },
            { id: 'q2_e4', text: 'Evaluate the limit as x→2 of (x²-4)/(x-2)', videoUrl: 'https://www.youtube.com/watch?v=NybHckSEQBI' }
        ]
    },
];

export const recentGradesData = [
    { id: 1, studentName: 'Ali Youssef', exam: 'Geometry Basics', score: 85, badge: 'success', date: '2024-09-28' },
    { id: 2, studentName: 'Omar Said', exam: 'Geometry Basics', score: 68, badge: 'warning', date: '2024-09-28' },
    { id: 3, studentName: 'Fatima Zahra', exam: 'Calculus Intro', score: 98, badge: 'success', date: '2024-09-25' },
];

export const scheduleData = [
    { time: '08:00 - 08:45', sun: { name: 'Grade 7', section: 'A', room: 'Room 101' }, mon: { name: 'Grade 7', section: 'A', room: 'Room 101' }, tue: { name: 'Grade 8', section: 'A', room: 'Room 103' }, wed: { name: 'Grade 8', section: 'A', room: 'Room 103' }, thu: { name: 'Grade 9', section: 'B', room: 'Room 105' } },
    { time: '09:00 - 09:45', sun: { name: 'Grade 7', section: 'B', room: 'Room 102' }, mon: { name: 'Grade 7', section: 'B', room: 'Room 102' }, tue: null, wed: { name: 'Grade 9', section: 'B', room: 'Room 105' }, thu: { name: 'Grade 8', section: 'C', room: 'Room 104' } },
    { time: '10:00 - 10:45', break: true },
    { time: '11:00 - 11:45', sun: null, mon: { name: 'Grade 8', section: 'C', room: 'Room 104' }, tue: { name: 'Grade 7', section: 'A', room: 'Room 101' }, wed: { name: 'Grade 7', section: 'B', room: 'Room 102' }, thu: null },
    { time: '12:00 - 12:45', sun: { name: 'Grade 9', section: 'B', room: 'Room 105' }, mon: null, tue: { name: 'Grade 8', section: 'C', room: 'Room 104' }, wed: null, thu: { name: 'Grade 7', section: 'A', room: 'Room 101' } }
];

export const performanceData = [
    { name: 'Jan', score: 72 },
    { name: 'Feb', score: 75 },
    { name: 'Mar', score: 80 },
    { name: 'Apr', score: 82 },
    { name: 'May', score: 85 },
    { name: 'Jun', score: 88 },
];

export const gradeDistribution = [
    { name: 'A (90-100)', value: 45, color: '#16a34a' },
    { name: 'B (80-89)', value: 80, color: '#1d4ed8' },
    { name: 'C (70-79)', value: 35, color: '#ea580c' },
    { name: 'D/F (<70)', value: 10, color: '#dc2626' },
];
