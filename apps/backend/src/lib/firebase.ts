import admin from 'firebase-admin';

let initialized = false;

export function getFirebaseAdmin(): admin.app.App {
  if (initialized) return admin.app();

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? 'boti-saas' });
  }

  initialized = true;
  return admin.app();
}

export async function verifyFirebaseToken(token: string): Promise<admin.auth.DecodedIdToken | null> {
  try {
    return await getFirebaseAdmin().auth().verifyIdToken(token);
  } catch {
    return null;
  }
}

export async function setFirebaseCustomClaims(uid: string, claims: Record<string, any>): Promise<void> {
  try {
    await getFirebaseAdmin().auth().setCustomUserClaims(uid, claims);
  } catch {
    // Non-fatal: claims are supplementary, role is stored in DB
  }
}
