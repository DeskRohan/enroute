import { db, auth } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const orderDetailsContainer = document.getElementById('order-details-container');
const mainContent = document.getElementById('main-content');
const invoiceWrapper = document.getElementById('invoice-wrapper');
const invoiceContent = document.getElementById('invoice-content');

// Get IDs from URL or sessionStorage fallback
const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get('orderId') || sessionStorage.getItem('successOrderId');
const productId = urlParams.get('productId') || sessionStorage.getItem('successProductId');

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(price);
};

const generateInvoiceNumber = (id) => {
    return 'ENR-' + id.substring(0, 8).toUpperCase();
};

const loadSuccessData = async (user) => {
    if (!orderId || !productId) {
        mainContent.innerHTML = `
            <h1>Oops!</h1>
            <p class="text-secondary mt-2">Invalid order details.</p>
            <a href="dashboard.html" class="btn btn-primary mt-4">Go to Dashboard</a>
        `;
        return;
    }

    try {
        // Fetch Order
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);

        // Fetch Product (to get download link)
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);

        if (orderSnap.exists() && productSnap.exists()) {
            const order = orderSnap.data();
            const product = productSnap.data();

            // Verify order belongs to current user
            if (order.userId !== user.uid) {
                throw new Error("Unauthorized access");
            }

            renderSuccess(order, product, orderId);
            buildInvoice(order, product, orderId);
            triggerAutoDownload(product.downloadLink);

        } else {
            throw new Error("Data not found");
        }

    } catch (error) {
        console.error("Error loading success data:", error);
        mainContent.innerHTML = `
            <h1>Error</h1>
            <p class="text-secondary mt-2">We couldn't load your order details. If you completed a payment, please check your dashboard.</p>
            <a href="dashboard.html" class="btn btn-primary mt-4">Go to Dashboard</a>
        `;
    }
};

const renderSuccess = (order, product, id) => {
    orderDetailsContainer.innerHTML = `
        <div class="order-details">
            <div class="detail-row">
                <span class="text-secondary">Order ID</span>
                <span style="font-family: monospace;">${id}</span>
            </div>
            <div class="detail-row">
                <span class="text-secondary">Product</span>
                <span>${product.name}</span>
            </div>
            <div class="detail-row">
                <span class="text-secondary">Amount Paid</span>
                <span class="color-primary">${formatPrice(order.amount)}</span>
            </div>
            <div class="detail-row">
                <span class="text-secondary">Payment ID</span>
                <span style="font-family: monospace; font-size: 0.85rem;">${order.paymentId || 'N/A'}</span>
            </div>
        </div>

        <div class="download-section">
            <p class="mb-4">Your download should start automatically.</p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <a href="${product.downloadLink || '#'}" class="btn btn-primary btn-lg" target="_blank" rel="noopener noreferrer">
                    Download Again
                </a>
                <button id="view-invoice-btn" class="btn btn-outline btn-lg" style="display: flex; align-items: center; gap: 0.5rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    View Invoice
                </button>
                <a href="products.html" class="btn btn-outline btn-lg">
                    Browse More
                </a>
            </div>
        </div>
    `;

    // Attach invoice button listener
    document.getElementById('view-invoice-btn').addEventListener('click', () => {
        invoiceWrapper.classList.add('active');
    });
};

const buildInvoice = (order, product, id) => {
    const invoiceNum = generateInvoiceNumber(id);
    const date = order.createdAt ? new Date(order.createdAt.seconds * 1000) : new Date();
    const formattedDate = date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
    });

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
                    <tr>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Qty</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <strong>${product.name}</strong>
                            <br><span style="font-size: 0.8rem; color: #9ca3af;">Digital Download License</span>
                        </td>
                        <td style="text-transform: capitalize;">${product.category || 'Mod'}</td>
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
            <button class="btn-close-invoice" id="close-invoice-btn">
                Close
            </button>
        </div>
    `;

    // Print button
    document.getElementById('print-invoice-btn').addEventListener('click', () => {
        window.print();
    });

    // Close button
    document.getElementById('close-invoice-btn').addEventListener('click', () => {
        invoiceWrapper.classList.remove('active');
    });

    // Close on backdrop click
    invoiceWrapper.addEventListener('click', (e) => {
        if (e.target === invoiceWrapper) {
            invoiceWrapper.classList.remove('active');
        }
    });
};

const triggerAutoDownload = (url) => {
    if (url) {
        // Slight delay for UX
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.download = '';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, 1500);
    }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        loadSuccessData(user);
    } else {
        window.location.href = 'login.html';
    }
});
