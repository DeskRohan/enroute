import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, where, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    } catch(e) {}
    window.location.href = `product.html?id=${id}`;
};

// Wishlist bookmark helper
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
    } catch(err) {}
};

// Render a single product card
const createProductCard = (product) => {
    const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : product.image;
    const isFree = (product.price === 0 || product.pricingType === 'free');
    const isOutOfStock = Boolean(product.outOfStock);
    
    // Uploader details
    const uploader = adminsMap[product.addedBy] || { name: 'Admin', isVerified: false };
    const verificationBadge = uploader.isVerified ? `<img src="assets/images/varified.png" title="Verified Admin" style="height: 1.15em; vertical-align: middle; margin-left: 4px; display: inline-block;">` : '';
    
    let isWishlisted = false;
    try {
        const currentWish = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
        isWishlisted = currentWish.includes(product.id);
    } catch(e) {}

    const origPrice = product.originalPrice ?? product.price ?? 0;
    const offerPrice = product.offerPrice;
    const hasOffer = (offerPrice !== undefined && offerPrice !== null && offerPrice !== '' && Number(offerPrice) < Number(origPrice));
    const isLimited = product.offerPeriodType === 'limited';
    const isExpired = isLimited && product.offerExpiryDate && new Date(product.offerExpiryDate) <= new Date();
    const isOfferActive = hasOffer && !isExpired;

    let priceRowHtml = '';
    if (isOutOfStock) {
        priceRowHtml = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <span style="font-size: 0.85rem; font-weight: 800; color: #dc2626; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); padding: 3px 8px; border-radius: 6px;">OUT OF STOCK</span>
                <span class="price" style="color: var(--text-muted); text-decoration: line-through; font-size: 0.95rem;">${isFree ? 'FREE' : formatPrice(origPrice)}</span>
            </div>
        `;
    } else if (isFree) {
        priceRowHtml = `<span class="price free">FREE</span>`;
    } else if (isOfferActive) {
        const discountPct = Math.round(((origPrice - offerPrice) / origPrice) * 100);
        priceRowHtml = `
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <div style="display: flex; align-items: baseline; gap: 6px;">
                    <span class="price" style="color: var(--color-primary);">${formatPrice(offerPrice)}</span>
                    <span style="text-decoration: line-through; color: var(--text-muted); font-size: 0.85rem;">${formatPrice(origPrice)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); padding: 1px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 800;">${discountPct}% OFF</span>
                    ${isLimited ? `<span style="font-size: 0.68rem; color: #d97706; font-weight: 600;">⚡ Limited Deal</span>` : `<span style="font-size: 0.68rem; color: #059669; font-weight: 600;">⚡ Lifetime Offer</span>`}
                </div>
            </div>
        `;
    } else {
        priceRowHtml = `<span class="price">${formatPrice(origPrice)}</span>`;
    }

    const outOfStockBadgeHtml = isOutOfStock ? `
        <div style="position: absolute; top: 10px; left: 10px; background: rgba(220, 38, 38, 0.95); backdrop-filter: blur(4px); color: #ffffff; padding: 3px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; z-index: 3; box-shadow: 0 2px 6px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 4px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></span> Out of Stock
        </div>
    ` : '';

    const actionButtonHtml = isOutOfStock ? `
        <a href="product.html?id=${product.id}" onclick="try{sessionStorage.setItem('viewProductId', '${product.id}');}catch(e){}" class="btn btn-outline" style="width: 100%; border-color: #ef4444; color: #ef4444; background: rgba(239, 68, 68, 0.05); font-weight: 700;">
            <span>Unavailable</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
        </a>
    ` : `
        <a href="product.html?id=${product.id}" onclick="try{sessionStorage.setItem('viewProductId', '${product.id}');}catch(e){}" class="btn btn-primary" style="width: 100%;">
            <span>View Details</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </a>
    `;

    return `
        <div class="card product-card ${isOutOfStock ? 'product-card-out-of-stock' : ''}" style="position: relative;">
            ${outOfStockBadgeHtml}
            <button class="card-wishlist-btn ${isWishlisted ? 'active' : ''}" id="wish-btn-${product.id}" onclick="window.toggleWishlist(event, '${product.id}')" title="Save to Garage Wishlist">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="${isWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <a href="product.html?id=${product.id}" onclick="try{sessionStorage.setItem('viewProductId', '${product.id}');}catch(e){}" style="display: block;">
                <div class="img-container" style="position: relative;">
                    <img src="${getImageUrl(imgUrl)}" alt="${product.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';" style="${isOutOfStock ? 'filter: grayscale(85%) opacity(0.85);' : ''}">
                </div>
            </a>
            <div class="content">
                <span class="category-pill">${product.category === 'livery' ? 'Vehicle Livery/Skin' : 'Vehicle Mod'}</span>
                <a href="product.html?id=${product.id}" onclick="try{sessionStorage.setItem('viewProductId', '${product.id}');}catch(e){}">
                    <h3 class="title">${product.name}</h3>
                </a>
                <div class="uploader-info">
                    <span>By:</span>
                    <span class="uploader-name">${uploader.name}</span>${verificationBadge}
                </div>
                <div class="price-row">
                    ${priceRowHtml}
                </div>
                ${actionButtonHtml}
            </div>
        </div>
    `;
};

// Render array of products to container
const renderProducts = (products, container) => {
    if (!container) return;
    
    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: var(--spacing-16) var(--spacing-4); background: var(--bg-secondary); border-radius: var(--radius-xl); border: 1px dashed var(--color-border);">
                <div style="width: 64px; height: 64px; border-radius: var(--radius-full); background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin: 0 auto var(--spacing-4);">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <h3 style="margin-bottom: 0.5rem; font-size: 1.25rem;">No products found</h3>
                <p class="text-secondary" style="font-size: 0.95rem;">Try adjusting your search query or filter criteria.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = products.map(createProductCard).join('');
};

// Fetch and render Featured Products (For Home Page)
export const loadFeaturedProducts = async () => {
    if (!featuredContainer) return;
    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(15));
        const snapshot = await getDocs(q);
        let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter out scheduled products in the future, and out-of-stock products
        products = products.filter(p => {
            if (p.outOfStock) return false;
            if (p.status === 'scheduled') {
                return p.scheduledDate && new Date(p.scheduledDate) <= new Date();
            }
            return true;
        });
        
        renderProducts(products.slice(0, 3), featuredContainer);
    } catch (error) {
        console.error("Error loading featured products:", error);
        featuredContainer.innerHTML = `<p class="text-secondary text-center" style="grid-column: 1/-1;">Failed to load products. Please try again later.</p>`;
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
        
        renderProducts(allProducts, productsContainer);
    } catch (error) {
        console.error("Error loading all products:", error);
        productsContainer.innerHTML = `<p class="text-secondary text-center" style="grid-column: 1/-1;">Failed to load products. Please try again later.</p>`;
    }
};

// Filter and Sort Logic
const applyFilters = () => {
    if (!productsContainer) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    const sort = sortFilter.value;

    let filtered = allProducts.filter(p => {
        const safeName = p.name || '';
        const safeDesc = p.description || '';
        const matchesSearch = safeName.toLowerCase().includes(searchTerm) || safeDesc.toLowerCase().includes(searchTerm);
        const matchesCategory = category === 'all' || p.category === category;
        return matchesSearch && matchesCategory;
    });

    if (sort === 'price-low') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
        filtered.sort((a, b) => b.price - a.price);
    } else { // newest
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    renderProducts(filtered, productsContainer);
};

// Event Listeners
if (searchInput) searchInput.addEventListener('input', applyFilters);
if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
if (sortFilter) sortFilter.addEventListener('change', applyFilters);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchAdmins();
    loadFeaturedProducts();
    loadAllProducts();
});
