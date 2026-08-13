import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { GoogleAuthProvider, getAuth, type Auth } from "firebase/auth";

const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

/**
 * True when the Firebase web config is present. Google sign-in is optional —
 * without these vars the button never renders and email/password still works.
 */
export const googleSignInEnabled = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId
);

/** Reuses the existing app across fast-refresh reloads instead of re-initialising. */
export function getFirebaseAuth(): Auth {
  const app = getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}

export function googleProvider() {
  const provider = new GoogleAuthProvider();
  // Always let the user pick an account rather than silently reusing the last one.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
