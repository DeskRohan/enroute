import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const tableBody = document.getElementById('orders-table-body');
const searchInput = document.getElementById('search-order');
const exportBtn = document.getElementById('export-csv-btn');

let allOrders = [];

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price);
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

const loadOrders = async () => {
    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTable(allOrders);
    } catch (error) {
        console.error("Error loading orders:", error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load orders</td></tr>`;
    }
};

const renderTable = (orders) => {
    if (orders.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary">No orders found.</td></tr>`;
        return;
    }

    let html = '';
    orders.forEach(order => {
        html += `
            <tr>
                <td style="font-family: monospace;">#${order.id.slice(0, 8)}</td>
                <td>${order.customerName || 'N/A'}</td>
                <td>${order.email}</td>
                <td>${order.productName}</td>
                <td class="color-primary" style="font-weight: 600;">${formatPrice(order.amount)}</td>
                <td><span style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: rgba(34, 197, 94, 0.1); color: var(--color-accent); border-radius: 4px; text-transform: uppercase;">${order.status}</span></td>
                <td style="font-size: 0.875rem;">${formatDate(order.createdAt)}</td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
};

// Search Filter
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allOrders.filter(order => 
        order.id.toLowerCase().includes(term) || 
        order.email.toLowerCase().includes(term) ||
        (order.customerName && order.customerName.toLowerCase().includes(term))
    );
    renderTable(filtered);
});

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
