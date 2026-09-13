import { db, auth } from './firebase-config.js';
import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
    }).format(price || 0);
};

const generateInvoiceNumber = (id) => {
    return 'ENR-' + id.substring(0, 8).toUpperCase();
};

const loadSuccessData = async (user) => {
    if (!orderId) {
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

        if (!orderSnap.exists()) {
            throw new Error("Order not found");
        }

        const order = orderSnap.data();

        // Verify order belongs to current user
        if (order.userId !== user.uid) {
            throw new Error("Unauthorized access");
        }

        // Determine items list
        let orderItems = order.items || [];

        // If legacy single product without items array
        if (orderItems.length === 0 && productId) {
            try {
                const productRef = doc(db, "products", productId);
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                    const pData = productSnap.data();
                    orderItems = [{
                        id: productId,
                        name: pData.name,
                        price: order.amount,
                        category: pData.category || 'mod',
                        downloadLink: pData.downloadLink || pData.downloadUrl || '#'
                    }];
                }
            } catch(e) {}
        }

        renderSuccess(order, orderItems, orderId);
        buildInvoice(order, orderItems, orderId);

        // Auto download first item if available
        if (orderItems.length > 0 && orderItems[0].downloadLink) {
            triggerAutoDownload(orderItems[0].downloadLink);
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

const renderSuccess = (order, items, id) => {
    const productsText = items.map(i => i.name).join(', ') || order.productName || 'BUSSID Mod';

    let downloadsHtml = '';
    if (items.length > 1) {
        downloadsHtml = `
            <div style="display:flex; flex-direction:column; gap:0.75rem; margin:1.5rem auto; max-width:500px;">
                ${items.map(item => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:0.75rem 1rem;">
                        <div style="text-align:left;">
                            <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">${item.name}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">${item.category === 'livery' ? 'Vehicle Livery' : 'Vehicle Mod'}</div>
                        </div>
                        <a href="${item.downloadLink || '#'}" class="btn btn-primary btn-sm" target="_blank" rel="noopener noreferrer" style="white-space:nowrap;">
                            Download Mod
                        </a>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (items.length === 1) {
        downloadsHtml = `
            <div style="margin: 1.5rem 0;">
                <a href="${items[0].downloadLink || '#'}" class="btn btn-primary btn-lg" target="_blank" rel="noopener noreferrer">
                    Download Mod (${items[0].name})
                </a>
            </div>
        `;
    }

    orderDetailsContainer.innerHTML = `
        <div class="order-details">
            <div class="detail-row">
                <span class="text-secondary">Order ID</span>
                <span style="font-family: monospace;">${id}</span>
            </div>
            <div class="detail-row">
                <span class="text-secondary">Product${items.length > 1 ? 's' : ''}</span>
                <span>${productsText}</span>
            </div>
            <div class="detail-row">
                <span class="text-secondary">Amount Paid</span>
                <span class="color-primary" style="font-weight:800;">${formatPrice(order.amount)}</span>
            </div>
            <div class="detail-row">
                <span class="text-secondary">Payment ID</span>
                <span style="font-family: monospace; font-size: 0.85rem;">${order.paymentId || 'N/A'}</span>
            </div>
        </div>

        <div class="download-section">
            <p class="mb-2">Your cloud download link${items.length > 1 ? 's are' : ' is'} ready.</p>
            ${downloadsHtml}
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 1rem;">
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
    const invBtn = document.getElementById('view-invoice-btn');
    if (invBtn) {
        invBtn.addEventListener('click', () => {
            invoiceWrapper.classList.add('active');
        });
    }
};

const buildInvoice = (order, items, id) => {
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

    let tableRows = '';
    if (items.length > 0) {
        tableRows = items.map(item => `
            <tr>
                <td>
                    <strong>${item.name}</strong>
                    <br><span style="font-size: 0.8rem; color: #9ca3af;">Digital Download License</span>
                </td>
                <td style="text-transform: capitalize;">${item.category === 'livery' ? 'Vehicle Livery' : 'Vehicle Mod'}</td>
                <td>1</td>
                <td>${formatPrice(item.price)}</td>
            </tr>
        `).join('');
    } else {
        tableRows = `
            <tr>
                <td>
                    <strong>${order.productName || 'BUSSID Mod'}</strong>
                    <br><span style="font-size: 0.8rem; color: #9ca3af;">Digital Download License</span>
                </td>
                <td style="text-transform: capitalize;">Mod</td>
                <td>1</td>
                <td>${formatPrice(order.amount)}</td>
            </tr>
        `;
    }

    invoiceContent.innerHTML = `
        <div class="invoice-header">
            <div class="invoice-brand">
                <h2>EnrouteIn<span>.</span></h2>
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
                    ${tableRows}
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
    if (url && url !== '#') {
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
