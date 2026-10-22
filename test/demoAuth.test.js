import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessStudent, demoAccounts, isValidEmail } from '../src/auth/demoAuth.js'

test('lists one fictional sign-in account per role without duplicates', () => {
  assert.equal(demoAccounts.length, 4)
  assert.equal(new Set(demoAccounts.map(({ email }) => email)).size, 4)
  assert.deepEqual(demoAccounts.map(({ role }) => role), ['admin', 'faculty', 'student', 'parent'])
  assert.equal(demoAccounts.every(({ email, password }) => email && password), true)
  assert.equal(isValidEmail('faculty@aicampus360.com'), true)
  assert.equal(isValidEmail('faculty-at-campus'), false)
})

test('keeps student, parent, and faculty route scopes linked to authorized records', () => {
  const student = { role: 'student', studentId: 'ST102' }
  const parent = { role: 'parent', linkedStudentId: 'ST102' }
  const faculty = { role: 'faculty', assignedStudentIds: ['ST102', 'ST105', 'ST136'] }
  assert.equal(canAccessStudent(student, 'ST102'), true)
  assert.equal(canAccessStudent(student, 'ST105'), false)
  assert.equal(canAccessStudent(parent, 'ST102'), true)
  assert.equal(canAccessStudent(parent, 'ST105'), false)
  assert.equal(canAccessStudent(faculty, 'ST102'), true)
  assert.equal(canAccessStudent(faculty, 'ST121'), false)
})
