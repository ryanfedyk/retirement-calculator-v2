"use client";
/**
 * Firebase client initialization.
 *
 * Reads the public web-app config from NEXT_PUBLIC_FIREBASE_* env vars. These
 * values are safe to expose to the browser — Firestore access is gated by
 * security rules (see firestore.rules), not by hiding the config.
 *
 * The app authenticates with Google + email/password and stores each user's
 * Horizon configuration under users/{uid} in Firestore.
 */
import { getApps, getApp, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";

const env = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True once the env vars are populated. Lets the UI show a helpful message
 *  instead of throwing when Firebase hasn't been configured yet. */
export const firebaseConfigured = Boolean(env.apiKey && env.projectId && env.appId);

// When unconfigured, initialize with harmless placeholders so getAuth() doesn't
// throw at module load. All auth/db calls are gated behind firebaseConfigured,
// so these placeholders are never exercised against the network.
const firebaseConfig = firebaseConfigured
  ? env
  : {
      apiKey:        "missing-api-key",
      authDomain:    "missing.firebaseapp.com",
      projectId:     "missing",
      appId:         "missing",
    };

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);

// `ignoreUndefinedProperties` so writes don't throw when an optional field is
// undefined (e.g. a holding with no expected_return) — that was silently
// failing the save and flipping the app to "offline". initializeFirestore must
// run once before getFirestore; fall back if it's already initialized (HMR).
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app);
  }
})();
export default app;
