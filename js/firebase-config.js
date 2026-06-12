// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Replace with your app's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAknt6HT1HB3JKFo3FlnQpq0rohQ7cBdY0",
  authDomain: "enroute-baec2.firebaseapp.com",
  projectId: "enroute-baec2",
  storageBucket: "enroute-baec2.firebasestorage.app",
  messagingSenderId: "840253279947",
  appId: "1:840253279947:web:3c8d239ebcbb0f5631d54e",
  measurementId: "G-4DHDHZ2KX4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);
