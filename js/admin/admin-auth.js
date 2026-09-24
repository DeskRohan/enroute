import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginForm = document.getElementById('admin-login-form');
const errorMessage = document.getElementById('error-message');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('admin-logout-btn');

// Admin Login Logic
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
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
                    // Check if Super Admin assigned a password directly for this admin
                    const userQ = query(collection(db, "users"), where("email", "==", email));
                    const userSnap = await getDocs(userQ);

                    if (!userSnap.empty) {
                        const targetDoc = userSnap.docs[0];
                        const targetData = targetDoc.data();

                        if (targetData.role === 'admin' && targetData.assignedPassword && targetData.assignedPassword === password) {
                            // The admin entered the exact password set by the Super Admin!
                            // Ensure Firebase Auth session exists for Firestore security rules
                            try {
                                userCredential = await createUserWithEmailAndPassword(auth, email, password);
                            } catch (createErr) {
                                if (createErr.code === 'auth/email-already-in-use') {
                                    // User already exists in Firebase Auth.
                                    // Sign in with the master admin auth credentials so a valid Firebase Auth session is active
                                    try {
                                        userCredential = await signInWithEmailAndPassword(auth, 'admin@enroute.in', 'enroute2026');
                                    } catch (_) {
                                        // If master admin signIn fails, proceed with session
                                    }
                                } else {
                                    throw createErr;
                                }
                            }

                            // Store admin identity and role in localStorage
                            localStorage.setItem('userRole', 'admin');
                            localStorage.setItem('adminEmail', targetData.email);
                            localStorage.setItem('adminUid', targetDoc.id);

                            if (!targetData.name) {
                                promptForAdminName(targetDoc.id, () => {
                                    window.location.href = 'dashboard.html';
                                });
                            } else {
                                window.location.href = 'dashboard.html';
                            }
                            return;
                        }
                    }
                    throw err;
                }
            }
            
            const user = userCredential.user;

            // Verify Admin Role
            const userDocRef = doc(db, 'users', user.uid);
            let userDoc = await getDoc(userDocRef);

            // Fallback search by email if UID doc doesn't match directly
            if (!userDoc.exists()) {
                const qEmail = query(collection(db, "users"), where("email", "==", user.email));
                const snapEmail = await getDocs(qEmail);
                if (!snapEmail.empty) {
                    userDoc = snapEmail.docs[0];
                }
            }
            
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                const userData = userDoc.data();
                localStorage.setItem('userRole', 'admin');
                localStorage.setItem('adminEmail', user.email);
                localStorage.setItem('adminUid', userDoc.id);
                
                if (!userData.name) {
                    promptForAdminName(userDoc.id, () => {
                        window.location.href = 'dashboard.html';
                    });
                } else {
                    window.location.href = 'dashboard.html';
                }
            } else {
                // Not an admin
                await signOut(auth);
                localStorage.removeItem('userRole');
                localStorage.removeItem('adminEmail');
                localStorage.removeItem('adminUid');
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
        const storedRole = localStorage.getItem('userRole');
        const storedEmail = localStorage.getItem('adminEmail');

        if (!user && !(storedRole === 'admin' && storedEmail)) {
            if (!window.location.pathname.endsWith('/admin/login.html')) {
                window.location.href = 'login.html';
            }
            return;
        }

        // Fast check
        if (storedRole === 'admin') {
            if (storedEmail && storedEmail !== 'admin@enroute.in') {
                const currentPath = window.location.pathname;
                document.querySelectorAll('a[href="users.html"]').forEach(el => el.style.display = 'none');
                if (currentPath.endsWith('users.html')) {
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
            const userData = userDoc.data();
            localStorage.setItem('userRole', 'admin');
            localStorage.setItem('adminEmail', user.email);
            localStorage.setItem('adminUid', userDoc.id);
            
            if (!userData.name && window.location.pathname.endsWith('dashboard.html')) {
                promptForAdminName(user.uid);
            }

            if (user.email !== 'admin@enroute.in') {
                const currentPath = window.location.pathname;
                document.querySelectorAll('a[href="users.html"]').forEach(el => el.style.display = 'none');
                if (currentPath.endsWith('users.html')) {
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
            localStorage.removeItem('adminUid');
            window.location.href = 'login.html';
        });
    });
}

// Mobile Logout Listener for hardcoded button
document.addEventListener('DOMContentLoaded', () => {
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                localStorage.removeItem('userRole');
                localStorage.removeItem('adminEmail');
                localStorage.removeItem('adminUid');
                window.location.href = 'login.html';
            });
        });
    }
});

const promptForAdminName = (uid, onSuccess) => {
    if (document.getElementById('name-prompt-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'name-prompt-modal';
    overlay.innerHTML = `
        <style>
            #name-prompt-modal {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
                z-index: 100000; display: flex; align-items: center; justify-content: center;
            }
            .name-modal-content {
                background: #ffffff; padding: 2.5rem; border-radius: 16px;
                max-width: 400px; width: 90%; text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;
                color: #111827;
            }
            .name-modal-content h3 { margin-bottom: 1rem; font-size: 1.5rem; color: #111827; }
            .name-modal-content p { color: #6b7280; margin-bottom: 1.5rem; font-size: 0.9rem; }
            .name-modal-content input {
                width: 100%; padding: 0.8rem 1rem; margin-bottom: 1.5rem; border-radius: 8px;
                border: 1px solid #d1d5db; background: #f9fafb;
                color: #111827; font-size: 1rem;
            }
            .name-modal-content button {
                width: 100%; padding: 0.8rem; border: none; border-radius: 8px;
                background: #3b82f6; color: #fff; font-size: 1rem; font-weight: 600;
                cursor: pointer; transition: opacity 0.2s;
            }
            .name-modal-content button:hover { opacity: 0.9; }
        </style>
        <div class="name-modal-content">
            <h3>Welcome, Admin!</h3>
            <p>Please provide your full name to proceed.</p>
            <input type="text" id="new-admin-name" placeholder="Enter your full name" required>
            <button id="save-admin-name-btn">Continue</button>
            <p id="admin-name-error" style="color: #ef4444; font-size: 0.85rem; display: none; margin-top: 0.5rem;">Please enter a valid name.</p>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('save-admin-name-btn').addEventListener('click', async () => {
        const nameInput = document.getElementById('new-admin-name').value.trim();
        const errorEl = document.getElementById('admin-name-error');
        
        if (!nameInput || nameInput.length < 2) {
            errorEl.style.display = 'block';
            return;
        }

        const btn = document.getElementById('save-admin-name-btn');
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            await updateDoc(doc(db, 'users', uid), {
                name: nameInput
            });
            overlay.remove();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Error updating name:", error);
            errorEl.textContent = "Failed to save. Please try again.";
            errorEl.style.display = 'block';
            btn.textContent = 'Continue';
            btn.disabled = false;
        }
    });
};
