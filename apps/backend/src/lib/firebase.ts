import admin from 'firebase-admin';

let initialized = false;

export function getFirebaseAdmin(): admin.app.App {
  if (initialized) return admin.app();

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID ?? 'boti-saas';

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Without a service account, initialize with a no-op credential to avoid ADC
    // timeout in non-GCP environments. verifyIdToken only needs Google's public keys
    // (fetched via HTTPS), not the service account credential.
    // setCustomUserClaims will silently fail — that's acceptable (role is stored in DB).
    admin.initializeApp({
      projectId,
      credential: {
        getAccessToken: () =>
          Promise.resolve({ access_token: 'no-service-account', expires_in: 86400 }),
      } as admin.credential.Credential,
    });
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
