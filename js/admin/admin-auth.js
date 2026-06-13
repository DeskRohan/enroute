import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginForm = document.getElementById('admin-login-form');
const errorMessage = document.getElementById('error-message');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('admin-logout-btn');

// Admin Login Logic
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        errorMessage.style.display = 'none';
        loginBtn.textContent = 'Verifying...';
        loginBtn.disabled = true;

        try {
            let userCredential;
            try {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            } catch (err) {
                // Auto-provision master admin if it doesn't exist
                if (email === 'admin@enroute.in' && password === 'enroute2026') {
                    try {
                        userCredential = await createUserWithEmailAndPassword(auth, email, password);
                        // Setup admin role in Firestore
                        await setDoc(doc(db, 'users', userCredential.user.uid), {
                            uid: userCredential.user.uid,
                            email: userCredential.user.email,
                            role: 'admin',
                            createdAt: new Date().toISOString()
                        });
                    } catch (createErr) {
                        console.error("Auto-provision error:", createErr);
                        if (createErr.code === 'auth/email-already-in-use') {
                            throw err; // It means wrong password for existing user
                        }
                        throw createErr;
                    }
                } else {
                    throw err;
                }
            }
            
            const user = userCredential.user;

            // Verify Admin Role
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                localStorage.setItem('userRole', 'admin');
                localStorage.setItem('adminEmail', user.email);
                window.location.href = 'dashboard.html';
            } else {
                // Not an admin
                await signOut(auth);
                localStorage.removeItem('userRole');
                localStorage.removeItem('adminEmail');
                throw new Error('Unauthorized Access');
            }
        } catch (error) {
            console.error(error);
            errorMessage.textContent = error.message === 'Unauthorized Access' 
                ? 'Access denied. Admin privileges required.' 
                : (error.code ? `Error: ${error.code.replace('auth/', '')}` : 'Invalid credentials.');
            errorMessage.style.display = 'block';
            loginBtn.textContent = 'Authenticate';
            loginBtn.disabled = false;
        }
    });
}

// Global Admin Protection
export const requireAdmin = () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            if (!window.location.pathname.endsWith('/admin/login.html')) {
                window.location.href = 'login.html';
            }
            return;
        }

        // Fast check
        if (localStorage.getItem('userRole') === 'admin') {
            const adminEmail = localStorage.getItem('adminEmail');
            if (adminEmail && adminEmail !== 'admin@enroute.in') {
                const currentPath = window.location.pathname;
                document.querySelectorAll('a[href="orders.html"], a[href="users.html"], a[href="reports.html"]').forEach(el => el.style.display = 'none');
                if (currentPath.endsWith('orders.html') || currentPath.endsWith('users.html') || currentPath.endsWith('reports.html')) {
                    window.location.href = 'dashboard.html';
                    return;
                }
            }
            return; // Proceed
        }

        // Verify with DB
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists() && userDoc.data().role === 'admin') {
            localStorage.setItem('userRole', 'admin');
            localStorage.setItem('adminEmail', user.email);
            
            if (user.email !== 'admin@enroute.in') {
                const currentPath = window.location.pathname;
                document.querySelectorAll('a[href="orders.html"], a[href="users.html"], a[href="reports.html"]').forEach(el => el.style.display = 'none');
                if (currentPath.endsWith('orders.html') || currentPath.endsWith('users.html') || currentPath.endsWith('reports.html')) {
                    window.location.href = 'dashboard.html';
                }
            }
        } else {
            // Kick out
            window.location.href = '../index.html';
        }
    });
};

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            localStorage.removeItem('userRole');
            localStorage.removeItem('adminEmail');
            window.location.href = 'login.html';
        });
    });
}
