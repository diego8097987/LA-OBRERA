import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  sendEmailVerification,
  setPersistence,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const BOOTSTRAP_ADMIN_EMAIL = 'd.olivares.imilenio@gmail.com';

/**
 * Provisions a new Firebase Auth Email/Password user inside an ephemeral,
 * in-memory secondary Firebase App so the currently signed-in Admin session
 * is never interrupted and no secondary credentials touch browser storage.
 */
export async function provisionStaffAuthAccount(
  email: string,
  password: string,
  displayName: string
): Promise<{ uid: string; email: string }> {
  const tempAppName = `staff-provisioner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const secondaryApp = initializeApp(firebaseConfig, tempAppName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await updateProfile(cred.user, { displayName });
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Non-fatal if verification email delivery is rate-limited; user can resend on first sign-in
    }
    const uid = cred.user.uid;
    const createdEmail = cred.user.email || email;
    await signOut(secondaryAuth);
    return { uid, email: createdEmail };
  } finally {
    await deleteApp(secondaryApp).catch(() => undefined);
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function logFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export function extractFriendlyErrorMessage(
  error: unknown,
  fallback: string = 'No se pudo completar la operación.'
): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!raw) return fallback;

  let candidate = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
    if (parsed && typeof parsed.error === 'string') {
      candidate = parsed.error;
    }
  } catch {
    // Plain error message
  }

  const lower = candidate.toLowerCase();
  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions')) {
    return 'Acceso denegado por las reglas de seguridad. Verifica que tu perfil y la caja estén autorizados.';
  }
  if (lower.includes('quota')) {
    return 'Se alcanzó temporalmente el límite diario gratuito de la base de datos. Intenta más tarde.';
  }
  if (lower.includes('unavailable') || lower.includes('network') || lower.includes('offline')) {
    return 'Sin conexión temporal con la base de datos. Verifica tu internet e intenta de nuevo.';
  }
  return candidate;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = logFirestoreError(error, operationType, path);
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
