import { db, auth } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, where, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
    }).format(price || 0);
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

        // 1. Get Products Count & Mapping
        const productsSnap = await getDocs(collection(db, "products"));
        const adminProductIds = [];
        const adminProductNames = [];

        productsSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (isSuperAdmin || data.addedBy === adminEmail) {
                adminProductIds.push(docSnap.id);
                if (data.name) adminProductNames.push(data.name);
            }
        });

        if (isSuperAdmin) {
            statProducts.textContent = productsSnap.size;
        } else {
            statProducts.textContent = adminProductIds.length;
        }

        // 2. Fetch Orders
        const ordersSnap = await getDocs(collection(db, "orders"));
        let matchingOrders = [];

        ordersSnap.forEach(docSnap => {
            const order = { id: docSnap.id, ...docSnap.data() };
            if (isSuperAdmin) {
                matchingOrders.push(order);
            } else {
                // Match by product ID, product name, or addedBy attribution
                const matchesId = order.productId && adminProductIds.includes(order.productId);
                const matchesName = order.productName && adminProductNames.includes(order.productName);
                const matchesCreator = order.addedBy === adminEmail;
                if (matchesId || matchesName || matchesCreator) {
                    matchingOrders.push(order);
                }
            }
        });

        // 3. Compute Total Revenue / Total Income & Total Orders
        let totalRevenue = 0;
        matchingOrders.forEach(order => {
            totalRevenue += Number(order.amount || 0);
        });

        statRevenue.textContent = formatPrice(totalRevenue);
        statOrders.textContent = matchingOrders.length;

        // 4. Users / Customers Count
        if (isSuperAdmin) {
            const usersSnap = await getDocs(collection(db, "users"));
            statUsers.textContent = usersSnap.size;
        } else {
            // Count unique customers who purchased this admin's products
            const uniqueCustomers = new Set();
            matchingOrders.forEach(o => {
                if (o.email) uniqueCustomers.add(o.email.toLowerCase());
            });
            statUsers.textContent = uniqueCustomers.size;
            const userTitle = statUsers.previousElementSibling;
            if (userTitle) userTitle.textContent = "Customer Base";
        }

    } catch (error) {
        console.error("Error loading stats:", error);
    }
};

const loadRecentOrders = async () => {
    try {
        const adminEmail = localStorage.getItem('adminEmail');
        const isSuperAdmin = adminEmail === MAIN_ADMIN_EMAIL;

        // Fetch products added by this admin for filtering
        const adminProductIds = [];
        const adminProductNames = [];

        if (!isSuperAdmin) {
            const prodQ = query(collection(db, "products"), where("addedBy", "==", adminEmail));
            const prodSnap = await getDocs(prodQ);
            prodSnap.forEach(docSnap => {
                adminProductIds.push(docSnap.id);
                if (docSnap.data().name) adminProductNames.push(docSnap.data().name);
            });
        }

        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            recentOrdersBody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">No orders found</td></tr>`;
            return;
        }

        let orders = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

        if (!isSuperAdmin) {
            // Filter orders belonging to this admin's products
            orders = orders.filter(order => {
                const matchesId = order.productId && adminProductIds.includes(order.productId);
                const matchesName = order.productName && adminProductNames.includes(order.productName);
                const matchesCreator = order.addedBy === adminEmail;
                return matchesId || matchesName || matchesCreator;
            });
        }

        if (orders.length === 0) {
            recentOrdersBody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">No orders yet for your uploaded products</td></tr>`;
            return;
        }

        // Take top 5
        const top5 = orders.slice(0, 5);
        let html = '';
        top5.forEach(order => {
            html += `
                <tr>
                    <td style="font-family: monospace;">#${order.id.slice(0, 8)}</td>
                    <td>
                        <div>${order.customerName || 'Customer'}</div>
                        <div class="text-secondary" style="font-size: 0.75rem;">${order.email || 'N/A'}</div>
                    </td>
                    <td>${order.productName || 'Mod Package'}</td>
                    <td style="font-weight: 700; color: var(--admin-primary);">${formatPrice(order.amount)}</td>
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
        const card = document.getElementById('pending-verifications-card');
        if (card) card.style.display = 'block';
        const list = document.getElementById('pending-verifications-list');
        if (!list) return;
        
        try {
            const q = query(collection(db, "users"), where("verificationStatus", "==", "pending"));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                list.innerHTML = '<p class="text-secondary">No pending verifications.</p>';
                return;
            }

            let html = '';
            snapshot.forEach(docSnap => {
                const user = docSnap.data();
                html += `
                    <div style="background: #ffffff; padding: 1rem; border-radius: 12px; border: 1px solid var(--admin-border); margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0; color: var(--admin-text-primary);">${user.name || 'Unknown'}</h4>
                            <p style="margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--admin-text-secondary);">${user.email}</p>
                            <p style="margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--admin-text-secondary);">Phone: ${user.phone || 'N/A'}</p>
                            <p style="margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--admin-text-secondary);">Address: ${user.address || 'N/A'}</p>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <button class="btn btn-primary approve-btn" data-id="${docSnap.id}" style="padding: 0.4rem 1rem; font-size: 0.85rem;">Approve</button>
                            <button class="btn btn-outline reject-btn" data-id="${docSnap.id}" style="padding: 0.4rem 1rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Reject</button>
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
        const header = document.querySelector('.admin-main h1');
        if (header) {
            header.innerHTML = `Dashboard Overview <img src="../assets/images/varified.png" title="Verified Admin" style="height: 1em; vertical-align: middle; margin-left: 8px; display: inline-block;">`;
        }
    } else {
        const applyCard = document.getElementById('apply-verification-card');
        if (applyCard) applyCard.style.display = 'block';

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
                        if (badge) {
                            badge.innerHTML = 'Verified <img src="../assets/images/varified.png" style="height: 1.2em; vertical-align: middle; display: inline-block;">';
                            badge.style.background = 'rgba(34, 197, 94, 0.1)';
                            badge.style.color = '#22c55e';
                        }
                    } else if (userData.verificationStatus === 'pending') {
                        if (badge) {
                            badge.textContent = 'Pending';
                            badge.style.background = 'rgba(234, 179, 8, 0.1)';
                            badge.style.color = '#eab308';
                        }
                        if (pendingMsg) pendingMsg.style.display = 'block';
                    } else if (userData.verificationStatus === 'rejected') {
                        if (badge) {
                            badge.textContent = 'Rejected';
                            badge.style.background = 'rgba(239, 68, 68, 0.1)';
                            badge.style.color = '#ef4444';
                        }
                        if (pendingMsg) {
                            pendingMsg.innerHTML = `<span style="color: #ef4444;">Your application was rejected: <strong>${userData.rejectReason || 'Invalid details'}</strong>. Please correct your details and apply again.</span>`;
                            pendingMsg.style.display = 'block';
                        }
                        if (form) form.style.display = 'flex';
                    } else {
                        if (form) form.style.display = 'flex';
                    }

                    const phoneInput = document.getElementById('ver-phone');
                    const addressInput = document.getElementById('ver-address');

                    if (phoneInput && userData.phone) phoneInput.value = userData.phone;
                    if (addressInput && userData.address) addressInput.value = userData.address;

                    if (form) {
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
                                if (pendingMsg) {
                                    pendingMsg.innerHTML = 'Your verification request has been submitted and is pending approval.';
                                    pendingMsg.style.display = 'block';
                                }
                                if (badge) {
                                    badge.textContent = 'Pending';
                                    badge.style.background = 'rgba(234, 179, 8, 0.1)';
                                    badge.style.color = '#eab308';
                                }
                            } catch (error) {
                                console.error(error);
                                alert("Failed to submit.");
                                btn.disabled = false;
                                btn.textContent = 'Apply for Verification';
                            }
                        });
                    }
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
                toast.style = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #0f172a; color: white; padding: 12px 24px; border-radius: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; animation: slideDownToast 0.3s ease, fadeOutToast 0.3s ease 2.7s forwards; border: 1px solid rgba(255,255,255,0.15); font-family: 'Plus Jakarta Sans', sans-serif;";
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

// =====================================================
// Admin Online / Offline Toggle System & Account Actions
// =====================================================

const showNotificationToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    toast.style = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: ${isSuccess ? '#0f172a' : '#ef4444'}; color: white; padding: 12px 24px; border-radius: 30px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); z-index: 99999; animation: slideDownToast 0.3s ease, fadeOutToast 0.3s ease 3.7s forwards; border: 1px solid rgba(255,255,255,0.2); font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 8px;`;
    toast.innerHTML = `${isSuccess ? '✅' : '⚠️'} ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
};

const showConfirmModal = ({ title, message, confirmText = 'Confirm', confirmStyle = 'danger', onConfirm }) => {
    const existing = document.getElementById('enroute-confirm-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'enroute-confirm-modal';
    overlay.style = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(6px); z-index: 100000; display: flex; align-items: center; justify-content: center;";
    overlay.innerHTML = `
        <div style="background: #ffffff; padding: 2rem; border-radius: 16px; width: 90%; max-width: 440px; color: #0f172a; box-shadow: 0 20px 50px rgba(0,0,0,0.2); animation: fadeIn 0.2s ease;">
            <h3 style="margin-top: 0; margin-bottom: 0.5rem; font-size: 1.25rem;">${title}</h3>
            <p style="font-size: 0.9rem; color: #64748b; line-height: 1.5; margin-bottom: 1.5rem;">${message}</p>
            <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button id="modal-cancel-btn" class="btn btn-outline" style="padding: 0.6rem 1.25rem; font-size: 0.88rem;">Cancel</button>
                <button id="modal-confirm-btn" class="btn" style="padding: 0.6rem 1.4rem; font-size: 0.88rem; background: ${confirmStyle === 'danger' ? '#ef4444' : '#2563eb'}; color: white; border: none; border-radius: 8px; font-weight: 700;">${confirmText}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#modal-cancel-btn').addEventListener('click', () => {
        overlay.remove();
    });

    overlay.querySelector('#modal-confirm-btn').addEventListener('click', async () => {
        const btn = overlay.querySelector('#modal-confirm-btn');
        btn.disabled = true;
        btn.textContent = 'Processing...';
        try {
            await onConfirm();
        } finally {
            overlay.remove();
        }
    });
};

export const showSetPasswordModal = ({ targetUid, targetEmail, targetName, onSuccess }) => {
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
                passwordLastSetBy: MAIN_ADMIN_EMAIL
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

const updateAdminProductsStock = async (adminEmail, setOffline) => {
    try {
        const prodQ = query(collection(db, "products"), where("addedBy", "==", adminEmail));
        const snap = await getDocs(prodQ);
        if (snap.empty) return 0;

        const docs = snap.docs;
        const chunkSize = 450;
        let updatedCount = 0;

        for (let i = 0; i < docs.length; i += chunkSize) {
            const chunk = docs.slice(i, i + chunkSize);
            const batch = writeBatch(db);
            let hasOps = false;

            chunk.forEach(docSnap => {
                const data = docSnap.data();
                if (setOffline) {
                    batch.update(docSnap.ref, {
                        outOfStock: true,
                        outOfStockReason: 'admin_offline'
                    });
                    hasOps = true;
                    updatedCount++;
                } else {
                    if (data.outOfStockReason === 'admin_offline') {
                        batch.update(docSnap.ref, {
                            outOfStock: false,
                            outOfStockReason: null
                        });
                        hasOps = true;
                        updatedCount++;
                    }
                }
            });

            if (hasOps) {
                await batch.commit();
            }
        }
        return updatedCount;
    } catch (err) {
        console.error('Error updating product stock status:', err);
        throw err;
    }
};

const initOnlineToggle = () => {
    const adminEmail = localStorage.getItem('adminEmail');
    const isSuperAdmin = adminEmail === MAIN_ADMIN_EMAIL;
    if (isSuperAdmin) return; // Super admin uses the control panel instead

    const card = document.getElementById('admin-status-card');
    const toggle = document.getElementById('online-toggle');
    const statusLabel = document.getElementById('status-label');
    const statusDesc = document.getElementById('status-description');
    const dotIndicator = document.getElementById('status-dot-indicator');
    const toggleStateText = document.getElementById('toggle-state-text');

    if (!card || !toggle) return;
    card.style.display = 'block';

    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.exists() ? userDoc.data() : {};

        // Default isOnline to true if not set
        const isOnline = userData.isOnline !== false;
        updateToggleUI(isOnline);

        toggle.addEventListener('change', async () => {
            const willBeOnline = toggle.checked;

            // Revert state temporarily until confirmed
            toggle.checked = !willBeOnline;

            if (!willBeOnline) {
                showConfirmModal({
                    title: 'Take Store Offline?',
                    message: 'Going offline will mark all your uploaded products as <strong>Out of Stock</strong>. Customers will not be able to purchase or download them until you go online again.',
                    confirmText: 'Go Offline',
                    confirmStyle: 'danger',
                    onConfirm: async () => {
                        toggle.disabled = true;
                        try {
                            await updateDoc(userRef, {
                                isOnline: false,
                                onlineToggledAt: serverTimestamp(),
                                onlineToggledBy: 'self'
                            });
                            await updateAdminProductsStock(adminEmail, true);
                            toggle.checked = false;
                            updateToggleUI(false);
                        } catch (err) {
                            console.error('Error toggling offline:', err);
                            alert('Failed to update status. Please try again.');
                        } finally {
                            toggle.disabled = false;
                        }
                    }
                });
            } else {
                showConfirmModal({
                    title: 'Bring Store Online?',
                    message: 'Going online will restore your products back to <strong>In Stock</strong> and make them available to customers immediately.',
                    confirmText: 'Go Online',
                    confirmStyle: 'primary',
                    onConfirm: async () => {
                        toggle.disabled = true;
                        try {
                            await updateDoc(userRef, {
                                isOnline: true,
                                onlineToggledAt: serverTimestamp(),
                                onlineToggledBy: 'self'
                            });
                            await updateAdminProductsStock(adminEmail, false);
                            toggle.checked = true;
                            updateToggleUI(true);
                        } catch (err) {
                            console.error('Error toggling online:', err);
                            alert('Failed to update status. Please try again.');
                        } finally {
                            toggle.disabled = false;
                        }
                    }
                });
            }
        });
    });

    function updateToggleUI(isOnline) {
        toggle.checked = isOnline;
        if (isOnline) {
            statusLabel.textContent = 'Online';
            statusLabel.style.color = '#10b981';
            dotIndicator.className = 'status-dot online';
            statusDesc.textContent = 'Your store is active and your uploaded products are visible and purchasable by customers.';
            toggleStateText.textContent = 'Active Online';
        } else {
            statusLabel.textContent = 'Offline';
            statusLabel.style.color = '#ef4444';
            dotIndicator.className = 'status-dot offline';
            statusDesc.textContent = 'Your store is currently offline. All your products are marked as Out of Stock.';
            toggleStateText.textContent = 'Offline (Paused)';
        }
    }
};

const loadAdminStatusControl = async () => {
    const adminEmail = localStorage.getItem('adminEmail');
    const isSuperAdmin = adminEmail === MAIN_ADMIN_EMAIL;
    if (!isSuperAdmin) return;

    const panel = document.getElementById('admin-control-panel');
    const list = document.getElementById('admin-status-list');
    if (!panel || !list) return;

    panel.style.display = 'block';

    try {
        const usersQ = query(collection(db, "users"), where("role", "==", "admin"));
        const usersSnap = await getDocs(usersQ);

        const prodsSnap = await getDocs(collection(db, "products"));
        const productCounts = {};
        prodsSnap.forEach(docSnap => {
            const p = docSnap.data();
            if (p.addedBy) {
                productCounts[p.addedBy] = (productCounts[p.addedBy] || 0) + 1;
            }
        });

        const admins = [];
        usersSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.email && data.email.toLowerCase() !== MAIN_ADMIN_EMAIL.toLowerCase()) {
                admins.push({ uid: docSnap.id, ...data });
            }
        });

        if (admins.length === 0) {
            list.innerHTML = '<p class="text-secondary" style="margin: 0; font-size: 0.9rem;">No other admins found in the database.</p>';
            return;
        }

        let html = '';
        admins.forEach(admin => {
            const isOnline = admin.isOnline !== false;
            const count = productCounts[admin.email] || 0;
            const statusClass = isOnline ? 'online' : 'offline';
            const statusText = isOnline ? 'Online' : 'Offline';
            const toggledBy = admin.onlineToggledBy ? (admin.onlineToggledBy === 'self' ? 'by self' : `by ${admin.onlineToggledBy}`) : '';
            const toggledAt = admin.onlineToggledAt ? formatDate(admin.onlineToggledAt) : '';
            const historyText = toggledAt ? `Last updated: ${toggledAt} ${toggledBy}` : 'Status: Default';
            const resetAt = admin.passwordLastSetAt ? ` &bull; PW set: ${formatDate(admin.passwordLastSetAt)}` : (admin.passwordResetSentAt ? ` &bull; PW Reset: ${formatDate(admin.passwordResetSentAt)}` : '');

            html += `
                <div class="admin-status-row" id="admin-row-${admin.uid}">
                    <div class="admin-meta">
                        <div class="admin-title">
                            <span class="status-dot ${statusClass}" id="dot-${admin.uid}"></span>
                            <span>${admin.name || 'Admin'}</span>
                            <span id="badge-${admin.uid}" style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: ${isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'}; color: ${isOnline ? '#059669' : '#dc2626'}; border: 1px solid ${isOnline ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}; margin-left: 4px;">
                                ${statusText}
                            </span>
                        </div>
                        <div class="admin-subtitle">${admin.email} &bull; <strong>${count}</strong> product${count === 1 ? '' : 's'}</div>
                        <div class="admin-history" id="history-${admin.uid}">${historyText}${resetAt}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
                        <button type="button" class="btn-reset-password admin-reset-pw-btn" data-uid="${admin.uid}" data-email="${admin.email}" data-name="${admin.name || 'Admin'}" title="Set new password for ${admin.email}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            <span>Set Password</span>
                        </button>
                        <div style="display: flex; align-items: center; gap: 0.6rem; padding-left: 0.5rem; border-left: 1px solid var(--admin-border);">
                            <span style="font-size: 0.82rem; font-weight: 700; color: ${isOnline ? '#059669' : '#dc2626'};" id="label-${admin.uid}">
                                ${isOnline ? 'Online' : 'Offline'}
                            </span>
                            <label class="toggle-switch">
                                <input type="checkbox" class="super-admin-toggle" data-uid="${admin.uid}" data-email="${admin.email}" data-name="${admin.name || 'Admin'}" ${isOnline ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
            `;
        });

        list.innerHTML = html;

        list.querySelectorAll('.admin-reset-pw-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetUid = btn.getAttribute('data-uid');
                const targetEmail = btn.getAttribute('data-email');
                const targetName = btn.getAttribute('data-name');

                showSetPasswordModal({
                    targetUid,
                    targetEmail,
                    targetName,
                    onSuccess: () => {
                        const history = document.getElementById(`history-${targetUid}`);
                        if (history) {
                            const baseHistory = history.textContent.split(' • PW')[0];
                            history.textContent = `${baseHistory} • PW set: Just now`;
                        }
                    }
                });
            });
        });

        list.querySelectorAll('.super-admin-toggle').forEach(input => {
            input.addEventListener('change', async () => {
                const targetUid = input.getAttribute('data-uid');
                const targetEmail = input.getAttribute('data-email');
                const targetName = input.getAttribute('data-name');
                const willBeOnline = input.checked;

                // Temporarily revert switch until confirmed
                input.checked = !willBeOnline;

                if (!willBeOnline) {
                    showConfirmModal({
                        title: `Set ${targetName} Offline?`,
                        message: `This will mark all products uploaded by <strong>${targetEmail}</strong> as <strong>Out of Stock</strong>. Customers will not be able to purchase or download them until set back online.`,
                        confirmText: 'Set Offline',
                        confirmStyle: 'danger',
                        onConfirm: async () => {
                            input.disabled = true;
                            try {
                                await updateDoc(doc(db, "users", targetUid), {
                                    isOnline: false,
                                    onlineToggledAt: serverTimestamp(),
                                    onlineToggledBy: MAIN_ADMIN_EMAIL
                                });
                                await updateAdminProductsStock(targetEmail, true);
                                input.checked = false;
                                updateAdminRowUI(targetUid, false);
                            } catch (err) {
                                console.error('Error overriding admin status:', err);
                                alert('Failed to update status.');
                            } finally {
                                input.disabled = false;
                            }
                        }
                    });
                } else {
                    showConfirmModal({
                        title: `Set ${targetName} Online?`,
                        message: `This will restore products uploaded by <strong>${targetEmail}</strong> back to <strong>In Stock</strong>, allowing customers to purchase them immediately.`,
                        confirmText: 'Set Online',
                        confirmStyle: 'primary',
                        onConfirm: async () => {
                            input.disabled = true;
                            try {
                                await updateDoc(doc(db, "users", targetUid), {
                                    isOnline: true,
                                    onlineToggledAt: serverTimestamp(),
                                    onlineToggledBy: MAIN_ADMIN_EMAIL
                                });
                                await updateAdminProductsStock(targetEmail, false);
                                input.checked = true;
                                updateAdminRowUI(targetUid, true);
                            } catch (err) {
                                console.error('Error overriding admin status:', err);
                                alert('Failed to update status.');
                            } finally {
                                input.disabled = false;
                            }
                        }
                    });
                }
            });
        });

    } catch (err) {
        console.error('Error loading admin status control:', err);
        list.innerHTML = '<p class="text-danger">Failed to load admin list.</p>';
    }

    function updateAdminRowUI(uid, isOnline) {
        const dot = document.getElementById(`dot-${uid}`);
        const badge = document.getElementById(`badge-${uid}`);
        const label = document.getElementById(`label-${uid}`);
        const history = document.getElementById(`history-${uid}`);

        if (dot) dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
        if (badge) {
            badge.textContent = isOnline ? 'Online' : 'Offline';
            badge.style.background = isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
            badge.style.color = isOnline ? '#059669' : '#dc2626';
            badge.style.borderColor = isOnline ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
        }
        if (label) {
            label.textContent = isOnline ? 'Online' : 'Offline';
            label.style.color = isOnline ? '#059669' : '#dc2626';
        }
        if (history) history.textContent = `Last updated: Just now by ${MAIN_ADMIN_EMAIL}`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadRecentOrders();
    loadVerifications();
    handleVerification();
    showWelcomeToast();
    initOnlineToggle();
    loadAdminStatusControl();
});
