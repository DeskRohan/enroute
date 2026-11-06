import { db, auth } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// DOM Elements
const superAdminTabs = document.getElementById('super-admin-tabs');
const superAdminIndicator = document.getElementById('super-admin-indicator');
const tabProductWise = document.getElementById('tab-product-wise');
const tabAdminWise = document.getElementById('tab-admin-wise');
const activeViewTag = document.getElementById('active-view-tag');

const filterAdminGroup = document.getElementById('filter-admin-group');
const filterAdminSelect = document.getElementById('filter-admin');
const filterProductGroup = document.getElementById('filter-product-group');
const filterProductSelect = document.getElementById('filter-product');
const filterTimeSelect = document.getElementById('filter-time');
const customDateGroup = document.getElementById('custom-date-group');
const startDateInput = document.getElementById('date-start');
const endDateInput = document.getElementById('date-end');

const generateBtn = document.getElementById('generate-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');

// Summary KPI Elements
const summaryRevenue = document.getElementById('summary-revenue');
const summaryUnits = document.getElementById('summary-units');
const summaryMetric3 = document.getElementById('summary-metric-3');
const metric3Title = document.getElementById('metric-3-title');
const metric3Sub = document.getElementById('metric-3-sub');
const summaryMetric4 = document.getElementById('summary-metric-4');
const metric4Title = document.getElementById('metric-4-title');
const metric4Sub = document.getElementById('metric-4-sub');

// Table Elements
const reportsTableHead = document.getElementById('reports-table-head');
const reportsTableBody = document.getElementById('reports-table-body');

// State Variables
const SUPER_ADMIN_EMAIL = 'admin@enroute.in';
let currentAdminEmail = (localStorage.getItem('adminEmail') || '').toLowerCase().trim();
let isSuperAdmin = currentAdminEmail === SUPER_ADMIN_EMAIL.toLowerCase();

let currentView = 'product'; // 'product' | 'admin'
let allProducts = [];
let allOrders = [];
let allAdmins = []; // [{ uid, email, name, role }]
let productReportRows = [];
let adminReportRows = [];
let filteredTotalRevenue = 0;
let filteredTotalUnits = 0;

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(price || 0);
};

const formatPercent = (val) => {
    if (isNaN(val) || !isFinite(val)) return '0%';
    return `${val.toFixed(1)}%`;
};

// Check Auth state to ensure Super Admin detection is 100% accurate
onAuthStateChanged(auth, (user) => {
    if (user && user.email) {
        currentAdminEmail = user.email.toLowerCase().trim();
        if (currentAdminEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
            isSuperAdmin = true;
            if (superAdminTabs) superAdminTabs.style.display = 'block';
            if (superAdminIndicator) superAdminIndicator.style.display = 'inline-flex';
            if (filterAdminGroup) filterAdminGroup.style.display = 'flex';
        }
    }
});

// Toggle custom date range inputs
filterTimeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
        customDateGroup.style.display = 'flex';
    } else {
        customDateGroup.style.display = 'none';
    }
});

// View Switcher Tab Handlers
if (tabProductWise) {
    tabProductWise.addEventListener('click', () => {
        if (currentView === 'product') return;
        currentView = 'product';
        tabProductWise.classList.add('active');
        if (tabAdminWise) tabAdminWise.classList.remove('active');
        if (activeViewTag) activeViewTag.textContent = 'Mode: Product-wise';
        if (filterProductGroup) filterProductGroup.style.display = 'flex';
        renderReport();
    });
}

if (tabAdminWise) {
    tabAdminWise.addEventListener('click', () => {
        if (!isSuperAdmin) {
            alert('Admin-wise revenue reports are exclusively available to the Main Super Admin (admin@enroute.in).');
            return;
        }
        if (currentView === 'admin') return;
        currentView = 'admin';
        tabAdminWise.classList.add('active');
        if (tabProductWise) tabProductWise.classList.remove('active');
        if (activeViewTag) activeViewTag.textContent = 'Mode: Admin-wise (Creator Breakdown)';
        // When in Admin-wise mode, hide individual product filter to focus on admin totals
        if (filterProductGroup) filterProductGroup.style.display = 'none';
        renderReport();
    });
}

/**
 * Load Admins, Products, and Initialize UI
 */
const loadInitialData = async () => {
    try {
        if (currentAdminEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
            isSuperAdmin = true;
        }

        if (isSuperAdmin) {
            if (superAdminTabs) superAdminTabs.style.display = 'block';
            if (superAdminIndicator) superAdminIndicator.style.display = 'inline-flex';
            if (filterAdminGroup) filterAdminGroup.style.display = 'flex';
        }

        // 1. Fetch Products
        let prodQuery;
        if (isSuperAdmin) {
            prodQuery = query(collection(db, "products"), orderBy("createdAt", "desc"));
        } else {
            prodQuery = query(collection(db, "products"), where("addedBy", "==", currentAdminEmail));
        }

        const prodSnap = await getDocs(prodQuery);
        allProducts = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Populate Product Filter Dropdown
        filterProductSelect.innerHTML = '<option value="all">All Products</option>';
        allProducts.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name || 'Unnamed Mod';
            filterProductSelect.appendChild(opt);
        });

        // 2. Fetch Admins (if Super Admin)
        if (isSuperAdmin) {
            try {
                const usersQ = query(collection(db, "users"), where("role", "==", "admin"));
                const usersSnap = await getDocs(usersQ);
                allAdmins = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            } catch (err) {
                console.warn("Could not query users collection for admin list:", err);
            }

            // Ensure Super Admin is included
            if (!allAdmins.some(a => (a.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())) {
                allAdmins.unshift({
                    uid: 'super-admin-uid',
                    email: SUPER_ADMIN_EMAIL,
                    name: 'Super Admin',
                    role: 'admin'
                });
            }

            // Also collect any unique creator emails found in allProducts that might not be in users
            allProducts.forEach(p => {
                if (p.addedBy && !allAdmins.some(a => (a.email || '').toLowerCase() === p.addedBy.toLowerCase())) {
                    allAdmins.push({
                        uid: `creator-${p.addedBy}`,
                        email: p.addedBy,
                        name: p.addedBy.split('@')[0],
                        role: 'admin'
                    });
                }
            });

            // Populate Admin Filter Dropdown
            filterAdminSelect.innerHTML = `<option value="all">All Admins & Creators (${allAdmins.length})</option>`;
            allAdmins.forEach(admin => {
                const opt = document.createElement('option');
                opt.value = (admin.email || '').toLowerCase();
                const isSuper = (admin.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                opt.textContent = `${admin.name || admin.email} ${isSuper ? '👑 (Main Admin)' : '(Creator)'}`;
                filterAdminSelect.appendChild(opt);
            });
        }

        // Run initial report generation
        await generateReport();

    } catch (error) {
        console.error("Error loading initial reports data:", error);
    }
};

/**
 * Compute active filter date boundary
 */
const getFilterDates = () => {
    const timeVal = filterTimeSelect.value;
    const now = new Date();
    let start = new Date(0); // Launch (Epoch 1970)
    let end = new Date();

    if (timeVal === 'all_time') {
        // Defaults start=0, end=now
    } else if (timeVal === 'last_30') {
        start = new Date();
        start.setDate(now.getDate() - 30);
        start.setHours(0, 0, 0, 0);
    } else if (timeVal === 'last_7') {
        start = new Date();
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
    } else if (timeVal === 'custom') {
        if (!startDateInput.value || !endDateInput.value) {
            alert('Please select both a Start Date and an End Date.');
            return null;
        }
        start = new Date(startDateInput.value);
        start.setHours(0, 0, 0, 0);
        end = new Date(endDateInput.value);
        end.setHours(23, 59, 59, 999);
    }
    return { start, end };
};

/**
 * Fetch Orders and Compute Report Statistics
 */
const generateReport = async () => {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Analyzing...';
    exportPdfBtn.disabled = true;
    exportCsvBtn.disabled = true;

    const dates = getFilterDates();
    if (!dates) {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate';
        return;
    }
    const { start, end } = dates;
    const selectedProductId = filterProductSelect.value;
    const selectedAdminEmail = (filterAdminSelect && filterAdminSelect.value) ? filterAdminSelect.value.toLowerCase() : 'all';

    try {
        // Fetch all orders
        const ordersSnap = await getDocs(query(collection(db, "orders")));
        allOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        filteredTotalRevenue = 0;
        filteredTotalUnits = 0;

        // Dictionaries for aggregation
        const productStatsMap = {};
        const adminStatsMap = {};

        // Pre-initialize adminStatsMap with all known admins
        if (isSuperAdmin) {
            allAdmins.forEach(adm => {
                const email = (adm.email || '').toLowerCase();
                if (!email) return;
                adminStatsMap[email] = {
                    email,
                    name: adm.name || email.split('@')[0],
                    isSuperAdmin: email === SUPER_ADMIN_EMAIL.toLowerCase(),
                    productsListed: allProducts.filter(p => (p.addedBy || '').toLowerCase() === email).length,
                    unitsSold: 0,
                    revenue: 0,
                    productEarnings: {}, // { [productName]: revenue }
                    topProduct: '—'
                };
            });
        }

        // Process each order
        allOrders.forEach(order => {
            // Exclude cancelled/failed orders
            const status = (order.status || 'completed').toLowerCase();
            if (status.includes('fail') || status.includes('cancel')) return;

            // Date filtering
            const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || 0);
            if (orderDate < start || orderDate > end) return;

            // Product matching
            const matchedProduct = allProducts.find(p => p.id === order.productId || p.name === order.productName);
            const creatorEmail = (matchedProduct?.addedBy || order.addedBy || SUPER_ADMIN_EMAIL).toLowerCase();

            // Admin filter check (if Super Admin chose a specific admin)
            if (isSuperAdmin && selectedAdminEmail !== 'all' && creatorEmail !== selectedAdminEmail) {
                return;
            }

            // Non-super-admins only see their own products
            if (!isSuperAdmin && creatorEmail !== currentAdminEmail) {
                return;
            }

            // Product dropdown filter check (in product-wise mode)
            if (currentView === 'product' && selectedProductId !== 'all' && order.productId !== selectedProductId) {
                return;
            }

            const amount = Number(order.amount || 0);
            const pId = order.productId || matchedProduct?.id || order.productName || 'unknown-product';
            const pName = order.productName || matchedProduct?.name || 'BUSSID Mod';
            const pricingType = matchedProduct?.pricingType || (amount === 0 ? 'free' : 'paid');

            // --- 1. Accumulate Product-wise Stats ---
            if (!productStatsMap[pId]) {
                productStatsMap[pId] = {
                    id: pId,
                    name: pName,
                    creatorEmail,
                    creatorName: allAdmins.find(a => (a.email || '').toLowerCase() === creatorEmail)?.name || creatorEmail.split('@')[0],
                    pricingType,
                    unitsSold: 0,
                    revenue: 0,
                    category: matchedProduct?.category || 'Mod'
                };
            }
            productStatsMap[pId].unitsSold += 1;
            productStatsMap[pId].revenue += amount;

            // --- 2. Accumulate Admin-wise Stats ---
            if (isSuperAdmin) {
                if (!adminStatsMap[creatorEmail]) {
                    adminStatsMap[creatorEmail] = {
                        email: creatorEmail,
                        name: creatorEmail.split('@')[0],
                        isSuperAdmin: creatorEmail === SUPER_ADMIN_EMAIL.toLowerCase(),
                        productsListed: allProducts.filter(p => (p.addedBy || '').toLowerCase() === creatorEmail).length,
                        unitsSold: 0,
                        revenue: 0,
                        productEarnings: {},
                        topProduct: '—'
                    };
                }
                adminStatsMap[creatorEmail].unitsSold += 1;
                adminStatsMap[creatorEmail].revenue += amount;
                adminStatsMap[creatorEmail].productEarnings[pName] = (adminStatsMap[creatorEmail].productEarnings[pName] || 0) + amount;
            }

            filteredTotalRevenue += amount;
            filteredTotalUnits += 1;
        });

        // Compute top products for each admin
        if (isSuperAdmin) {
            Object.values(adminStatsMap).forEach(adm => {
                let topName = '—';
                let topRev = -1;
                for (const [prodName, rev] of Object.entries(adm.productEarnings)) {
                    if (rev > topRev) {
                        topRev = rev;
                        topName = prodName;
                    }
                }
                adm.topProduct = topName !== '—' ? `${topName} (${formatPrice(topRev)})` : '—';
                adm.aov = adm.unitsSold > 0 ? (adm.revenue / adm.unitsSold) : 0;
                adm.share = filteredTotalRevenue > 0 ? ((adm.revenue / filteredTotalRevenue) * 100) : 0;
            });
        }

        // Also add products that had 0 sales in the period so the owner sees full catalog yield
        allProducts.forEach(prod => {
            const creatorEmail = (prod.addedBy || SUPER_ADMIN_EMAIL).toLowerCase();
            if (isSuperAdmin && selectedAdminEmail !== 'all' && creatorEmail !== selectedAdminEmail) return;
            if (!isSuperAdmin && creatorEmail !== currentAdminEmail) return;
            if (selectedProductId !== 'all' && prod.id !== selectedProductId) return;

            if (!productStatsMap[prod.id]) {
                productStatsMap[prod.id] = {
                    id: prod.id,
                    name: prod.name,
                    creatorEmail,
                    creatorName: allAdmins.find(a => (a.email || '').toLowerCase() === creatorEmail)?.name || creatorEmail.split('@')[0],
                    pricingType: prod.pricingType || (prod.price === 0 ? 'free' : 'paid'),
                    unitsSold: 0,
                    revenue: 0,
                    category: prod.category || 'Mod'
                };
            }
        });

        // Finalize rows and calculate percentage shares
        productReportRows = Object.values(productStatsMap).map(row => {
            row.share = filteredTotalRevenue > 0 ? ((row.revenue / filteredTotalRevenue) * 100) : 0;
            return row;
        }).sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold);

        adminReportRows = Object.values(adminStatsMap).sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold);

        // Render Active Table & KPIs
        renderReport();

    } catch (error) {
        console.error("Error generating financial report:", error);
        reportsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger" style="padding: 2.5rem 1rem;">Failed to load order analytics. Please verify network access.</td></tr>`;
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate';
    }
};

/**
 * Render Report UI according to current active view ('product' or 'admin')
 */
const renderReport = () => {
    // 1. Update Top Summary Cards
    summaryRevenue.textContent = formatPrice(filteredTotalRevenue);
    summaryUnits.textContent = filteredTotalUnits;

    if (currentView === 'admin') {
        // --- Admin-wise View ---
        metric3Title.textContent = 'Active Admins / Creators';
        const activeAdminsCount = adminReportRows.filter(a => a.unitsSold > 0 || a.revenue > 0).length;
        summaryMetric3.textContent = `${activeAdminsCount} / ${adminReportRows.length}`;
        metric3Sub.textContent = 'Creators with recorded sales';

        metric4Title.textContent = 'Top Earning Admin';
        const topAdmin = adminReportRows.find(a => a.revenue > 0) || adminReportRows[0];
        if (topAdmin && topAdmin.revenue > 0) {
            summaryMetric4.textContent = `${topAdmin.name} (${formatPrice(topAdmin.revenue)})`;
            metric4Sub.textContent = `${formatPercent(topAdmin.share)} of filtered platform earnings`;
        } else {
            summaryMetric4.textContent = '—';
            metric4Sub.textContent = 'No sales in selected period';
        }

        // Render Admin-wise Table Headers
        reportsTableHead.innerHTML = `
            <tr>
                <th style="min-width: 220px;">Admin / Creator</th>
                <th>Role</th>
                <th>Catalog Mods</th>
                <th>Units Sold</th>
                <th>Amount Earned</th>
                <th>Avg Order Value</th>
                <th style="min-width: 180px;">Top Selling Mod</th>
                <th style="min-width: 130px;">Revenue Share %</th>
            </tr>
        `;

        if (adminReportRows.length === 0) {
            reportsTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-secondary" style="padding: 2.5rem 1rem;">No admin data found for the selected filters.</td></tr>`;
            exportPdfBtn.disabled = true;
            exportCsvBtn.disabled = true;
            return;
        }

        let html = '';
        adminReportRows.forEach(a => {
            const initial = (a.name || a.email || 'A')[0].toUpperCase();
            html += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="admin-avatar-badge">${initial}</div>
                            <div>
                                <div style="font-weight: 700; color: var(--admin-text-primary);">${a.name}</div>
                                <div style="font-size: 0.76rem; color: var(--admin-text-muted);">${a.email}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${a.isSuperAdmin ? `
                            <span class="super-admin-badge">👑 Super Admin</span>
                        ` : `
                            <span style="font-size: 0.75rem; font-weight: 700; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px;">Creator Admin</span>
                        `}
                    </td>
                    <td style="font-weight: 600;">${a.productsListed} mods</td>
                    <td style="font-weight: 700;">${a.unitsSold}</td>
                    <td>
                        <span style="font-weight: 800; color: #059669; font-size: 0.95rem;">${formatPrice(a.revenue)}</span>
                    </td>
                    <td style="color: var(--admin-text-secondary);">${formatPrice(a.aov)}</td>
                    <td style="font-size: 0.82rem; color: var(--admin-text-secondary);">${a.topProduct}</td>
                    <td>
                        <div style="font-weight: 800; font-size: 0.82rem; color: var(--admin-text-primary);">${formatPercent(a.share)}</div>
                        <div class="share-progress-bar">
                            <div class="share-progress-fill" style="width: ${Math.min(100, Math.max(0, a.share))}%;"></div>
                        </div>
                    </td>
                </tr>
            `;
        });
        reportsTableBody.innerHTML = html;
        exportPdfBtn.disabled = false;
        exportCsvBtn.disabled = false;

    } else {
        // --- Product-wise View ---
        metric3Title.textContent = 'Products Evaluated';
        summaryMetric3.textContent = productReportRows.length;
        metric3Sub.textContent = 'Catalog vehicles in range';

        metric4Title.textContent = 'Top Selling Product';
        const topProd = productReportRows.find(p => p.revenue > 0) || productReportRows[0];
        if (topProd && topProd.revenue > 0) {
            summaryMetric4.textContent = `${topProd.name} (${formatPrice(topProd.revenue)})`;
            metric4Sub.textContent = `${topProd.unitsSold} units &bull; ${formatPercent(topProd.share)} share`;
        } else {
            summaryMetric4.textContent = '—';
            metric4Sub.textContent = 'No sales in selected period';
        }

        // Render Product-wise Table Headers
        reportsTableHead.innerHTML = `
            <tr>
                <th style="min-width: 220px;">Product Name</th>
                ${isSuperAdmin ? '<th>Creator / Admin</th>' : ''}
                <th>Pricing Type</th>
                <th>Units Sold</th>
                <th>Total Revenue Generated</th>
                <th style="min-width: 130px;">Revenue Share %</th>
            </tr>
        `;

        if (productReportRows.length === 0) {
            reportsTableBody.innerHTML = `<tr><td colspan="${isSuperAdmin ? 6 : 5}" class="text-center text-secondary" style="padding: 2.5rem 1rem;">No product data found for the selected filters.</td></tr>`;
            exportPdfBtn.disabled = true;
            exportCsvBtn.disabled = true;
            return;
        }

        let html = '';
        productReportRows.forEach(p => {
            const isFree = p.pricingType === 'free';
            html += `
                <tr>
                    <td>
                        <div style="font-weight: 700; color: var(--admin-text-primary);">${p.name}</div>
                        <div style="font-size: 0.74rem; color: var(--admin-text-muted);">${p.category} &bull; ID: <code>${p.id.slice(0, 8)}</code></div>
                    </td>
                    ${isSuperAdmin ? `
                        <td>
                            <div style="font-weight: 600; font-size: 0.82rem; color: var(--admin-text-primary);">${p.creatorName}</div>
                            <div style="font-size: 0.74rem; color: var(--admin-text-muted);">${p.creatorEmail}</div>
                        </td>
                    ` : ''}
                    <td>
                        <span style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; background: ${isFree ? 'rgba(5, 150, 105, 0.1)' : 'rgba(37, 99, 235, 0.1)'}; color: ${isFree ? '#059669' : '#2563eb'};">
                            ${p.pricingType}
                        </span>
                    </td>
                    <td style="font-weight: 700;">${p.unitsSold}</td>
                    <td>
                        <span style="font-weight: 800; color: #059669; font-size: 0.95rem;">${formatPrice(p.revenue)}</span>
                    </td>
                    <td>
                        <div style="font-weight: 800; font-size: 0.82rem; color: var(--admin-text-primary);">${formatPercent(p.share)}</div>
                        <div class="share-progress-bar">
                            <div class="share-progress-fill" style="width: ${Math.min(100, Math.max(0, p.share))}%;"></div>
                        </div>
                    </td>
                </tr>
            `;
        });
        reportsTableBody.innerHTML = html;
        exportPdfBtn.disabled = false;
        exportCsvBtn.disabled = false;
    }
};

/**
 * PDF Export Handler (Switches cleanly between Product-wise and Admin-wise views)
 */
exportPdfBtn.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        alert('PDF generator library is initializing. Please try again in a moment.');
        return;
    }

    const doc = new jsPDF();
    const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const periodText = filterTimeSelect.options[filterTimeSelect.selectedIndex]?.text || 'All Time';

    if (currentView === 'admin') {
        // --- Admin-wise PDF ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("EnrouteIn Merchant Revenue Report (Admin-wise Breakdown)", 14, 18);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Generated on: ${todayStr} | Target Period: ${periodText}`, 14, 25);
        doc.text(`Total Platform Revenue: ${summaryRevenue.textContent} | Total Orders Sold: ${summaryUnits.textContent}`, 14, 31);
        doc.text(`Account Role: Main Super Admin (${SUPER_ADMIN_EMAIL})`, 14, 37);

        const tableHeaders = [['Admin / Creator', 'Email', 'Role', 'Catalog Mods', 'Units Sold', 'Amount Earned (INR)', 'Share %']];
        const tableRows = adminReportRows.map(a => [
            a.name,
            a.email,
            a.isSuperAdmin ? 'Super Admin' : 'Creator',
            a.productsListed,
            a.unitsSold,
            `INR ${a.revenue.toLocaleString('en-IN')}`,
            formatPercent(a.share)
        ]);

        doc.autoTable({
            startY: 44,
            head: tableHeaders,
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8.5, cellPadding: 3.5 }
        });

        doc.save(`enroute_admin_wise_revenue_report_${new Date().toISOString().split('T')[0]}.pdf`);

    } else {
        // --- Product-wise PDF ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("EnrouteIn Product Sales & Revenue Report (Product-wise)", 14, 18);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Generated on: ${todayStr} | Target Period: ${periodText}`, 14, 25);
        doc.text(`Total Filtered Revenue: ${summaryRevenue.textContent} | Total Units Sold: ${summaryUnits.textContent}`, 14, 31);
        doc.text(`Generated by: ${currentAdminEmail} ${isSuperAdmin ? '(Main Super Admin)' : ''}`, 14, 37);

        const tableHeaders = [
            isSuperAdmin 
                ? ['Product Name', 'Creator / Admin', 'Pricing', 'Units Sold', 'Total Revenue Generated (INR)', 'Share %']
                : ['Product Name', 'Pricing', 'Units Sold', 'Total Revenue Generated (INR)', 'Share %']
        ];

        const tableRows = productReportRows.map(p => {
            if (isSuperAdmin) {
                return [
                    p.name,
                    p.creatorName,
                    p.pricingType.toUpperCase(),
                    p.unitsSold,
                    `INR ${p.revenue.toLocaleString('en-IN')}`,
                    formatPercent(p.share)
                ];
            } else {
                return [
                    p.name,
                    p.pricingType.toUpperCase(),
                    p.unitsSold,
                    `INR ${p.revenue.toLocaleString('en-IN')}`,
                    formatPercent(p.share)
                ];
            }
        });

        doc.autoTable({
            startY: 44,
            head: tableHeaders,
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8.5, cellPadding: 3.5 }
        });

        doc.save(`enroute_product_wise_report_${new Date().toISOString().split('T')[0]}.pdf`);
    }
});

/**
 * CSV Export Handler
 */
exportCsvBtn.addEventListener('click', () => {
    let csv = '\uFEFF'; // UTF-8 BOM for Microsoft Excel

    if (currentView === 'admin') {
        csv += "Admin Name,Admin Email,Role,Catalog Mods Listed,Units Sold,Total Amount Earned (INR),Avg Order Value,Top Selling Product,Platform Revenue Share\n";
        adminReportRows.forEach(a => {
            csv += `"${a.name}","${a.email}","${a.isSuperAdmin ? 'Super Admin' : 'Creator'}",${a.productsListed},${a.unitsSold},${a.revenue},${a.aov.toFixed(2)},"${a.topProduct.replace(/"/g, '""')}","${formatPercent(a.share)}"\n`;
        });
        downloadCsvFile(csv, `enroute_admin_wise_revenue_${new Date().toISOString().split('T')[0]}.csv`);
    } else {
        csv += isSuperAdmin 
            ? "Product ID,Product Name,Creator Name,Creator Email,Pricing Type,Units Sold,Total Revenue Generated (INR),Revenue Share\n"
            : "Product ID,Product Name,Pricing Type,Units Sold,Total Revenue Generated (INR),Revenue Share\n";
        productReportRows.forEach(p => {
            if (isSuperAdmin) {
                csv += `"${p.id}","${p.name.replace(/"/g, '""')}","${p.creatorName}","${p.creatorEmail}","${p.pricingType}",${p.unitsSold},${p.revenue},"${formatPercent(p.share)}"\n`;
            } else {
                csv += `"${p.id}","${p.name.replace(/"/g, '""')}","${p.pricingType}",${p.unitsSold},${p.revenue},"${formatPercent(p.share)}"\n`;
            }
        });
        downloadCsvFile(csv, `enroute_product_wise_revenue_${new Date().toISOString().split('T')[0]}.csv`);
    }
});

function downloadCsvFile(content, fileName) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1500);
}

// Event Listeners
generateBtn.addEventListener('click', generateReport);
if (filterAdminSelect) {
    filterAdminSelect.addEventListener('change', generateReport);
}
if (filterProductSelect) {
    filterProductSelect.addEventListener('change', generateReport);
}

document.addEventListener('DOMContentLoaded', loadInitialData);
