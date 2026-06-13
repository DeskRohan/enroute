import { db, auth } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ENV } from './env.js';

const checkoutForm = document.getElementById('checkout-form');
const custNameInput = document.getElementById('cust-name');
const custEmailInput = document.getElementById('cust-email');
const orderSummaryContainer = document.getElementById('order-summary');
const payBtn = document.getElementById('pay-btn');

let currentProduct = null;
let currentUser = null;

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(price);
};

// Google Drive Image URL Converter
function getImageUrl(url) {
    if (!url || url.trim() === "") {
        return "https://via.placeholder.com/800x600?text=No+Image";
    }

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
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
    }

    return url;
}

// Check if product exists in session storage
const initCheckout = () => {
    const productData = sessionStorage.getItem('checkoutProduct');
    if (!productData) {
        window.location.href = 'products.html';
        return;
    }
    
    currentProduct = JSON.parse(productData);
    
    const bc = document.getElementById('breadcrumbs');
    if (bc) {
        bc.innerHTML = `
            <a href="index.html">Home</a>
            <span class="separator">&gt;</span>
            <a href="product.html?id=${currentProduct.id}">${currentProduct.name}</a>
            <span class="separator">&gt;</span>
            <span class="current">Checkout</span>
        `;
    }
    
    const rawImg = currentProduct.image || (currentProduct.images && currentProduct.images[0]) || '';
    const displayImage = getImageUrl(rawImg);
    
    // Render Summary
    orderSummaryContainer.innerHTML = `
        <h3 class="mb-4">Order Summary</h3>
        <div class="product-preview">
            <img src="${displayImage}" alt="${currentProduct.name}">
            <div>
                <h4>${currentProduct.name}</h4>
                <p class="text-secondary text-sm mt-1">${currentProduct.category}</p>
            </div>
        </div>
        <div class="summary-item">
            <span>Subtotal</span>
            <span>${formatPrice(currentProduct.price)}</span>
        </div>
        <div class="summary-item">
            <span>Total</span>
            <span class="color-primary">${formatPrice(currentProduct.price)}</span>
        </div>
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

// Razorpay Integration
checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentProduct || !currentUser) return;

    payBtn.disabled = true;
    payBtn.textContent = 'Processing...';

    // Get Razorpay Key from ENV
    const RAZORPAY_KEY = ENV.RAZORPAY_KEY_ID;

    const options = {
        "key": RAZORPAY_KEY, 
        "amount": currentProduct.price * 100, // Amount in paise
        "currency": "INR",
        "name": "Enroute Store",
        "description": `Purchase: ${currentProduct.name}`,
        "image": "https://via.placeholder.com/150", // Your logo here
        "handler": async function (response) {
            // Success handler
            try {
                // Save Order to Firestore
                const orderData = {
                    paymentId: response.razorpay_payment_id,
                    userId: currentUser.uid,
                    email: currentUser.email,
                    customerName: custNameInput.value,
                    productId: currentProduct.id,
                    productName: currentProduct.name,
                    amount: currentProduct.price,
                    status: 'completed',
                    createdAt: serverTimestamp()
                };

                const docRef = await addDoc(collection(db, "orders"), orderData);
                
                // Use sessionStorage to pass IDs robustly to prevent URL rewriting issues
                sessionStorage.setItem('successOrderId', docRef.id);
                sessionStorage.setItem('successProductId', currentProduct.id);
                
                // Clear session storage and redirect
                sessionStorage.removeItem('checkoutProduct');
                window.location.href = `success.html?orderId=${docRef.id}&productId=${currentProduct.id}`;

            } catch (error) {
                console.error("Error creating order:", error);
                alert("Payment successful, but failed to record order. Please contact support.");
            }
        },
        "prefill": {
            "name": custNameInput.value,
            "email": currentUser.email
        },
        "theme": {
            "color": "#3b82f6" // Primary color
        }
    };

    try {
        const rzp1 = new Razorpay(options);
        rzp1.on('payment.failed', function (response){
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
