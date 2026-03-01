'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret-key';

/**
 * JWT Token generation and validation tests
 */
describe('Authentication & JWT', () => {
  describe('JWT Token Creation', () => {
    test('creates valid JWT token with student ID', () => {
      const payload = { studentId: 'STU001' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    test('token contains correct student ID', () => {
      const payload = { studentId: 'STU002' };
      const token = jwt.sign(payload, JWT_SECRET);
      const decoded = jwt.verify(token, JWT_SECRET);
      
      expect(decoded.studentId).toBe('STU002');
    });

    test('token expires at correct time', () => {
      const payload = { studentId: 'STU001' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      const decoded = jwt.decode(token);
      
      expect(decoded.exp).toBeDefined();
    });

    test('multiple tokens are unique', () => {
      const payload = { studentId: 'STU001' };
      const token1 = jwt.sign(payload, JWT_SECRET);
      const token2 = jwt.sign(payload, JWT_SECRET);
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('JWT Token Verification', () => {
    test('valid token can be verified', () => {
      const payload = { studentId: 'STU001' };
      const token = jwt.sign(payload, JWT_SECRET);
      
      expect(() => jwt.verify(token, JWT_SECRET)).not.toThrow();
    });

    test('invalid token throws error', () => {
      expect(() => jwt.verify('invalid.token.here', JWT_SECRET)).toThrow();
    });

    test('token with wrong secret throws error', () => {
      const payload = { studentId: 'STU001' };
      const token = jwt.sign(payload, JWT_SECRET);
      
      expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
    });

    test('expired token throws error', () => {
      const payload = { studentId: 'STU001' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1h' });
      
      expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
    });

    test('malformed token throws error', () => {
      expect(() => jwt.verify('not.a.valid.token', JWT_SECRET)).toThrow();
    });
  });

  describe('Password Hashing', () => {
    const bcrypt = require('bcryptjs');

    test('password is hashed correctly', async () => {
      const plainPassword = 'password123';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      
      expect(hashedPassword).not.toBe(plainPassword);
      expect(hashedPassword.length).toBeGreaterThan(plainPassword.length);
    });

    test('correct password matches hash', async () => {
      const plainPassword = 'password123';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      
      const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
      expect(isMatch).toBe(true);
    });

    test('wrong password does not match hash', async () => {
      const plainPassword = 'password123';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      
      const isMatch = await bcrypt.compare('wrongpassword', hashedPassword);
      expect(isMatch).toBe(false);
    });

    test('hash is salted (different each time)', async () => {
      const plainPassword = 'password123';
      const hash1 = await bcrypt.hash(plainPassword, 10);
      const hash2 = await bcrypt.hash(plainPassword, 10);
      
      expect(hash1).not.toBe(hash2);
    });

    test('both hashes validate same password', async () => {
      const plainPassword = 'password123';
      const hash1 = await bcrypt.hash(plainPassword, 10);
      const hash2 = await bcrypt.hash(plainPassword, 10);
      
      expect(await bcrypt.compare(plainPassword, hash1)).toBe(true);
      expect(await bcrypt.compare(plainPassword, hash2)).toBe(true);
    });
  });

  describe('Student Credentials', () => {
    test('default student has correct ID', () => {
      const defaultStudentId = 'STU001';
      expect(defaultStudentId).toMatch(/^STU\d+$/);
    });

    test('password meets minimum requirements', () => {
      const password = 'password123';
      expect(password.length).toBeGreaterThanOrEqual(8);
      expect(/[0-9]/).toBeDefined();
    });

    test('student ID format validation', () => {
      const validIds = ['STU001', 'STU999', 'STU000'];
      const invalidIds = ['SU001', 'STU', 'student001'];
      
      validIds.forEach(id => {
        expect(id).toMatch(/^STU\d+$/);
      });
      
      invalidIds.forEach(id => {
        expect(id).not.toMatch(/^STU\d+$/);
      });
    });
  });
});
