// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, set, get, child, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZbZQVRROhDQ5EP2CxBX0RwHhy5cwdpwQ",
  authDomain: "vu-present.firebaseapp.com",
  databaseURL: "https://vu-present-default-rtdb.firebaseio.com",
  projectId: "vu-present",
  storageBucket: "vu-present.firebasestorage.app",
  messagingSenderId: "816157816064",
  appId: "1:816157816064:web:cec50d401fba2df3792fe5"
};

let app, auth, db;
let isFirebaseInitialized = false;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    isFirebaseInitialized = true;
} catch (error) {
    console.warn("Firebase initialization failed. The app will work in offline-only mode.", error);
}

export { auth, db, isFirebaseInitialized, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, ref, set, get, child, update };
