import { MAX_DISPLAY_NAME_LENGTH, sanitizeText } from './posCalculations';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 160;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface AuthValidationResult {
  valid: boolean;
  error?: string;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);
}

export function validateEmail(raw: string): AuthValidationResult {
  const email = normalizeEmail(raw);
  if (!email) {
    return { valid: false, error: 'Ingresa un correo electrónico.' };
  }
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Ingresa un correo electrónico válido (ejemplo@restaurante.com).' };
  }
  return { valid: true };
}

export function validatePasswordForSignIn(password: string): AuthValidationResult {
  if (!password) {
    return { valid: false, error: 'Ingresa tu contraseña.' };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: 'La contraseña excede la longitud máxima permitida.' };
  }
  return { valid: true };
}

export function validateNewPassword(password: string): AuthValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres.`,
    };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      valid: false,
      error: 'La contraseña debe incluir al menos una letra y un número.',
    };
  }
  return { valid: true };
}

export function validateStaffRegistration(input: {
  displayName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}): AuthValidationResult {
  const cleanName = sanitizeText(input.displayName, MAX_DISPLAY_NAME_LENGTH);
  if (cleanName.length < 2) {
    return { valid: false, error: 'Ingresa el nombre completo del empleado (mínimo 2 caracteres).' };
  }

  const emailCheck = validateEmail(input.email);
  if (!emailCheck.valid) return emailCheck;

  const passCheck = validateNewPassword(input.password);
  if (!passCheck.valid) return passCheck;

  if (typeof input.confirmPassword === 'string' && input.password !== input.confirmPassword) {
    return { valid: false, error: 'Las contraseñas no coinciden.' };
  }

  return { valid: true };
}

/**
 * Translates Firebase Auth error codes to safe Spanish messages.
 * Uses identical messaging for wrong-password / user-not-found / invalid-credential
 * to prevent account enumeration.
 */
export function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con este correo electrónico.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil. Usa al menos 8 caracteres con letras y números.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.';
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada por el administrador.';
    case 'auth/operation-not-allowed':
      return 'El acceso con Correo y Contraseña debe activarse en Firebase Console (Authentication → Sign-in method → Correo electrónico/contraseña).';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Se cerró la ventana de inicio de sesión antes de completar el acceso.';
    case 'auth/network-request-failed':
      return 'Sin conexión de red. Verifica tu internet e intenta nuevamente.';
    default:
      return 'No se pudo completar la autenticación. Intenta de nuevo.';
  }
}
