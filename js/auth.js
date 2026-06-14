import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, 
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const loginBtn = document.getElementById('nav-login-btn');
const dashBtn = document.getElementById('nav-dash-btn');

const showUserWelcomeToast = (name) => {
    const toast = document.createElement('div');
    toast.style = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: var(--bg-secondary, #111827); color: var(--text-primary, white); padding: 12px 24px; border-radius: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 999999; animation: slideDownToast 0.3s ease, fadeOutToast 0.3s ease 2.7s forwards; border: 1px solid var(--color-border, #374151);";
    toast.innerHTML = `Welcome back, <strong>${name}</strong>! 👋`;
    document.body.appendChild(toast);
    
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.innerHTML = `
            @keyframes slideDownToast { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
            @keyframes fadeOutToast { from { opacity: 1; } to { opacity: 0; visibility: hidden; } }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => toast.remove(), 3500);
};

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
            
            if (dashBtn) {
                dashBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ${userData.name || 'Profile'}`;
            }

            // First time login - ask for name
            if (!userData.name) {
                promptForName(user.uid);
            } else {
                if (!sessionStorage.getItem('welcomeShown')) {
                    sessionStorage.setItem('welcomeShown', 'true');
                    showUserWelcomeToast(userData.name);
                }
            }

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

// Prompt for name on first login
export const promptForName = (uid) => {
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
                background: var(--bg-primary, #1e1e2f); padding: 2.5rem; border-radius: 16px;
                max-width: 400px; width: 90%; text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.4); border: 1px solid var(--color-border, #333);
                color: var(--text-primary, #fff);
            }
            .name-modal-content h3 { margin-bottom: 1rem; font-size: 1.5rem; }
            .name-modal-content p { color: var(--text-secondary, #aaa); margin-bottom: 1.5rem; font-size: 0.9rem; }
            .name-modal-content input {
                width: 100%; padding: 0.8rem 1rem; margin-bottom: 1.5rem; border-radius: 8px;
                border: 1px solid var(--color-border, #444); background: var(--bg-secondary, #2a2a40);
                color: var(--text-primary, #fff); font-size: 1rem;
            }
            .name-modal-content button {
                width: 100%; padding: 0.8rem; border: none; border-radius: 8px;
                background: var(--color-primary, #3b82f6); color: #fff; font-size: 1rem; font-weight: 600;
                cursor: pointer; transition: opacity 0.2s;
            }
            .name-modal-content button:hover { opacity: 0.9; }
        </style>
        <div class="name-modal-content">
            <h3>Welcome to Enroute!</h3>
            <p>Please tell us your name to personalize your experience.</p>
            <input type="text" id="new-user-name" placeholder="Enter your full name" required>
            <button id="save-name-btn">Continue</button>
            <p id="name-error" style="color: #ef4444; font-size: 0.85rem; display: none; margin-top: 0.5rem;">Please enter a valid name.</p>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('save-name-btn').addEventListener('click', async () => {
        const nameInput = document.getElementById('new-user-name').value.trim();
        const errorEl = document.getElementById('name-error');
        
        if (!nameInput || nameInput.length < 2) {
            errorEl.style.display = 'block';
            return;
        }

        const btn = document.getElementById('save-name-btn');
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            await updateDoc(doc(db, 'users', uid), {
                name: nameInput
            });
            overlay.remove();
        } catch (error) {
            console.error("Error updating name:", error);
            errorEl.textContent = "Failed to save. Please try again.";
            errorEl.style.display = 'block';
            btn.textContent = 'Continue';
            btn.disabled = false;
        }
    });
};
