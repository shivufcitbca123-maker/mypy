export const student = {
    id: 'ST102',
    name: 'Aarav Sharma',
    initials: 'AS',
    department: 'Computer Science',
    semester: 'Semester 4',
    attendance: 64,
    dbms: 49,
    python: 58,
    java: 55,
    assignments: 2,
    feedback: 'DBMS practical sessions are difficult and I need more practice.',
    status: 'Support Required',
    followUp: { attendance: 76, dbms: 63, assignments: 0 },
}

export const kpis = [
    { label: 'Total students', value: '300', change: '+12 this term', tone: 'blue' },
    { label: 'Average attendance', value: '78.4%', change: '+3.8% vs last month', tone: 'cyan' },
    { label: 'Academic health', value: '82%', change: '+6.4% vs last month', tone: 'green' },
    { label: 'Active concerns', value: '17', change: '4 need review today', tone: 'amber' },
]

export const trendData = [
    { day: 'Mon', attendance: 73, academic: 68 }, { day: 'Tue', attendance: 76, academic: 71 },
    { day: 'Wed', attendance: 74, academic: 74 }, { day: 'Thu', attendance: 80, academic: 76 },
    { day: 'Fri', attendance: 78, academic: 79 }, { day: 'Sat', attendance: 82, academic: 82 },
    { day: 'Sun', attendance: 84, academic: 85 },
]

export const campusAreas = [
    { name: 'Computer Science', meta: '82 students', score: 84, icon: '⌘', tone: 'blue' },
    { name: 'Library', meta: 'Low noise · 92%', score: 92, icon: '▤', tone: 'green' },
    { name: 'Engineering Block', meta: '3 open concerns', score: 71, icon: '⌁', tone: 'amber' },
    { name: 'Science Labs', meta: 'Stable · 88%', score: 88, icon: '◈', tone: 'cyan' },
    { name: 'Hostel', meta: '1 wellbeing case', score: 76, icon: '⌂', tone: 'amber' },
    { name: 'Cafeteria', meta: 'Healthy · 95%', score: 95, icon: '◌', tone: 'green' },
]

export const students = [
    student,
    { id: 'ST105', name: 'Meera Iyer', initials: 'MI', department: 'Computer Science', semester: 'Semester 4', attendance: 91, academic: 88, status: 'Stable' },
    { id: 'ST118', name: 'Kabir Nair', initials: 'KN', department: 'Engineering', semester: 'Semester 6', attendance: 72, academic: 67, status: 'Monitor' },
    { id: 'ST121', name: 'Riya Menon', initials: 'RM', department: 'Science', semester: 'Semester 2', attendance: 84, academic: 79, status: 'Stable' },
    { id: 'ST136', name: 'Dev Patel', initials: 'DP', department: 'Engineering', semester: 'Semester 6', attendance: 61, academic: 55, status: 'Support Required' },
]

export const interventions = [
    { title: 'DBMS practical mentoring', student: 'Aarav Sharma · ST102', owner: 'Dr. Priya Nair', status: 'In progress', due: 'Oct 04', tone: 'blue' },
    { title: 'Attendance review', student: 'Dev Patel · ST136', owner: 'Faculty team', status: 'New', due: 'Oct 06', tone: 'amber' },
    { title: 'Assignment completion check', student: 'Meera Iyer · ST105', owner: 'Prof. Rao', status: 'Follow-up', due: 'Oct 09', tone: 'green' },
]

export const notifications = [
    { type: 'Attendance alert', text: 'ST102 attendance dropped below threshold.', time: '12 min ago', tone: 'red' },
    { type: 'Academic signal', text: 'DBMS performance requires attention.', time: '38 min ago', tone: 'amber' },
    { type: 'Positive update', text: 'ST105 completed all pending assignments.', time: '1 hr ago', tone: 'green' },
]