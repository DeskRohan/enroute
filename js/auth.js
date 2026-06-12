import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, 
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const loginBtn = document.getElementById('nav-login-btn');
const dashBtn = document.getElementById('nav-dash-btn');

// Listen for Auth State Changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        if (loginBtn) loginBtn.style.display = 'none';
        if (dashBtn) dashBtn.style.display = 'inline-flex';

        // Check role (Admin or Customer)
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            // Store role in local storage for quick checks
            localStorage.setItem('userRole', userData.role);
            
            // If on admin route but not admin, redirect
            if (window.location.pathname.includes('/admin/') && userData.role !== 'admin') {
                window.location.href = '../index.html';
            }
        }
    } else {
        // User is signed out
        if (loginBtn) loginBtn.style.display = 'inline-flex';
        if (dashBtn) dashBtn.style.display = 'none';
        localStorage.removeItem('userRole');

        // Protect specific routes
        const protectedRoutes = ['/dashboard.html', '/checkout.html', '/success.html', '/admin/'];
        const isProtected = protectedRoutes.some(route => window.location.pathname.includes(route));
        
        if (isProtected) {
            window.location.href = window.location.pathname.includes('/admin/') ? '../login.html' : 'login.html';
        }
    }
});

// Logout function
export const logoutUser = () => {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Logout error:', error);
    });
};

// Expose to window for inline onclick attributes if needed
window.logoutUser = logoutUser;
