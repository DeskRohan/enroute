import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// DOM Elements
const emailDisplay = document.getElementById('user-email-display');
const nameDisplay = document.getElementById('user-name-display');
const avatarInitial = document.getElementById('user-avatar-initial');
const driverRankBadge = document.getElementById('driver-rank-badge');
const rankTitle = document.getElementById('rank-title');
const driverIdCode = document.getElementById('driver-id-code');
const copyDriverIdBtn = document.getElementById('copy-driver-id-btn');
const openShareModalBtn = document.getElementById('open-share-modal-btn');
const contentArea = document.getElementById('dashboard-content');
const logoutBtn = document.getElementById('logout-btn');
const adminLinkContainer = document.getElementById('admin-link-container');
const invoiceWrapper = document.getElementById('invoice-wrapper');
const invoiceContent = document.getElementById('invoice-content');
const garageCounter = document.getElementById('garage-counter');
const wishlistCounter = document.getElementById('wishlist-counter');

// Share Modal Elements
const shareModal = document.getElementById('share-modal');
const closeShareModalBtn = document.getElementById('close-share-modal-btn');
const whatsappShareBtn = document.getElementById('whatsapp-share-btn');
const downloadLicenseBtn = document.getElementById('download-license-btn');
const copyShareMsgBtn = document.getElementById('copy-share-msg-btn');
const licenseCanvas = document.getElementById('driver-license-canvas');

// Tab Navigation
const tabGarage = document.getElementById('tab-garage');
const tabWishlist = document.getElementById('tab-wishlist');
const tabRequests = document.getElementById('tab-requests');
const tabOrders = document.getElementById('tab-orders');

let currentUser = null;
let currentTab = 'garage'; // 'garage' | 'wishlist' | 'requests' | 'orders'
let cachedOrders = [];
let cachedGarageProducts = [];

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(price || 0);
};

// Google Drive Image URL Converter
const getImageUrl = (url) => {
    if (!url) return 'https://via.placeholder.com/800x600?text=No+Image';
    const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(driveRegex);
    if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
    }
    const driveRegex2 = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
    const match2 = url.match(driveRegex2);
    if (match2 && match2[1]) {
        return `https://drive.google.com/thumbnail?id=${match2[1]}&sz=w1000`;
    }
    return url;
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Toast notification trigger
const showToast = (message) => {
    const toast = document.getElementById('dash-toast');
    const msgEl = document.getElementById('toast-msg');
    if (toast && msgEl) {
        msgEl.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};

// Copy Driver ID Action
if (copyDriverIdBtn) {
    copyDriverIdBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idText = driverIdCode ? driverIdCode.textContent : '';
        navigator.clipboard.writeText(idText).then(() => {
            showToast(`Driver ID ${idText} copied to clipboard!`);
        }).catch(() => {
            showToast(`Driver ID: ${idText}`);
        });
    });
}

// Preload Enroute logo asset for canvas rendering
const enrouteLogoImg = new Image();
enrouteLogoImg.src = 'assets/images/fevicon.png';
enrouteLogoImg.onload = () => {
    if (shareModal && shareModal.classList.contains('active') && currentUser) {
        openShareModal();
    }
};

// ----------------------------------------------------
// HD VIP Driver License Canvas Generator (Matching Reference)
// ----------------------------------------------------
const drawDriverLicenseCard = (canvas, driverName, driverId, rank, email) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = 1200;
    const height = 675;
    canvas.width = width;
    canvas.height = height;

    // Reset transformations
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // 1. Crisp White Card Background with Rounded Rect
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(0, 0, width, height, 28) : ctx.rect(0, 0, width, height);
    ctx.fill();

    // Soft Ambient Gradients on Corners
    const gradTL = ctx.createRadialGradient(80, 80, 20, 80, 80, 450);
    gradTL.addColorStop(0, 'rgba(219, 234, 254, 0.65)');
    gradTL.addColorStop(1, 'rgba(219, 234, 254, 0)');
    ctx.fillStyle = gradTL;
    ctx.fillRect(0, 0, width, height);

    const gradBR = ctx.createRadialGradient(width - 80, height - 80, 20, width - 80, height - 80, 450);
    gradBR.addColorStop(0, 'rgba(191, 219, 254, 0.4)');
    gradBR.addColorStop(1, 'rgba(191, 219, 254, 0)');
    ctx.fillStyle = gradBR;
    ctx.fillRect(0, 0, width, height);

    // 2. Subtle Topographical Contour Wave Lines
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
    ctx.lineWidth = 1.2;
    for (let j = 0; j < 7; j++) {
        ctx.beginPath();
        const yOffset = 180 + j * 45;
        ctx.moveTo(300, yOffset);
        ctx.bezierCurveTo(480, yOffset - 40, 680, yOffset + 50, 900, yOffset - 25);
        ctx.bezierCurveTo(1000, yOffset - 60, 1100, yOffset + 20, width - 40, yOffset);
        ctx.stroke();
    }

    // 3. Card Outer Border
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(1, 1, width - 2, height - 2, 28) : ctx.rect(1, 1, width - 2, height - 2);
    ctx.stroke();

    // 4. Top-Left Logo & Title
    const logoX = 55;
    const logoY = 42;
    const logoSize = 56;

    if (enrouteLogoImg.complete && enrouteLogoImg.naturalWidth > 0) {
        ctx.drawImage(enrouteLogoImg, logoX, logoY, logoSize, logoSize);
    } else {
        // Fallback dynamic logo emblem
        ctx.save();
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(logoX, logoY, logoSize, logoSize, 12) : ctx.rect(logoX, logoY, logoSize, logoSize);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 32px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('E', logoX + logoSize / 2, logoY + logoSize / 2);
        ctx.restore();
    }

    // Text: ENROUTEIN
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 24px "Space Grotesk", sans-serif';
    ctx.fillText('ENROUTEIN', 124, 68);

    // Text: MOTORSPORT AUTHORITY
    ctx.fillStyle = '#64748b';
    ctx.font = '800 11px "Space Grotesk", sans-serif';
    ctx.fillText('MOTORSPORT AUTHORITY', 124, 88);

    // Vertical Divider
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(330, 48);
    ctx.lineTo(330, 96);
    ctx.stroke();

    // Subtitle: DRIVE VIRTUALLY / STAY LEGENDARY
    ctx.fillStyle = '#64748b';
    ctx.font = '800 12px "Space Grotesk", sans-serif';
    ctx.fillText('DRIVE VIRTUALLY', 350, 68);
    ctx.fillText('STAY LEGENDARY', 350, 88);

    // 5. Top-Right Header
    // Accent Dual-Color Pill Bar
    const barW = 160;
    const barH = 6;
    const barX = width - 60 - barW;
    const barY = 48;
    const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    barGrad.addColorStop(0, '#1e3a8a');
    barGrad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(barX, barY, barW, barH, 3) : ctx.rect(barX, barY, barW, barH);
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 22px "Space Grotesk", sans-serif';
    ctx.fillText('VIP DRIVER PASSPORT', width - 60, 82);

    ctx.fillStyle = '#64748b';
    ctx.font = '800 11px "Space Grotesk", sans-serif';
    ctx.fillText('SIMULATION // COMMUNITY // PASSION', width - 60, 102);
    ctx.textAlign = 'left';

    // 6. Left Avatar Card (Frosted Glass Container)
    const cardX = 55;
    const cardY = 145;
    const cardW = 235;
    const cardH = 390;
    const cardR = 22;

    ctx.fillStyle = 'rgba(239, 246, 255, 0.82)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cardX, cardY, cardW, cardH, cardR) : ctx.rect(cardX, cardY, cardW, cardH);
    ctx.fill();
    ctx.strokeStyle = 'rgba(191, 219, 254, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Card Corner Microtext
    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 9px sans-serif';
    ctx.fillText('SIMULATION', cardX + 16, cardY + 24);
    ctx.fillText('UNITED', cardX + 16, cardY + 36);
    ctx.fillText('PEOPLE', cardX + 16, cardY + 48);

    ctx.textAlign = 'right';
    ctx.fillText('EST.', cardX + cardW - 16, cardY + 24);
    ctx.fillText('2023', cardX + cardW - 16, cardY + 36);
    ctx.textAlign = 'left';

    ctx.fillText('MORE', cardX + 16, cardY + cardH - 36);
    ctx.fillText('THAN', cardX + 16, cardY + cardH - 24);
    ctx.fillText('A GAME', cardX + 16, cardY + cardH - 12);

    // Dot matrix grid on bottom left
    ctx.fillStyle = '#cbd5e1';
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            ctx.beginPath();
            ctx.arc(cardX - 25 + c * 10, cardY + cardH - 40 + r * 10, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Center Avatar Sphere
    const avCX = cardX + cardW / 2;
    const avCY = cardY + cardH / 2;
    const avR = 70;

    // Glowing shadow
    const avGlow = ctx.createRadialGradient(avCX, avCY, avR * 0.8, avCX, avCY, avR * 1.3);
    avGlow.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
    avGlow.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = avGlow;
    ctx.beginPath();
    ctx.arc(avCX, avCY, avR * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Sphere Gradient
    const sphereGrad = ctx.createRadialGradient(avCX - 20, avCY - 20, 10, avCX, avCY, avR);
    sphereGrad.addColorStop(0, '#60a5fa');
    sphereGrad.addColorStop(0.5, '#2563eb');
    sphereGrad.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(avCX, avCY, avR, 0, Math.PI * 2);
    ctx.fill();

    // Driver Initial in Avatar
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 68px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((driverName || 'D')[0].toUpperCase(), avCX, avCY - 2);

    // Green Verified Checkmark Badge
    const badgeX = avCX + 48;
    const badgeY = avCY + 46;
    const badgeR = 18;

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px sans-serif';
    ctx.fillText('✓', badgeX, badgeY);

    // 7. Center Driver Credentials Column
    const colX = 335;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Label: OFFICIAL DRIVER OPERATOR
    ctx.fillStyle = '#64748b';
    ctx.font = '800 12px "Space Grotesk", sans-serif';
    ctx.fillText('OFFICIAL DRIVER OPERATOR', colX, 192);

    // Value: Driver Name
    ctx.fillStyle = '#090d16';
    ctx.font = '900 42px "Space Grotesk", sans-serif';
    ctx.fillText(driverName || 'admin', colX, 242);

    // Hairline Divider
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(colX, 282);
    ctx.lineTo(750, 282);
    ctx.stroke();

    // LICENSE ID NUMBER
    ctx.fillStyle = '#64748b';
    ctx.font = '800 12px "Space Grotesk", sans-serif';
    ctx.fillText('LICENSE ID NUMBER', colX, 318);

    ctx.fillStyle = '#2563eb';
    ctx.font = '900 28px monospace';
    ctx.fillText(driverId, colX, 356);

    // FLEET RANK
    const rankColX = 570;
    ctx.fillStyle = '#64748b';
    ctx.font = '800 12px "Space Grotesk", sans-serif';
    ctx.fillText('FLEET RANK', rankColX, 318);

    // Fleet Rank Mint Badge Pill
    const rankPillW = 185;
    const rankPillH = 38;
    ctx.fillStyle = '#dcfce7';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(rankColX, 328, rankPillW, rankPillH, 8) : ctx.rect(rankColX, 328, rankPillW, rankPillH);
    ctx.fill();
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#059669';
    ctx.font = '900 15px "Space Grotesk", sans-serif';
    ctx.fillText(`👑 ${rank.toUpperCase()}`, rankColX + 14, 352);

    // SIMULATION CLEARANCE
    ctx.fillStyle = '#64748b';
    ctx.font = '800 12px "Space Grotesk", sans-serif';
    ctx.fillText('SIMULATION CLEARANCE', colX, 416);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 20px "Space Grotesk", sans-serif';
    ctx.fillText('LIFETIME CLOUD ASSET HOLDER', colX, 452);

    // 8. Right Side Logo Watermark & Barcode
    // Watermark Logo
    if (enrouteLogoImg.complete && enrouteLogoImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.drawImage(enrouteLogoImg, 820, 160, 220, 160);
        ctx.restore();
    }

    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.font = '900 24px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ENROUTEIN', 940, 265);
    ctx.font = '800 13px "Space Grotesk", sans-serif';
    ctx.fillText('DRIVE BEYOND', 940, 285);
    ctx.textAlign = 'left';

    // Barcode at right
    const bcX = 770;
    const bcY = 385;
    ctx.fillStyle = '#0f172a';
    const barPattern = [4, 2, 6, 3, 5, 2, 4, 8, 3, 6, 2, 7, 4, 3, 6, 2, 5, 7, 3, 5, 4, 2, 6, 5, 8, 3, 2, 5, 4, 3, 6, 2, 7, 4, 2, 6, 3];
    let curX = bcX;
    for (let bw of barPattern) {
        ctx.fillRect(curX, bcY, bw, 68);
        curX += bw + 3;
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '800 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('E N R O U T E I N   -   V E R I F I E D', bcX + (curX - bcX) / 2, bcY + 86);
    ctx.textAlign = 'left';

    // 9. Bottom Footer Bar
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(55, 575);
    ctx.lineTo(width - 55, 575);
    ctx.stroke();

    // Globe icon
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(68, 614, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(57, 614);
    ctx.lineTo(79, 614);
    ctx.moveTo(68, 603);
    ctx.lineTo(68, 625);
    ctx.stroke();

    // Footer Text Left
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 12px "Space Grotesk", sans-serif';
    ctx.fillText('OFFICIAL MOTORSPORT SIMULATION PASSPORT', 88, 608);

    ctx.fillStyle = '#64748b';
    ctx.font = '800 11px "Space Grotesk", sans-serif';
    ctx.fillText('ENROUTEIN.STORE  •  BUSSID MODS  •  COMMUNITY DRIVEN', 88, 626);

    // Footer Text Right
    ctx.fillStyle = '#64748b';
    ctx.font = '800 11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('KEEP DRIVING FOR A BETTER VIRTUAL TOMORROW  →', width - 90, 616);
    ctx.textAlign = 'left';

    // Blue Geometric Corner Polygon (Bottom Right)
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(width - 70, height - 85);
    ctx.lineTo(width - 25, height - 85);
    ctx.lineTo(width - 2, height - 28);
    ctx.lineTo(width - 2, height - 2);
    ctx.lineTo(width - 55, height - 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.moveTo(width - 45, height - 45);
    ctx.lineTo(width - 2, height - 2);
    ctx.lineTo(width - 35, height - 2);
    ctx.closePath();
    ctx.fill();
};

// ----------------------------------------------------
// Share & View Modal Controller
// ----------------------------------------------------
const openShareModal = () => {
    const user = currentUser || auth.currentUser || {
        displayName: 'admin',
        email: 'admin@enroute.in',
        uid: 'U20XVC999'
    };
    const emailName = user.email ? user.email.split('@')[0] : 'Driver';
    const driverName = user.displayName || emailName || (nameDisplay ? nameDisplay.textContent : 'admin');
    const driverId = (driverIdCode && driverIdCode.textContent && driverIdCode.textContent !== '#DRV-8829')
        ? driverIdCode.textContent
        : `#DRV-${(user.uid || 'U20XVC').slice(0, 6).toUpperCase()}`;
    const rank = (rankTitle && rankTitle.textContent) ? rankTitle.textContent : 'Rookie Driver';

    // Draw to Canvas
    drawDriverLicenseCard(licenseCanvas, driverName, driverId, rank, user.email);

    // Prepare Promotional Text
    const origin = window.location.origin || 'https://enroutein.store';
    const promoMessage = `🔥 *Check out my Official EnrouteIn Driver License!* 🪪

👑 *Driver:* ${driverName}
🔰 *License ID:* ${driverId}
⚡ *Fleet Rank:* ${rank}

Looking for hyper-realistic, high-poly BUSSID sleeper buses, coach mods, custom sound physics & Indian terrain maps?
🚀 Get the best mods with instant cloud downloads at *EnrouteIn*:
👉 ${origin}/products.html`;

    // WhatsApp & Multi-Platform Image Share Action
    if (whatsappShareBtn) {
        whatsappShareBtn.onclick = async () => {
            if (!licenseCanvas) return;

            licenseCanvas.toBlob(async (blob) => {
                if (!blob) {
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(promoMessage)}`, '_blank');
                    return;
                }

                const file = new File([blob], `Enroute_VIP_License_${driverId.replace('#', '')}.png`, { type: 'image/png' });

                // Check if device supports direct image sharing to WhatsApp / Share Sheet
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            title: 'Official EnrouteIn Driver License',
                            text: promoMessage,
                            files: [file]
                        });
                        showToast("Shared license with image!");
                        return;
                    } catch (err) {
                        if (err.name === 'AbortError') return; // User cancelled
                        console.warn("Native share error, falling back to direct link:", err);
                    }
                }

                // Fallback for desktop / unsupported environments:
                // 1. Automatically download the high-res license card image
                const link = document.createElement('a');
                link.download = `Enroute_VIP_License_${driverId.replace('#', '')}.png`;
                link.href = licenseCanvas.toDataURL('image/png');
                link.click();

                // 2. Open WhatsApp with the pre-filled promotional marketing message
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(promoMessage)}`, '_blank');
                showToast("License image downloaded & WhatsApp opened! Attach the image to send.");
            }, 'image/png');
        };
    }

    // Copy Promo Message Listener
    if (copyShareMsgBtn) {
        copyShareMsgBtn.onclick = () => {
            navigator.clipboard.writeText(promoMessage).then(() => {
                showToast("Promo message & website link copied!");
            }).catch(() => {
                showToast("Message ready to share!");
            });
        };
    }

    // Download PNG Action
    if (downloadLicenseBtn) {
        downloadLicenseBtn.onclick = () => {
            if (licenseCanvas) {
                const link = document.createElement('a');
                link.download = `Enroute_VIP_License_${driverId.replace('#', '')}.png`;
                link.href = licenseCanvas.toDataURL('image/png');
                link.click();
                showToast("License image saved to device!");
            }
        };
    }

    if (shareModal) shareModal.classList.add('active');
};

const closeShareModal = () => {
    if (shareModal) shareModal.classList.remove('active');
};

// 1. View License Button
const topViewLicenseBtn = document.getElementById('top-view-license-btn');
if (topViewLicenseBtn) {
    topViewLicenseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openShareModal();
    });
}

// 2. Download ID Button
const topDownloadBtn = document.getElementById('top-download-btn');
if (topDownloadBtn) {
    topDownloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const user = currentUser || auth.currentUser || {
            displayName: 'admin',
            email: 'admin@enroute.in',
            uid: 'U20XVC999'
        };
        const emailName = user.email ? user.email.split('@')[0] : 'Driver';
        const driverName = user.displayName || emailName || (nameDisplay ? nameDisplay.textContent : 'admin');
        const driverId = (driverIdCode && driverIdCode.textContent && driverIdCode.textContent !== '#DRV-8829')
            ? driverIdCode.textContent
            : `#DRV-${(user.uid || 'U20XVC').slice(0, 6).toUpperCase()}`;
        const rank = (rankTitle && rankTitle.textContent) ? rankTitle.textContent : 'Rookie Driver';

        let canvas = licenseCanvas;
        if (!canvas) {
            canvas = document.createElement('canvas');
        }
        drawDriverLicenseCard(canvas, driverName, driverId, rank, user.email);
        const link = document.createElement('a');
        link.download = `Enroute_VIP_License_${driverId.replace('#', '')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast("VIP Driver License saved to device!");
    });
}

// 3. Share VIP License Button
if (openShareModalBtn) {
    openShareModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openShareModal();
    });
}

if (closeShareModalBtn) {
    closeShareModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeShareModal();
    });
}

if (shareModal) {
    shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) closeShareModal();
    });
}

const driverPassportCard = document.getElementById('driver-passport');
if (driverPassportCard) {
    driverPassportCard.addEventListener('click', (e) => {
        if (!e.target.closest('#copy-driver-id-btn') && !e.target.closest('#top-download-btn') && !e.target.closest('#top-view-license-btn') && !e.target.closest('#open-share-modal-btn')) {
            openShareModal();
        }
    });
}

// ----------------------------------------------------
// Core Data Loader
// ----------------------------------------------------
const loadDashboardData = async () => {
    contentArea.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem;">
            <div style="width: 44px; height: 44px; border: 3px solid var(--color-primary-light); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto var(--spacing-4);"></div>
            <p class="text-secondary" style="font-weight: 600;">Connecting to Fleet Database...</p>
        </div>
    `;

    try {
        // Fetch user orders
        const q = query(
            collection(db, "orders"),
            where("userId", "==", currentUser.uid)
        );
        const snapshot = await getDocs(q);
        cachedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort orders by date descending
        cachedOrders.sort((a, b) => {
            const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (new Date(a.createdAt || 0)).getTime();
            const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (new Date(b.createdAt || 0)).getTime();
            return dateB - dateA;
        });

        // Load owned products for Virtual Garage
        const productIds = [...new Set(cachedOrders.map(o => o.productId))];
        cachedGarageProducts = [];

        for (const pid of productIds) {
            try {
                const prodRef = doc(db, "products", pid);
                const prodSnap = await getDoc(prodRef);
                if (prodSnap.exists()) {
                    cachedGarageProducts.push({ id: prodSnap.id, ...prodSnap.data() });
                }
            } catch (err) {
                console.warn("Could not fetch product:", pid, err);
            }
        }

        // Update Driver Passport Badges & Rank
        updateDriverPassport();

        // Update Wishlist Counter
        updateWishlistCount();

        // Render current active tab
        renderCurrentTab();
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        contentArea.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 3rem 1rem;">
                <p class="text-danger" style="font-weight: 700;">Failed to load your garage data. Please refresh.</p>
                <button class="btn btn-outline mt-4" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
};

// ----------------------------------------------------
// Driver Passport & Rank Computation
// ----------------------------------------------------
const updateDriverPassport = () => {
    const modsCount = cachedGarageProducts.length;
    if (garageCounter) garageCounter.textContent = modsCount;

    // Compute rank
    let rank = 'Rookie Driver';
    let icon = '🔰';

    if (modsCount >= 5) {
        rank = 'Fleet Master';
        icon = '👑';
    } else if (modsCount >= 2) {
        rank = 'Highway Captain';
        icon = '🚍';
    }

    if (rankTitle) rankTitle.textContent = rank;
    if (driverRankBadge) {
        driverRankBadge.querySelector('span:first-child').textContent = icon;
    }

    if (driverIdCode && currentUser) {
        driverIdCode.textContent = `#DRV-${currentUser.uid.slice(0, 6).toUpperCase()}`;
    }

    const emailName = currentUser.email ? currentUser.email.split('@')[0] : 'Driver';
    if (nameDisplay) nameDisplay.textContent = currentUser.displayName || emailName;
    if (avatarInitial) avatarInitial.textContent = (currentUser.displayName || emailName)[0].toUpperCase();
};

const updateWishlistCount = () => {
    try {
        const saved = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
        if (wishlistCounter) wishlistCounter.textContent = saved.length;
    } catch(e) {
        if (wishlistCounter) wishlistCounter.textContent = '0';
    }
};

// ----------------------------------------------------
// Tab Router
// ----------------------------------------------------
const renderCurrentTab = () => {
    switch (currentTab) {
        case 'garage':
            renderGarageTab();
            break;
        case 'wishlist':
            renderWishlistTab();
            break;
        case 'requests':
            renderVotingHubTab();
            break;
        case 'orders':
            renderOrdersTab();
            break;
    }
};

// ----------------------------------------------------
// TAB 1: My Virtual Garage
// ----------------------------------------------------
const renderGarageTab = () => {
    if (cachedGarageProducts.length === 0) {
        contentArea.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-6);">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--text-primary);">My Virtual Garage</h2>
                    <p class="text-secondary" style="font-size: 0.875rem; margin: 2px 0 0 0;">Your personal collection of unlocked BUSSID vehicle mods.</p>
                </div>
            </div>

            <div class="empty-state" style="background: var(--bg-primary); border-radius: var(--radius-xl); border: 1px dashed var(--color-border); padding: 3.5rem 2rem; text-align: center;">
                <div style="width: 60px; height: 60px; border-radius: var(--radius-full); background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin: 0 auto var(--spacing-4);">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>
                </div>
                <h4 style="margin-bottom: 0.5rem; font-size: 1.25rem;">Garage is Empty</h4>
                <p class="text-secondary" style="font-size: 0.95rem; margin-bottom: 1.75rem; max-width: 420px; margin-left: auto; margin-right: auto;">
                    You haven't purchased or unlocked any mods yet. Explore our high-poly fleet collection and get your first bus!
                </p>
                <a href="products.html" class="btn btn-primary btn-lg">Explore Store Catalog</a>
            </div>
        `;
        return;
    }

    // Compute approximate storage radar
    let totalSizeMB = 0;
    cachedGarageProducts.forEach(p => {
        if (p.size) {
            const num = parseFloat(p.size);
            if (!isNaN(num)) totalSizeMB += num;
        } else {
            totalSizeMB += 45; // default avg size
        }
    });

    let garageCardsHtml = '';
    cachedGarageProducts.forEach(p => {
        const primaryImg = (p.images && p.images.length > 0) ? p.images[0] : p.image;
        garageCardsHtml += `
            <div class="garage-card">
                <div class="garage-media">
                    <img src="${getImageUrl(primaryImg)}" alt="${p.name}" loading="lazy">
                    <span style="position: absolute; top: 10px; left: 10px; background: rgba(9, 13, 22, 0.75); backdrop-filter: blur(4px); color: #fff; font-size: 0.7rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
                        ${p.category || 'MOD'}
                    </span>
                </div>
                <div class="garage-body">
                    <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem; font-family: var(--font-heading); color: var(--text-primary); line-height: 1.35;">${p.name}</h3>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Compatible: <strong>${p.version || 'BUSSID Universal'}</strong></div>
                    
                    <div class="garage-meta-specs">
                        <div>📦 Size: <strong>${p.size || '45 MB'}</strong></div>
                        <div>⚡ Power: <strong>${p.engine || 'High Power'}</strong></div>
                        <div>📐 Polys: <strong>${p.polygons || 'High-Poly'}</strong></div>
                        <div>💺 Interior: <strong>${p.interior ? 'Yes' : 'Basic'}</strong></div>
                    </div>

                    <div style="display: flex; gap: var(--spacing-3); margin-top: auto;">
                        <a href="${p.downloadLink || '#'}" target="_blank" class="btn btn-primary btn-sm" style="flex: 1; justify-content: center;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            <span>Download Mod</span>
                        </a>
                        <a href="product.html?id=${p.id}" class="btn btn-outline btn-sm" title="View Specs">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        </a>
                    </div>
                </div>
            </div>
        `;
    });

    contentArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-6); flex-wrap: wrap; gap: var(--spacing-4);">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--text-primary);">My Virtual Garage</h2>
                <p class="text-secondary" style="font-size: 0.875rem; margin: 2px 0 0 0;">Manage and re-download your unlocked simulation vehicles.</p>
            </div>
            <a href="products.html" class="btn btn-primary btn-sm">+ Add New Mods</a>
        </div>

        <!-- Fleet Storage Radar -->
        <div class="fleet-radar-bar">
            <div class="radar-stat-item">
                <div class="radar-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>
                </div>
                <div>
                    <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Active Fleet</div>
                    <div style="font-size: 1.05rem; font-weight: 800; font-family: var(--font-heading); color: var(--text-primary);">${cachedGarageProducts.length} Vehicles</div>
                </div>
            </div>

            <div class="radar-stat-item">
                <div class="radar-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </div>
                <div>
                    <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Storage Radar</div>
                    <div style="font-size: 1.05rem; font-weight: 800; font-family: var(--font-heading); color: var(--color-primary);">~${Math.round(totalSizeMB)} MB Total</div>
                </div>
            </div>

            <div class="radar-stat-item">
                <div class="radar-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <div>
                    <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Cloud Access</div>
                    <div style="font-size: 1.05rem; font-weight: 800; font-family: var(--font-heading); color: var(--color-success);">Lifetime Unlimited</div>
                </div>
            </div>
        </div>

        <div class="garage-grid">
            ${garageCardsHtml}
        </div>
    `;
};

// ----------------------------------------------------
// TAB 2: Garage Wishlist
// ----------------------------------------------------
const renderWishlistTab = async () => {
    let savedIds = [];
    try {
        savedIds = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
    } catch (e) {
        savedIds = [];
    }

    if (savedIds.length === 0) {
        contentArea.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-6);">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--text-primary);">Garage Wishlist</h2>
                    <p class="text-secondary" style="font-size: 0.875rem; margin: 2px 0 0 0;">Mods you have bookmarked for future purchases.</p>
                </div>
            </div>

            <div class="empty-state" style="background: var(--bg-primary); border-radius: var(--radius-xl); border: 1px dashed var(--color-border); padding: 3.5rem 2rem; text-align: center;">
                <div style="width: 60px; height: 60px; border-radius: var(--radius-full); background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin: 0 auto var(--spacing-4);">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </div>
                <h4 style="margin-bottom: 0.5rem; font-size: 1.25rem;">Wishlist is Empty</h4>
                <p class="text-secondary" style="font-size: 0.95rem; margin-bottom: 1.75rem;">Browse through the catalog and click the Bookmark/Heart icon on mods to save them here.</p>
                <a href="products.html" class="btn btn-primary">Browse Mods Catalog</a>
            </div>
        `;
        return;
    }

    contentArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-6);">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--text-primary);">Garage Wishlist</h2>
                <p class="text-secondary" style="font-size: 0.875rem; margin: 2px 0 0 0;">${savedIds.length} Saved Mods</p>
            </div>
            <button class="btn btn-outline btn-sm" id="clear-wishlist-btn">Clear All</button>
        </div>
        <div id="wishlist-items-container">
            <div style="text-align: center; padding: 2rem;">Loading wishlist items...</div>
        </div>
    `;

    document.getElementById('clear-wishlist-btn')?.addEventListener('click', () => {
        if (confirm("Clear all items from your wishlist?")) {
            localStorage.removeItem('enroute_wishlist');
            updateWishlistCount();
            renderWishlistTab();
        }
    });

    const itemsContainer = document.getElementById('wishlist-items-container');
    let itemsHtml = '';

    for (const id of savedIds) {
        try {
            const pRef = doc(db, "products", id);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
                const p = pSnap.data();
                const pImg = (p.images && p.images.length > 0) ? p.images[0] : p.image;
                const isFree = (p.price === 0 || p.pricingType === 'free');

                itemsHtml += `
                    <div class="wishlist-card">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <img src="${getImageUrl(pImg)}" alt="${p.name}" style="width: 72px; height: 52px; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                            <div>
                                <h4 style="font-size: 1.05rem; font-weight: 700; margin: 0 0 3px 0; color: var(--text-primary);">${p.name}</h4>
                                <span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">${p.category || 'Mod'}</span>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 1.25rem;">
                            <span style="font-size: 1.35rem; font-weight: 800; font-family: var(--font-heading); color: var(--color-primary);">${isFree ? 'FREE' : formatPrice(p.price)}</span>
                            <a href="product.html?id=${pSnap.id}" class="btn btn-primary btn-sm">Get Mod</a>
                            <button class="btn btn-outline btn-sm remove-wishlist-btn" data-id="${pSnap.id}" title="Remove">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>
                `;
            }
        } catch(e) {
            console.warn("Could not load wishlist mod:", id, e);
        }
    }

    if (itemsHtml) {
        itemsContainer.innerHTML = itemsHtml;
        document.querySelectorAll('.remove-wishlist-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const removeId = btn.getAttribute('data-id');
                let currentSaved = JSON.parse(localStorage.getItem('enroute_wishlist') || '[]');
                currentSaved = currentSaved.filter(x => x !== removeId);
                localStorage.setItem('enroute_wishlist', JSON.stringify(currentSaved));
                updateWishlistCount();
                renderWishlistTab();
            });
        });
    } else {
        itemsContainer.innerHTML = `<p class="text-secondary text-center">Items no longer available.</p>`;
    }
};

// ----------------------------------------------------
// TAB 3: Mod Request & Community Voting Hub
// ----------------------------------------------------
const renderVotingHubTab = async () => {
    contentArea.innerHTML = `
        <div style="margin-bottom: var(--spacing-6);">
            <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--text-primary);">Community Mod Request & Voting Hub</h2>
            <p class="text-secondary" style="font-size: 0.875rem; margin: 2px 0 0 0;">Suggest upcoming buses, chassis, liveries, or routes and upvote community ideas!</p>
        </div>

        <!-- Submit Request Card -->
        <div class="request-input-card">
            <h4 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 0.5rem; color: var(--text-primary); font-family: var(--font-heading);">Submit a Vehicle / Mod Suggestion</h4>
            <p class="text-secondary" style="font-size: 0.85rem; margin-bottom: 1.25rem;">Our 3D modding team reviews the top-voted ideas for official development.</p>
            
            <form id="mod-request-form" style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--spacing-4);">
                <div class="form-group" style="margin-bottom: 0;">
                    <input type="text" id="req-title" class="form-control" placeholder="e.g., KSRTC Airavat Club Class Multi-Axle Volvo" required>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <select id="req-category" class="form-control" required>
                        <option value="Sleeper Coach Bus">Sleeper Coach Bus</option>
                        <option value="Intercity Express Bus">Intercity Express Bus</option>
                        <option value="Heavy Cargo Truck">Heavy Cargo Truck</option>
                        <option value="Custom Livery Skin">Custom Livery Skin</option>
                        <option value="Indian Highway Map Route">Indian Highway Map Route</option>
                    </select>
                </div>
                <div style="grid-column: 1/-1; display: flex; justify-content: flex-end;">
                    <button type="submit" class="btn btn-primary" id="req-submit-btn" style="padding: 0.65rem 1.5rem;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        <span>Submit Proposal</span>
                    </button>
                </div>
            </form>
        </div>

        <!-- Community Voting Feed -->
        <div style="margin-bottom: var(--spacing-4); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-heading);">Trending Community Proposals</h3>
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--color-primary); background: var(--color-primary-light); padding: 4px 10px; border-radius: var(--radius-full);">🔥 Live Voting</span>
        </div>

        <div id="requests-feed-container">
            <div style="text-align: center; padding: 2rem;">Loading community requests...</div>
        </div>
    `;

    // Handle Form Submit
    const reqForm = document.getElementById('mod-request-form');
    reqForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('req-title');
        const catInput = document.getElementById('req-category');
        const submitBtn = document.getElementById('req-submit-btn');

        const title = titleInput.value.trim();
        const category = catInput.value;
        if (!title) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        try {
            await addDoc(collection(db, "mod_requests"), {
                title,
                category,
                authorEmail: currentUser.email,
                authorName: currentUser.displayName || currentUser.email.split('@')[0],
                votes: 1,
                voters: [currentUser.uid],
                status: 'community', // 'community' | 'in_development' | 'released'
                createdAt: serverTimestamp()
            });

            titleInput.value = '';
            showToast("Your mod proposal has been submitted!");
            loadRequestsFeed();
        } catch(err) {
            console.warn("Could not save to Firestore collection, fallback local:", err);
            showToast("Proposal received!");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>Submit Proposal</span>
            `;
        }
    });

    loadRequestsFeed();
};

const loadRequestsFeed = async () => {
    const feedContainer = document.getElementById('requests-feed-container');
    if (!feedContainer) return;

    let requests = [];

    // Pre-seed default community ideas so board is instantly lively
    const defaultRequests = [
        { id: 'def-1', title: 'KSRTC Airavat Diamond Class B11R Multi-Axle', category: 'Intercity Express Bus', votes: 84, status: 'in_development', authorName: 'Arjun Nair' },
        { id: 'def-2', title: 'BharatBenz 1624 AC Sleeper 2026 Custom LED Edition', category: 'Sleeper Coach Bus', votes: 67, status: 'community', authorName: 'Rohan Sharma' },
        { id: 'def-3', title: 'Western Ghats Mumbai-Goa 4-Lane Expressway Route Map', category: 'Indian Highway Map Route', votes: 52, status: 'community', authorName: 'Vikram Joshi' },
        { id: 'def-4', title: 'Volvo 9600 Luxury Sleeper 15-Meter Chassis', category: 'Sleeper Coach Bus', votes: 39, status: 'community', authorName: 'Dev Patel' }
    ];

    try {
        const q = query(collection(db, "mod_requests"));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const dbReqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            requests = [...dbReqs, ...defaultRequests];
        } else {
            requests = defaultRequests;
        }
    } catch(e) {
        requests = defaultRequests;
    }

    // Sort by highest votes
    requests.sort((a, b) => (b.votes || 0) - (a.votes || 0));

    let feedHtml = '';
    requests.forEach(req => {
        const isVoted = req.voters && currentUser && req.voters.includes(currentUser.uid);
        let statusBadge = '<span style="font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); background: var(--bg-secondary); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--color-border);">💡 Community Idea</span>';
        
        if (req.status === 'in_development') {
            statusBadge = '<span style="font-size: 0.72rem; font-weight: 700; color: #d97706; background: rgba(245, 158, 11, 0.1); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(245, 158, 11, 0.3);">⚡ In 3D Modeling</span>';
        } else if (req.status === 'released') {
            statusBadge = '<span style="font-size: 0.72rem; font-weight: 700; color: #059669; background: rgba(16, 185, 129, 0.1); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">✅ Completed</span>';
        }

        feedHtml += `
            <div class="vote-item-card">
                <div style="display: flex; align-items: center; gap: 1.25rem;">
                    <button class="upvote-btn ${isVoted ? 'voted' : ''}" data-id="${req.id}" data-votes="${req.votes || 1}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        <span class="vote-count">${req.votes || 1}</span>
                    </button>
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
                            <span class="category-pill" style="font-size: 0.68rem; margin-bottom: 0;">${req.category || 'Vehicle'}</span>
                            ${statusBadge}
                        </div>
                        <h4 style="font-size: 1.05rem; font-weight: 700; margin: 0 0 4px 0; color: var(--text-primary);">${req.title}</h4>
                        <div style="font-size: 0.78rem; color: var(--text-secondary);">Proposed by: <strong>${req.authorName || 'Driver'}</strong></div>
                    </div>
                </div>
            </div>
        `;
    });

    feedContainer.innerHTML = feedHtml;

    // Attach upvote listeners
    document.querySelectorAll('.upvote-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const reqId = btn.getAttribute('data-id');
            const countEl = btn.querySelector('.vote-count');
            let currentVotes = parseInt(countEl.textContent) || 0;

            if (btn.classList.contains('voted')) {
                btn.classList.remove('voted');
                countEl.textContent = currentVotes - 1;
            } else {
                btn.classList.add('voted');
                countEl.textContent = currentVotes + 1;
                showToast("Upvoted!");
                try {
                    if (!reqId.startsWith('def-')) {
                        await updateDoc(doc(db, "mod_requests", reqId), {
                            votes: increment(1)
                        });
                    }
                } catch(e) {}
            }
        });
    });
};

// ----------------------------------------------------
// TAB 4: Order Invoices
// ----------------------------------------------------
const renderOrdersTab = () => {
    if (cachedOrders.length === 0) {
        contentArea.innerHTML = `
            <div style="margin-bottom: var(--spacing-6);">
                <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--text-primary);">Order Invoices & Receipts</h2>
                <p class="text-secondary" style="font-size: 0.875rem; margin: 2px 0 0 0;">View transaction history and download tax invoices.</p>
            </div>
            <div class="empty-state" style="background: var(--bg-primary); border-radius: var(--radius-xl); border: 1px dashed var(--color-border); padding: 3rem 1rem; text-align: center;">
                <p class="text-secondary">No purchase orders found.</p>
            </div>
        `;
        return;
    }

    let ordersHtml = '';
    cachedOrders.forEach((order, index) => {
        ordersHtml += `
            <div class="order-card" style="display: flex; justify-content: space-between; align-items: center; padding: 1.15rem 1.35rem; background: var(--bg-primary); border: 1px solid var(--color-border); border-radius: var(--radius-xl); margin-bottom: 0.75rem;">
                <div>
                    <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 2px;">Order #${order.id.slice(0, 8).toUpperCase()}</div>
                    <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 0 0 4px 0;">${order.productName || 'BUSSID Mod'}</h4>
                    <p class="text-secondary" style="font-size: 0.825rem; margin: 0;">Date: ${formatDate(order.createdAt)} • Method: Razorpay</p>
                </div>
                <div style="display: flex; align-items: center; gap: 1.25rem;">
                    <div style="text-align: right;">
                        <div style="font-size: 1.25rem; font-weight: 800; font-family: var(--font-heading); color: var(--color-primary);">${formatPrice(order.amount)}</div>
                        <span style="font-size: 0.72rem; font-weight: 800; padding: 2px 8px; background: rgba(16, 185, 129, 0.1); color: #059669; border-radius: var(--radius-full); border: 1px solid rgba(16, 185, 129, 0.25);">PAID</span>
                    </div>
                    <button class="btn btn-outline btn-sm invoice-btn" data-order-index="${index}">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <span>Print Invoice</span>
                    </button>
                </div>
            </div>
        `;
    });

    contentArea.innerHTML = `
        <div style="margin-bottom: var(--spacing-6);">
            <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--text-primary);">Order Invoices & Receipts</h2>
            <p class="text-secondary" style="font-size: 0.875rem; margin: 2px 0 0 0;">Official commercial receipts verified with Razorpay payment tokens.</p>
        </div>
        <div>
            ${ordersHtml}
        </div>
    `;

    document.querySelectorAll('.invoice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-order-index'));
            showInvoice(cachedOrders[idx]);
        });
    });
};

const showInvoice = (order) => {
    const invoiceNum = 'ENR-' + order.id.substring(0, 8).toUpperCase();
    const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || Date.now());
    const formattedDate = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const formattedTime = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    invoiceContent.innerHTML = `
        <div class="invoice-header">
            <div class="invoice-brand">
                <h2>EnrouteIn<span>.Store</span></h2>
                <p style="font-size: 0.85rem; opacity: 0.8; margin-top: 0.25rem;">Official Digital Mod Marketplace</p>
            </div>
            <div style="text-align: right;">
                <div class="invoice-badge">Payment Verified</div>
                <p style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem; font-family: monospace;">${invoiceNum}</p>
            </div>
        </div>
        <div class="invoice-body">
            <div class="invoice-meta">
                <div class="invoice-meta-group">
                    <h4>Invoice Date</h4>
                    <p>${formattedDate}</p>
                    <p style="font-size: 0.8rem; color: #9ca3af;">${formattedTime}</p>
                </div>
                <div class="invoice-meta-group">
                    <h4>Billed To</h4>
                    <p>${order.customerName || currentUser.displayName || 'Driver'}</p>
                    <p style="font-size: 0.8rem; color: #9ca3af;">${order.email || currentUser.email}</p>
                </div>
                <div class="invoice-meta-group">
                    <h4>Razorpay Payment ID</h4>
                    <p style="font-family: monospace; font-size: 0.85rem; color: var(--color-primary);">${order.paymentId || 'pay_online_token'}</p>
                </div>
                <div class="invoice-meta-group">
                    <h4>License Status</h4>
                    <p>Lifetime Commercial Mod License</p>
                </div>
            </div>
            <table class="invoice-table">
                <thead>
                    <tr><th>Item Description</th><th>Category</th><th>Qty</th><th>Amount</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>${order.productName || 'BUSSID Mod'}</strong><br><span style="font-size: 0.8rem; color: #9ca3af;">Digital Download Archive (.bussidmod)</span></td>
                        <td style="text-transform: capitalize;">BUSSID Mod</td>
                        <td>1</td>
                        <td>${formatPrice(order.amount)}</td>
                    </tr>
                </tbody>
            </table>
            <div class="invoice-totals">
                <div class="invoice-total-row">
                    <span style="color: #9ca3af;">Subtotal</span>
                    <span>${formatPrice(order.amount)}</span>
                </div>
                <div class="invoice-total-row">
                    <span style="color: #9ca3af;">Goods & Service Tax</span>
                    <span>₹0.00</span>
                </div>
                <div class="invoice-total-row grand">
                    <span>Total Paid</span>
                    <span style="color: var(--color-primary);">${formatPrice(order.amount)}</span>
                </div>
            </div>
        </div>
        <div class="invoice-footer">
            <p>Thank you for supporting simulation mod creators! This is a verified electronic digital invoice.</p>
            <p style="margin-top: 0.5rem;">Need support? Reach our driver helpdesk at <strong>enroutestorein@gmail.com</strong></p>
        </div>
        <div class="invoice-actions">
            <button class="btn btn-primary" id="print-invoice-btn" style="padding: 0.65rem 1.5rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                <span>Print / Save as PDF</span>
            </button>
            <button class="btn btn-outline" id="close-invoice-btn" style="padding: 0.65rem 1.5rem;">Close</button>
        </div>
    `;

    invoiceWrapper.classList.add('active');

    document.getElementById('print-invoice-btn').addEventListener('click', () => window.print());
    document.getElementById('close-invoice-btn').addEventListener('click', () => invoiceWrapper.classList.remove('active'));
    invoiceWrapper.addEventListener('click', (e) => {
        if (e.target === invoiceWrapper) invoiceWrapper.classList.remove('active');
    });
};

// ----------------------------------------------------
// Tab Navigation Events
// ----------------------------------------------------
const activateTab = (tabName, activeEl) => {
    currentTab = tabName;
    [tabGarage, tabWishlist, tabRequests, tabOrders].forEach(t => t?.classList.remove('active'));
    activeEl?.classList.add('active');
    renderCurrentTab();
};

tabGarage?.addEventListener('click', (e) => { e.preventDefault(); activateTab('garage', tabGarage); });
tabWishlist?.addEventListener('click', (e) => { e.preventDefault(); activateTab('wishlist', tabWishlist); });
tabRequests?.addEventListener('click', (e) => { e.preventDefault(); activateTab('requests', tabRequests); });
tabOrders?.addEventListener('click', (e) => { e.preventDefault(); activateTab('orders', tabOrders); });

logoutBtn?.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    });
});

// ----------------------------------------------------
// Auth State Observer
// ----------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (emailDisplay) emailDisplay.textContent = user.email;

        // Check if Admin
        const role = localStorage.getItem('userRole');
        if (role === 'admin') {
            if (adminLinkContainer) adminLinkContainer.style.display = 'block';
        } else {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                if (adminLinkContainer) adminLinkContainer.style.display = 'block';
                localStorage.setItem('userRole', 'admin');
            }
        }

        loadDashboardData();
    } else {
        window.location.href = 'login.html';
    }
});
