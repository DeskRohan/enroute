import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, where, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const productsContainer = document.getElementById('products-container');
const featuredContainer = document.getElementById('featured-products');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const sortFilter = document.getElementById('sort-filter');

let allProducts = [];
let adminsMap = {}; // mapping email to {name, isVerified}

// Fetch Admins
const fetchAdmins = async () => {
    try {
        const q = query(collection(db, "users"), where("role", "==", "admin"));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.email) {
                adminsMap[data.email] = {
                    name: data.name || 'Admin',
                    isVerified: data.isVerified || false
                };
            }
        });
        // Main admin is always verified
        if (adminsMap['admin@enroute.in']) {
            adminsMap['admin@enroute.in'].isVerified = true;
        } else {
            adminsMap['admin@enroute.in'] = { name: 'EnrouteIn', isVerified: true };
        }
    } catch (error) {
        console.error("Error fetching admins:", error);
    }
};

// Format currency
const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(price);
};

// Google Drive Image URL Converter (Reliable Google UserContent CDN & direct links)
const getImageUrl = (url) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';
    }

    const cleanUrl = url.trim();

    // Already Google User Content CDN
    if (cleanUrl.includes('googleusercontent.com/d/')) {
        return cleanUrl;
    }

    let fileId = null;
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]{20,})/,
        /[?&]id=([a-zA-Z0-9_-]{20,})/,
        /\/d\/([a-zA-Z0-9_-]{20,})/,
        /drive\.google\.com\/.*?\/([a-zA-Z0-9_-]{20,})/,
        /^([a-zA-Z0-9_-]{25,50})$/
    ];

    for (const pattern of patterns) {
        const match = cleanUrl.match(pattern);
        if (match && match[1]) {
            fileId = match[1];
            break;
        }
    }

    if (fileId) {
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    }

    return cleanUrl;
};

// Helper to navigate to product robustly
window.goToProduct = (id) => {
    try {
        sessionStorage.setItem('viewProductId', id);
    } catch (e) { }
    window.location.href = `product.html?id=${id}`;
};

// Wishlist bookmark helper
export const updateWishlistBadge = () => {
    try {
        const list = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
        document.querySelectorAll('.nav-wish-badge').forEach(b => {
            b.textContent = list.length;
            b.style.display = list.length > 0 ? 'inline-flex' : 'none';
        });
    } catch (e) { }
};

window.toggleWishlist = (e, id) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    try {
        let wishlist = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
        const btn = document.getElementById(`wish-btn-${id}`);
        if (wishlist.includes(id)) {
            wishlist = wishlist.filter(x => x !== id);
            if (btn) btn.classList.remove('active');
        } else {
            wishlist.push(id);
            if (btn) btn.classList.add('active');
        }
        localStorage.setItem('enroute_wishlist', JSON.stringify(wishlist));
        updateWishlistBadge();
    } catch (err) { }
};

// Render a single product card (Image 2 for Desktop, Image 1 for Mobile)
const createProductCard = (product) => {
    const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : product.image;
    const isFree = (product.price === 0 || product.pricingType === 'free');
    const isOutOfStock = Boolean(product.outOfStock);

    // Uploader details
    const uploader = adminsMap[product.addedBy] || { name: 'EnrouteIn', isVerified: true };
    const verificationBadge = uploader.isVerified ? `<img src="assets/images/varified.png" title="Verified Creator" style="height: 1.05em; vertical-align: middle; margin-left: 3px; display: inline-block;">` : '';

    let isWishlisted = false;
    try {
        const currentWish = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
        isWishlisted = currentWish.includes(product.id);
    } catch (e) { }

    const origPrice = product.originalPrice ?? product.price ?? 0;
    const offerPrice = product.offerPrice;
    const hasOffer = (offerPrice !== undefined && offerPrice !== null && offerPrice !== '' && Number(offerPrice) < Number(origPrice));
    const isLimited = product.offerPeriodType === 'limited';
    const isExpired = isLimited && product.offerExpiryDate && new Date(product.offerExpiryDate) <= new Date();
    const isOfferActive = hasOffer && !isExpired;
    const discountPct = (origPrice > 0 && isOfferActive) ? Math.round(((origPrice - offerPrice) / origPrice) * 100) : 0;

    // Badge on top-left of image
    let badgeText = 'Bestseller';
    let badgeBg = '#238636';
    if (isOutOfStock) {
        badgeText = 'Out of Stock';
        badgeBg = '#dc2626';
    } else if (product.category === 'livery') {
        badgeText = 'Livery Skin';
        badgeBg = '#007DC6';
    } else if (isOfferActive) {
        badgeText = `${discountPct}% OFF`;
        badgeBg = '#EAB800';
    }

    return `
        <div class="product-card fk-product-card ${isOutOfStock ? 'fk-out-of-stock' : ''}">
            <!-- Column 1: Image / Media -->
            <div class="fk-col-media">
                <span class="fk-badge-pill" style="background: ${badgeBg};">${badgeText}</span>
                <button class="card-wishlist-btn ${isWishlisted ? 'active' : ''}" id="wish-btn-${product.id}" onclick="window.toggleWishlist(event, '${product.id}')" title="Save to Wishlist">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="${isWishlisted ? '#ef4444' : 'none'}" stroke="${isWishlisted ? '#ef4444' : '#60646C'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
                <a href="product.html?id=${product.id}" onclick="try{sessionStorage.setItem('viewProductId', '${product.id}');}catch(e){}" class="fk-img-anchor">
                    <img src="${getImageUrl(imgUrl)}" alt="${product.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';" style="${isOutOfStock ? 'filter: grayscale(85%) opacity(0.85);' : ''}">
                </a>
            </div>

            <!-- Column 2: Center Details (Desktop specs + Mobile body) -->
            <div class="fk-col-details">
                <a href="product.html?id=${product.id}" onclick="try{sessionStorage.setItem('viewProductId', '${product.id}');}catch(e){}" class="fk-title-link">
                    <h3 class="fk-title">${product.name}</h3>
                </a>

                <!-- Creator & Assured Tag -->
                <div class="fk-rating-row" style="margin-bottom: 0.5rem;">
                    <span class="fk-assured-tag" title="Enroute Verified Mod">
                        <span class="fk-assured-shield">🛡️</span>
                        <span class="fk-assured-text">Assured</span>
                    </span>
                    <span class="fk-creator-text" style="font-size: 0.78rem; color: var(--text-muted); margin-left: 4px;">By ${uploader.name}${verificationBadge}</span>
                </div>
                <!-- Desktop Bullet Specifications (Image 2 style) -->
                <ul class="fk-specs-bullets">
                    <li>Compatibility: <strong>${product.version || 'BUSSID Universal (v3.8+)'}</strong></li>
                    <li>Category: <strong>${product.category === 'livery' ? 'High-Res Livery Skin' : (product.category || 'High-Poly Bus Mod')}</strong></li>
                    <li>Download Archive: <strong>${product.size || '35 MB'} (.bussidmod)</strong></li>
                    <li>Custom Sound & Clean 3D Mesh Included</li>
                    <li>Instant Cloud Download &bull; Lifetime Commercial License</li>
                </ul>

                <!-- Mobile Pricing & Deal Block (Image 1 style) -->
                <div class="fk-mobile-price-block">
                    <div class="fk-mobile-price-row">
                        ${isOutOfStock ? `
                            <span style="font-size: 0.75rem; font-weight: 800; color: #dc2626; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); padding: 1px 5px; border-radius: 3px;">OUT OF STOCK</span>
                            <span class="fk-mobile-orig-price">${isFree ? 'FREE' : formatPrice(origPrice)}</span>
                        ` : (isFree ? `
                            <span class="fk-mobile-final-price" style="color: var(--color-success);">FREE</span>
                        ` : (isOfferActive ? `
                            <span class="fk-mobile-discount">↓${discountPct}%</span>
                            <span class="fk-mobile-orig-price">${formatPrice(origPrice)}</span>
                            <span class="fk-mobile-final-price">${formatPrice(offerPrice)}</span>
                        ` : `
                            <span class="fk-mobile-final-price">${formatPrice(origPrice)}</span>
                        `))}
                    </div>
                    ${(!isOutOfStock && isOfferActive) ? `
                        <div class="fk-mobile-offer-line">
                            <span class="fk-mobile-offer-badge">WOW!</span>
                            <span>${formatPrice(offerPrice)} with Creator Deal</span>
                        </div>
                    ` : ''}
                    <div class="fk-mobile-perk-line">
                        <span>Free Instant Download &bull; 100% Virus-Free</span>
                    </div>
                </div>
            </div>

            <!-- Column 3: Desktop Pricing & Action (Image 2 style) -->
            <div class="fk-col-pricing">
                <div class="fk-desktop-price-wrap">
                    <div class="fk-desktop-price-main">
                        <span class="fk-price-amount" style="${isFree ? 'color: var(--color-success);' : ''}">${isOutOfStock ? (isFree ? 'FREE' : formatPrice(origPrice)) : (isFree ? 'FREE' : (isOfferActive ? formatPrice(offerPrice) : formatPrice(origPrice)))}</span>
                        <span class="fk-assured-tag-desktop">
                            <span style="color: #007DC6; font-weight: 800;">Enroute</span><span style="color: #EAB800; font-style: italic; font-weight: 800;">Assured</span>
                        </span>
                    </div>

                    ${(isOutOfStock) ? `
                        <span style="font-size: 0.75rem; font-weight: 800; color: #dc2626; margin-top: 4px;">Currently Out of Stock</span>
                    ` : (isOfferActive && !isFree ? `
                        <div class="fk-desktop-orig-price">
                            <span class="fk-strikethrough">${formatPrice(origPrice)}</span>
                            <span class="fk-discount-green">${discountPct}% off</span>
                        </div>
                    ` : '')}

                    <div class="fk-desktop-perk">Free Instant Download</div>
                    ${isOfferActive ? '<div class="fk-desktop-offer-tag">Special Creator Deal</div>' : ''}
                </div>

                <div class="fk-desktop-action">
                    ${isOutOfStock ? `
                        <a href="product.html?id=${product.id}" onclick="try{sessionStorage.setItem('viewProductId', '${product.id}');}catch(e){}" class="btn btn-outline btn-sm" style="width: 100%; border-color: #ef4444; color: #ef4444;">
                            <span>Unavailable</span>
                        </a>
                    ` : `
                        <a href="product.html?id=${product.id}" onclick="try{sessionStorage.setItem('viewProductId', '${product.id}');}catch(e){}" class="btn btn-primary btn-sm" style="width: 100%; font-weight: 700;">
                            <span>View Details</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                        </a>
                    `}
                </div>
            </div>
        </div>
    `;
};

// Render array of products to container
const renderProducts = (products, container) => {
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; background: #FFFFFF; border-radius: var(--radius-md); border: 1px dashed var(--color-border);">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <h3 style="margin-bottom: 0.5rem; font-size: 1.15rem; color: var(--text-primary);">No products found</h3>
                <p class="text-secondary" style="font-size: 0.9rem; margin-bottom: 1.25rem;">Try adjusting your search query or removing active filters.</p>
                <button type="button" class="btn btn-outline btn-sm" onclick="window.clearProductFilters()" style="margin: 0 auto;">Clear All Filters</button>
            </div>
        `;
        return;
    }

    container.innerHTML = products.map(createProductCard).join('');
};

window.clearProductFilters = () => {
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.nav-search-input, #header-search-input').forEach(inp => {
        inp.value = '';
    });
    if (categoryFilter) categoryFilter.value = 'all';
    if (sortFilter) sortFilter.value = 'newest';

    try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('search');
        currentUrl.searchParams.delete('q');
        currentUrl.searchParams.delete('category');
        currentUrl.searchParams.delete('sort');
        window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
    } catch (_) { }

    applyFilters();
};

// Fetch and render Featured Sections (For Home Page)
export const loadFeaturedProducts = async () => {
    const featuredEl = document.getElementById('featured-products');
    const popularModsEl = document.getElementById('popular-mods');
    const popularLiveriesEl = document.getElementById('popular-liveries');
    const budgetModsEl = document.getElementById('budget-mods');

    if (!featuredEl && !popularModsEl && !popularLiveriesEl && !budgetModsEl) return;

    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(25));
        const snapshot = await getDocs(q);
        let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter out scheduled products in the future and out-of-stock from top banner
        const availableProducts = products.filter(p => {
            if (p.outOfStock) return false;
            if (p.status === 'scheduled') {
                return p.scheduledDate && new Date(p.scheduledDate) <= new Date();
            }
            return true;
        });

        // 1. Featured Releases (Latest 4)
        if (featuredEl) {
            renderProducts(availableProducts.slice(0, 4), featuredEl);
        }

        // 2. Popular Vehicle Mods
        if (popularModsEl) {
            const mods = availableProducts.filter(p => p.category !== 'livery').slice(0, 4);
            renderProducts(mods.length > 0 ? mods : availableProducts.slice(0, 4), popularModsEl);
        }

        // 3. Top Livery Skins
        if (popularLiveriesEl) {
            const liveries = availableProducts.filter(p => p.category === 'livery').slice(0, 4);
            renderProducts(liveries, popularLiveriesEl);
        }

        // 4. Budget / Free Mods
        if (budgetModsEl) {
            const budget = availableProducts.filter(p => p.price === 0 || p.pricingType === 'free' || (p.price && p.price <= 50)).slice(0, 4);
            if (budget.length > 0) {
                renderProducts(budget, budgetModsEl);
            } else {
                const section = budgetModsEl.closest('section');
                if (section) section.style.display = 'none';
            }
        }
    } catch (error) {
        console.error("Error loading featured products:", error);
        if (featuredEl) {
            featuredEl.innerHTML = `<p class="text-secondary text-center" style="grid-column: 1/-1;">Failed to load products. Please check back shortly.</p>`;
        }
    }
};

// Fetch and render All Products (For Products Page)
export const loadAllProducts = async () => {
    if (!productsContainer) return;
    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter out scheduled products in the future
        allProducts = allProducts.filter(p => {
            if (p.status === 'scheduled') {
                return p.scheduledDate && new Date(p.scheduledDate) <= new Date();
            }
            return true;
        });

        // Apply URL query params on initial load
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = (urlParams.get('search') || urlParams.get('q') || '').trim();
        const categoryParam = urlParams.get('category');
        const sortParam = urlParams.get('sort');

        if (searchParam) {
            if (searchInput) searchInput.value = searchParam;
            document.querySelectorAll('.nav-search-input, #header-search-input').forEach(inp => {
                inp.value = searchParam;
            });
        }
        if (categoryParam && categoryFilter) {
            categoryFilter.value = categoryParam;
        }
        if (sortParam && sortFilter) {
            sortFilter.value = sortParam;
        }

        syncPillsFromCurrent();
        applyFilters();
    } catch (error) {
        console.error("Error loading all products:", error);
        productsContainer.innerHTML = `<p class="text-secondary text-center" style="grid-column: 1/-1;">Failed to load products. Please try again later.</p>`;
    }
};

// Filter and Sort Logic
const applyFilters = () => {
    if (!productsContainer) return;

    const headerInput = document.getElementById('header-search-input');
    const bottomInput = document.getElementById('search-input');
    const searchTerm = (headerInput ? headerInput.value : (bottomInput ? bottomInput.value : '')).toLowerCase().trim();
    const category = categoryFilter ? categoryFilter.value : 'all';
    const sort = sortFilter ? sortFilter.value : 'newest';

    let filtered = allProducts.filter(p => {
        const safeName = (p.name || '').toLowerCase();
        const safeDesc = (p.description || '').toLowerCase();
        const safeCategory = (p.category || '').toLowerCase();
        const safeAddedBy = (p.addedBy || '').toLowerCase();

        const matchesSearch = !searchTerm || safeName.includes(searchTerm) || safeDesc.includes(searchTerm) || safeCategory.includes(searchTerm) || safeAddedBy.includes(searchTerm);

        let matchesCategory = false;
        if (category === 'all') {
            matchesCategory = true;
        } else if (category === 'sleeper') {
            matchesCategory = p.category === 'sleeper' || safeCategory.includes('sleeper') || safeName.includes('sleeper') || safeDesc.includes('sleeper');
        } else if (category === 'seater') {
            matchesCategory = p.category === 'seater' || safeCategory.includes('seater') || safeName.includes('seater') || safeDesc.includes('seater');
        } else if (category === 'mod') {
            matchesCategory = p.category === 'mod' || (!safeCategory.includes('livery') && p.category !== 'livery');
        } else if (category === 'livery') {
            matchesCategory = p.category === 'livery' || safeCategory.includes('livery');
        } else {
            matchesCategory = p.category === category || safeCategory.includes(category);
        }

        return matchesSearch && matchesCategory;
    });

    if (sort === 'price-low') {
        filtered.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (sort === 'price-high') {
        filtered.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    } else { // newest
        filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    // Update filter active dot on trigger button
    const hasActiveFilters = (category !== 'all' || sort !== 'newest');
    document.querySelectorAll('#header-filter-dot, #filter-active-dot').forEach(dot => {
        dot.style.display = hasActiveFilters ? 'block' : 'none';
    });

    // Update Category badge
    const catBadge = document.getElementById('active-category-query-wrap');
    const catBadgeText = document.getElementById('active-category-query-text');
    if (catBadge && catBadgeText) {
        if (category !== 'all') {
            const labelMap = {
                'mod': 'Vehicle Mods',
                'livery': 'Livery Skins',
                'sleeper': 'Sleeper Bus Mods',
                'seater': 'Seater Bus Mods'
            };
            catBadgeText.textContent = labelMap[category] || category;
            catBadge.style.display = 'inline-flex';
        } else {
            catBadge.style.display = 'none';
        }
    }

    // Update Sort badge
    const sortBadge = document.getElementById('active-sort-query-wrap');
    const sortBadgeText = document.getElementById('active-sort-query-text');
    if (sortBadge && sortBadgeText) {
        if (sort !== 'newest') {
            const sortMap = {
                'price-low': 'Price: Low to High',
                'price-high': 'Price: High to Low'
            };
            sortBadgeText.textContent = sortMap[sort] || sort;
            sortBadge.style.display = 'inline-flex';
        } else {
            sortBadge.style.display = 'none';
        }
    }

    // Update active search query badge
    const activeQueryWrap = document.getElementById('active-search-query-wrap');
    const activeQueryText = document.getElementById('active-search-query-text');
    if (activeQueryWrap && activeQueryText) {
        if (searchTerm) {
            activeQueryText.textContent = searchTerm;
            activeQueryWrap.style.display = 'inline-flex';
        } else {
            activeQueryWrap.style.display = 'none';
        }
    }

    renderProducts(filtered, productsContainer);
};

// Filter Controls (Desktop Sidebar & Mobile Bottom Sheet)
const filterModalOverlay = document.getElementById('filter-modal-overlay');
const closeFilterModalBtn = document.getElementById('close-filter-modal-btn');
const filterSheetApplyBtn = document.getElementById('filter-sheet-apply-btn');
const filterSheetResetBtn = document.getElementById('filter-sheet-reset-btn');
const sidebarResetBtn = document.getElementById('sidebar-reset-btn');

let tempCategory = 'all';
let tempSort = 'newest';

// Sync controls across Desktop Sidebar, Mobile Bottom Sheet, and Select elements
const syncPillsFromCurrent = () => {
    const curCategory = categoryFilter ? categoryFilter.value : 'all';
    const curSort = sortFilter ? sortFilter.value : 'newest';
    tempCategory = curCategory;
    tempSort = curSort;

    // Desktop Sidebar Radios
    document.querySelectorAll('input[name="sidebar-category"]').forEach(radio => {
        radio.checked = (radio.value === curCategory);
    });
    document.querySelectorAll('input[name="sidebar-sort"]').forEach(radio => {
        radio.checked = (radio.value === curSort);
    });

    // Mobile Sheet Pills
    document.querySelectorAll('#category-pills .filter-pill').forEach(pill => {
        if (pill.getAttribute('data-category') === curCategory) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    document.querySelectorAll('#sort-pills .filter-pill').forEach(pill => {
        if (pill.getAttribute('data-sort') === curSort) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    // Active indicator dot
    const hasActiveFilters = (curCategory !== 'all' || curSort !== 'newest');
    document.querySelectorAll('#header-filter-dot, #filter-active-dot').forEach(dot => {
        dot.style.display = hasActiveFilters ? 'block' : 'none';
    });
};

// Open filter modal from either header button or trigger
document.querySelectorAll('#open-header-filter-btn, #open-filter-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (filterModalOverlay) {
            syncPillsFromCurrent();
            filterModalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    });
});

const closeFilterModal = () => {
    if (filterModalOverlay) {
        filterModalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
};

if (closeFilterModalBtn) {
    closeFilterModalBtn.addEventListener('click', closeFilterModal);
}

if (filterModalOverlay) {
    filterModalOverlay.addEventListener('click', (e) => {
        if (e.target === filterModalOverlay) {
            closeFilterModal();
        }
    });
}

// Category Pill Selection in Modal
document.querySelectorAll('#category-pills .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('#category-pills .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        tempCategory = pill.getAttribute('data-category') || 'all';
    });
});

// Sort Pill Selection in Modal
document.querySelectorAll('#sort-pills .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('#sort-pills .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        tempSort = pill.getAttribute('data-sort') || 'newest';
    });
});

// Apply filters from mobile modal
if (filterSheetApplyBtn) {
    filterSheetApplyBtn.addEventListener('click', () => {
        if (categoryFilter) categoryFilter.value = tempCategory;
        if (sortFilter) sortFilter.value = tempSort;

        try {
            const currentUrl = new URL(window.location.href);
            if (tempCategory !== 'all') {
                currentUrl.searchParams.set('category', tempCategory);
            } else {
                currentUrl.searchParams.delete('category');
            }
            if (tempSort !== 'newest') {
                currentUrl.searchParams.set('sort', tempSort);
            } else {
                currentUrl.searchParams.delete('sort');
            }
            window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
        } catch (_) { }

        syncPillsFromCurrent();
        closeFilterModal();
        applyFilters();
    });
}

// Reset filters in mobile modal
if (filterSheetResetBtn) {
    filterSheetResetBtn.addEventListener('click', () => {
        tempCategory = 'all';
        tempSort = 'newest';

        if (categoryFilter) categoryFilter.value = 'all';
        if (sortFilter) sortFilter.value = 'newest';

        syncPillsFromCurrent();

        try {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete('category');
            currentUrl.searchParams.delete('sort');
            window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
        } catch (_) { }

        closeFilterModal();
        applyFilters();
    });
}

// Desktop Sidebar Radio Listeners
document.querySelectorAll('input[name="sidebar-category"]').forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.checked) {
            if (categoryFilter) categoryFilter.value = radio.value;
            try {
                const currentUrl = new URL(window.location.href);
                if (radio.value !== 'all') {
                    currentUrl.searchParams.set('category', radio.value);
                } else {
                    currentUrl.searchParams.delete('category');
                }
                window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
            } catch (_) { }
            syncPillsFromCurrent();
            applyFilters();
        }
    });
});

document.querySelectorAll('input[name="sidebar-sort"]').forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.checked) {
            if (sortFilter) sortFilter.value = radio.value;
            try {
                const currentUrl = new URL(window.location.href);
                if (radio.value !== 'newest') {
                    currentUrl.searchParams.set('sort', radio.value);
                } else {
                    currentUrl.searchParams.delete('sort');
                }
                window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
            } catch (_) { }
            syncPillsFromCurrent();
            applyFilters();
        }
    });
});

if (sidebarResetBtn) {
    sidebarResetBtn.addEventListener('click', () => {
        if (categoryFilter) categoryFilter.value = 'all';
        if (sortFilter) sortFilter.value = 'newest';
        try {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete('category');
            currentUrl.searchParams.delete('sort');
            window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
        } catch (_) { }
        syncPillsFromCurrent();
        applyFilters();
    });
}

// Global filter clear functions called from active tags
window.clearCategoryFilter = () => {
    if (categoryFilter) categoryFilter.value = 'all';
    try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('category');
        window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
    } catch (_) { }
    syncPillsFromCurrent();
    applyFilters();
};

window.clearSortFilter = () => {
    if (sortFilter) sortFilter.value = 'newest';
    try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('sort');
        window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
    } catch (_) { }
    syncPillsFromCurrent();
    applyFilters();
};

window.clearSearchFilter = () => {
    document.querySelectorAll('.nav-search-input, #header-search-input, #search-input').forEach(inp => {
        inp.value = '';
    });
    try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('search');
        window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
    } catch (_) { }
    applyFilters();
};

// Event Listeners for catalog filters with bidirectional sync and URL updates
if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
        try {
            const currentUrl = new URL(window.location.href);
            if (categoryFilter.value !== 'all') {
                currentUrl.searchParams.set('category', categoryFilter.value);
            } else {
                currentUrl.searchParams.delete('category');
            }
            window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
        } catch (_) { }
        syncPillsFromCurrent();
        applyFilters();
    });
}

if (sortFilter) {
    sortFilter.addEventListener('change', () => {
        try {
            const currentUrl = new URL(window.location.href);
            if (sortFilter.value !== 'newest') {
                currentUrl.searchParams.set('sort', sortFilter.value);
            } else {
                currentUrl.searchParams.delete('sort');
            }
            window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
        } catch (_) { }
        syncPillsFromCurrent();
        applyFilters();
    });
}

// Header search form global handler (works on products.html, index.html, and all pages)
const initHeaderSearch = () => {
    // Live typing sync from header search inputs when on products page
    document.querySelectorAll('.nav-search-input, #header-search-input').forEach(headerInp => {
        headerInp.addEventListener('input', (e) => {
            if (productsContainer) {
                const val = e.target.value;
                document.querySelectorAll('.nav-search-input, #header-search-input').forEach(other => {
                    if (other !== e.target) other.value = val;
                });
                try {
                    const currentUrl = new URL(window.location.href);
                    if (val.trim()) {
                        currentUrl.searchParams.set('search', val.trim());
                    } else {
                        currentUrl.searchParams.delete('search');
                    }
                    window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
                } catch (_) { }
                applyFilters();
            }
        });
    });

    // Form submit handler
    document.querySelectorAll('.nav-search-form, #header-search-form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = form.querySelector('input[type="text"]');
            const term = input ? input.value.trim() : '';

            // If we are on products.html (catalog page with productsContainer)
            if (productsContainer) {
                document.querySelectorAll('.nav-search-input, #header-search-input').forEach(inp => {
                    inp.value = term;
                });
                try {
                    const currentUrl = new URL(window.location.href);
                    if (term) {
                        currentUrl.searchParams.set('search', term);
                    } else {
                        currentUrl.searchParams.delete('search');
                    }
                    window.history.replaceState(null, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
                } catch (_) { }
                applyFilters();

                // Smooth scroll to catalog results if page is scrolled
                const scrollTarget = document.querySelector('.catalog-layout') || productsContainer;
                if (scrollTarget && window.scrollY > 200) {
                    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else {
                // On index.html or any other page: directly open the store with the search term (never product.html)
                if (term) {
                    window.location.href = `products.html?search=${encodeURIComponent(term)}`;
                } else {
                    window.location.href = 'products.html';
                }
            }
        });
    });
};

// Live Recent Products Marquee Ticker (Real-Time Firestore Listener)
export const initRecentProductsMarquee = () => {
    const track = document.getElementById('recent-products-track');
    if (!track) return;

    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(12));

        onSnapshot(q, (snapshot) => {
            const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter out scheduled future products or out-of-stock
            const recent = products.filter(p => {
                if (p.outOfStock) return false;
                if (p.status === 'scheduled') {
                    return p.scheduledDate && new Date(p.scheduledDate) <= new Date();
                }
                return true;
            });

            if (recent.length === 0) {
                track.innerHTML = `<span class="marquee-loading-item">⚡ Fresh simulator mods dropping soon &bull; Stay tuned!</span>`;
                return;
            }

            const renderItems = (list) => list.map(p => {
                const img = getImageUrl(p.imageUrl || p.image);
                const isFree = p.price === 0 || p.pricingType === 'free';
                const priceText = isFree ? 'FREE' : formatPrice(p.price);
                const categoryIcon = p.category === 'livery' ? '🎨' : '🚌';

                return `
                    <a href="product.html?id=${p.id}" class="marquee-product-chip" title="View ${p.name}">
                        <span class="chip-badge">NEW</span>
                        <div class="chip-img-wrap">
                            <img src="${img}" alt="${p.name}" class="chip-img" loading="lazy" onerror="this.parentElement.style.display='none'">
                        </div>
                        <span class="chip-title">${categoryIcon} ${p.name}</span>
                        <span class="chip-price ${isFree ? 'is-free' : ''}">${priceText}</span>
                    </a>
                    <span class="marquee-divider">★</span>
                `;
            }).join('');

            // Duplicate items for continuous seamless loop without jump
            const itemsHtml = renderItems(recent);
            track.innerHTML = itemsHtml + itemsHtml;
        }, (error) => {
            console.error("Error loading marquee products:", error);
            track.innerHTML = `<span class="marquee-loading-item">⚡ Explore our latest BUSSID simulator collection now!</span>`;
        });
    } catch (err) {
        console.error("Marquee initialization error:", err);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchAdmins();
    updateWishlistBadge();
    initHeaderSearch();
    initRecentProductsMarquee();
    loadFeaturedProducts();
    loadAllProducts();
});
