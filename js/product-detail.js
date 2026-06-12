import { db, auth } from './firebase-config.js';
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const productContainer = document.getElementById('product-container');

// Get product ID from URL or sessionStorage fallback
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id') || sessionStorage.getItem('viewProductId');

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(price || 0);
};

// Google Drive Image URL Converter
function getImageUrl(url) {
    if (!url || url.trim() === "") {
        return "https://via.placeholder.com/800x600?text=No+Image";
    }

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
}



const loadProduct = async () => {
    if (!productId) {
        productContainer.innerHTML = `
            <div class="text-center mt-8">
                <h3>Product not found</h3>
                <p style="color:#ef4444;margin:1rem 0;">
                    Debug: No ID found in URL.
                    <br>
                    Current URL: ${window.location.href}
                </p>
                <a href="products.html" class="btn btn-primary mt-4">
                    Back to Store
                </a>
            </div>
        `;
        return;
    }

    try {
        const docRef = doc(db, "products", productId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const product = docSnap.data();

            console.log("Product Data:", product);
            console.log("Raw Image URL:", product.image);
            console.log("Converted URL:", getImageUrl(product.image));

            renderProduct(product, productId);
        } else {
            productContainer.innerHTML = `
                <div class="text-center mt-8">
                    <h3>Product not found</h3>
                    <a href="products.html" class="btn btn-primary mt-4">
                        Back to Store
                    </a>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error fetching product:", error);

        productContainer.innerHTML = `
            <div class="text-center mt-8">
                <h3>Error loading product</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
};

const renderProduct = (product, id) => {
    document.title = `${product.name || 'Product'} - Enroute Store`;

    const handleBuyNow = () => {
        const user = auth.currentUser;

        if (!user) {
            alert('Please login to purchase.');
            window.location.href =
                `login.html?redirect=product.html?id=${id}`;
            return;
        }

        sessionStorage.setItem(
            'checkoutProduct',
            JSON.stringify({
                id,
                ...product
            })
        );

        window.location.href = 'checkout.html';
    };

    let formattedDate = "N/A";
    try {
        if (product.createdAt) {
            formattedDate = new Date(product.createdAt).toLocaleDateString();
        }
    } catch (e) {
        console.warn("Invalid Date:", product.createdAt);
    }

    const getYoutubeEmbed = (url) => {
        if (!url) return '';
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            return `https://www.youtube.com/embed/${match[2]}`;
        }
        return '';
    };

    const ytEmbedUrl = getYoutubeEmbed(product.youtube);
    const youtubeHtml = ytEmbedUrl ? `
        <div class="video-container">
            <iframe src="${ytEmbedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
    ` : '';

    const summaryHtml = product.summary ? `
        <div class="product-summary">
            <strong>Mod Summary:</strong><br>
            ${product.summary}
        </div>
    ` : '';

    // Process Images
    const rawImages = product.images || [product.image];
    const images = rawImages.filter(img => img && img.trim() !== '').map(img => getImageUrl(img));
    if (images.length === 0) images.push("https://via.placeholder.com/800x600?text=Image+Not+Found");

    let thumbnailsHtml = '';
    if (images.length > 1) {
        thumbnailsHtml = '<div class="thumbnail-strip">';
        images.forEach((img, idx) => {
            thumbnailsHtml += `
                <div class="thumbnail-item ${idx === 0 ? 'active' : ''}" data-index="${idx}">
                    <img src="${img}" alt="Thumbnail ${idx + 1}">
                </div>
            `;
        });
        thumbnailsHtml += '</div>';
    }

    // Process Specs
    const specs = [
        { label: 'Game Version', value: product.version || 'Universal' },
        { label: 'Brand / Make', value: product.brand || 'Custom' },
        { label: 'Engine', value: product.engine || 'Standard' },
        { label: 'Polygons', value: product.polygons || 'Standard' },
        { label: 'File Size', value: product.size || 'Unknown' },
        { label: 'Interior', value: product.interior ? 'Included' : 'Not Included' },
        { label: 'Last Updated', value: formattedDate }
    ];

    let specsHtml = '';
    specs.forEach(spec => {
        specsHtml += `
            <div class="spec-item">
                <span class="spec-label">${spec.label}</span>
                <span class="spec-value">${spec.value}</span>
            </div>
        `;
    });

    productContainer.innerHTML = `
        <div class="product-grid">

            <div class="product-gallery">
                <div class="main-image-wrapper">
                    <img id="main-product-image" src="${images[0]}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/800x600?text=Image+Not+Found'">
                </div>
                ${thumbnailsHtml}
                ${summaryHtml}
            </div>

            <div class="product-info">
                <div class="product-info-container">
                    <h1 style="margin-bottom: 0.5rem; font-size: clamp(2rem, 4vw, 2.5rem); line-height: 1.2;">${product.name || 'Unnamed Product'}</h1>
                    
                    <p class="text-secondary" style="text-transform:uppercase; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: var(--color-accent);">
                        ${product.category || 'Mod'}
                    </p>

                    <div class="product-price" style="font-size: 2.5rem; margin-bottom: 2rem;">
                        ${formatPrice(product.price)}
                    </div>

                    <div class="specs-grid">
                        ${specsHtml}
                    </div>

                    <div class="buy-card" style="margin-bottom: 2rem;">
                        <button id="buy-btn" class="btn btn-primary btn-lg" style="width:100%; font-size:1.125rem; padding:1rem; display:flex; align-items:center; justify-content:center; gap:0.5rem; box-shadow: 0 10px 20px -10px var(--color-primary);">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                            Buy Now
                        </button>
                        
                        <div class="guarantee-list">
                            <div class="guarantee-item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                Instant delivery upon checkout
                            </div>
                            <div class="guarantee-item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                100% Secure Encrypted Payment
                            </div>
                            <div class="guarantee-item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Free lifetime updates
                            </div>
                        </div>
                    </div>

                    <div class="product-description">
                        <h3 style="margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border); font-size: 1.25rem;">Description</h3>
                        ${youtubeHtml}
                        <p style="line-height: 1.8; color: var(--text-secondary); font-size: 0.95rem;">
                            ${product.description ? product.description.replace(/\n/g, '<br>') : 'No description provided.'}
                        </p>
                    </div>
                </div>
            </div>

        </div>
        
        <div id="related-mods-container"></div>
    `;

    document.getElementById('buy-btn').addEventListener('click', handleBuyNow);

    // Carousel Logic
    if (images.length > 1) {
        const mainImg = document.getElementById('main-product-image');
        const thumbnails = document.querySelectorAll('.thumbnail-item');

        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', () => {
                // Update active class
                thumbnails.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');

                // Change main image
                const idx = parseInt(thumb.getAttribute('data-index'));
                mainImg.src = images[idx];
            });
        });
    }

    // Load Related Mods
    if (product.relatedMods && product.relatedMods.length > 0) {
        const loadRelated = async () => {
            const relContainer = document.getElementById('related-mods-container');
            relContainer.innerHTML = '<div class="text-center mt-8 text-secondary">Loading related mods...</div>';

            try {
                const snapshot = await getDocs(collection(db, "products"));
                const allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

                const relatedProducts = allProducts.filter(p => product.relatedMods.includes(p.id));

                if (relatedProducts.length > 0) {
                    let gridHtml = '';
                    relatedProducts.forEach(rp => {
                        const rpImg = (rp.images && rp.images[0]) ? getImageUrl(rp.images[0]) : getImageUrl(rp.image);
                        gridHtml += `
                            <a href="product.html?id=${rp.id}" class="product-card" style="text-decoration: none; color: inherit; display: block;">
                                <div class="product-img-wrapper">
                                    <img src="${rpImg}" alt="${rp.name}">
                                </div>
                                <div class="product-card-body">
                                    <h3 class="product-title" style="margin-bottom: 0.5rem;">${rp.name}</h3>
                                    <p class="product-category" style="margin-bottom: 1rem; font-size: 0.85rem; text-transform: uppercase;">${rp.category}</p>
                                    <div style="font-weight: 700; font-size: 1.125rem; color: var(--color-primary);">${formatPrice(rp.price)}</div>
                                </div>
                            </a>
                        `;
                    });

                    relContainer.innerHTML = `
                        <div class="related-products-section">
                            <h2 style="font-size: 1.75rem; margin-bottom: 1rem;">You May Also Like</h2>
                            <div class="related-products-grid">
                                ${gridHtml}
                            </div>
                        </div>
                    `;
                } else {
                    relContainer.innerHTML = '';
                }
            } catch (err) {
                console.error("Error loading related mods", err);
                relContainer.innerHTML = '';
            }
        };
        loadRelated();
    }
};

document.addEventListener('DOMContentLoaded', loadProduct);