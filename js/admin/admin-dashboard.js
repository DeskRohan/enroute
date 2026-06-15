import { db, auth } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, where, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const MAIN_ADMIN_EMAIL = 'admin@enroute.in';

const statRevenue = document.getElementById('stat-revenue');
const statOrders = document.getElementById('stat-orders');
const statProducts = document.getElementById('stat-products');
const statUsers = document.getElementById('stat-users');
const recentOrdersBody = document.getElementById('recent-orders-body');

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(price);
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
};

const loadStats = async () => {
    try {
        const adminEmail = localStorage.getItem('adminEmail');
        const isSuperAdmin = adminEmail === MAIN_ADMIN_EMAIL;

        // 1. Get Products Count
        const productsSnap = await getDocs(collection(db, "products"));
        if (isSuperAdmin) {
            statProducts.textContent = productsSnap.size;
        } else {
            let ownCount = 0;
            productsSnap.forEach(doc => {
                if (doc.data().addedBy === adminEmail) ownCount++;
            });
            statProducts.textContent = ownCount;
        }

        // 2. Get Users Count
        if (isSuperAdmin) {
            const usersSnap = await getDocs(collection(db, "users"));
            statUsers.textContent = usersSnap.size;
        } else {
            statUsers.textContent = "N/A";
        }

        // 3. Get Orders & Revenue
        if (isSuperAdmin) {
            const ordersSnap = await getDocs(collection(db, "orders"));
            statOrders.textContent = ordersSnap.size;
            
            let totalRev = 0;
            ordersSnap.forEach(doc => {
                totalRev += Number(doc.data().amount || 0);
            });
            statRevenue.textContent = formatPrice(totalRev);
        } else {
            statOrders.textContent = "N/A";
            statRevenue.textContent = "N/A";
        }

    } catch (error) {
        console.error("Error loading stats:", error);
    }
};

const loadRecentOrders = async () => {
    try {
        const adminEmail = localStorage.getItem('adminEmail');
        if (adminEmail !== MAIN_ADMIN_EMAIL) {
            recentOrdersBody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">Not available for your role</td></tr>`;
            return;
        }

        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            recentOrdersBody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">No orders yet</td></tr>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const order = doc.data();
            html += `
                <tr>
                    <td style="font-family: monospace;">#${doc.id.slice(0, 8)}</td>
                    <td>
                        <div>${order.customerName || 'N/A'}</div>
                        <div class="text-secondary" style="font-size: 0.75rem;">${order.email}</div>
                    </td>
                    <td>${order.productName}</td>
                    <td class="color-primary" style="font-weight: 600;">${formatPrice(order.amount)}</td>
                    <td>${formatDate(order.createdAt)}</td>
                </tr>
            `;
        });
        recentOrdersBody.innerHTML = html;

    } catch (error) {
        console.error("Error loading recent orders:", error);
        recentOrdersBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading orders</td></tr>`;
    }
};

const loadVerifications = async () => {
    const adminEmail = localStorage.getItem('adminEmail');
    const isSuperAdmin = adminEmail === MAIN_ADMIN_EMAIL;

    if (isSuperAdmin) {
        document.getElementById('pending-verifications-card').style.display = 'block';
        const list = document.getElementById('pending-verifications-list');
        
        try {
            const q = query(collection(db, "users"), where("verificationStatus", "==", "pending"));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                list.innerHTML = '<p class="text-secondary">No pending verifications.</p>';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const user = doc.data();
                html += `
                    <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; border: 1px solid var(--color-border); margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0; color: var(--text-primary);">${user.name || 'Unknown'}</h4>
                            <p style="margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">${user.email}</p>
                            <p style="margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">Phone: ${user.phone || 'N/A'}</p>
                            <p style="margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">Address: ${user.address || 'N/A'}</p>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <button class="btn btn-primary approve-btn" data-id="${doc.id}" style="padding: 0.4rem 1rem; font-size: 0.85rem;">Approve</button>
                            <button class="btn btn-outline reject-btn" data-id="${doc.id}" style="padding: 0.4rem 1rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Reject</button>
                        </div>
                    </div>
                `;
            });
            list.innerHTML = html;

            document.querySelectorAll('.approve-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    e.target.textContent = '...';
                    await updateDoc(doc(db, "users", id), {
                        isVerified: true,
                        verificationStatus: 'approved'
                    });
                    loadVerifications();
                });
            });

            document.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    showRejectModal(id);
                });
            });

        } catch (error) {
            console.error("Error loading verifications:", error);
            list.innerHTML = '<p class="text-danger">Failed to load verifications.</p>';
        }
    }
};

const showRejectModal = (userId) => {
    const overlay = document.createElement('div');
    overlay.style = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 100000; display: flex; align-items: center; justify-content: center;";
    overlay.innerHTML = `
        <div style="background: #ffffff; padding: 2rem; border-radius: 12px; width: 90%; max-width: 400px; color: #111827;">
            <h3 style="margin-top: 0;">Reject Verification</h3>
            <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 1rem;">Select a reason for rejecting this application.</p>
            <select id="reject-reason" style="width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid #d1d5db; margin-bottom: 1.5rem; background: #f9fafb; color: #111827;">
                <option value="Invalid phone number">Invalid phone number</option>
                <option value="Missing or invalid address">Missing or invalid address</option>
                <option value="Name mismatch">Name mismatch</option>
                <option value="Other (Please contact support)">Other</option>
            </select>
            <div style="display: flex; gap: 1rem;">
                <button id="cancel-reject" class="btn btn-outline" style="flex: 1; color: #111827; border-color: #d1d5db;">Cancel</button>
                <button id="confirm-reject" class="btn" style="flex: 1; background: #ef4444; color: white; border: none;">Reject</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('cancel-reject').addEventListener('click', () => overlay.remove());
    document.getElementById('confirm-reject').addEventListener('click', async () => {
        const reason = document.getElementById('reject-reason').value;
        const btn = document.getElementById('confirm-reject');
        btn.disabled = true;
        btn.textContent = 'Rejecting...';
        try {
            await updateDoc(doc(db, "users", userId), {
                verificationStatus: 'rejected',
                rejectReason: reason,
                isVerified: false
            });
            overlay.remove();
            loadVerifications();
        } catch (error) {
            console.error(error);
            alert("Error rejecting.");
            btn.disabled = false;
            btn.textContent = 'Reject';
        }
    });
};

const handleVerification = () => {
    const adminEmail = localStorage.getItem('adminEmail');
    const isSuperAdmin = adminEmail === MAIN_ADMIN_EMAIL;

    if (isSuperAdmin) {
        // Main admin is always verified — show tick badge next to heading
        const header = document.querySelector('.admin-main h1');
        if (header) {
            header.innerHTML = `Dashboard Overview <img src="../assets/images/varified.png" title="Verified Admin" style="height: 1em; vertical-align: middle; margin-left: 8px; display: inline-block;">`;
        }
    } else {
        document.getElementById('apply-verification-card').style.display = 'block';

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const docRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(docRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const badge = document.getElementById('admin-badge');
                    const form = document.getElementById('verification-form');
                    const pendingMsg = document.getElementById('ver-pending-msg');

                    if (userData.isVerified) {
                        badge.innerHTML = 'Verified <img src="../assets/images/varified.png" style="height: 1.2em; vertical-align: middle; display: inline-block;">';
                        badge.style.background = 'rgba(34, 197, 94, 0.1)';
                        badge.style.color = '#22c55e';
                    } else if (userData.verificationStatus === 'pending') {
                        badge.textContent = 'Pending';
                        badge.style.background = 'rgba(234, 179, 8, 0.1)';
                        badge.style.color = '#eab308';
                        pendingMsg.style.display = 'block';
                    } else if (userData.verificationStatus === 'rejected') {
                        badge.textContent = 'Rejected';
                        badge.style.background = 'rgba(239, 68, 68, 0.1)';
                        badge.style.color = '#ef4444';
                        pendingMsg.innerHTML = `<span style="color: #ef4444;">Your application was rejected: <strong>${userData.rejectReason || 'Invalid details'}</strong>. Please correct your details and apply again.</span>`;
                        pendingMsg.style.display = 'block';
                        form.style.display = 'flex';
                    } else {
                        form.style.display = 'flex';
                    }

                    const phoneInput = document.getElementById('ver-phone');
                    const addressInput = document.getElementById('ver-address');

                    if (userData.phone) phoneInput.value = userData.phone;
                    if (userData.address) addressInput.value = userData.address;

                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const btn = form.querySelector('button');
                        btn.disabled = true;
                        btn.textContent = 'Submitting...';

                        try {
                            await updateDoc(docRef, {
                                phone: phoneInput.value,
                                address: addressInput.value,
                                verificationStatus: 'pending'
                            });

                            form.style.display = 'none';
                            pendingMsg.innerHTML = 'Your verification request has been submitted and is pending approval.';
                            pendingMsg.style.display = 'block';
                            badge.textContent = 'Pending';
                            badge.style.background = 'rgba(234, 179, 8, 0.1)';
                            badge.style.color = '#eab308';
                        } catch (error) {
                            console.error(error);
                            alert("Failed to submit.");
                            btn.disabled = false;
                            btn.textContent = 'Apply for Verification';
                        }
                    });
                }
            }
        });
    }
};

const showWelcomeToast = async () => {
    if (!sessionStorage.getItem('welcomeShown')) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const docRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(docRef);
                const name = userDoc.exists() ? (userDoc.data().name || 'Admin') : 'Admin';

                const toast = document.createElement('div');
                toast.style = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #111827; color: white; padding: 12px 24px; border-radius: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; animation: slideDownToast 0.3s ease, fadeOutToast 0.3s ease 2.7s forwards; border: 1px solid #374151;";
                toast.innerHTML = `Welcome back, <strong>${name}</strong>! 👋`;
                document.body.appendChild(toast);

                const style = document.createElement('style');
                style.innerHTML = `
                    @keyframes slideDownToast { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
                    @keyframes fadeOutToast { from { opacity: 1; } to { opacity: 0; visibility: hidden; } }
                `;
                document.head.appendChild(style);

                sessionStorage.setItem('welcomeShown', 'true');
                setTimeout(() => toast.remove(), 3500);
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadRecentOrders();
    loadVerifications();
    handleVerification();
    showWelcomeToast();
});
