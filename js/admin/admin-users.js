import { db, auth } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const tableBody = document.getElementById('users-table-body');
const searchInput = document.getElementById('search-user');

let allUsers = [];

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
                    <select class="form-control role-select" data-id="${user.id}" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.875rem;" ${isCurrent ? 'disabled' : ''}>
                        <option value="customer" ${user.role === 'customer' || !user.role ? 'selected' : ''}>Customer</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;

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
