import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const productSelect = document.getElementById('filter-product');
const timeSelect = document.getElementById('filter-time');
const customDateGroup = document.getElementById('custom-date-group');
const startDateInput = document.getElementById('date-start');
const endDateInput = document.getElementById('date-end');
const generateBtn = document.getElementById('generate-btn');
const exportBtn = document.getElementById('export-pdf-btn');
const tableBody = document.getElementById('reports-table-body');
const summaryRevenue = document.getElementById('summary-revenue');
const summaryUnits = document.getElementById('summary-units');

let allProducts = [];
let reportData = []; // To hold the summarized data for CSV export

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price);
};

// Toggle custom date range inputs
timeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
        customDateGroup.style.display = 'flex';
    } else {
        customDateGroup.style.display = 'none';
    }
});

const loadProducts = async () => {
    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        allProducts.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            productSelect.appendChild(opt);
        });
    } catch (error) {
        console.error("Error loading products:", error);
    }
};

const getFilterDates = () => {
    const timeVal = timeSelect.value;
    const now = new Date();
    let start = new Date(0); // Epoch start (launch)
    let end = new Date();

    if (timeVal === 'all_time') {
        // Defaults to start=0, end=now
    } else if (timeVal === 'last_30') {
        start = new Date();
        start.setDate(now.getDate() - 30);
    } else if (timeVal === 'last_7') {
        start = new Date();
        start.setDate(now.getDate() - 7);
    } else if (timeVal === 'custom') {
        if (!startDateInput.value || !endDateInput.value) {
            alert('Please select both start and end dates.');
            return null;
        }
        start = new Date(startDateInput.value);
        end = new Date(endDateInput.value);
        end.setHours(23, 59, 59, 999); // Include entire end day
    }
    return { start, end };
};

const generateReport = async () => {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Loading...';
    exportBtn.disabled = true;

    const dates = getFilterDates();
    if (!dates) {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate';
        return;
    }
    const { start, end } = dates;
    const selectedProductId = productSelect.value;

    try {
        const q = query(collection(db, "orders"));
        const snapshot = await getDocs(q);
        const allOrders = snapshot.docs.map(doc => doc.data());

        let totalRev = 0;
        let totalUnits = 0;
        
        // Group by productId
        const productStats = {};

        allOrders.forEach(order => {
            // Check status
            if (order.status !== 'completed') return;

            // Check Date
            const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
            if (orderDate < start || orderDate > end) return;

            // Check Product
            if (selectedProductId !== 'all' && order.productId !== selectedProductId) return;

            const pid = order.productId;
            if (!productStats[pid]) {
                productStats[pid] = {
                    name: order.productName || 'Unknown Product',
                    units: 0,
                    revenue: 0,
                    pricingType: 'Paid' // Simplification based on orders, could be refined by looking at allProducts
                };
            }

            productStats[pid].units += 1;
            productStats[pid].revenue += Number(order.amount || 0);

            totalUnits += 1;
            totalRev += Number(order.amount || 0);
        });

        summaryRevenue.textContent = formatPrice(totalRev);
        summaryUnits.textContent = totalUnits;

        // Render Table
        reportData = Object.values(productStats);
        if (reportData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary">No data found for the selected filters.</td></tr>`;
        } else {
            let html = '';
            reportData.forEach(data => {
                // Determine pricing type based on revenue for accurate historical reporting
                const productMatch = allProducts.find(p => p.name === data.name);
                let pType = 'paid';
                if (data.revenue === 0 && productMatch) {
                    pType = productMatch.pricingType === 'free' || productMatch.price === 0 ? 'free' : 'paid';
                }

                html += `
                    <tr>
                        <td style="font-weight: 500;">${data.name}</td>
                        <td style="text-transform: capitalize;">${pType}</td>
                        <td>${data.units}</td>
                        <td class="color-primary" style="font-weight: 600;">${formatPrice(data.revenue)}</td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
            exportBtn.disabled = false;
        }

    } catch (error) {
        console.error("Error generating report:", error);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error loading report data.</td></tr>`;
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate';
    }
};

exportBtn.addEventListener('click', () => {
    if (reportData.length === 0) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add Title
    doc.setFontSize(18);
    doc.text("Enroute Revenue Report", 14, 20);
    
    // Add Summary
    doc.setFontSize(11);
    doc.text(`Total Revenue (Filtered): ${summaryRevenue.textContent}`, 14, 30);
    doc.text(`Total Units Sold: ${summaryUnits.textContent}`, 14, 36);

    // Prepare Table Data
    const tableHeaders = [['Product Name', 'Pricing Type', 'Units Sold', 'Total Revenue Generated (INR)']];
    const tableRows = reportData.map(data => {
        const productMatch = allProducts.find(p => p.name === data.name);
        let pType = 'paid';
        if (data.revenue === 0 && productMatch) {
            pType = productMatch.pricingType === 'free' || productMatch.price === 0 ? 'free' : 'paid';
        }
        return [
            data.name,
            pType.charAt(0).toUpperCase() + pType.slice(1),
            data.units,
            data.revenue
        ];
    });

    // AutoTable
    doc.autoTable({
        startY: 45,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] } // Matches var(--color-primary) roughly
    });

    // Save
    doc.save(`enroute_revenue_report_${new Date().toISOString().split('T')[0]}.pdf`);
});

generateBtn.addEventListener('click', generateReport);

document.addEventListener('DOMContentLoaded', loadProducts);
