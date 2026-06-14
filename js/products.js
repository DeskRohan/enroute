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

// Google Drive Image URL Converter
const getImageUrl = (url) => {
    if (!url || url.trim() === '') return 'https://via.placeholder.com/400x300?text=No+Image';

    // Non-Google Drive URLs — return as-is
    if (url.startsWith("http") && !url.includes("drive.google.com")) {
        return url;
    }

    let fileId = null;

    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /open\?id=([a-zA-Z0-9_-]+)/,
        /uc\?id=([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            fileId = match[1];
            break;
        }
    }

    if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }

    return url;
};

// Helper to navigate to product robustly
window.goToProduct = (id) => {
    sessionStorage.setItem('viewProductId', id);
    window.location.href = `product.html?id=${id}`;
};

// Render a single product card
const createProductCard = (product) => {
    const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : product.image;
    
    // Uploader details
    const uploader = adminsMap[product.addedBy] || { name: 'Admin', isVerified: false };
    const verificationBadge = uploader.isVerified ? `<img src="assets/images/varified.png" title="Verified Admin" style="height: 1.2em; vertical-align: middle; margin-left: 4px; display: inline-block;">` : '';
    
    return `
        <div class="card product-card">
            <a href="javascript:void(0)" onclick="goToProduct('${product.id}')">
                <div class="img-container">
                    <img src="${getImageUrl(imgUrl)}" alt="${product.name}" loading="lazy">
                </div>
            </a>
            <div class="content">
                <a href="javascript:void(0)" onclick="goToProduct('${product.id}')"><h3 class="title">${product.name}</h3></a>
                <p class="text-secondary" style="font-size: 0.875rem; margin-bottom: 0.5rem;">${product.category || 'Mod'}</p>
                <div style="font-size: 0.8rem; margin-bottom: 0.5rem; color: var(--text-secondary);">
                    By: <span style="font-weight: 600; color: var(--text-primary);">${uploader.name}</span>${verificationBadge}
                </div>
                <div class="price">${(product.price === 0 || product.pricingType === 'free') ? 'FREE' : formatPrice(product.price)}</div>
                <a href="javascript:void(0)" onclick="goToProduct('${product.id}')" class="btn btn-primary" style="width: 100%;">View Details</a>
            </div>
        </div>
    `;
};

// Render array of products to container
const renderProducts = (products, container) => {
    if (!container) return;
    
    if (products.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No products found</h3><p>Try adjusting your search or filters.</p></div>`;
        return;
    }

    container.innerHTML = products.map(createProductCard).join('');
};

// Fetch and render Featured Products (For Home Page)
export const loadFeaturedProducts = async () => {
    if (!featuredContainer) return;
    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(3));
        const snapshot = await getDocs(q);
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts(products, featuredContainer);
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
        const matchesSearch = p.name.toLowerCase().includes(searchTerm) || p.description?.toLowerCase().includes(searchTerm);
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
document.addEventListener('DOMContentLoaded', async () => {
    await fetchAdmins();
    loadFeaturedProducts();
    loadAllProducts();
});
