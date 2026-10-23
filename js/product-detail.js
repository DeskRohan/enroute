import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentAuthUser = auth.currentUser;
let currentProductData = null;
let currentUploaderData = null;
let currentTotalDownloads = 0;
let currentLinkedVariants = [];
let currentUserOwnedOrder = null;

const productContainer = document.getElementById('product-container');

// Get product ID from URL or sessionStorage fallback
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id') || sessionStorage.getItem('viewProductId');

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(price || 0);
};

// Google Drive Image URL Converter (Reliable Google UserContent CDN & direct links)
function getImageUrl(url) {
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
}

// Check purchase entitlement securely from Firestore orders
async function checkUserOwnership(user, prodId) {
    if (!user || !prodId) return null;
    try {
        const q = query(
            collection(db, "orders"),
            where("userId", "==", user.uid)
        );
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
            const orderData = docSnap.data();
            if (orderData.status === 'cancelled' || orderData.status === 'failed') continue;

            const matchesSingle = orderData.productId === prodId;
            const matchesItems = Array.isArray(orderData.items) && orderData.items.some(
                item => item.id === prodId || item.productId === prodId
            );

            if (matchesSingle || matchesItems) {
                return { id: docSnap.id, ...orderData };
            }
        }
    } catch (e) {
        console.warn("Could not check ownership:", e);
    }
    return null;
}

// Download executor matching dashboard.js implementation
async function initiateDownload(url, filename, btn) {
    if (!url || url === '#' || url.trim() === '') {
        alert("The download file link is currently unavailable. Please reach out to customer support.");
        return;
    }

    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg>
            <span>Preparing Download...</span>
        `;
    }

    try {
        if (url.includes('sharemods.com') || /^[a-z0-9]{12}$/i.test(url.trim())) {
            const apiBase = (window.location.hostname === 'localhost' && window.location.port !== '3001') ? 'http://localhost:3001' : '';
            const res = await fetch(`${apiBase}/api/direct-download?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (data.ok && data.directUrl) {
                if (btn) btn.innerHTML = `<span>✓ Downloading...</span>`;
                const a = document.createElement('a');
                a.href = data.directUrl;
                if (data.filename) a.download = data.filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    if (document.body.contains(a)) document.body.removeChild(a);
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = originalHtml;
                    }
                }, 3000);
                return;
            }
        }

        // Direct link fallback
        const a = document.createElement('a');
        a.href = url;
        if (filename) a.download = filename;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (document.body.contains(a)) document.body.removeChild(a);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }, 2000);
    } catch (err) {
        console.error("Download error:", err);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

// React to auth state changes to dynamically reflect ownership
onAuthStateChanged(auth, async (user) => {
    currentAuthUser = user;
    if (productId && currentProductData) {
        const owned = await checkUserOwnership(user, productId);
        if (owned !== currentUserOwnedOrder) {
            currentUserOwnedOrder = owned;
            renderProduct(currentProductData, productId, currentUploaderData, currentTotalDownloads, currentLinkedVariants, currentUserOwnedOrder);
        }
    }
});

const loadProduct = async () => {
    if (!productId) {
        productContainer.innerHTML = `
            <div class="text-center mt-8" style="padding: 3rem 1rem;">
                <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;">Product Not Found</h3>
                <p class="text-secondary" style="margin-bottom: 1.5rem;">The product you are looking for does not exist or may have been moved.</p>
                <a href="products.html" class="btn btn-primary">
                    Return to Store Catalog
                </a>
            </div>
        `;
        return;
    }

    try {
        const docRef = doc(db, "products", productId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            productContainer.innerHTML = `
                <div class="text-center mt-8" style="padding: 3rem 1rem;">
                    <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;">Product Not Found</h3>
                    <p class="text-secondary" style="margin-bottom: 1.5rem;">We couldn't locate this mod in our fleet records.</p>
                    <a href="products.html" class="btn btn-primary">
                        Browse All BUSSID Mods
                    </a>
                </div>
            `;
            return;
        }

        const product = docSnap.data();

        // Check if scheduled
        const isAdmin = localStorage.getItem('userRole') === 'admin';
        const isScheduled = product.status === 'scheduled' && (!product.scheduledDate || new Date(product.scheduledDate) > new Date());
        
        if (isScheduled && !isAdmin) {
            const formattedTime = product.scheduledDate ? new Date(product.scheduledDate).toLocaleString('en-IN', {
                day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'soon';
            productContainer.innerHTML = `
                <div class="text-center mt-8" style="max-width: 520px; margin: 3rem auto; padding: 2.5rem; background: #FFFFFF; border-radius: var(--radius-md); border: 1px solid var(--color-border); box-shadow: var(--shadow-sm);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🗓️</div>
                    <h3 style="margin-bottom: 0.5rem; font-family: var(--font-heading); font-size: 1.4rem;">Product Scheduled</h3>
                    <p class="text-secondary" style="margin-bottom: 1.5rem; line-height: 1.5;">This mod is scheduled for official release on <br><strong style="color: var(--text-primary); font-size: 1.05rem;">${formattedTime}</strong>.</p>
                    <a href="products.html" class="btn btn-primary" style="width: 100%;">
                        Return to Store
                    </a>
                </div>
            `;
            return;
        }

        let uploader = { name: 'EnrouteIn Studio', isVerified: true };
        if (product.addedBy) {
            if (product.addedBy === 'admin@enroute.in') {
                uploader = { name: 'EnrouteIn Studio', isVerified: true };
            } else {
                try {
                    const uq = query(collection(db, "users"), where("email", "==", product.addedBy));
                    const uSnap = await getDocs(uq);
                    if (!uSnap.empty) {
                        const ud = uSnap.docs[0].data();
                        uploader.name = ud.name || 'Community Creator';
                        uploader.isVerified = ud.isVerified || false;
                    } else {
                        uploader.name = product.addedBy.split('@')[0] || 'Community Creator';
                        uploader.isVerified = false;
                    }
                } catch (e) {
                    console.warn("Could not fetch uploader info:", e);
                }
            }
        }

        // Query database orders collection to count total downloads/purchases for this mod
        let dbOrderCount = 0;
        try {
            const ordersQuery = query(collection(db, "orders"), where("productId", "==", productId));
            const ordersSnap = await getDocs(ordersQuery);
            dbOrderCount = ordersSnap.size;
        } catch (e) {
            console.warn("Could not query orders count:", e);
        }

        const totalDownloads = Math.max(dbOrderCount, (product.downloadCount || 0));

        // Load linked variant products
        let linkedVariants = [];
        if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
            try {
                const variantPromises = product.variants.map(async (v) => {
                    const vId = (typeof v === 'object' && v !== null) ? v.id : v;
                    const customLabel = (typeof v === 'object' && v !== null) ? v.label : '';
                    if (!vId || vId === productId) return null;
                    try {
                        const vDocRef = doc(db, "products", vId);
                        const vDocSnap = await getDoc(vDocRef);
                        if (vDocSnap.exists()) {
                            const vData = vDocSnap.data();
                            return {
                                id: vId,
                                name: customLabel || vData.variantName || vData.name,
                                price: vData.price,
                                originalPrice: vData.originalPrice,
                                offerPrice: vData.offerPrice,
                                offerPeriodType: vData.offerPeriodType,
                                offerExpiryDate: vData.offerExpiryDate,
                                pricingType: vData.pricingType,
                                image: vData.image || (vData.images && vData.images[0])
                            };
                        }
                    } catch (err) {
                        console.warn("Error fetching variant product:", vId, err);
                    }
                    return null;
                });
                const results = await Promise.all(variantPromises);
                linkedVariants = results.filter(v => v !== null);
            } catch (vErr) {
                console.warn("Could not load product variants:", vErr);
            }
        }

        // Check ownership for authenticated user
        currentUserOwnedOrder = await checkUserOwnership(currentAuthUser, productId);

        // Store active data
        currentProductData = product;
        currentUploaderData = uploader;
        currentTotalDownloads = totalDownloads;
        currentLinkedVariants = linkedVariants;

        renderProduct(product, productId, uploader, totalDownloads, linkedVariants, currentUserOwnedOrder);

    } catch (error) {
        console.error("Error fetching product:", error);
        productContainer.innerHTML = `
            <div class="text-center mt-8" style="padding: 3rem 1rem;">
                <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;">Error Loading Product</h3>
                <p class="text-secondary" style="margin-bottom: 1.5rem;">Unable to load mod details right now. Please check your internet connection.</p>
                <a href="products.html" class="btn btn-primary">
                    Return to Store
                </a>
            </div>
        `;
    }
};

const renderProduct = (product, id, uploader, totalDownloads = 0, linkedVariants = [], userOwnedOrder = null) => {
    document.title = `${product.name || 'Product'} | EnrouteIn BUSSID Store`;

    const isFree = product.pricingType === 'free' || product.price === 0;
    const origPrice = product.originalPrice ?? product.price ?? 0;
    const offerPrice = product.offerPrice;
    const hasOffer = (!isFree && offerPrice !== undefined && offerPrice !== null && offerPrice !== '' && Number(offerPrice) < Number(origPrice));
    const isLimited = product.offerPeriodType === 'limited';
    const isExpired = isLimited && product.offerExpiryDate && new Date(product.offerExpiryDate) <= new Date();
    const isOfferActive = hasOffer && !isExpired;
    const currentPrice = isFree ? 0 : (isOfferActive ? Number(offerPrice) : Number(product.price ?? origPrice));
    const discountPct = isOfferActive ? Math.round(((origPrice - offerPrice) / origPrice) * 100) : 0;
    const isOutOfStock = Boolean(product.outOfStock);
    const isUserOwned = Boolean(userOwnedOrder);

    // Buy Now Handler (Preserves existing direct checkout logic)
    const handleBuyNow = () => {
        if (isOutOfStock) {
            alert('This product is currently out of stock.');
            return;
        }

        if (isFree) {
            sessionStorage.setItem('unlockProductId', id);
            window.location.href = `sub2unlock.html?id=${id}`;
            return;
        }

        // Save single product checkout state
        try {
            sessionStorage.setItem('checkoutMode', 'single');
            sessionStorage.setItem(
                'checkoutProduct',
                JSON.stringify({
                    id,
                    ...product,
                    price: currentPrice,
                    originalPrice: origPrice,
                    offerPrice: isOfferActive ? offerPrice : null,
                    isOfferActive,
                    downloadSource: product.downloadSource || ((product.downloadLink || '').includes('sharemods.com') ? 'sharemods' : 'manual')
                })
            );
        } catch(e) {}

        const user = currentAuthUser || auth.currentUser;
        if (!user) {
            window.location.href = `login.html?redirect=${encodeURIComponent(`checkout.html?id=${id}`)}`;
            return;
        }

        window.location.href = `checkout.html?id=${id}`;
    };

    // Cart Button Sync
    const updateCartButtonState = () => {
        if (isFree || isUserOwned) return;
        const cart = (window.EnrouteCart && window.EnrouteCart.getCart) ? window.EnrouteCart.getCart() : JSON.parse(localStorage.getItem('enroute_cart') || '[]');
        const isInCart = cart.some(item => item.id === id);

        const addCartBtnEl = document.getElementById('add-to-cart-btn');
        const stickyAddCartBtnEl = document.getElementById('sticky-add-cart-btn');

        if (isInCart) {
            if (addCartBtnEl) {
                addCartBtnEl.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path><polyline points="13 9 16 12 13 15"></polyline><line x1="9" y1="12" x2="16" y2="12"></line></svg>
                    <span>Go to Cart</span>
                `;
                addCartBtnEl.classList.add('in-cart-btn');
                addCartBtnEl.title = 'View Cart';
            }
            if (stickyAddCartBtnEl) {
                stickyAddCartBtnEl.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path><polyline points="13 9 16 12 13 15"></polyline><line x1="9" y1="12" x2="16" y2="12"></line></svg>
                    <span>Go to Cart</span>
                `;
                stickyAddCartBtnEl.classList.add('in-cart-btn');
                stickyAddCartBtnEl.title = 'View Cart';
            }
        } else {
            if (addCartBtnEl) {
                addCartBtnEl.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                    <span>Add to Cart</span>
                `;
                addCartBtnEl.classList.remove('in-cart-btn');
                addCartBtnEl.title = 'Add to Cart';
            }
            if (stickyAddCartBtnEl) {
                stickyAddCartBtnEl.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                    <span>Add to Cart</span>
                `;
                stickyAddCartBtnEl.classList.remove('in-cart-btn');
                stickyAddCartBtnEl.title = 'Add to Cart';
            }
        }
    };

    const handleAddToCartOrGoToCart = () => {
        const cart = (window.EnrouteCart && window.EnrouteCart.getCart) ? window.EnrouteCart.getCart() : JSON.parse(localStorage.getItem('enroute_cart') || '[]');
        const isInCart = cart.some(item => item.id === id);

        if (isInCart) {
            if (window.EnrouteCart && window.EnrouteCart.openCart) {
                window.EnrouteCart.openCart();
            }
        } else {
            const productPayload = {
                id,
                ...product,
                price: currentPrice,
                originalPrice: origPrice,
                offerPrice: isOfferActive ? offerPrice : null,
                isOfferActive
            };
            if (window.EnrouteCart && window.EnrouteCart.addToCart) {
                window.EnrouteCart.addToCart(productPayload);
            }
            updateCartButtonState();
        }
    };

    // Images Processing
    const rawImages = product.images || [product.image];
    const images = rawImages.filter(img => img && typeof img === 'string' && img.trim() !== '').map(img => getImageUrl(img));
    if (images.length === 0) images.push("https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800");

    // Gallery Thumbnails HTML
    let thumbnailsHtml = '';
    if (images.length > 1) {
        thumbnailsHtml = `
            <div class="amazon-thumbnails-strip" role="group" aria-label="Product image thumbnails">
                ${images.map((imgUrl, idx) => `
                    <div class="amazon-thumbnail-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}" tabindex="0" role="button" aria-label="View product image ${idx + 1}">
                        <img src="${imgUrl}" alt="${(product.name || 'Product').replace(/"/g, '&quot;')} thumbnail ${idx + 1}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';">
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Variants HTML (if linked variants exist)
    let variantsHtml = '';
    if (linkedVariants && linkedVariants.length > 0) {
        const allVariantsList = [
            {
                id: id,
                name: product.variantName || product.name || 'Standard Edition',
                finalPrice: isFree ? 'FREE' : formatPrice(currentPrice),
                isCurrent: true
            },
            ...linkedVariants.map(v => {
                const vIsFree = v.pricingType === 'free' || v.price === 0;
                const vOrigPrice = v.originalPrice ?? v.price ?? 0;
                const vOfferPrice = v.offerPrice;
                const vHasOffer = (!vIsFree && vOfferPrice !== undefined && vOfferPrice !== null && vOfferPrice !== '' && Number(vOfferPrice) < Number(vOrigPrice));
                const vIsLimited = v.offerPeriodType === 'limited';
                const vIsExpired = vIsLimited && v.offerExpiryDate && new Date(v.offerExpiryDate) <= new Date();
                const vIsOfferActive = vHasOffer && !vIsExpired;
                const vEffectivePrice = vIsOfferActive ? vOfferPrice : (v.price ?? vOrigPrice);

                return {
                    id: v.id,
                    name: v.name,
                    finalPrice: vIsFree ? 'FREE' : formatPrice(vEffectivePrice),
                    isCurrent: false
                };
            })
        ];

        variantsHtml = `
            <div class="product-variants-box">
                <div class="variants-header-title">
                    <span>Available Editions & Variants</span>
                    <span style="color: var(--color-primary);">${allVariantsList.length} Options</span>
                </div>
                <div class="variants-pill-group">
                    ${allVariantsList.map(v => {
                        if (v.isCurrent) {
                            return `
                                <div class="variant-pill active" title="Currently Selected">
                                    <span class="variant-pill-dot"></span>
                                    <span>${v.name}</span>
                                    <span class="variant-pill-price">${v.finalPrice}</span>
                                </div>
                            `;
                        } else {
                            return `
                                <a href="product.html?id=${v.id}" onclick="try{sessionStorage.setItem('viewProductId', '${v.id}');}catch(e){}" class="variant-pill" title="Switch to ${v.name}">
                                    <span>${v.name}</span>
                                    <span class="variant-pill-price" style="color: var(--text-secondary);">${v.finalPrice}</span>
                                </a>
                            `;
                        }
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Dynamic Specifications List (Only includes genuine existing fields!)
    const specsList = [];
    if (product.category) {
        const catLabel = product.category.toLowerCase() === 'livery' ? 'Vehicle Livery / Skin' : (product.category.toUpperCase() + ' Mod');
        specsList.push({ label: 'Product Type', value: catLabel });
    }
    if (product.brand) {
        specsList.push({ label: 'Bus Model / Chassis', value: product.brand });
    }
    if (product.version) {
        specsList.push({ label: 'Game Compatibility', value: `Bus Simulator Indonesia ${product.version}` });
    }
    if (product.engine) {
        specsList.push({ label: 'Engine & Sound Transmission', value: product.engine });
    }
    if (product.polygons) {
        specsList.push({ label: '3D Mesh Quality', value: product.polygons });
    }
    if (product.size) {
        specsList.push({ label: 'Package Download Size', value: product.size });
    }
    if (product.interior !== undefined && product.interior !== null && product.interior !== '') {
        const hasInterior = product.interior === true || product.interior === 'true' || product.interior === 'Detailed' || product.interior === 'Yes';
        specsList.push({ label: 'Cabin Interior', value: hasInterior ? 'Fully Detailed Driver & Passenger Cabin' : 'Exterior Body Modeling' });
    }
    if (product.format) {
        specsList.push({ label: 'Mod File Format', value: product.format });
    }
    if (product.createdAt) {
        try {
            const dateObj = new Date(product.createdAt);
            if (!isNaN(dateObj.getTime())) {
                specsList.push({ label: 'Release Date', value: dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) });
            }
        } catch(e){}
    }

    const specsTableHtml = specsList.length > 0 ? `
        <table class="amazon-specs-table">
            <tbody>
                ${specsList.map(s => `
                    <tr>
                        <th>${s.label}</th>
                        <td>${s.value}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    ` : `<p class="text-secondary" style="font-size: 0.9rem; margin: 0;">Standard Bus Simulator Indonesia digital add-on package.</p>`;

    // Feature Highlights ("About this mod" bullets)
    const bullets = [
        `<strong>Compatible with BUSSID</strong>: Digital asset built specifically for Bus Simulator Indonesia.`,
        `<strong>Genuine Developer Release</strong>: Published and maintained by ${uploader.name}.`
    ];
    if (product.summary) {
        bullets.push(`<strong>Overview</strong>: ${product.summary}`);
    }
    if (product.brand) {
        bullets.push(`<strong>Authentic Vehicle Design</strong>: Realistic styling modeled after ${product.brand}.`);
    }
    if (product.size) {
        bullets.push(`<strong>Download Package</strong>: Fast, high-speed cloud file access (${product.size}).`);
    }
    bullets.push(`<strong>Instant Digital Delivery</strong>: File download is granted immediately through your account upon order.`);

    // YouTube Video Showcase Check
    let ytEmbedUrl = null;
    if (product.youtube) {
        const ytMatch = product.youtube.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (ytMatch && ytMatch[1]) {
            ytEmbedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
        }
    }

    const formattedDescription = (product.description || 'No detailed description provided for this product.').replace(/\n/g, '<br>');

    // Category Pill label
    const categoryName = (product.category || 'Mod').toUpperCase();

    // RENDER MAIN 3-REGION AMAZON LAYOUT
    productContainer.innerHTML = `
        <!-- Breadcrumbs Navigation -->
        <nav class="breadcrumb-wrap" style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.5rem; margin-bottom: 0.85rem; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.4; width: 100%; box-sizing: border-box;">
            <a href="index.html" style="color: inherit; text-decoration: none; display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                Home
            </a>
            <span class="separator" style="color: var(--color-border); flex-shrink: 0;">/</span>
            <a href="products.html" style="color: inherit; text-decoration: none; flex-shrink: 0;">Store</a>
            <span class="separator" style="color: var(--color-border); flex-shrink: 0;">/</span>
            <a href="products.html?category=${encodeURIComponent(product.category || 'mod')}" style="color: inherit; text-decoration: none; flex-shrink: 0;">${categoryName}</a>
            <span class="separator" style="color: var(--color-border); flex-shrink: 0;">/</span>
            <span style="color: var(--text-primary); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; display: inline-block; vertical-align: middle;">${product.name || 'Details'}</span>
        </nav>

        <div class="product-amazon-layout">
            <!-- COLUMN 1: LEFT GALLERY & HIGHLIGHTS -->
            <div class="product-amazon-gallery">
                <!-- Title & Creator in Column 1 -->
                <div class="amazon-title-block">
                    <h1>${product.name || 'Unnamed Mod'}</h1>
                    <div class="amazon-creator-row">
                        <span>Published by <strong>${uploader.name}</strong></span>
                        ${uploader.isVerified ? `<img src="assets/images/varified.png" title="Verified Creator" style="height: 1.1em; vertical-align: middle; display: inline-block;">` : ''}
                        <span>&bull;</span>
                        <span style="color: var(--text-secondary);">${totalDownloads} Total Downloads</span>
                    </div>
                </div>

                <div class="amazon-divider" style="margin: 0.65rem 0 1rem;"></div>

                <div class="gallery-sticky-wrap">
                    <div class="amazon-main-image-wrap" id="main-image-trigger" title="Click to view full image">
                        <div class="gallery-badges-wrap">
                            <span class="gallery-badge cat">${categoryName}</span>
                            <span class="gallery-badge assured">★ Verified Mod</span>
                        </div>
                        <img id="main-product-image" src="${images[0]}" alt="${(product.name || 'Product').replace(/"/g, '&quot;')}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';">
                    </div>

                    ${thumbnailsHtml}
                    ${variantsHtml}
                </div>
            </div>

            <!-- COLUMN 2: CENTER PRODUCT DETAILS & SPECS -->
            <div class="product-amazon-center">
                <!-- Feature Bullets (About this digital mod) -->
                <div class="amazon-about-box">
                    <h3>About this digital mod</h3>
                    <ul class="amazon-bullet-list">
                        ${bullets.map(b => `<li>${b}</li>`).join('')}
                    </ul>
                </div>

                <!-- Structured Tabs Section -->
                <div class="amazon-tabs-card">
                    <div class="amazon-tabs-nav" role="tablist">
                        <button class="amazon-tab-btn active" data-tab="tab-desc" role="tab" aria-selected="true">
                            Overview & Description
                        </button>
                        <button class="amazon-tab-btn" data-tab="tab-specs" role="tab" aria-selected="false">
                            Specifications
                        </button>
                        ${ytEmbedUrl ? `
                            <button class="amazon-tab-btn" data-tab="tab-video" role="tab" aria-selected="false">
                                Video Showcase
                            </button>
                        ` : ''}
                        <button class="amazon-tab-btn" data-tab="tab-policies" role="tab" aria-selected="false">
                            Delivery & Support
                        </button>
                    </div>

                    <div class="amazon-tab-content">
                        <!-- Tab 1: Description -->
                        <div class="amazon-tab-pane active" id="tab-desc" role="tabpanel">
                            <div class="amazon-desc-text">
                                ${formattedDescription}
                            </div>
                        </div>

                        <!-- Tab 2: Specifications -->
                        <div class="amazon-tab-pane" id="tab-specs" role="tabpanel">
                            ${specsTableHtml}
                        </div>

                        <!-- Tab 3: Video Showcase (if available) -->
                        ${ytEmbedUrl ? `
                            <div class="amazon-tab-pane" id="tab-video" role="tabpanel">
                                <div class="video-container">
                                    <iframe src="${ytEmbedUrl}" title="Product Video Review" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                                </div>
                            </div>
                        ` : ''}

                        <!-- Tab 4: Delivery & Policies -->
                        <div class="amazon-tab-pane" id="tab-policies" role="tabpanel">
                            <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6;">
                                <p style="margin: 0;"><strong style="color: var(--text-primary);">Instant Digital Access:</strong> Following a successful order, your mod files are made immediately available in your <a href="dashboard.html#garage" style="color: var(--color-primary); font-weight: 700;">Virtual Garage</a> and Orders history.</p>
                                <p style="margin: 0;"><strong style="color: var(--text-primary);">Installation Guide:</strong> Transfer the downloaded <code>.bussidmod</code> or <code>.bussidvehicle</code> file to your device's <code>BUSSID/Mods</code> directory, then enable it inside the Bus Simulator Indonesia Garage menu.</p>
                                <p style="margin: 0;"><strong style="color: var(--text-primary);">Support & Inquiries:</strong> Facing an issue with this mod? Review our <a href="refund.html" style="color: var(--color-primary); font-weight: 600;">Refund & Return Policy</a> or contact our support team at <a href="contact.html" style="color: var(--color-primary); font-weight: 600;">Customer Support</a>.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- COLUMN 3: RIGHT PURCHASE PANEL (THE BUY BOX) -->
            <div class="product-amazon-buybox">
                <div class="buybox-card">
                    <!-- Price Presentation -->
                    <div class="buybox-price-wrap">
                        ${isFree ? `
                            <div class="buybox-price-main free">FREE</div>
                            <span class="buybox-taxes-sub">Free community edition for BUSSID</span>
                        ` : (isOfferActive ? `
                            <div style="display: flex; align-items: baseline; gap: 8px;">
                                <div class="buybox-price-main">${formatPrice(offerPrice)}</div>
                                <span class="buybox-mrp">${formatPrice(origPrice)}</span>
                            </div>
                            <div class="buybox-offer-row">
                                <span class="buybox-discount-pill">SAVE ${discountPct}%</span>
                                <span class="buybox-taxes-sub">Inclusive of all taxes & licensing</span>
                            </div>
                            ${isLimited ? `
                                <div style="font-size: 0.74rem; color: #b45309; font-weight: 700; background: rgba(245, 158, 11, 0.1); padding: 3px 8px; border-radius: var(--radius-xs); border: 1px solid rgba(245, 158, 11, 0.25);">
                                    Limited Deal: Ends ${new Date(product.offerExpiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </div>
                            ` : ''}
                        ` : `
                            <div class="buybox-price-main">${formatPrice(origPrice)}</div>
                            <span class="buybox-taxes-sub">Inclusive of all taxes & licensing</span>
                        `)}
                    </div>

                    <!-- Availability Status -->
                    <div class="buybox-stock-status ${isOutOfStock ? 'out-of-stock' : 'in-stock'}">
                        <span class="buybox-stock-dot"></span>
                        <span>${isOutOfStock ? 'Currently Out of Stock' : 'In Stock &bull; Instant Download'}</span>
                    </div>

                    <!-- Digital Delivery Notice -->
                    <div class="buybox-delivery-note">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span><strong>Digital Product:</strong> Files are accessible in your account immediately after purchase.</span>
                    </div>

                    <!-- Actions or Purchased State -->
                    ${isUserOwned ? `
                        <!-- Customer Purchased State (Task 7) -->
                        <div class="buybox-owned-card">
                            <div class="buybox-owned-title">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                                <span>You Own This Mod</span>
                            </div>
                            <p class="buybox-owned-desc">
                                Verified order entitlement. You have lifetime access to download this mod file.
                            </p>
                        </div>

                        <div class="buybox-actions">
                            <button id="owned-download-btn" class="btn-buy-now" title="Download Purchased Mod">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                <span>Download Mod Files</span>
                            </button>

                            <a href="dashboard.html#garage" class="btn-add-cart" style="text-decoration: none;" title="Go to Virtual Garage">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="3" y1="9" x2="21" y2="9"></line>
                                    <line x1="9" y1="21" x2="9" y2="9"></line>
                                </svg>
                                <span>View in Virtual Garage</span>
                            </a>
                        </div>
                    ` : `
                        <!-- Normal Purchase Actions -->
                        <div class="buybox-actions">
                            ${isOutOfStock ? `
                                <button class="btn-buy-now" disabled style="opacity: 0.6; cursor: not-allowed; background: #64748b;">
                                    Out of Stock
                                </button>
                            ` : (isFree ? `
                                <button id="buy-btn" class="btn-buy-now" title="Unlock Free Download">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    <span>Free Instant Download</span>
                                </button>
                            ` : `
                                <button id="buy-btn" class="btn-buy-now" title="Buy Now & Download">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                    <span>Buy Now</span>
                                </button>
                                <button id="add-to-cart-btn" class="btn-add-cart" title="Add to Cart">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="9" cy="21" r="1"></circle>
                                        <circle cx="20" cy="21" r="1"></circle>
                                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                                    </svg>
                                    <span>Add to Cart</span>
                                </button>
                            `)}

                            <button id="detail-wishlist-btn" class="btn-wishlist-toggle" title="Add to Garage Wishlist">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                                <span class="wishlist-btn-text">Add to Garage Wishlist</span>
                            </button>
                        </div>
                    `}

                    <!-- Trust Points -->
                    <div class="buybox-trust-list">
                        <div class="buybox-trust-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <span>256-Bit SSL Secured by Razorpay</span>
                        </div>
                        <div class="buybox-trust-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                            <span>Verified Integrity & Virus-Free File</span>
                        </div>
                        <div class="buybox-trust-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>Direct Cloud Access via Dashboard</span>
                        </div>
                    </div>

                    <div class="buybox-meta-line">
                        SKU: ENR-${id.slice(0, 8).toUpperCase()} &bull; Bus Simulator Indonesia
                    </div>
                </div>
            </div>
        </div>

        <!-- Sticky Bottom Bar for Mobile -->
        <div class="product-sticky-bottom-bar" id="product-sticky-bottom-bar">
            <div class="sticky-bar-price-wrap">
                ${isFree ? `
                    <span class="sticky-bar-price free">FREE</span>
                ` : (isOfferActive ? `
                    <div style="display: flex; align-items: baseline; gap: 6px;">
                        <span class="sticky-bar-price">${formatPrice(offerPrice)}</span>
                        <span class="sticky-bar-orig-price">${formatPrice(origPrice)}</span>
                    </div>
                    <span class="sticky-bar-discount">SAVE ${discountPct}%</span>
                ` : `
                    <span class="sticky-bar-price">${formatPrice(origPrice)}</span>
                `)}
            </div>

            <div class="sticky-bar-actions">
                ${isUserOwned ? `
                    <button id="sticky-download-btn" class="btn btn-primary" style="width: 100%;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>Download Mod</span>
                    </button>
                ` : (isOutOfStock ? `
                    <button class="btn btn-secondary" disabled style="width: 100%; opacity: 0.65; cursor: not-allowed; background: #e2e8f0; color: #64748b; font-weight: 700; padding: 0.65rem 1rem;">
                        Out of Stock
                    </button>
                ` : (!isFree ? `
                    <button id="sticky-add-cart-btn" class="btn btn-outline" title="Add to Cart">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        <span>Add to Cart</span>
                    </button>
                    <button id="sticky-buy-btn" class="btn btn-primary" title="Buy Now">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <span>Buy Now</span>
                    </button>
                ` : `
                    <button id="sticky-free-btn" class="btn btn-primary" style="width: 100%;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>Free Download</span>
                    </button>
                `))}
            </div>
        </div>

        <!-- Related Products Section (Task 8) -->
        <div id="related-mods-container"></div>
    `;

    // Mount sticky bottom bar to document.body for fixed docking
    const oldStickyBar = document.body.querySelector(':scope > .product-sticky-bottom-bar');
    if (oldStickyBar) oldStickyBar.remove();

    const stickyBarEl = document.getElementById('product-sticky-bottom-bar');
    if (stickyBarEl) {
        document.body.appendChild(stickyBarEl);

        // Smart Mobile Sticky Bar: Reveal only when user scrolls past the main buybox
        const updateStickyVisibility = () => {
            if (window.innerWidth > 768) {
                stickyBarEl.classList.remove('is-visible');
                return;
            }
            const buyboxEl = document.querySelector('.buybox-card');
            if (!buyboxEl) return;
            const rect = buyboxEl.getBoundingClientRect();
            // Show sticky bar only when user has scrolled past the main buy buttons
            if (rect.bottom < 60) {
                stickyBarEl.classList.add('is-visible');
            } else {
                stickyBarEl.classList.remove('is-visible');
            }
        };

        window.removeEventListener('scroll', window.__enrouteStickyScrollHandler);
        window.removeEventListener('resize', window.__enrouteStickyScrollHandler);
        window.__enrouteStickyScrollHandler = updateStickyVisibility;
        window.addEventListener('scroll', updateStickyVisibility, { passive: true });
        window.addEventListener('resize', updateStickyVisibility, { passive: true });
        updateStickyVisibility();
    }

    // Attach Event Listeners
    // Buy button
    const buyBtnEl = document.getElementById('buy-btn');
    if (buyBtnEl) {
        buyBtnEl.addEventListener('click', handleBuyNow);
    }

    // Add to cart button
    const addCartBtnEl = document.getElementById('add-to-cart-btn');
    if (addCartBtnEl) {
        addCartBtnEl.addEventListener('click', handleAddToCartOrGoToCart);
    }

    // Sticky buy buttons
    const stickyBuyBtnEl = document.getElementById('sticky-buy-btn');
    if (stickyBuyBtnEl) {
        stickyBuyBtnEl.addEventListener('click', handleBuyNow);
    }

    const stickyAddCartBtnEl = document.getElementById('sticky-add-cart-btn');
    if (stickyAddCartBtnEl) {
        stickyAddCartBtnEl.addEventListener('click', handleAddToCartOrGoToCart);
    }

    const stickyFreeBtnEl = document.getElementById('sticky-free-btn');
    if (stickyFreeBtnEl) {
        stickyFreeBtnEl.addEventListener('click', handleBuyNow);
    }

    // Owned download buttons (Task 7)
    const downloadTargetUrl = product.downloadLink || '#';
    const downloadFileName = `${(product.name || 'mod').replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;

    const ownedDownloadBtn = document.getElementById('owned-download-btn');
    if (ownedDownloadBtn) {
        ownedDownloadBtn.addEventListener('click', () => {
            initiateDownload(downloadTargetUrl, downloadFileName, ownedDownloadBtn);
        });
    }

    const stickyDownloadBtn = document.getElementById('sticky-download-btn');
    if (stickyDownloadBtn) {
        stickyDownloadBtn.addEventListener('click', () => {
            initiateDownload(downloadTargetUrl, downloadFileName, stickyDownloadBtn);
        });
    }

    // Wishlist Toggle
    const detailWishBtn = document.getElementById('detail-wishlist-btn');
    if (detailWishBtn) {
        const updateWishBtnUI = () => {
            const wishlist = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
            const isInWish = wishlist.includes(id);
            const svg = detailWishBtn.querySelector('svg');
            const textEl = detailWishBtn.querySelector('.wishlist-btn-text');

            if (isInWish) {
                detailWishBtn.classList.add('active');
                if (svg) {
                    svg.style.fill = '#ef4444';
                    svg.style.color = '#ef4444';
                }
                if (textEl) textEl.textContent = 'In Your Wishlist';
            } else {
                detailWishBtn.classList.remove('active');
                if (svg) {
                    svg.style.fill = 'none';
                    svg.style.color = 'currentColor';
                }
                if (textEl) textEl.textContent = 'Add to Garage Wishlist';
            }
        };

        updateWishBtnUI();

        detailWishBtn.addEventListener('click', () => {
            let wishlist = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
            if (wishlist.includes(id)) {
                wishlist = wishlist.filter(x => x !== id);
            } else {
                wishlist.push(id);
            }
            localStorage.setItem('enroute_wishlist', JSON.stringify(wishlist));
            updateWishBtnUI();
            window.dispatchEvent(new Event('enroute-wishlist-updated'));
            updateHeaderWishBadge();
        });
    }

    const updateHeaderWishBadge = () => {
        try {
            const saved = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
            const badge = document.querySelector('.nav-wish-badge');
            if (badge) {
                if (saved.length > 0) {
                    badge.textContent = saved.length > 99 ? '99+' : saved.length;
                    badge.style.display = 'inline-flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch(e) {}
    };
    updateHeaderWishBadge();

    // Tabs Switching Interaction
    const tabBtns = document.querySelectorAll('.amazon-tab-btn');
    const tabPanes = document.querySelectorAll('.amazon-tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');
        });
    });

    // Thumbnail Switching
    const thumbItems = document.querySelectorAll('.amazon-thumbnail-item');
    const mainImg = document.getElementById('main-product-image');

    const switchImage = (idx) => {
        if (images[idx]) {
            thumbItems.forEach(t => t.classList.remove('active'));
            if (thumbItems[idx]) thumbItems[idx].classList.add('active');
            mainImg.src = images[idx];
        }
    };

    thumbItems.forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.getAttribute('data-idx'));
            switchImage(idx);
        });

        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const idx = parseInt(item.getAttribute('data-idx'));
                switchImage(idx);
            }
        });
    });

    // Lightbox Modal for Main Image
    const mainImageTrigger = document.getElementById('main-image-trigger');
    if (mainImageTrigger) {
        mainImageTrigger.addEventListener('click', () => {
            const currentSrc = mainImg.src;
            const lightbox = document.createElement('div');
            lightbox.className = 'image-lightbox-modal';
            lightbox.id = 'product-lightbox';
            lightbox.innerHTML = `
                <div class="lightbox-content">
                    <button class="lightbox-close-btn" aria-label="Close Preview">&times;</button>
                    <img src="${currentSrc}" alt="${(product.name || 'Preview').replace(/"/g, '&quot;')}" class="lightbox-img" referrerpolicy="no-referrer">
                </div>
            `;
            document.body.appendChild(lightbox);

            const closeLightbox = () => {
                if (document.body.contains(lightbox)) {
                    document.body.removeChild(lightbox);
                }
                document.removeEventListener('keydown', handleEsc);
            };

            const handleEsc = (e) => {
                if (e.key === 'Escape') closeLightbox();
            };

            lightbox.querySelector('.lightbox-close-btn').addEventListener('click', closeLightbox);
            lightbox.addEventListener('click', (e) => {
                if (e.target === lightbox) closeLightbox();
            });
            document.addEventListener('keydown', handleEsc);
        });
    }

    // Sync cart button state initially and on events
    updateCartButtonState();
    window.addEventListener('enroute-cart-updated', updateCartButtonState);
    window.addEventListener('storage', updateCartButtonState);

    // LOAD RELATED PRODUCTS (Task 8)
    const loadRelated = async () => {
        const relContainer = document.getElementById('related-mods-container');
        if (!relContainer) return;

        try {
            const snapshot = await getDocs(collection(db, "products"));
            const allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Filter out current product and hidden/draft items
            let candidates = allProducts.filter(p => p.id !== id && p.status !== 'draft' && p.status !== 'archived');

            let relatedList = [];
            // Prioritize manually linked relatedMods if available
            if (product.relatedMods && Array.isArray(product.relatedMods) && product.relatedMods.length > 0) {
                relatedList = candidates.filter(p => product.relatedMods.includes(p.id));
            }

            // Fill with same category or top products up to 4
            if (relatedList.length < 4 && product.category) {
                const sameCategory = candidates.filter(p => p.category === product.category && !relatedList.some(r => r.id === p.id));
                relatedList = relatedList.concat(sameCategory.slice(0, 4 - relatedList.length));
            }

            if (relatedList.length < 4) {
                const remaining = candidates.filter(p => !relatedList.some(r => r.id === p.id));
                relatedList = relatedList.concat(remaining.slice(0, 4 - relatedList.length));
            }

            if (relatedList.length > 0) {
                const cardsHtml = relatedList.slice(0, 4).map(rp => {
                    const rpImg = (rp.images && rp.images[0]) ? getImageUrl(rp.images[0]) : getImageUrl(rp.image);
                    const rpIsFree = rp.pricingType === 'free' || rp.price === 0;
                    const rpOrigPrice = rp.originalPrice ?? rp.price ?? 0;
                    const rpHasOffer = (!rpIsFree && rp.offerPrice !== undefined && rp.offerPrice !== null && rp.offerPrice !== '' && Number(rp.offerPrice) < Number(rpOrigPrice));
                    const rpIsLimited = rp.offerPeriodType === 'limited';
                    const rpIsExpired = rpIsLimited && rp.offerExpiryDate && new Date(rp.offerExpiryDate) <= new Date();
                    const rpOfferActive = rpHasOffer && !rpExpired(rp);
                    const rpFinalPrice = rpIsFree ? 'FREE' : formatPrice(rpOfferActive ? rp.offerPrice : (rp.price ?? rpOrigPrice));

                    function rpExpired(item) {
                        return item.offerPeriodType === 'limited' && item.offerExpiryDate && new Date(item.offerExpiryDate) <= new Date();
                    }

                    return `
                        <a href="product.html?id=${rp.id}" onclick="try{sessionStorage.setItem('viewProductId', '${rp.id}');}catch(e){}" class="product-card" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; background: #FFFFFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; transition: transform 0.2s, box-shadow 0.2s;">
                            <div class="product-img-wrapper" style="aspect-ratio: 16/10; overflow: hidden; background: #f1f5f9;">
                                <img src="${rpImg}" alt="${(rp.name || 'Product').replace(/"/g, '&quot;')}" style="width: 100%; height: 100%; object-fit: cover;" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';">
                            </div>
                            <div class="product-card-body" style="padding: 1rem; display: flex; flex-direction: column; flex: 1; justify-content: space-between;">
                                <div>
                                    <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--color-primary); letter-spacing: 0.05em; display: block; margin-bottom: 0.35rem;">
                                        ${rp.category || 'Mod'}
                                    </span>
                                    <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0 0 0.5rem; line-height: 1.35; color: var(--text-primary);">
                                        ${rp.name || 'BUSSID Mod'}
                                    </h4>
                                </div>
                                <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 0.5rem; border-top: 1px solid var(--color-border-subtle); padding-top: 0.5rem;">
                                    <span style="font-size: 1.1rem; font-weight: 800; font-family: var(--font-heading); color: ${rpIsFree ? 'var(--color-success)' : 'var(--text-primary)'};">
                                        ${rpFinalPrice}
                                    </span>
                                    <span style="font-size: 0.78rem; font-weight: 700; color: var(--color-primary);">View Mod &rarr;</span>
                                </div>
                            </div>
                        </a>
                    `;
                }).join('');

                relContainer.innerHTML = `
                    <div class="related-products-section">
                        <h2>Explore Related BUSSID Mods</h2>
                        <div class="related-products-grid">
                            ${cardsHtml}
                        </div>
                    </div>
                `;
            } else {
                relContainer.innerHTML = '';
            }
        } catch (err) {
            console.warn("Could not load related products:", err);
            relContainer.innerHTML = '';
        }
    };

    loadRelated();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadProduct);
} else {
    loadProduct();
}