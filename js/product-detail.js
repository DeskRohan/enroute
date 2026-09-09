import { db, auth } from './firebase-config.js';
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

            // Block access to scheduled products for non-admins
            const isAdmin = localStorage.getItem('userRole') === 'admin';
            const isScheduled = product.status === 'scheduled' && (!product.scheduledDate || new Date(product.scheduledDate) > new Date());
            
            if (isScheduled && !isAdmin) {
                const formattedTime = product.scheduledDate ? new Date(product.scheduledDate).toLocaleString('en-IN', {
                    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : 'soon';
                productContainer.innerHTML = `
                    <div class="text-center mt-8" style="max-width: 500px; margin: var(--spacing-16) auto; padding: var(--spacing-8); background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--color-border); box-shadow: var(--shadow-md);">
                        <div style="font-size: 3rem; margin-bottom: var(--spacing-4);">🗓️</div>
                        <h3 style="margin-bottom: var(--spacing-2);">Product Scheduled</h3>
                        <p class="text-secondary" style="margin-bottom: var(--spacing-6);">This product is scheduled to go live on <br><strong style="color: var(--text-primary); font-size: 1.1rem;">${formattedTime}</strong>.</p>
                        <a href="products.html" class="btn btn-primary" style="width: 100%;">
                            Return to Store
                        </a>
                    </div>
                `;
                return;
            }

            let uploader = { name: 'Admin', isVerified: false };
            if (product.addedBy) {
                // Main admin is always verified
                if (product.addedBy === 'admin@enroute.in') {
                    uploader = { name: 'EnrouteIn', isVerified: true };
                } else {
                    try {
                        const uq = query(collection(db, "users"), where("email", "==", product.addedBy));
                        const uSnap = await getDocs(uq);
                        if (!uSnap.empty) {
                            const ud = uSnap.docs[0].data();
                            uploader.name = ud.name || 'Admin';
                            uploader.isVerified = ud.isVerified || false;
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

            renderProduct(product, productId, uploader, totalDownloads);
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
                <p style="color:#ef4444;margin:1rem 0;font-size:0.8rem;word-break:break-all;">
                    Debug: ${error.code || 'unknown'} - ${error.message || error}
                    <br>Product ID: ${productId}
                    <br>URL: ${window.location.href}
                </p>
                <a href="products.html" class="btn btn-primary mt-4">
                    Back to Store
                </a>
            </div>
        `;
    }
};

const renderProduct = (product, id, uploader, totalDownloads = 0) => {
    document.title = `${product.name || 'Product'} - EnrouteIn.Store`;

    const isFree = product.pricingType === 'free' || product.price === 0;

    const handleBuyNow = () => {
        if (isFree) {
            sessionStorage.setItem('unlockProductId', id);
            window.location.href = `sub2unlock.html?id=${id}`;
            return;
        }

        const user = auth.currentUser;

        if (!user) {
            alert('Please login to purchase.');
            window.location.href =
                `login.html?redirect=product.html?id=${id}`;
            return;
        }

        // Show CAPTCHA modal
        showCaptchaModal(() => {
            sessionStorage.setItem(
                'checkoutProduct',
                JSON.stringify({
                    id,
                    ...product
                })
            );
            window.location.href = 'checkout.html';
        });
    };

    window.showCaptchaModal = (onSuccess) => {
        const existing = document.getElementById('captcha-overlay');
        if (existing) existing.remove();

        // Puzzle position (random X between 40%-75% of track)
        const puzzleTarget = 40 + Math.floor(Math.random() * 35);
        const tolerance = 4; // % tolerance

        const overlay = document.createElement('div');
        overlay.id = 'captcha-overlay';
        overlay.innerHTML = `
            <style>
                #captcha-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(8px);
                    z-index: 10000; display: flex; align-items: center; justify-content: center;
                    animation: captchaFadeIn 0.25s ease;
                }
                @keyframes captchaFadeIn { from { opacity: 0; } to { opacity: 1; } }
                .captcha-modal {
                    background: #ffffff;
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-2xl); padding: 2.25rem 2rem;
                    max-width: 400px; width: 90%;
                    box-shadow: var(--shadow-xl);
                    text-align: center; animation: captchaSlideUp 0.3s ease;
                    user-select: none; position: relative;
                }
                @keyframes captchaSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .captcha-modal h3 { margin: 0 0 0.35rem; font-size: 1.3rem; font-family: 'Space Grotesk', sans-serif; font-weight: 700; color: #090d16; }
                .captcha-modal p.desc { color: #64748b; font-size: 0.85rem; margin: 0 0 1.5rem; }
                .captcha-lock { font-size: 2.25rem; margin-bottom: 0.5rem; }

                /* Puzzle area */
                .puzzle-area {
                    position: relative; width: 100%; height: 140px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-xl); overflow: hidden; margin-bottom: 1.25rem;
                    border: 1px solid var(--color-border);
                }
                .puzzle-pattern {
                    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    background-image:
                        radial-gradient(circle at 20% 30%, rgba(37,99,235,0.08) 0%, transparent 50%),
                        radial-gradient(circle at 80% 70%, rgba(14,165,233,0.08) 0%, transparent 50%),
                        radial-gradient(circle at 50% 50%, rgba(15,23,42,0.04) 0%, transparent 60%);
                }
                .puzzle-target {
                    position: absolute; top: 50%; transform: translateY(-50%);
                    width: 48px; height: 48px; border-radius: 10px;
                    border: 2px dashed rgba(37,99,235,0.6);
                    background: rgba(37,99,235,0.08);
                    transition: border-color 0.2s, background 0.2s;
                }
                .puzzle-piece {
                    position: absolute; top: 50%; transform: translateY(-50%);
                    width: 48px; height: 48px; border-radius: 10px;
                    background: #ffffff;
                    box-shadow: 0 4px 12px rgba(15,23,42,0.15);
                    border: 1px solid var(--color-border);
                    display: flex; align-items: center; justify-content: center;
                    transition: filter 0.2s, box-shadow 0.2s;
                    pointer-events: none;
                }
                .puzzle-piece img { width: 32px; height: 32px; object-fit: contain; }
                .puzzle-piece.matched {
                    box-shadow: 0 0 20px rgba(16,185,129,0.5);
                    border-color: #10b981;
                }

                /* Slider track */
                .slider-track {
                    position: relative; width: 100%; height: 50px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-full);
                    border: 1px solid var(--color-border);
                    overflow: hidden;
                    margin-bottom: 1rem;
                }
                .slider-fill {
                    position: absolute; top: 0; left: 0; bottom: 0; width: 0;
                    background: linear-gradient(90deg, rgba(37,99,235,0.15), rgba(37,99,235,0.3));
                    border-radius: var(--radius-full); transition: background 0.2s;
                    pointer-events: none;
                }
                .slider-fill.matched { background: rgba(16,185,129,0.25); }
                .slider-label {
                    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    color: #64748b; font-size: 0.8rem; font-weight: 700;
                    pointer-events: none; white-space: nowrap;
                    letter-spacing: 0.5px; text-transform: uppercase;
                }
                .slider-thumb {
                    position: absolute; top: 4px; left: 4px;
                    width: 42px; height: 42px; border-radius: 50%;
                    background: #ffffff;
                    border: 1.5px solid var(--color-border-strong);
                    display: flex; align-items: center; justify-content: center;
                    cursor: grab; touch-action: none;
                    box-shadow: var(--shadow-sm);
                    transition: border-color 0.2s, box-shadow 0.2s;
                    z-index: 2;
                }
                .slider-thumb:active { cursor: grabbing; box-shadow: var(--shadow-xs); }
                .slider-thumb:hover { border-color: var(--color-primary); box-shadow: 0 0 12px rgba(37,99,235,0.25); }
                .slider-thumb svg { width: 18px; height: 18px; color: #090d16; }
                .slider-thumb.matched { border-color: #10b981; background: #10b981; box-shadow: 0 0 16px rgba(16,185,129,0.4); }
                .slider-thumb.matched svg { color: #fff; }

                .captcha-status {
                    font-size: 0.85rem; color: #64748b; min-height: 1.25rem;
                    margin-bottom: 1rem; font-weight: 600;
                }
                .captcha-status.success { color: #10b981; }
                .captcha-status.fail { color: #dc2626; }

                .captcha-btn-cancel {
                    padding: 0.6rem 1.5rem;
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    background: var(--bg-tertiary);
                    color: var(--text-secondary); font-size: 0.85rem; font-weight: 700;
                    cursor: pointer; font-family: inherit; transition: all 0.2s;
                }
                .captcha-btn-cancel:hover {
                    color: var(--text-primary); border-color: var(--color-border-hover);
                    background: #ffffff;
                }
            </style>
            <div class="captcha-modal">
                <div class="captcha-lock">🛡️</div>
                <h3>Security Verification</h3>
                <p class="desc">Slide to align the puzzle piece</p>
                <div class="puzzle-area">
                    <div class="puzzle-pattern"></div>
                    <div class="puzzle-target" id="captcha-target" style="left: ${puzzleTarget}%;"></div>
                    <div class="puzzle-piece" id="captcha-piece" style="left: 2%;">
                        <img src="assets/images/fevicon.png" alt="Captcha Piece">
                    </div>
                </div>
                <div class="slider-track" id="captcha-track">
                    <div class="slider-fill" id="captcha-fill"></div>
                    <div class="slider-label" id="captcha-label">⟶ Slide to verify</div>
                    <div class="slider-thumb" id="captcha-thumb">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
                    </div>
                </div>
                <div class="captcha-status" id="captcha-status"></div>
                <button class="captcha-btn-cancel" id="captcha-cancel">Cancel</button>
            </div>
        `;

        document.body.appendChild(overlay);

        const thumb = document.getElementById('captcha-thumb');
        const fill = document.getElementById('captcha-fill');
        const piece = document.getElementById('captcha-piece');
        const track = document.getElementById('captcha-track');
        const label = document.getElementById('captcha-label');
        const status = document.getElementById('captcha-status');
        let isDragging = false;
        let startX = 0;
        let verified = false;

        const getPercent = (clientX) => {
            const rect = track.getBoundingClientRect();
            const thumbW = 48;
            const maxLeft = rect.width - thumbW;
            const x = Math.min(Math.max(clientX - rect.left - thumbW / 2, 0), maxLeft);
            return (x / maxLeft) * 100;
        };

        const updatePosition = (pct) => {
            const rect = track.getBoundingClientRect();
            const thumbW = 48;
            const maxLeft = rect.width - thumbW;
            const px = (pct / 100) * maxLeft;
            thumb.style.left = px + 2 + 'px';
            fill.style.width = px + thumbW / 2 + 'px';
            piece.style.left = 2 + (pct / 100) * (92) + '%';
            label.style.opacity = pct > 10 ? '0' : '1';
        };

        const onStart = (e) => {
            if (verified) return;
            isDragging = true;
            startX = e.clientX || e.touches[0].clientX;
            thumb.style.transition = 'none';
            fill.style.transition = 'none';
            piece.style.transition = 'none';
        };

        const onMove = (e) => {
            if (!isDragging || verified) return;
            e.preventDefault();
            const clientX = e.clientX || e.touches[0].clientX;
            const pct = getPercent(clientX);
            updatePosition(pct);
        };

        const onEnd = (e) => {
            if (!isDragging || verified) return;
            isDragging = false;
            thumb.style.transition = 'left 0.3s ease';
            fill.style.transition = 'width 0.3s ease';
            piece.style.transition = 'left 0.3s ease';

            const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX) || 0;
            const pct = getPercent(clientX);

            if (Math.abs(pct - puzzleTarget) <= tolerance) {
                // SUCCESS
                verified = true;
                updatePosition(puzzleTarget);
                thumb.classList.add('matched');
                fill.classList.add('matched');
                piece.classList.add('matched');
                thumb.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>';
                status.textContent = '✅ Verified! Redirecting...';
                status.className = 'captcha-status success';
                document.getElementById('captcha-target').style.borderColor = '#22c55e';
                document.getElementById('captcha-target').style.background = 'rgba(34,197,94,0.1)';
                setTimeout(() => { overlay.remove(); onSuccess(); }, 800);
            } else {
                // FAIL — reset
                status.textContent = 'Not quite — try again!';
                status.className = 'captcha-status fail';
                setTimeout(() => {
                    updatePosition(0);
                    setTimeout(() => { status.textContent = ''; }, 1000);
                }, 300);
            }
        };

        // Mouse events
        thumb.addEventListener('mousedown', onStart);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);

        // Touch events
        thumb.addEventListener('touchstart', onStart, { passive: true });
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);

        // Cancel
        document.getElementById('captcha-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        // Cleanup listeners on remove
        const observer = new MutationObserver(() => {
            if (!document.getElementById('captcha-overlay')) {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onEnd);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onEnd);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });
    };

    let formattedDate = "N/A";
    try {
        if (product.createdAt) {
            formattedDate = new Date(product.createdAt).toLocaleDateString();
        }
    } catch (e) {
        console.warn("Invalid Date:", product.createdAt);
    }

    // YouTube Embed Link
    let youtubeEmbedHtml = '';
    if (product.youtube) {
        let videoId = null;
        const ytMatch = product.youtube.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (ytMatch && ytMatch[1]) {
            videoId = ytMatch[1];
        }

        if (videoId) {
            youtubeEmbedHtml = `
                <div class="video-container" style="margin-top: var(--spacing-8);">
                    <iframe src="https://www.youtube.com/embed/${videoId}" title="Product Video Review" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </div>
            `;
        }
    }

    // Process Images
    const rawImages = product.images || [product.image];
    const images = rawImages.filter(img => img && img.trim() !== '').map(img => getImageUrl(img));
    if (images.length === 0) images.push("https://via.placeholder.com/800x600?text=No+Image");

    // Thumbnails HTML
    let thumbnailsHtml = '';
    if (images.length > 1) {
        thumbnailsHtml = `
            <div class="thumbnail-strip" style="margin-top: var(--spacing-4);">
                ${images.map((imgUrl, idx) => `
                    <div class="thumbnail-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
                        <img src="${imgUrl}" alt="${product.name} Thumbnail ${idx + 1}">
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Summary Text
    const summaryCardHtml = product.summary ? `
        <div class="product-summary" style="margin-top: var(--spacing-4);">
            <strong>Mod Summary:</strong> ${product.summary}
        </div>
    ` : '';

    // Specifications HTML
    const specs = [
        { 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`, 
            label: 'Game Version', 
            value: product.version || 'BUSSID v3.8+' 
        },
        { 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`, 
            label: 'Brand / Make', 
            value: product.brand || 'Custom Coach' 
        },
        { 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m4.93 4.93 4.24 4.24"></path><path d="m14.83 9.17 4.24-4.24"></path><path d="m14.83 14.83 4.24 4.24"></path><path d="m9.17 14.83-4.24 4.24"></path><circle cx="12" cy="12" r="4"></circle></svg>`, 
            label: 'Engine Specs', 
            value: product.engine || 'High Power Transmission' 
        },
        { 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`, 
            label: 'Poly Quality', 
            value: product.polygons || 'Ultra High-Poly' 
        },
        { 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`, 
            label: 'Download Size', 
            value: product.size || '35 MB' 
        },
        { 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`, 
            label: 'Interior Cockpit', 
            value: product.interior ? 'Fully Detailed Interior' : 'Exterior Only' 
        }
    ];

    const specsHtml = specs.map(s => `
        <div class="spec-item">
            <span class="spec-label">
                ${s.icon}
                ${s.label}
            </span>
            <span class="spec-value">${s.value}</span>
        </div>
    `).join('');

    // Description formatted text
    const formattedDescription = (product.description || 'No description available.').replace(/\n/g, '<br>');

    // Verified badge for uploader
    const verificationBadge = uploader.isVerified ? `<img src="assets/images/varified.png" title="Verified Admin" style="height: 1.15em; vertical-align: middle; margin-left: 4px; display: inline-block;">` : '';

    productContainer.innerHTML = `
        <nav class="breadcrumb" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: var(--spacing-6); font-size: 0.85rem; color: var(--text-secondary);">
            <a href="index.html" style="color: inherit; text-decoration: none; display: flex; align-items: center; gap: 0.35rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                Home
            </a>
            <span class="separator">/</span>
            <a href="products.html" style="color: inherit; text-decoration: none;">Store</a>
            <span class="separator">/</span>
            <span style="color: var(--text-primary); font-weight: 600;">${product.name || 'Details'}</span>
        </nav>

        <div class="product-grid">
            <div class="product-gallery">
                <div class="main-image-wrapper">
                    <img id="main-product-image" src="${images[0]}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/800x600?text=Image+Not+Found'">
                </div>
                ${thumbnailsHtml}
                ${summaryCardHtml}

                <!-- Mod Description Section -->
                <div style="margin-top: var(--spacing-6); background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--spacing-6); box-shadow: var(--shadow-sm);">
                    <h3 style="font-size: 1.25rem; font-family: var(--font-heading); margin-bottom: var(--spacing-4); color: var(--text-primary);">Vehicle Overview & Documentation</h3>
                    <div style="font-size: 0.95rem; line-height: 1.7; color: var(--text-secondary); word-break: break-word;">
                        ${formattedDescription}
                    </div>
                </div>

                ${youtubeEmbedHtml}
            </div>

            <div class="product-info">
                <div class="product-info-container">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                        <span class="category-pill">${product.category || 'BUSSID MOD'}</span>
                        <span class="trust-badge"><span style="color: #f59e0b;">★</span> Verified Mod</span>
                    </div>
                    <h1 style="margin-bottom: 0.75rem; font-size: 2rem; font-family: var(--font-heading);">${product.name || 'Unnamed Product'}</h1>
                    <div class="uploader-info" style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                        <span>Published By:</span>
                        <strong style="color: var(--text-primary); margin-left: 0.35rem;">${uploader.name}</strong>${verificationBadge}
                    </div>

                    <div class="product-price" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.75rem; padding: 1.15rem 1.35rem; background: var(--bg-secondary); border-radius: var(--radius-xl); border: 1px solid var(--color-border);">
                        <div>
                            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Price</span>
                            <span style="font-size: 2.25rem; font-weight: 800; font-family: var(--font-heading); color: var(--color-primary);">${isFree ? 'FREE' : formatPrice(product.price)}</span>
                        </div>
                        <span style="font-size: 0.875rem; font-weight: 700; color: var(--color-primary); display: flex; align-items: center; gap: 0.45rem; background: var(--color-primary-light); padding: 0.5rem 1.15rem; border-radius: var(--radius-full); border: 1px solid rgba(37, 99, 235, 0.2);">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            ${totalDownloads} Downloads
                        </span>
                    </div>

                    <div class="specs-grid">
                        ${specsHtml}
                    </div>

                    <div class="buy-card">
                        <div class="download-stats-card" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; padding: 0.85rem 1.15rem; background: var(--bg-primary); border-radius: var(--radius-lg); border: 1px solid var(--color-border);">
                            <div style="display: flex; align-items: center; gap: 0.65rem;">
                                <div style="width: 36px; height: 36px; border-radius: 8px; background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                </div>
                                <div>
                                    <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Database Telemetry</div>
                                    <div style="font-size: 0.95rem; font-weight: 800; font-family: var(--font-heading); color: var(--text-primary);"><span style="color: var(--color-primary);">${totalDownloads}</span> Total Downloads</div>
                                </div>
                            </div>
                            <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: #059669; background: rgba(16, 185, 129, 0.1); padding: 4px 10px; border-radius: var(--radius-full); border: 1px solid rgba(16, 185, 129, 0.25);">
                                <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span> Instant Access
                            </span>
                        </div>

                        <div style="display: flex; gap: var(--spacing-3); width: 100%;">
                            <button id="buy-btn" class="btn btn-primary btn-lg" style="flex: 1; font-size:1.05rem; padding:0.95rem; display:flex; align-items:center; justify-content:center; gap:0.5rem; border-radius: var(--radius-xl);">
                                ${isFree ? 
                                `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                 <span>Free Instant Download</span>` :
                                `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                                 <span>Buy Now & Download</span>`
                                }
                            </button>
                            <button id="detail-wishlist-btn" class="btn btn-outline" style="padding: 0 1.15rem; border-radius: var(--radius-xl);" title="Save to Garage Wishlist">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            </button>
                        </div>

                        <div class="guarantee-list">
                            <div class="guarantee-item">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-primary);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                <span>100% Virus-Free & File Integrity Verified</span>
                            </div>
                            <div class="guarantee-item">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-primary);"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                <span>Immediate High-Speed Cloud Download</span>
                            </div>
                            <div class="guarantee-item">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-primary);"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                <span>Lifetime Order History Access</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div id="related-mods-container"></div>
    `;

    const buyBtnEl = document.getElementById('buy-btn');
    if (buyBtnEl) {
        buyBtnEl.addEventListener('click', handleBuyNow);
    }

    const detailWishBtn = document.getElementById('detail-wishlist-btn');
    if (detailWishBtn) {
        let wishlist = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
        if (wishlist.includes(id)) {
            detailWishBtn.classList.add('active');
            detailWishBtn.querySelector('svg').style.fill = '#ef4444';
            detailWishBtn.querySelector('svg').style.color = '#ef4444';
        }

        detailWishBtn.addEventListener('click', () => {
            wishlist = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
            const svg = detailWishBtn.querySelector('svg');
            if (wishlist.includes(id)) {
                wishlist = wishlist.filter(x => x !== id);
                detailWishBtn.classList.remove('active');
                svg.style.fill = 'none';
                svg.style.color = 'currentColor';
            } else {
                wishlist.push(id);
                detailWishBtn.classList.add('active');
                svg.style.fill = '#ef4444';
                svg.style.color = '#ef4444';
            }
            localStorage.setItem('enroute_wishlist', JSON.stringify(wishlist));
        });
    }

    // Thumbnail switching logic
    const thumbItems = document.querySelectorAll('.thumbnail-item');
    const mainImg = document.getElementById('main-product-image');
    
    thumbItems.forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.getAttribute('data-idx'));
            if (images[idx]) {
                thumbItems.forEach(t => t.classList.remove('active'));
                item.classList.add('active');
                mainImg.src = images[idx];
            }
        });
    });

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