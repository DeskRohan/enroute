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

            let uploader = { name: 'Admin', isVerified: false };
            if (product.addedBy) {
                const uq = query(collection(db, "users"), where("email", "==", product.addedBy));
                const uSnap = await getDocs(uq);
                if (!uSnap.empty) {
                    const ud = uSnap.docs[0].data();
                    uploader.name = ud.name || 'Admin';
                    uploader.isVerified = ud.isVerified || false;
                }
            }

            renderProduct(product, productId, uploader);
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

const renderProduct = (product, id, uploader) => {
    document.title = `${product.name || 'Product'} - Enroute Store`;

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
                    background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
                    z-index: 10000; display: flex; align-items: center; justify-content: center;
                    animation: captchaFadeIn 0.25s ease;
                }
                @keyframes captchaFadeIn { from { opacity: 0; } to { opacity: 1; } }
                .captcha-modal {
                    background: #fff; border-radius: 16px; padding: 2rem;
                    max-width: 380px; width: 90%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
                    text-align: center; animation: captchaSlideUp 0.3s ease;
                    user-select: none;
                }
                @keyframes captchaSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .captcha-modal h3 { margin: 0 0 0.25rem; font-size: 1.2rem; color: #111827; }
                .captcha-modal p.desc { color: #6b7280; font-size: 0.8rem; margin: 0 0 1.25rem; }
                .captcha-lock { font-size: 2.25rem; margin-bottom: 0.5rem; }

                /* Puzzle area */
                .puzzle-area {
                    position: relative; width: 100%; height: 140px;
                    background: linear-gradient(135deg, #e0e7ff 0%, #dbeafe 50%, #ede9fe 100%);
                    border-radius: 12px; overflow: hidden; margin-bottom: 1rem;
                    border: 1px solid #c7d2fe;
                }
                .puzzle-pattern {
                    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    background-image:
                        radial-gradient(circle at 20% 30%, rgba(99,102,241,0.15) 0%, transparent 50%),
                        radial-gradient(circle at 80% 70%, rgba(139,92,246,0.12) 0%, transparent 50%),
                        radial-gradient(circle at 50% 50%, rgba(59,130,246,0.08) 0%, transparent 60%);
                }
                .puzzle-target {
                    position: absolute; top: 50%; transform: translateY(-50%);
                    width: 48px; height: 48px; border-radius: 10px;
                    border: 3px dashed rgba(99,102,241,0.5);
                    background: rgba(99,102,241,0.08);
                    transition: border-color 0.2s, background 0.2s;
                }
                .puzzle-piece {
                    position: absolute; top: 50%; transform: translateY(-50%);
                    width: 48px; height: 48px; border-radius: 10px;
                    background: transparent;
                    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
                    display: flex; align-items: center; justify-content: center;
                    transition: filter 0.2s;
                    pointer-events: none;
                }
                .puzzle-piece img { width: 100%; height: 100%; color: #fff; }
                .puzzle-piece.matched {
                    filter: drop-shadow(0 4px 12px rgba(34,197,94,0.8));
                }

                /* Slider track */
                .slider-track {
                    position: relative; width: 100%; height: 48px;
                    background: #f3f4f6; border-radius: 24px;
                    border: 1px solid #d1d5db; overflow: hidden;
                    margin-bottom: 0.75rem;
                }
                .slider-fill {
                    position: absolute; top: 0; left: 0; bottom: 0; width: 0;
                    background: linear-gradient(90deg, #e0e7ff, #c7d2fe);
                    border-radius: 24px; transition: background 0.2s;
                    pointer-events: none;
                }
                .slider-fill.matched { background: linear-gradient(90deg, #dcfce7, #bbf7d0); }
                .slider-label {
                    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    color: #9ca3af; font-size: 0.8rem; font-weight: 600;
                    pointer-events: none; white-space: nowrap;
                    letter-spacing: 0.5px;
                }
                .slider-thumb {
                    position: absolute; top: 2px; left: 2px;
                    width: 44px; height: 44px; border-radius: 50%;
                    background: #fff; border: 2px solid #d1d5db;
                    display: flex; align-items: center; justify-content: center;
                    cursor: grab; touch-action: none;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transition: border-color 0.2s, box-shadow 0.2s;
                    z-index: 2;
                }
                .slider-thumb:active { cursor: grabbing; }
                .slider-thumb:hover { border-color: #6366f1; box-shadow: 0 2px 12px rgba(99,102,241,0.25); }
                .slider-thumb svg { width: 20px; height: 20px; color: #6b7280; }
                .slider-thumb.matched { border-color: #22c55e; background: #22c55e; }
                .slider-thumb.matched svg { color: #fff; }

                .captcha-status {
                    font-size: 0.8rem; color: #6b7280; min-height: 1.25rem;
                    margin-bottom: 0.75rem;
                }
                .captcha-status.success { color: #16a34a; font-weight: 600; }
                .captcha-status.fail { color: #ef4444; }

                .captcha-btn-cancel {
                    padding: 0.6rem 1.5rem; border: 1px solid #d1d5db; border-radius: 8px;
                    background: #f9fafb; color: #374151; font-size: 0.85rem; font-weight: 600;
                    cursor: pointer; font-family: inherit; transition: all 0.2s;
                }
                .captcha-btn-cancel:hover { background: #e5e7eb; }
            </style>
            <div class="captcha-modal">
                <div class="captcha-lock">🛡️</div>
                <h3>Security Check</h3>
                <p class="desc">Drag the slider to fit the puzzle piece into the target</p>
                <div class="puzzle-area">
                    <div class="puzzle-pattern"></div>
                    <div class="puzzle-target" id="captcha-target" style="left: ${puzzleTarget}%;"></div>
                    <div class="puzzle-piece" id="captcha-piece" style="left: 2%;">
                        <img src="assets/images/fevicon.png" style="width: 48px; height: 48px; object-fit: contain; pointer-events: none;" alt="Captcha Piece">
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

    const verificationBadge = uploader.isVerified ? `<img src="assets/images/varified.png" title="Verified Admin" style="height: 1.2em; vertical-align: middle; margin-left: 6px; display: inline-block;">` : '';

    productContainer.innerHTML = `
        <nav class="breadcrumbs" style="margin-bottom: 2rem;">
            <a href="index.html">Home</a>
            <span class="separator">&gt;</span>
            <a href="products.html">Store</a>
            <span class="separator">&gt;</span>
            <span class="current">${product.name}</span>
        </nav>
        <div class="product-grid">

            <div class="product-gallery">
                <div class="main-image-wrapper" style="position: relative; overflow: hidden; border-radius: var(--radius-lg);">
                    <img id="main-product-image" src="${images[0]}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/800x600?text=Image+Not+Found'" style="width: 100%; display: block; transition: opacity 0.5s ease-in-out;">
                </div>
                ${summaryHtml}
            </div>

            <div class="product-info">
                <div class="product-info-container">
                    <h1 style="margin-bottom: 0.5rem; font-size: clamp(2rem, 4vw, 2.5rem); line-height: 1.2;">${product.name || 'Unnamed Product'}</h1>
                    
                    <p class="text-secondary" style="text-transform:uppercase; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 0.5rem; color: var(--color-accent);">
                        ${product.category || 'Mod'}
                    </p>
                    <p style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                        Uploaded By: <span style="font-weight: 600; color: var(--text-primary);">${uploader.name}</span>${verificationBadge}
                    </p>

                    <div class="product-price" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
                        <span style="font-size: 2.5rem; font-weight: 700;">${isFree ? 'FREE' : formatPrice(product.price)}</span>
                        <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem; background: var(--bg-secondary); padding: 0.5rem 1rem; border-radius: 20px; border: 1px solid var(--color-border);">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            ${(product.downloadCount || 0) + '+'} Downloads
                        </span>
                    </div>

                    <div class="specs-grid">
                        ${specsHtml}
                    </div>

                    <div class="buy-card" style="margin-bottom: 2rem;">
                        <button id="buy-btn" class="btn btn-primary btn-lg" style="width:100%; font-size:1.125rem; padding:1rem; display:flex; align-items:center; justify-content:center; gap:0.5rem; box-shadow: 0 10px 20px -10px var(--color-primary);">
                            ${isFree ? 
                            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                             Download` :
                            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                             Buy Now`
                            }
                        </button>
                        
                        ${!isFree ? `
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
                        ` : ''}
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
        let currentIdx = 0;
        
        setInterval(() => {
            mainImg.style.opacity = '0.7'; // Small fade effect
            setTimeout(() => {
                currentIdx = (currentIdx + 1) % images.length;
                mainImg.src = images[currentIdx];
                mainImg.style.opacity = '1';
            }, 150);
        }, 3000);
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