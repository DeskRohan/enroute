import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
let productId = urlParams.get('id') || sessionStorage.getItem('unlockProductId');

const modNameEl = document.getElementById('mod-name');
const btnSubscribe = document.getElementById('btn-subscribe');
const btnGetLink = document.getElementById('btn-get-link');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const statusMessage = document.getElementById('status-message');

let targetDownloadLink = '';
let targetChannelLink = '';

const init = async () => {
    if (!productId) {
        modNameEl.textContent = 'Invalid Product ID';
        btnSubscribe.disabled = true;
        return;
    }

    try {
        const docRef = doc(db, "products", productId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const product = docSnap.data();
            modNameEl.textContent = `Mod: ${product.name}`;
            
            const bc = document.getElementById('breadcrumbs');
            if (bc) {
                bc.innerHTML = `
                    <a href="index.html">Home</a>
                    <span class="separator">&gt;</span>
                    <a href="product.html?id=${productId}">${product.name}</a>
                    <span class="separator">&gt;</span>
                    <span class="current">Unlock</span>
                `;
            }
            
            targetDownloadLink = product.downloadLink || '#';
            targetChannelLink = product.channelLink || 'https://youtube.com';

        } else {
            modNameEl.textContent = 'Product not found';
        }
    } catch (error) {
        console.error("Error fetching product:", error);
        modNameEl.textContent = 'Error loading product details';
    }
};

btnSubscribe.addEventListener('click', () => {
    // Open channel in new tab
    window.open(targetChannelLink, '_blank');
    
    // UI Updates
    btnSubscribe.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Subscribed';
    btnSubscribe.classList.remove('btn-youtube');
    btnSubscribe.classList.add('btn-completed');
    btnSubscribe.disabled = true;

    statusMessage.style.display = 'block';
    
    let timeLeft = 10;
    statusMessage.textContent = `Please wait ${timeLeft} seconds...`;

    // 10 second verification timer
    const timerId = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            statusMessage.textContent = `Please wait ${timeLeft} seconds...`;
        } else {
            clearInterval(timerId);
            statusMessage.style.display = 'none';
            
            // Enable Step 2
            step1.classList.remove('active');
            step1.classList.add('completed');
            
            step2.classList.remove('disabled');
            step2.classList.add('active');
            
            btnGetLink.disabled = false;
        }
    }, 1000);
});

btnGetLink.addEventListener('click', async () => {
    if (targetDownloadLink && targetDownloadLink !== '#') {
        window.open(targetDownloadLink, '_blank');
        try {
            const docRef = doc(db, "products", productId);
            await updateDoc(docRef, { downloadCount: increment(3) });
        } catch (err) {
            console.error("Error updating count", err);
        }
    } else {
        alert("No download link is available for this mod.");
    }
});

document.addEventListener('DOMContentLoaded', init);
