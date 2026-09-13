import { db, auth } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const checkoutForm = document.getElementById('checkout-form');
const custNameInput = document.getElementById('cust-name');
const custEmailInput = document.getElementById('cust-email');
const orderSummaryContainer = document.getElementById('order-summary');
const payBtn = document.getElementById('pay-btn');

let currentProduct = null;
let cartItems = [];
let isCartCheckout = false;
let currentUser = null;

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(price || 0);
};

// Google Drive Image URL Converter (Reliable Google UserContent CDN & direct links)
function getImageUrl(url) {
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
}

// Initialize Checkout Data (Supports Single Item and Multi-Item Cart)
const initCheckout = () => {
    const checkoutMode = sessionStorage.getItem('checkoutMode');
    const cartData = sessionStorage.getItem('checkoutCart');
    const singleProductData = sessionStorage.getItem('checkoutProduct');

    if (checkoutMode === 'cart' && cartData) {
        try {
            cartItems = JSON.parse(cartData);
            if (cartItems.length > 0) {
                isCartCheckout = true;
            }
        } catch(e) {
            isCartCheckout = false;
        }
    }

    if (!isCartCheckout) {
        if (!singleProductData) {
            window.location.href = 'products.html';
            return;
        }
        currentProduct = JSON.parse(singleProductData);
        cartItems = [currentProduct];
    }

    const bc = document.getElementById('breadcrumbs');
    if (bc) {
        bc.innerHTML = `
            <a href="index.html">Home</a>
            <span class="separator">&gt;</span>
            <a href="products.html">Store</a>
            <span class="separator">&gt;</span>
            <span class="current">${isCartCheckout ? `Cart Checkout (${cartItems.length} Mods)` : currentProduct.name}</span>
        `;
    }

    renderOrderSummary();
};

// Render Order Summary (Handles Summation of All Selected Products)
const renderOrderSummary = () => {
    let totalOriginal = 0;
    let totalPayable = 0;

    let itemsPreviewHtml = '';
    cartItems.forEach(item => {
        const rawImg = item.image || (item.images && item.images[0]) || '';
        const displayImage = getImageUrl(rawImg);
        const itemOrig = Number(item.originalPrice ?? item.price ?? 0);
        const itemFinal = Number(item.price ?? 0);

        totalOriginal += itemOrig;
        totalPayable += itemFinal;

        itemsPreviewHtml += `
            <div class="product-preview" style="display:flex; gap:var(--spacing-3); margin-bottom:var(--spacing-4); padding-bottom:var(--spacing-4); border-bottom:1px solid var(--color-border);">
                <img src="${displayImage}" alt="${item.name}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';" style="width:68px; height:68px; object-fit:cover; border-radius:var(--radius-lg); border:1px solid var(--color-border); flex-shrink:0;">
                <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                        <h4 style="font-size:0.95rem; font-weight:700; margin:0; line-height:1.3; color:var(--text-primary);">${item.name}</h4>
                        <span style="font-weight:800; font-family:var(--font-heading); color:var(--color-primary); white-space:nowrap;">${formatPrice(itemFinal)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-top:4px;">
                        <span class="text-secondary" style="font-size:0.75rem; text-transform:uppercase;">${(item.category === 'livery' ? 'Vehicle Livery/Skin' : 'Vehicle Mod')}</span>
                        <span style="font-size:0.7rem; font-weight:700; color:#059669; background:rgba(16,185,129,0.1); padding:1px 6px; border-radius:3px;">1 Unit License</span>
                    </div>
                </div>
            </div>
        `;
    });

    const totalDiscount = Math.max(0, totalOriginal - totalPayable);

    let pricingSummaryHtml = '';
    if (totalDiscount > 0) {
        pricingSummaryHtml = `
            <div class="summary-item">
                <span>Items Subtotal (${cartItems.length})</span>
                <span style="text-decoration: line-through; color: var(--text-muted);">${formatPrice(totalOriginal)}</span>
            </div>
            <div class="summary-item" style="color: #059669; font-weight: 600;">
                <span>Total Offer Savings</span>
                <span>-${formatPrice(totalDiscount)}</span>
            </div>
            <div class="summary-item" style="border-top: 1px solid var(--color-border); padding-top: 0.75rem; margin-top: 0.5rem;">
                <span style="font-weight: 700;">Total Amount Payable</span>
                <span class="color-primary" style="font-weight: 800; font-size: 1.35rem;">${formatPrice(totalPayable)}</span>
            </div>
        `;
    } else {
        pricingSummaryHtml = `
            <div class="summary-item">
                <span>Subtotal (${cartItems.length} item${cartItems.length > 1 ? 's' : ''})</span>
                <span>${formatPrice(totalPayable)}</span>
            </div>
            <div class="summary-item" style="border-top: 1px solid var(--color-border); padding-top: 0.75rem; margin-top: 0.5rem;">
                <span style="font-weight: 700;">Total Amount Payable</span>
                <span class="color-primary" style="font-weight: 800; font-size: 1.35rem;">${formatPrice(totalPayable)}</span>
            </div>
        `;
    }

    orderSummaryContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0;">Order Summary</h3>
            <span style="font-size:0.78rem; font-weight:700; background:var(--color-primary-light); color:var(--color-primary); padding:2px 8px; border-radius:var(--radius-full);">${cartItems.length} Mod${cartItems.length > 1 ? 's' : ''} Selected</span>
        </div>
        <div class="order-items-scroll" style="max-height: 280px; overflow-y: auto; margin-bottom: 1rem; padding-right: 4px;">
            ${itemsPreviewHtml}
        </div>
        ${pricingSummaryHtml}
    `;
};

// Handle Auth State
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        custEmailInput.value = user.email;
        initCheckout();
    } else {
        // Must be logged in to checkout
        window.location.href = 'login.html';
    }
});

// Razorpay Integration & Multi-Product Payment Submission
checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (cartItems.length === 0 || !currentUser) return;

    let totalAmount = 0;
    cartItems.forEach(item => {
        totalAmount += Number(item.price ?? 0);
    });

    payBtn.disabled = true;
    payBtn.textContent = 'Processing Payment...';

    // Razorpay Key ID
    const RAZORPAY_KEY = "rzp_live_T18UlWiOOjCX7g";

    try {
        const orderDescription = isCartCheckout ? 
            `Order: ${cartItems.length} BUSSID Mods (${cartItems.map(i => i.name).join(', ')})` : 
            `Purchase: ${cartItems[0].name}`;

        // Create order on the server
        const orderResponse = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: Math.round(totalAmount * 100), // Amount in paise
                currency: "INR",
                receipt: `rcpt_${Date.now()}`
            })
        });

        const orderData = await orderResponse.json();

        if (!orderResponse.ok) {
            throw new Error(orderData.error || 'Failed to create order on server');
        }

        const options = {
            "key": RAZORPAY_KEY,
            "amount": orderData.amount,
            "currency": orderData.currency,
            "name": "EnrouteIn",
            "description": orderDescription.substring(0, 250),
            "image": "https://via.placeholder.com/150",
            "order_id": orderData.id,
            "handler": async function (response) {
                try {
                    // Prepare items array for DB
                    const dbItems = cartItems.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        originalPrice: item.originalPrice ?? item.price,
                        category: item.category || 'mod',
                        downloadLink: item.downloadLink || item.downloadUrl || ''
                    }));

                    // Save Order to Firestore
                    const orderDataForDb = {
                        paymentId: response.razorpay_payment_id,
                        orderId: response.razorpay_order_id,
                        signature: response.razorpay_signature,
                        userId: currentUser.uid,
                        email: currentUser.email,
                        customerName: custNameInput.value,
                        items: dbItems,
                        productNames: cartItems.map(i => i.name).join(', '),
                        productId: cartItems[0].id,
                        productName: cartItems[0].name,
                        amount: totalAmount,
                        status: 'completed',
                        createdAt: serverTimestamp()
                    };

                    const docRef = await addDoc(collection(db, "orders"), orderDataForDb);

                    // Update download count for each purchased product in database
                    for (const item of cartItems) {
                        try {
                            const prodDocRef = doc(db, "products", item.id);
                            await updateDoc(prodDocRef, { downloadCount: increment(1) });
                        } catch (countErr) {
                            console.warn("Could not increment downloadCount for product:", item.id, countErr);
                        }
                    }

                    // Clear local cart if checking out from cart
                    if (isCartCheckout) {
                        localStorage.removeItem('enroute_cart');
                    }

                    // Pass Order data to sessionStorage
                    sessionStorage.setItem('successOrderId', docRef.id);
                    sessionStorage.setItem('successProductId', cartItems[0].id);
                    sessionStorage.setItem('successItems', JSON.stringify(dbItems));

                    // Clean session storage
                    sessionStorage.removeItem('checkoutCart');
                    sessionStorage.removeItem('checkoutProduct');
                    sessionStorage.removeItem('checkoutMode');

                    window.location.href = `success.html?orderId=${docRef.id}&productId=${cartItems[0].id}`;

                } catch (error) {
                    console.error("Error saving order:", error);
                    alert("Payment successful, but failed to record order. Please contact support.");
                }
            },
            "prefill": {
                "name": custNameInput.value,
                "email": currentUser.email
            },
            "theme": {
                "color": "#2563eb"
            }
        };

        const rzp1 = new Razorpay(options);
        rzp1.on('payment.failed', function (response) {
            alert(`Payment Failed: ${response.error.description}`);
            payBtn.disabled = false;
            payBtn.textContent = 'Pay Securely with Razorpay';
        });
        rzp1.open();
    } catch (err) {
        console.error("Razorpay error:", err);
        alert("Failed to initialize payment gateway. Check configuration.");
        payBtn.disabled = false;
        payBtn.textContent = 'Pay Securely with Razorpay';
    }
});
