import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
        // 1. Get Products Count
        const productsSnap = await getDocs(collection(db, "products"));
        statProducts.textContent = productsSnap.size;

        // 2. Get Users Count
        const usersSnap = await getDocs(collection(db, "users"));
        statUsers.textContent = usersSnap.size;

        // 3. Get Orders & Revenue
        const ordersSnap = await getDocs(collection(db, "orders"));
        statOrders.textContent = ordersSnap.size;
        
        let totalRev = 0;
        ordersSnap.forEach(doc => {
            totalRev += Number(doc.data().amount || 0);
        });
        statRevenue.textContent = formatPrice(totalRev);

    } catch (error) {
        console.error("Error loading stats:", error);
    }
};

const loadRecentOrders = async () => {
    try {
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

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadRecentOrders();
});
