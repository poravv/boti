import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  onAuthStateChanged,
  type User,
  connectAuthEmulator,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);

  // Only connect to emulator when explicitly opted in (VITE_FIREBASE_USE_EMULATOR=true)
  // Default is to use the real Firebase project
  if (import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true') {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  }
}

export { auth };

export const isFirebaseEnabled = !!firebaseConfig.apiKey;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<User> {
  if (!auth) throw new Error('Firebase no configurado.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase no configurado.');
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase no configurado.');
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(result.user);
  return result.user;
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function resetPassword(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase no configurado.');
  await sendPasswordResetEmail(auth, email);
}

export async function firebaseSignOut(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export async function getIdToken(): Promise<string | null> {
  if (!auth?.currentUser) return null;
  return auth.currentUser.getIdToken();
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}

// ─── Phone / OTP ──────────────────────────────────────────────────────────────

export function createRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  if (!auth) throw new Error('Firebase no configurado.');
  return new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
}

export async function sendOtp(phone: string, recaptcha: RecaptchaVerifier): Promise<ConfirmationResult> {
  if (!auth) throw new Error('Firebase no configurado.');
  return signInWithPhoneNumber(auth, phone, recaptcha);
}

export { GoogleAuthProvider, PhoneAuthProvider };
