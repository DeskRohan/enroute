import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const tableBody = document.getElementById('orders-table-body');
const mobileCardsContainer = document.getElementById('mobile-orders-cards');
const searchInput = document.getElementById('search-order');
const exportBtn = document.getElementById('export-csv-btn');
const ordersCountBadge = document.getElementById('orders-count-badge');
const filterSummary = document.getElementById('orders-filter-summary');
const clearSearchBtn = document.getElementById('clear-search-btn');

let allOrders = [];

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price);
};

const formatDateObj = (timestamp) => {
    if (!timestamp) return { date: 'N/A', time: '' };
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return { date: 'N/A', time: '' };
    const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { date: dateStr, time: timeStr };
};

const formatDate = (timestamp) => {
    const dt = formatDateObj(timestamp);
    return dt.time ? `${dt.date} ${dt.time}` : dt.date;
};

const loadOrders = async () => {
    try {
        const adminEmail = localStorage.getItem('adminEmail');
        const isSuperAdmin = adminEmail === 'admin@enroute.in';

        let adminProductIds = [];
        let adminProductNames = [];

        if (!isSuperAdmin) {
            const prodQ = query(collection(db, "products"), where("addedBy", "==", adminEmail));
            const prodSnap = await getDocs(prodQ);
            prodSnap.forEach(doc => {
                adminProductIds.push(doc.id);
                adminProductNames.push(doc.data().name);
            });
            if (adminProductIds.length === 0) {
                // Admin has no products, so no orders
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary" style="padding: 2.5rem;">No orders found for your products.</td></tr>`;
                if (mobileCardsContainer) mobileCardsContainer.innerHTML = `<div class="orders-empty-state"><h3>No Orders</h3><p>No orders found for your products yet.</p></div>`;
                if (ordersCountBadge) ordersCountBadge.textContent = '0 Orders';
                return;
            }
        }

        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (!isSuperAdmin) {
            // filter orders belonging to admin's products
            orders = orders.filter(o => {
                if (o.productId && adminProductIds.includes(o.productId)) return true;
                if (o.productName && adminProductNames.includes(o.productName)) return true;
                return false;
            });
        }

        allOrders = orders;
        renderTable(allOrders);
    } catch (error) {
        console.error("Error loading orders:", error);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding: 2.5rem;">Failed to load orders</td></tr>`;
        if (mobileCardsContainer) mobileCardsContainer.innerHTML = `<div class="orders-empty-state"><h3 style="color:var(--admin-danger);">Failed to load orders</h3><p>Please check your connection and refresh.</p></div>`;
    }
};

const renderTable = (orders) => {
    // Update badge counter
    if (ordersCountBadge) {
        ordersCountBadge.textContent = `${orders.length} ${orders.length === 1 ? 'Order' : 'Orders'}`;
    }

    // Search feedback and clear button toggle
    const term = searchInput ? searchInput.value.trim() : '';
    if (term) {
        if (filterSummary) {
            filterSummary.textContent = `Found ${orders.length} of ${allOrders.length} orders matching "${term}"`;
            filterSummary.style.display = 'block';
        }
        if (clearSearchBtn) clearSearchBtn.style.display = 'block';
    } else {
        if (filterSummary) filterSummary.style.display = 'none';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
    }

    if (orders.length === 0) {
        const emptyMsg = term
            ? `No orders matching "${term}". Try clearing the search.`
            : 'No orders recorded yet.';
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary" style="padding: 2.5rem;">${emptyMsg}</td></tr>`;
        }
        if (mobileCardsContainer) {
            mobileCardsContainer.innerHTML = `
                <div class="orders-empty-state">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <h3>No Orders Found</h3>
                    <p>${emptyMsg}</p>
                </div>
            `;
        }
        return;
    }

    let desktopHtml = '';
    let mobileHtml = '';

    orders.forEach(order => {
        const rawId = order.id || '';
        const idDisplay = rawId ? `#${rawId.slice(0, 8).toUpperCase()}` : '#N/A';
        const statusLower = (order.status || 'completed').toLowerCase();
        let statusClass = 'status-completed';
        if (statusLower.includes('pending')) statusClass = 'status-pending';
        else if (statusLower.includes('fail') || statusLower.includes('cancel')) statusClass = 'status-failed';

        const dt = formatDateObj(order.createdAt);
        const formattedAmount = formatPrice(order.amount);
        const customerName = order.customerName || 'Customer';
        const customerEmail = order.email || '';
        const productName = order.productName || 'Mod Package';

        // 1. Desktop Table Row
        desktopHtml += `
            <tr>
                <td class="col-id" data-label="Order ID">
                    <span class="order-cell-val" style="font-family: monospace; font-weight: 700;">${idDisplay}</span>
                </td>
                <td class="col-customer" data-label="Customer">
                    <span class="order-cell-val" style="font-weight: 600;" title="${customerName}">${customerName}</span>
                </td>
                <td class="col-email" data-label="Email">
                    <span class="order-cell-val" title="${customerEmail}">${customerEmail || 'N/A'}</span>
                </td>
                <td class="col-product" data-label="Product">
                    <span class="order-cell-val" title="${productName}">${productName}</span>
                </td>
                <td class="col-amount" data-label="Amount">
                    <span class="order-cell-val" style="font-weight: 700; color: var(--admin-text-primary);">${formattedAmount}</span>
                </td>
                <td class="col-status" data-label="Status">
                    <span class="order-cell-val">
                        <span class="status-pill ${statusClass}">${order.status || 'Completed'}</span>
                    </span>
                </td>
                <td class="col-date" data-label="Date">
                    <div class="order-cell-val">
                        <div style="font-weight: 600; font-size: 0.8rem; line-height: 1.2;">${dt.date}</div>
                        ${dt.time ? `<div style="font-size: 0.72rem; color: var(--admin-text-muted);">${dt.time}</div>` : ''}
                    </div>
                </td>
            </tr>
        `;

        // 2. Native Mobile Card
        mobileHtml += `
            <div class="mobile-order-card">
                <div class="moc-header">
                    <div class="moc-id-group">
                        <span class="moc-order-id">${idDisplay}</span>
                        <span class="moc-date">${dt.date}${dt.time ? ' &bull; ' + dt.time : ''}</span>
                    </div>
                    <span class="status-pill ${statusClass}">${order.status || 'Completed'}</span>
                </div>
                <div class="moc-body">
                    <div class="moc-product-name">${productName}</div>
                    <div class="moc-customer-row">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="moc-customer-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        <span class="moc-customer-name">${customerName}</span>
                        ${customerEmail ? `<span class="moc-dot">&bull;</span><span class="moc-customer-email">${customerEmail}</span>` : ''}
                    </div>
                </div>
                <div class="moc-footer">
                    <span class="moc-amount-label">Order Total</span>
                    <span class="moc-amount-value">${formattedAmount}</span>
                </div>
            </div>
        `;
    });

    if (tableBody) tableBody.innerHTML = desktopHtml;
    if (mobileCardsContainer) mobileCardsContainer.innerHTML = mobileHtml;
};

// Search Filter
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = allOrders.filter(order => 
            (order.id && order.id.toLowerCase().includes(term)) || 
            (order.email && order.email.toLowerCase().includes(term)) ||
            (order.customerName && order.customerName.toLowerCase().includes(term)) ||
            (order.productName && order.productName.toLowerCase().includes(term))
        );
        renderTable(filtered);
    });
}

// Clear Search Button
if (clearSearchBtn && searchInput) {
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
    });
}

// CSV Export
exportBtn.addEventListener('click', () => {
    if (allOrders.length === 0) {
        alert("No orders to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    // Header
    csvContent += "Order ID,Payment ID,Customer Name,Email,Product Name,Amount,Status,Date\n";
    
    // Rows
    allOrders.forEach(order => {
        const row = [
            order.id,
            order.paymentId || 'N/A',
            order.customerName || 'N/A',
            order.email,
            order.productName,
            order.amount,
            order.status,
            formatDate(order.createdAt)
        ];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `enroute_orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

document.addEventListener('DOMContentLoaded', loadOrders);
