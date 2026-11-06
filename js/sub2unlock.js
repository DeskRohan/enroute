import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { downloadModInPlace } from './inplace-downloader.js';

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
            
            // Block access for non-admins if product is in upcoming premiere or scheduled in the future
            const isAdmin = localStorage.getItem('userRole') === 'admin';
            const releaseTime = product.expectedReleaseDate || product.scheduledDate;
            const isUpcomingPremiere = (product.status === 'upcoming' || product.isUpcoming) && releaseTime && (new Date(releaseTime) > new Date());
            const isScheduled = product.status === 'scheduled' && (!product.scheduledDate || new Date(product.scheduledDate) > new Date());
            
            if ((isUpcomingPremiere || isScheduled) && !isAdmin) {
                const formattedTime = releaseTime ? new Date(releaseTime).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : 'soon';
                modNameEl.innerHTML = `<span style="color: #7c3aed;">🎬 Premiere Locked:</span> ${product.name}`;
                btnSubscribe.disabled = true;
                const lockBox = document.createElement('div');
                lockBox.style.cssText = 'margin: 1.5rem auto; padding: 1.25rem; background: #faf5ff; border: 1px solid #c4b5fd; border-radius: 10px; color: #4c1d95; font-size: 0.95rem; line-height: 1.5; text-align: center; max-width: 480px;';
                lockBox.innerHTML = `<strong>🎬 YouTube Premiere Active!</strong><br><span style="font-size: 0.88rem; color: #6d28d9;">Free download will automatically unlock on <strong>${formattedTime}</strong>. Please check back when the premiere starts!</span>`;
                if (btnSubscribe.parentElement) {
                    btnSubscribe.parentElement.appendChild(lockBox);
                }
                return;
            }

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
        const originalText = btnGetLink.innerHTML;
        btnGetLink.disabled = true;
        btnGetLink.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg>
            <span>Preparing Mod Download...</span>
        `;

        try {
            const docRef = doc(db, "products", productId);
            await updateDoc(docRef, { downloadCount: increment(1) });
        } catch (err) {
            console.error("Error updating count", err);
        }

        const modTitle = modNameEl ? modNameEl.textContent : 'BUSSID Mod';
        await downloadModInPlace(targetDownloadLink, modTitle, btnGetLink);
    } else {
        alert("No download link is available for this mod.");
    }
});

document.addEventListener('DOMContentLoaded', init);
