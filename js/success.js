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
                        <button type="button" class="btn btn-primary btn-sm direct-download-btn" data-url="${item.downloadLink || '#'}" data-name="${item.name.replace(/"/g, '&quot;')}" style="white-space:nowrap; display:inline-flex; align-items:center; gap:6px;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            <span>Download Mod</span>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (items.length === 1) {
        downloadsHtml = `
            <div style="margin: 1.5rem 0;">
                <button type="button" class="btn btn-primary btn-lg direct-download-btn" data-url="${items[0].downloadLink || '#'}" data-name="${items[0].name.replace(/"/g, '&quot;')}" style="display:inline-flex; align-items:center; gap:8px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>Download Mod (${items[0].name})</span>
                </button>
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

    // Attach direct download button listeners
    document.querySelectorAll('.direct-download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const downloadUrl = btn.getAttribute('data-url');
            const modName = btn.getAttribute('data-name') || '';
            triggerDirectDownload(downloadUrl, modName, btn);
        });
    });

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

const triggerDirectDownload = async (url, productName = '', btnEl = null) => {
    if (!url || url === '#' || url === 'undefined') {
        alert('Download link is not available. Please check your garage or contact support.');
        return;
    }

    let originalHtml = '';
    if (btnEl) {
        originalHtml = btnEl.innerHTML;
        btnEl.disabled = true;
        btnEl.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg>
            <span>Preparing Download...</span>
        `;
    }

    try {
        // If it's a cloud storage / mod link, resolve the direct binary download URL
        if (url.includes('sharemods.com') || /^[a-z0-9]{12}$/i.test(url.trim())) {
            const apiBase = (window.location.hostname === 'localhost' && window.location.port !== '3001')
                ? 'http://localhost:3001'
                : '';

            const res = await fetch(`${apiBase}/api/direct-download?url=${encodeURIComponent(url)}`);
            const data = await res.json();

            if (data.ok && data.directUrl) {
                if (btnEl) {
                    btnEl.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>Download Starting...</span>
                    `;
                }

                // Trigger in-browser direct file download without navigating away
                const a = document.createElement('a');
                a.href = data.directUrl;
                if (data.filename) a.download = data.filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    if (btnEl) {
                        btnEl.disabled = false;
                        btnEl.innerHTML = originalHtml;
                    }
                }, 3000);
                return;
            } else {
                throw new Error(data.error || 'Failed to resolve direct download link');
            }
        }

        // Generic direct URL download
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = originalHtml;
            }
        }, 1000);
    } catch (err) {
        console.error('Direct download error:', err);
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = originalHtml;
        }
        // Fallback: seamless client-side download form / tab without showing raw API JSON error
        let fileCode = '';
        const match = url.match(/sharemods\.com\/([a-zA-Z0-9]+)/);
        if (match) fileCode = match[1];
        else if (/^[a-zA-Z0-9]{8,20}$/.test(url.trim())) fileCode = url.trim();

        if (fileCode) {
            let iframe = document.getElementById('enroute-download-frame');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'enroute-download-frame';
                iframe.name = 'enroute-download-frame';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `https://sharemods.com/${fileCode}`;
            form.target = 'enroute-download-frame';
            const fields = { op: 'download2', id: fileCode, rand: '', referer: `https://sharemods.com/${fileCode}`, method_free: '', method_premium: '' };
            for (const [k, v] of Object.entries(fields)) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = k;
                input.value = v;
                form.appendChild(input);
            }
            document.body.appendChild(form);
            form.submit();
            setTimeout(() => document.body.removeChild(form), 1000);
        } else {
            const fallbackA = document.createElement('a');
            fallbackA.href = url;
            fallbackA.download = '';
            document.body.appendChild(fallbackA);
            fallbackA.click();
            setTimeout(() => document.body.removeChild(fallbackA), 1000);
        }
    }
};

const triggerAutoDownload = (url) => {
    if (url && url !== '#') {
        setTimeout(() => {
            const firstBtn = document.querySelector('.direct-download-btn');
            triggerDirectDownload(url, '', firstBtn);
        }, 1200);
    }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        loadSuccessData(user);
    } else {
        window.location.href = 'login.html';
    }
});
