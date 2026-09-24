import { db, auth } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const tableBody = document.getElementById('users-table-body');
const searchInput = document.getElementById('search-user');

let allUsers = [];

const showNotificationToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    toast.style = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: ${isSuccess ? '#0f172a' : '#ef4444'}; color: white; padding: 12px 24px; border-radius: 30px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); z-index: 99999; animation: slideDownToast 0.3s ease, fadeOutToast 0.3s ease 3.7s forwards; border: 1px solid rgba(255,255,255,0.2); font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 8px;`;
    toast.innerHTML = `${isSuccess ? '✅' : '⚠️'} ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
};

const showSetPasswordModal = ({ targetUid, targetEmail, targetName, onSuccess }) => {
    const existing = document.getElementById('enroute-set-password-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'enroute-set-password-modal';
    overlay.style = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(8px); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 1rem;";
    overlay.innerHTML = `
        <div style="background: #ffffff; padding: 2rem; border-radius: 18px; width: 100%; max-width: 440px; color: #0f172a; box-shadow: 0 25px 60px rgba(0,0,0,0.25); border: 1px solid #e2e8f0; animation: fadeIn 0.2s ease; font-family: 'Plus Jakarta Sans', sans-serif;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                <div style="display: flex; align-items: center; gap: 0.65rem;">
                    <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(37, 99, 235, 0.1); color: #2563eb; display: flex; align-items: center; justify-content: center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #0f172a;">Set Admin Password</h3>
                        <p style="margin: 0; font-size: 0.8rem; color: #64748b;">Direct password update for admin</p>
                    </div>
                </div>
                <button type="button" id="modal-close-x" style="background: transparent; border: none; font-size: 1.5rem; line-height: 1; color: #94a3b8; cursor: pointer; padding: 4px;">&times;</button>
            </div>

            <!-- Target Admin Info Card -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: #2563eb; color: #ffffff; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    ${(targetName || 'A').charAt(0).toUpperCase()}
                </div>
                <div style="overflow: hidden;">
                    <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${targetName || 'Admin'}</div>
                    <div style="font-size: 0.8rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${targetEmail}</div>
                </div>
            </div>

            <form id="set-password-form" autocomplete="off">
                <!-- New Password Field -->
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem;">New Password</label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="password" id="input-new-pw" required minlength="6" placeholder="Enter new password (min. 6 chars)" style="width: 100%; padding: 0.75rem 2.5rem 0.75rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; font-family: inherit; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#cbd5e1'">
                        <button type="button" class="pw-toggle-btn" data-target="input-new-pw" style="position: absolute; right: 0.75rem; background: none; border: none; cursor: pointer; color: #64748b; padding: 0; display: flex; align-items: center;" title="Show/Hide Password">
                            <svg class="eye-open" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <svg class="eye-closed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        </button>
                    </div>
                </div>

                <!-- Confirm Password Field -->
                <div style="margin-bottom: 1.15rem;">
                    <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem;">Confirm New Password</label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="password" id="input-confirm-pw" required minlength="6" placeholder="Re-enter new password" style="width: 100%; padding: 0.75rem 2.5rem 0.75rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; font-family: inherit; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#cbd5e1'">
                        <button type="button" class="pw-toggle-btn" data-target="input-confirm-pw" style="position: absolute; right: 0.75rem; background: none; border: none; cursor: pointer; color: #64748b; padding: 0; display: flex; align-items: center;" title="Show/Hide Password">
                            <svg class="eye-open" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <svg class="eye-closed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        </button>
                    </div>
                </div>

                <!-- Info Notice -->
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.65rem 0.85rem; margin-bottom: 1.25rem; font-size: 0.78rem; color: #1e40af; line-height: 1.45; display: flex; align-items: flex-start; gap: 6px;">
                    <span style="font-size: 0.9rem; line-height: 1;">💡</span>
                    <span>No email link will be sent. The new password is set directly and can be used immediately to log in.</span>
                </div>

                <!-- Error Message -->
                <div id="modal-pw-error" style="display: none; background: #fef2f2; border: 1px solid #fecaca; color: #ef4444; padding: 0.6rem 0.85rem; border-radius: 8px; font-size: 0.82rem; font-weight: 600; margin-bottom: 1rem;"></div>

                <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                    <button type="button" id="modal-pw-cancel" class="btn btn-outline" style="padding: 0.65rem 1.25rem; font-size: 0.88rem;">Cancel</button>
                    <button type="submit" id="modal-pw-submit" class="btn" style="padding: 0.65rem 1.45rem; font-size: 0.88rem; background: #2563eb; color: #ffffff; border: none; border-radius: 8px; font-weight: 700;">Save Password</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    // Eye toggle handlers
    overlay.querySelectorAll('.pw-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const eyeOpen = btn.querySelector('.eye-open');
            const eyeClosed = btn.querySelector('.eye-closed');
            if (input.type === 'password') {
                input.type = 'text';
                eyeOpen.style.display = 'none';
                eyeClosed.style.display = 'block';
            } else {
                input.type = 'password';
                eyeOpen.style.display = 'block';
                eyeClosed.style.display = 'none';
            }
        });
    });

    const closeOverlay = () => overlay.remove();
    overlay.querySelector('#modal-close-x').addEventListener('click', closeOverlay);
    overlay.querySelector('#modal-pw-cancel').addEventListener('click', closeOverlay);

    const form = overlay.querySelector('#set-password-form');
    const errorBox = overlay.querySelector('#modal-pw-error');
    const submitBtn = overlay.querySelector('#modal-pw-submit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const p1 = document.getElementById('input-new-pw').value.trim();
        const p2 = document.getElementById('input-confirm-pw').value.trim();

        if (p1.length < 6) {
            errorBox.textContent = 'Password must be at least 6 characters.';
            errorBox.style.display = 'block';
            return;
        }
        if (p1 !== p2) {
            errorBox.textContent = 'Passwords do not match. Please re-check.';
            errorBox.style.display = 'block';
            return;
        }

        errorBox.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
            await updateDoc(doc(db, "users", targetUid), {
                assignedPassword: p1,
                passwordLastSetAt: serverTimestamp(),
                passwordLastSetBy: 'admin@enroute.in'
            });

            closeOverlay();
            showNotificationToast(`New password set successfully for ${targetName}!`, 'success');
            if (onSuccess) onSuccess(p1);
        } catch (err) {
            console.error('Error saving new password:', err);
            errorBox.textContent = 'Failed to save password: ' + (err.message || 'Unknown error');
            errorBox.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Password';
        }
    });
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    // Handle string ISO dates or Firestore timestamps
    const date = typeof timestamp === 'string' ? new Date(timestamp) : (timestamp.toDate ? timestamp.toDate() : new Date(timestamp));
    return date.toLocaleDateString();
};

const loadUsers = async () => {
    try {
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTable(allUsers);
    } catch (error) {
        console.error("Error loading users:", error);
        // Fallback without order by if index is missing
        try {
             const snapshot2 = await getDocs(collection(db, "users"));
             allUsers = snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }));
             renderTable(allUsers);
        } catch(err2) {
             tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load users</td></tr>`;
        }
    }
};

const renderTable = (users) => {
    if (users.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">No users found.</td></tr>`;
        return;
    }

    let html = '';
    const currentUserId = auth.currentUser ? auth.currentUser.uid : null;
    const adminEmail = localStorage.getItem('adminEmail');
    const isSuperAdmin = adminEmail === 'admin@enroute.in';

    users.forEach(user => {
        const isCurrent = user.uid === currentUserId;
        const roleColor = user.role === 'admin' ? 'var(--color-primary)' : 'var(--text-secondary)';
        
        html += `
            <tr>
                <td style="font-family: monospace; font-size: 0.875rem;">${user.uid.slice(0, 8)}...</td>
                <td>${user.email} ${isCurrent ? '<span class="text-secondary" style="font-size: 0.75rem;">(You)</span>' : ''}</td>
                <td style="color: ${roleColor}; text-transform: capitalize; font-weight: 500;">${user.role || 'customer'}</td>
                <td>${formatDate(user.createdAt)}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <select class="form-control role-select" data-id="${user.id}" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.875rem;" ${isCurrent ? 'disabled' : ''}>
                            <option value="customer" ${user.role === 'customer' || !user.role ? 'selected' : ''}>Customer</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                        ${(isSuperAdmin && user.role === 'admin' && user.email !== 'admin@enroute.in') ? `
                            <button type="button" class="btn btn-sm btn-outline user-reset-pw-btn" data-email="${user.email}" data-name="${user.name || 'Admin'}" data-id="${user.id}" title="Set new password for ${user.email}" style="padding: 0.25rem 0.55rem; font-size: 0.75rem; border-color: #cbd5e1; display: inline-flex; align-items: center; gap: 4px; font-weight: 700;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                Set PW
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;

    // Attach password reset listeners
    document.querySelectorAll('.user-reset-pw-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetEmail = btn.getAttribute('data-email');
            const targetName = btn.getAttribute('data-name');
            const targetId = btn.getAttribute('data-id');

            showSetPasswordModal({
                targetUid: targetId,
                targetEmail,
                targetName,
                onSuccess: () => {
                    const u = allUsers.find(x => x.id === targetId);
                    if (u) {
                        u.passwordLastSetAt = new Date();
                    }
                }
            });
        });
    });

    // Attach role change listeners
    document.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const userId = e.target.getAttribute('data-id');
            const newRole = e.target.value;
            
            try {
                e.target.disabled = true;
                await updateDoc(doc(db, "users", userId), {
                    role: newRole
                });
                // Update local array
                const u = allUsers.find(x => x.id === userId);
                if (u) u.role = newRole;
                e.target.disabled = false;
                
                // Slight visual feedback
                e.target.parentElement.previousElementSibling.previousElementSibling.textContent = newRole;
                e.target.parentElement.previousElementSibling.previousElementSibling.style.color = newRole === 'admin' ? 'var(--color-primary)' : 'var(--text-secondary)';
                
            } catch (error) {
                console.error("Error updating role:", error);
                alert("Failed to update user role.");
                e.target.disabled = false;
                // Revert select visually
                e.target.value = newRole === 'admin' ? 'customer' : 'admin';
            }
        });
    });
};

// Search Filter
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allUsers.filter(user => 
        user.email.toLowerCase().includes(term) || 
        user.uid.toLowerCase().includes(term)
    );
    renderTable(filtered);
});

document.addEventListener('DOMContentLoaded', loadUsers);
