import https from 'https';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'boti-saas';
const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// ─── Public key cache ────────────────────────────────────────────────────────

let cachedKeys: Record<string, string> = {};
let keyCacheExpiry = 0;

function fetchPublicKeys(): Promise<Record<string, string>> {
  if (Date.now() < keyCacheExpiry && Object.keys(cachedKeys).length > 0) {
    return Promise.resolve(cachedKeys);
  }
  return new Promise((resolve, reject) => {
    https
      .get(CERT_URL, (res) => {
        let raw = '';
        const maxAgeMatch = res.headers['cache-control']?.match(/max-age=(\d+)/);
        const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 3600;
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          cachedKeys = JSON.parse(raw);
          keyCacheExpiry = Date.now() + maxAge * 1000;
          resolve(cachedKeys);
        });
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

// ─── Token types ─────────────────────────────────────────────────────────────

export interface FirebaseDecodedToken {
  uid: string;
  email?: string;
  name?: string;
}

// ─── Token verification (no service account needed) ──────────────────────────
// Firebase ID tokens are standard RS256 JWTs. We verify them using Google's
// public keys directly — the same thing firebase-admin does internally.
// This works in any environment without ADC or a service account.

export async function verifyFirebaseToken(idToken: string): Promise<FirebaseDecodedToken | null> {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const keys = await fetchPublicKeys();
    const publicKey = keys[header.kid as string];

    if (!publicKey) {
      console.error('[firebase] No public key found for kid:', header.kid);
      return null;
    }

    const decoded = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience: PROJECT_ID,
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    }) as Record<string, unknown>;

    return {
      uid: decoded.sub as string,
      email: decoded.email as string | undefined,
      name: decoded.name as string | undefined,
    };
  } catch (e) {
    console.error('[firebase] verifyFirebaseToken failed:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ─── Custom claims (requires service account — silently skipped without one) ──

let adminInitialized = false;

function getFirebaseAdmin(): admin.app.App | null {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) return null;
  if (adminInitialized) return admin.app();
  try {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccountJson)) });
    adminInitialized = true;
    return admin.app();
  } catch {
    return null;
  }
}

export async function setFirebaseCustomClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
  try {
    const app = getFirebaseAdmin();
    if (!app) return;
    await app.auth().setCustomUserClaims(uid, claims);
  } catch {
    // Non-fatal: claims are supplementary, role is stored in DB
  }
}
