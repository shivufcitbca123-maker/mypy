const accountSeeds = [
  {
    id: 'demo-admin',
    email: 'admin@aicampus360.com',
    password: 'Admin@360',
    role: 'admin',
    name: 'Campus Admin',
  },
  {
    id: 'demo-faculty',
    email: 'faculty@aicampus360.com',
    password: 'Faculty@360',
    role: 'faculty',
    name: 'Dr. Priya Nair',
    assignedStudentIds: ['ST102', 'ST105', 'ST136'],
  },
  {
    id: 'demo-student',
    email: 'student@aicampus360.com',
    password: 'Student@360',
    role: 'student',
    name: 'Aarav Sharma',
    studentId: 'ST102',
  },
  {
    id: 'demo-parent',
    email: 'parent@aicampus360.com',
    password: 'Parent@360',
    role: 'parent',
    name: 'Aarav Sharma’s Parent/Guardian',
    linkedStudentId: 'ST102',
  },
  {
    id: 'legacy-admin',
    email: 'demo@aicampus360.com',
    password: 'Demo@360',
    role: 'admin',
    name: 'Campus Admin',
  },
]

export const demoAccounts = accountSeeds
  .filter((account) => account.id !== 'legacy-admin')
  .map(({ email, password, role, name }) => ({ email, password, role, name }))

export const dashboardPaths = {
  admin: '/admin/dashboard',
  faculty: '/faculty/dashboard',
  student: '/student/dashboard',
  parent: '/parent/dashboard',
}

export function canAccessStudent(user, studentId) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'faculty') return user.assignedStudentIds.includes(studentId)
  if (user.role === 'student') return user.studentId === studentId
  if (user.role === 'parent') return user.linkedStudentId === studentId
  return false
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
