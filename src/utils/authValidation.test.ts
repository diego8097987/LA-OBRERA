import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapFirebaseAuthError,
  normalizeEmail,
  validateEmail,
  validateNewPassword,
  validatePasswordForSignIn,
  validateStaffRegistration,
} from './authValidation';

test('normalizeEmail trims and lowercases safely', () => {
  assert.equal(normalizeEmail('  Mesero1@LaObrera.MX  '), 'mesero1@laobrera.mx');
});

test('validateEmail accepts valid emails and rejects malformed ones', () => {
  assert.equal(validateEmail('cocina@laobrera.com').valid, true);
  assert.equal(validateEmail('').valid, false);
  assert.equal(validateEmail('sin-arroba').valid, false);
  assert.equal(validateEmail('usuario@dominio').valid, false);
});

test('validateNewPassword enforces minimum length and alphanumeric complexity', () => {
  assert.equal(validateNewPassword('Obrera2026').valid, true);
  assert.equal(validateNewPassword('abc1234').valid, false);
  assert.equal(validateNewPassword('sololetras').valid, false);
  assert.equal(validateNewPassword('12345678').valid, false);
  assert.equal(validateNewPassword('a'.repeat(130) + '1').valid, false);
});

test('validatePasswordForSignIn rejects empty or oversized input', () => {
  assert.equal(validatePasswordForSignIn('secret12').valid, true);
  assert.equal(validatePasswordForSignIn('').valid, false);
  assert.equal(validatePasswordForSignIn('x'.repeat(200)).valid, false);
});

test('validateStaffRegistration checks name, email, password, and confirmation match', () => {
  const ok = validateStaffRegistration({
    displayName: 'Carlos Ramírez',
    email: 'cajero@laobrera.com',
    password: 'Password123',
    confirmPassword: 'Password123',
  });
  assert.equal(ok.valid, true);

  const mismatch = validateStaffRegistration({
    displayName: 'Carlos Ramírez',
    email: 'cajero@laobrera.com',
    password: 'Password123',
    confirmPassword: 'Password999',
  });
  assert.equal(mismatch.valid, false);

  const shortName = validateStaffRegistration({
    displayName: 'A',
    email: 'cajero@laobrera.com',
    password: 'Password123',
  });
  assert.equal(shortName.valid, false);
});

test('mapFirebaseAuthError prevents account enumeration across credential failures', () => {
  const m1 = mapFirebaseAuthError({ code: 'auth/invalid-credential' });
  const m2 = mapFirebaseAuthError({ code: 'auth/wrong-password' });
  const m3 = mapFirebaseAuthError({ code: 'auth/user-not-found' });
  assert.equal(m1, m2);
  assert.equal(m2, m3);
  assert.match(m1, /Correo o contraseña incorrectos/);

  const notAllowed = mapFirebaseAuthError({ code: 'auth/operation-not-allowed' });
  assert.match(notAllowed, /Firebase Console/);
});
