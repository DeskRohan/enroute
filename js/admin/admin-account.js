import { auth, db } from '../firebase-config.js';
import { signOut, onAuthStateChanged, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const nameInput = document.getElementById('admin-name');
const emailInput = document.getElementById('admin-email');
const accountForm = document.getElementById('account-form');
const logoutBtn = document.getElementById('account-logout-btn');
const deleteBtn = document.getElementById('delete-account-btn');

let currentUser = null;
let currentAdminEmail = null;

// Load user data
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        currentAdminEmail = user.email;
        emailInput.value = user.email;
        
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                nameInput.value = userDoc.data().name || '';
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    } else {
        window.location.href = 'login.html';
    }
});

// Update Name
accountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const newName = nameInput.value.trim();
    const btn = document.getElementById('save-account-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            name: newName
        });
        alert('Name updated successfully!');
    } catch (error) {
        console.error("Error updating name:", error);
        alert('Failed to update name.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('adminEmail');
        window.location.href = 'login.html';
    });
});

// Delete Account
deleteBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    
    const isSuperAdmin = currentAdminEmail === 'admin@enroute.in';
    if (isSuperAdmin) {
        alert("The main admin account cannot be deleted.");
        return;
    }

    const confirmMsg = "Are you ABSOLUTELY sure? This will delete your account and ALL products you have uploaded permanently. This action cannot be undone.";
    if (!confirm(confirmMsg)) return;
    
    const doubleCheck = prompt('Type "DELETE" to confirm:');
    if (doubleCheck !== "DELETE") {
        alert("Account deletion cancelled.");
        return;
    }

    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    try {
        // 1. Delete all products uploaded by this admin
        const q = query(collection(db, "products"), where("addedBy", "==", currentAdminEmail));
        const snapshot = await getDocs(q);
        
        const deletePromises = snapshot.docs.map(productDoc => deleteDoc(doc(db, "products", productDoc.id)));
        await Promise.all(deletePromises);
        
        // 2. Delete user doc from firestore
        await deleteDoc(doc(db, "users", currentUser.uid));
        
        // 3. Delete auth user
        await deleteUser(currentUser);
        
        // Cleanup
        localStorage.removeItem('userRole');
        localStorage.removeItem('adminEmail');
        alert("Account and all associated products deleted successfully.");
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Error deleting account:", error);
        if (error.code === 'auth/requires-recent-login') {
            alert("Please logout and log back in to verify your identity before deleting your account.");
        } else {
            alert("An error occurred while deleting your account. Check console for details.");
        }
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete My Account';
    }
});
