import "server-only";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

// Admin access to the same Firebase project the client syncs to. On Firebase App
// Hosting the runtime service account supplies Application Default Credentials, so
// no key file is needed; locally this is unconfigured and callers should guard on
// isAdminConfigured() before using it. Init is lazy so importing this module never
// crashes a build.
function ensureApp() {
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
}

export function adminDb(): Firestore {
  ensureApp();
  return getFirestore();
}

export function adminAuth(): Auth {
  ensureApp();
  return getAuth();
}
