import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const emailDisplay = document.getElementById('user-email-display');
const contentArea = document.getElementById('dashboard-content');
const tabPurchases = document.getElementById('tab-purchases');
const tabOrders = document.getElementById('tab-orders');
const logoutBtn = document.getElementById('logout-btn');
const adminLinkContainer = document.getElementById('admin-link-container');
const invoiceWrapper = document.getElementById('invoice-wrapper');
const invoiceContent = document.getElementById('invoice-content');

let currentUser = null;
let currentTab = 'purchases'; // 'purchases' or 'orders'

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(price);
};

// Google Drive Image URL Converter
const getImageUrl = (url) => {
    if (!url) return 'https://via.placeholder.com/800x600?text=No+Image';
    const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(driveRegex);
    if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
    }
    const driveRegex2 = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
    const match2 = url.match(driveRegex2);
    if (match2 && match2[1]) {
        return `https://drive.google.com/thumbnail?id=${match2[1]}&sz=w1000`;
    }
    return url;
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    // Handle Firestore Timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
};

const loadUserOrders = async () => {
    contentArea.innerHTML = `<div style="text-align: center; padding: 2rem;">Loading...</div>`;
    
    try {
        const q = query(
            collection(db, "orders"), 
            where("userId", "==", currentUser.uid)
        );
        
        const snapshot = await getDocs(q);
        let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort in memory to avoid requiring a Firestore composite index
        orders.sort((a, b) => {
            const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (new Date(a.createdAt || 0)).getTime();
            const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (new Date(b.createdAt || 0)).getTime();
            return dateB - dateA;
        });

        if (currentTab === 'purchases') {
            renderPurchases(orders);
        } else {
            renderOrderHistory(orders);
        }
    } catch (error) {
        console.error("Error loading orders:", error);
        contentArea.innerHTML = `<p class="text-danger">Failed to load data. Please try again later.</p>`;
    }
};

const renderPurchases = async (orders) => {
    contentArea.innerHTML = `<h2 class="mb-6">My Purchases</h2>`;
    
    if (orders.length === 0) {
        contentArea.innerHTML += `<div class="empty-state">
            <p>You haven't purchased anything yet.</p>
            <a href="products.html" class="btn btn-primary mt-4">Browse Mods</a>
        </div>`;
        return;
    }

    // Get unique product IDs from orders
    const productIds = [...new Set(orders.map(o => o.productId))];
    
    try {
        const productsList = document.createElement('div');
        productsList.style.display = 'grid';
        productsList.style.gap = '1rem';

        for (const pid of productIds) {
            const prodRef = doc(db, "products", pid);
            const prodSnap = await getDoc(prodRef);
            
            if (prodSnap.exists()) {
                const product = prodSnap.data();
                productsList.innerHTML += `
                    <div class="order-card">
                        <div class="order-card-info">
                            <h4>${product.name}</h4>
                            <p class="text-secondary text-sm">Version: ${product.version || '1.0'}</p>
                        </div>
                        <div>
                            <a href="${product.downloadLink || '#'}" target="_blank" class="btn btn-accent">Download</a>
                        </div>
                    </div>
                `;
            }
        }
        contentArea.appendChild(productsList);
    } catch (error) {
        console.error("Error loading products:", error);
    }
};

const renderOrderHistory = (orders) => {
    let html = `<h2 class="mb-6">Order History</h2>`;
    
    if (orders.length === 0) {
        html += `<div class="empty-state"><p>No orders found.</p></div>`;
    } else {
        html += `<div style="display: flex; flex-direction: column; gap: 1rem;">`;
        orders.forEach((order, index) => {
            html += `
                <div class="order-card">
                    <div class="order-card-info">
                        <h4>Order #${order.id.slice(0, 8)}...</h4>
                        <p class="text-secondary text-sm">Product: ${order.productName}</p>
                        <p class="text-secondary text-sm">Date: ${formatDate(order.createdAt)}</p>
                    </div>
                    <div style="text-align: right; display: flex; align-items: center; gap: 0.75rem;">
                        <div>
                            <div class="color-primary" style="font-weight: bold; margin-bottom: 0.5rem;">${formatPrice(order.amount)}</div>
                            <span style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: rgba(34, 197, 94, 0.1); color: var(--color-accent); border-radius: 4px;">Paid</span>
                        </div>
                        <button class="btn btn-outline invoice-btn" data-order-index="${index}" style="padding: 0.5rem 0.75rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.35rem;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                            Invoice
                        </button>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    contentArea.innerHTML = html;

    // Attach invoice button listeners
    document.querySelectorAll('.invoice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-order-index'));
            showInvoice(orders[idx]);
        });
    });
};

const showInvoice = (order) => {
    const invoiceNum = 'ENR-' + order.id.substring(0, 8).toUpperCase();
    const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || Date.now());
    const formattedDate = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const formattedTime = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    invoiceContent.innerHTML = `
        <div class="invoice-header">
            <div class="invoice-brand">
                <h2>Enroute<span>.</span></h2>
                <p style="font-size: 0.85rem; opacity: 0.7; margin-top: 0.25rem;">Digital Mod Store</p>
            </div>
            <div style="text-align: right;">
                <div class="invoice-badge">Paid</div>
                <p style="font-size: 0.8rem; opacity: 0.6; margin-top: 0.5rem;">${invoiceNum}</p>
            </div>
        </div>
        <div class="invoice-body">
            <div class="invoice-meta">
                <div class="invoice-meta-group">
                    <h4>Invoice Date</h4>
                    <p>${formattedDate}</p>
                    <p style="font-size: 0.8rem; color: #9ca3af;">${formattedTime}</p>
                </div>
                <div class="invoice-meta-group">
                    <h4>Billed To</h4>
                    <p>${order.customerName || 'Customer'}</p>
                    <p style="font-size: 0.8rem; color: #9ca3af;">${order.email}</p>
                </div>
                <div class="invoice-meta-group">
                    <h4>Payment ID</h4>
                    <p style="font-family: monospace; font-size: 0.8rem;">${order.paymentId || 'N/A'}</p>
                </div>
                <div class="invoice-meta-group">
                    <h4>Payment Method</h4>
                    <p>Razorpay</p>
                </div>
            </div>
            <table class="invoice-table">
                <thead>
                    <tr><th>Description</th><th>Category</th><th>Qty</th><th>Amount</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>${order.productName}</strong><br><span style="font-size: 0.8rem; color: #9ca3af;">Digital Download License</span></td>
                        <td style="text-transform: capitalize;">Mod</td>
                        <td>1</td>
                        <td>${formatPrice(order.amount)}</td>
                    </tr>
                </tbody>
            </table>
            <div class="invoice-totals">
                <div class="invoice-total-row">
                    <span style="color: #9ca3af;">Subtotal</span>
                    <span>${formatPrice(order.amount)}</span>
                </div>
                <div class="invoice-total-row">
                    <span style="color: #9ca3af;">Tax</span>
                    <span>₹0.00</span>
                </div>
                <div class="invoice-total-row grand">
                    <span>Total Paid</span>
                    <span>${formatPrice(order.amount)}</span>
                </div>
            </div>
        </div>
        <div class="invoice-footer">
            <p>Thank you for your purchase! This is a computer-generated invoice and does not require a signature.</p>
            <p style="margin-top: 0.5rem;">For support, contact us at <strong>enroute2026@gmail.com</strong></p>
        </div>
        <div class="invoice-actions">
            <button class="btn-print" id="print-invoice-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Print / Save as PDF
            </button>
            <button class="btn-close-invoice" id="close-invoice-btn">Close</button>
        </div>
    `;

    invoiceWrapper.classList.add('active');

    document.getElementById('print-invoice-btn').addEventListener('click', () => window.print());
    document.getElementById('close-invoice-btn').addEventListener('click', () => invoiceWrapper.classList.remove('active'));
    invoiceWrapper.addEventListener('click', (e) => {
        if (e.target === invoiceWrapper) invoiceWrapper.classList.remove('active');
    });
};

// Event Listeners
tabPurchases.addEventListener('click', (e) => {
    e.preventDefault();
    currentTab = 'purchases';
    tabPurchases.classList.add('active');
    tabOrders.classList.remove('active');
    if (currentUser) loadUserOrders();
});

tabOrders.addEventListener('click', (e) => {
    e.preventDefault();
    currentTab = 'orders';
    tabOrders.classList.add('active');
    tabPurchases.classList.remove('active');
    if (currentUser) loadUserOrders();
});

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    });
});

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        emailDisplay.textContent = user.email;
        
        // Check if Admin
        const role = localStorage.getItem('userRole');
        if (role === 'admin') {
            adminLinkContainer.style.display = 'block';
        } else {
            // Fallback check if localstorage was cleared
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                adminLinkContainer.style.display = 'block';
                localStorage.setItem('userRole', 'admin');
            }
        }

        loadUserOrders();
    } else {
        window.location.href = 'login.html';
    }
});
