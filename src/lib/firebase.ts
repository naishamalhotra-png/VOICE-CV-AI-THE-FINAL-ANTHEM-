/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const isKeysSetup = 
  firebaseConfig &&
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "MY_FIREBASE_API_KEY" && 
  firebaseConfig.apiKey.trim() !== "";

let app;
let auth: any;
let googleProvider: any;

if (isKeysSetup) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    console.log("🔥 Successfully initialized production Google Firebase Web SDK Client with " + firebaseConfig.projectId);
  } catch (err) {
    console.warn("⚠️ Firebase Initialization fell back during build checks.", err);
  }
}

// Custom mock user for instant sandbox demo support when Firebase is not connected
export interface WebUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Universal Auth Controller supporting both live Firebase Authentication and sandbox developer mocks
export const firebaseAuthHelper = {
  isLive: isKeysSetup,
  
  // Dynamic auth callback listener
  onUserChanged: (callback: (user: WebUser | null) => void) => {
    if (isKeysSetup && auth) {
      return onAuthStateChanged(auth, (user: FirebaseUser | null) => {
        if (user) {
          callback({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email?.split("@")[0] || "User",
            photoURL: user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80"
          });
        } else {
          callback(null);
        }
      });
    } else {
      // Local check mock session
      const saved = localStorage.getItem("voice_cv_mock_auth");
      if (saved) {
        callback(JSON.parse(saved));
      } else {
        callback(null);
      }
      return () => {}; // return unsubscriber stub
    }
  },

  // Auth: Email registration/creation
  registerWithEmail: async (email: string, pass: string): Promise<WebUser> => {
    if (isKeysSetup && auth) {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      return {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.email?.split("@")[0] || "User",
        photoURL: null
      };
    } else {
      // Safe simulator
      const mockResult: WebUser = {
        uid: "mock_usr_" + Math.random().toString(36).substring(2, 12),
        email,
        displayName: email.split("@")[0],
        photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80"
      };
      localStorage.setItem("voice_cv_mock_auth", JSON.stringify(mockResult));
      return mockResult;
    }
  },

  // Auth: Email standard Login
  loginWithEmail: async (email: string, pass: string): Promise<WebUser> => {
    if (isKeysSetup && auth) {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      return {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || cred.user.email?.split("@")[0] || "User",
        photoURL: null
      };
    } else {
      const mockResult: WebUser = {
        uid: "mock_usr_existing",
        email,
        displayName: email.split("@")[0],
        photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80"
      };
      localStorage.setItem("voice_cv_mock_auth", JSON.stringify(mockResult));
      return mockResult;
    }
  },

  // Auth: Google Sign-in Popup
  loginWithGoogle: async (): Promise<WebUser> => {
    if (isKeysSetup && auth && googleProvider) {
      const result = await signInWithPopup(auth, googleProvider);
      return {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL
      };
    } else {
      const mockResult: WebUser = {
        uid: "mock_google_user",
        email: "guest.developer@example.com",
        displayName: "Guest Developer",
        photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80"
      };
      localStorage.setItem("voice_cv_mock_auth", JSON.stringify(mockResult));
      return mockResult;
    }
  },

  // Auth: Sign Out
  logoutSession: async () => {
    if (isKeysSetup && auth) {
      await signOut(auth);
    } else {
      localStorage.removeItem("voice_cv_mock_auth");
    }
  }
};
