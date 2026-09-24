// ==========================================================================
// Enroute Cart System - Shared Shopping Cart & Drawer
// Enforces 1 Unit per Digital Mod Rule, Multi-Item Summation, and Checkout Flow
// ==========================================================================

const formatPriceINR = (price) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(price || 0);
};

// Reliable Google Drive CDN & Direct URL Parser
const getCartImageUrl = (url) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';
    }

    const cleanUrl = url.trim();
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

// Toast notification helper
const showCartToast = (message, isWarning = false) => {
    let toast = document.getElementById('enroute-cart-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'enroute-cart-toast';
        toast.className = 'cart-toast';
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.6rem;">
            ${isWarning ? 
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>` : 
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
            }
            <span>${message}</span>
        </div>
    `;
    toast.classList.add('show');
    if (isWarning) {
        toast.classList.add('warning');
    } else {
        toast.classList.remove('warning');
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
};

export const EnrouteCart = {
    // Get all items from local storage
    getCart() {
        try {
            return JSON.parse(localStorage.getItem('enroute_cart') || '[]');
        } catch (e) {
            return [];
        }
    },

    // Save cart to local storage
    saveCart(cart) {
        localStorage.setItem('enroute_cart', JSON.stringify(cart));
        this.updateBadge();
        this.renderDrawer();
        window.dispatchEvent(new CustomEvent('enroute-cart-updated', { detail: { cart } }));
    },

    // Add 1 unit of product to cart (strictly 1 unit per mod)
    addToCart(product) {
        if (!product || !product.id) return;
        const cart = this.getCart();
        const existingIndex = cart.findIndex(item => item.id === product.id);

        if (existingIndex > -1) {
            showCartToast(`"${product.name}" is already in your cart (1 unit per digital mod)`, true);
            return;
        }

        const origPrice = Number(product.originalPrice ?? product.price ?? 0);
        const offerPrice = (product.offerPrice !== undefined && product.offerPrice !== null && product.offerPrice !== '') ? Number(product.offerPrice) : null;
        const isLimited = product.offerPeriodType === 'limited';
        const isExpired = isLimited && product.offerExpiryDate && new Date(product.offerExpiryDate) <= new Date();
        const isOfferActive = (offerPrice !== null && offerPrice < origPrice && !isExpired);
        const effectivePrice = isOfferActive ? offerPrice : origPrice;

        const cartItem = {
            id: product.id,
            name: product.name,
            price: effectivePrice,
            originalPrice: origPrice,
            offerPrice: offerPrice,
            isOfferActive: isOfferActive,
            category: product.category || 'mod',
            image: (product.images && product.images.length > 0) ? product.images[0] : (product.image || ''),
            downloadLink: product.downloadLink || product.downloadUrl || '',
            downloadSource: product.downloadSource || ((product.downloadLink || product.downloadUrl || '').includes('sharemods.com') ? 'sharemods' : 'manual'),
            quantity: 1 // Fixed at 1 unit for digital licenses
        };

        cart.push(cartItem);
        this.saveCart(cart);
        showCartToast(`Added "${product.name}" to cart!`);
    },

    // Remove an item from cart
    removeFromCart(productId) {
        let cart = this.getCart();
        cart = cart.filter(item => item.id !== productId);
        this.saveCart(cart);
        showCartToast('Item removed from cart');
    },

    // Clear entire cart
    clearCart() {
        localStorage.removeItem('enroute_cart');
        this.updateBadge();
        this.renderDrawer();
        window.dispatchEvent(new CustomEvent('enroute-cart-updated', { detail: { cart: [] } }));
        showCartToast('Cart cleared');
    },

    // Calculate totals
    getTotals() {
        const cart = this.getCart();
        let totalOriginal = 0;
        let totalPayable = 0;

        cart.forEach(item => {
            const orig = Number(item.originalPrice ?? item.price ?? 0);
            const pay = Number(item.price ?? 0);
            totalOriginal += orig;
            totalPayable += pay;
        });

        const totalDiscount = Math.max(0, totalOriginal - totalPayable);

        return {
            count: cart.length,
            totalOriginal,
            totalDiscount,
            totalPayable
        };
    },

    // Update nav badge counters
    updateBadge() {
        const cart = this.getCart();
        const count = cart.length;
        const badges = document.querySelectorAll('.nav-cart-badge, #nav-cart-badge');
        badges.forEach(badge => {
            badge.textContent = count;
            if (count > 0) {
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        });
    },

    // Open Cart Drawer
    openCart() {
        this.renderDrawer();
        const drawer = document.getElementById('enroute-cart-drawer');
        const backdrop = document.getElementById('enroute-cart-backdrop');
        if (drawer && backdrop) {
            drawer.classList.add('open');
            backdrop.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        // Hide sticky bottom bar while cart drawer is open
        const stickyBar = document.getElementById('product-sticky-bottom-bar');
        if (stickyBar) stickyBar.style.setProperty('display', 'none', 'important');
    },

    // Close Cart Drawer
    closeCart() {
        const drawer = document.getElementById('enroute-cart-drawer');
        const backdrop = document.getElementById('enroute-cart-backdrop');
        if (drawer && backdrop) {
            drawer.classList.remove('open');
            backdrop.classList.remove('open');
            document.body.style.overflow = '';
        }
        // Restore sticky bottom bar when cart drawer closes
        const stickyBar = document.getElementById('product-sticky-bottom-bar');
        if (stickyBar) stickyBar.style.removeProperty('display');
    },

    // Proceed to checkout with cart items
    proceedToCheckout() {
        const cart = this.getCart();
        if (cart.length === 0) {
            showCartToast('Your cart is empty!', true);
            return;
        }

        try {
            sessionStorage.setItem('checkoutMode', 'cart');
            sessionStorage.setItem('checkoutCart', JSON.stringify(cart));
            // For single item fallback compatibility
            sessionStorage.setItem('checkoutProduct', JSON.stringify(cart[0]));
        } catch(e) {}

        this.closeCart();
        window.location.href = 'checkout.html';
    },

    // Render Drawer HTML
    renderDrawer() {
        let drawer = document.getElementById('enroute-cart-drawer');
        let backdrop = document.getElementById('enroute-cart-backdrop');

        if (!drawer) {
            drawer = document.createElement('div');
            drawer.id = 'enroute-cart-drawer';
            drawer.className = 'cart-drawer';
            document.body.appendChild(drawer);
        }

        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'enroute-cart-backdrop';
            backdrop.className = 'cart-backdrop';
            backdrop.addEventListener('click', () => this.closeCart());
            document.body.appendChild(backdrop);
        }

        const cart = this.getCart();
        const { count, totalOriginal, totalDiscount, totalPayable } = this.getTotals();

        let itemsHtml = '';
        if (cart.length === 0) {
            itemsHtml = `
                <div class="cart-empty-state">
                    <div class="cart-empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                    </div>
                    <h4>Your Cart is Empty</h4>
                    <p class="text-secondary" style="font-size: 0.88rem; margin: 0.5rem 0 1.25rem;">Add hyper-realistic BUSSID mods and liveries to your cart to checkout together.</p>
                    <a href="products.html" class="btn btn-primary" onclick="window.EnrouteCart.closeCart();" style="border-radius: var(--radius-full);">
                        Explore Mod Store
                    </a>
                </div>
            `;
        } else {
            itemsHtml = `
                <div class="cart-items-list">
                    ${cart.map((item, idx) => {
                        const imgUrl = getCartImageUrl(item.image);
                        const categoryLabel = item.category === 'livery' ? 'Vehicle Livery/Skin' : 'Vehicle Mod';
                        return `
                            <div class="cart-item-row" data-id="${item.id}">
                                <img src="${imgUrl}" alt="${item.name}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';" class="cart-item-img">
                                <div class="cart-item-details">
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                                        <h4 class="cart-item-title">${item.name}</h4>
                                        <button class="cart-item-remove-btn" onclick="window.EnrouteCart.removeFromCart('${item.id}')" title="Remove Item">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                    <div class="cart-item-meta">
                                        <span class="cart-item-cat">${categoryLabel}</span>
                                        <span class="cart-item-qty-badge">1 Unit License</span>
                                    </div>
                                    <div class="cart-item-price-row">
                                        <span class="cart-item-price">${formatPriceINR(item.price)}</span>
                                        ${item.isOfferActive && item.originalPrice ? `<span class="cart-item-orig-price">${formatPriceINR(item.originalPrice)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        drawer.innerHTML = `
            <div class="cart-drawer-header">
                <div style="display:flex; align-items:center; gap:0.65rem;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-primary);"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                    <h3 style="margin:0; font-size:1.2rem; font-family:var(--font-heading); color:var(--text-primary);">Your Cart</h3>
                    <span class="cart-header-count">${count}</span>
                </div>
                <button class="cart-close-btn" onclick="window.EnrouteCart.closeCart()" title="Close Cart">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <div class="cart-drawer-body">
                ${itemsHtml}
            </div>

            ${cart.length > 0 ? `
                <div class="cart-drawer-footer">
                    <div class="cart-summary-line">
                        <span>Items Total (${count})</span>
                        <span>${formatPriceINR(totalOriginal)}</span>
                    </div>
                    ${totalDiscount > 0 ? `
                        <div class="cart-summary-line discount" style="color:#059669; font-weight:600;">
                            <span>Offer Discount</span>
                            <span>-${formatPriceINR(totalDiscount)}</span>
                        </div>
                    ` : ''}
                    <div class="cart-summary-line total">
                        <span>Total Payable</span>
                        <span class="cart-total-amount">${formatPriceINR(totalPayable)}</span>
                    </div>
                    
                    <button class="btn btn-primary btn-lg cart-checkout-btn" onclick="window.EnrouteCart.proceedToCheckout()" style="width:100%; border-radius:var(--radius-xl); display:flex; align-items:center; justify-content:center; gap:0.6rem; margin-top:0.75rem;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <span>Proceed to Checkout &bull; ${formatPriceINR(totalPayable)}</span>
                    </button>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.75rem; font-size:0.75rem; color:var(--text-muted);">
                        <span>🔒 256-bit Secure Razorpay Checkout</span>
                        <button onclick="window.EnrouteCart.clearCart()" style="background:none; border:none; color:#ef4444; font-size:0.75rem; cursor:pointer; font-weight:600; text-decoration:underline;">Clear Cart</button>
                    </div>
                </div>
            ` : ''}
        `;
    },

    // Initialize globally
    init() {
        this.updateBadge();
        // Attach click listeners to all cart trigger buttons
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#nav-cart-btn, .open-cart-trigger');
            if (btn) {
                e.preventDefault();
                this.openCart();
            }
        });
    }
};

// Expose on window
window.EnrouteCart = EnrouteCart;
window.showCartToast = showCartToast;

// Auto initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => EnrouteCart.init());
} else {
    EnrouteCart.init();
}
