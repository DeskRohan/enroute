import { auth, db } from '../firebase-config.js';
import { signOut, onAuthStateChanged, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const nameInput = document.getElementById('admin-name');
const emailInput = document.getElementById('admin-email');
const accountForm = document.getElementById('account-form');
const logoutBtn = document.getElementById('account-logout-btn');
const deleteBtn = document.getElementById('delete-account-btn');

// Hero elements
const heroName = document.getElementById('admin-hero-name');
const heroEmail = document.getElementById('admin-hero-email');
const heroInitial = document.getElementById('admin-avatar-initial');
const badgePill = document.getElementById('admin-badge-pill');
const badgeNameEl = document.getElementById('admin-badge-name');
const idCodeEl = document.getElementById('admin-id-code');
const modsCountEl = document.getElementById('admin-mods-count');

// Modal & Buttons
const viewLicenseBtn = document.getElementById('admin-view-license-btn');
const downloadBtn = document.getElementById('admin-download-btn');
const shareModalBtn = document.getElementById('admin-share-modal-btn');
const licenseModal = document.getElementById('admin-license-modal');
const closeModalBtn = document.getElementById('close-admin-modal-btn');
const modalDownloadBtn = document.getElementById('admin-modal-download-btn');
const whatsappBtn = document.getElementById('admin-whatsapp-btn');
const copyTextBtn = document.getElementById('admin-copy-text-btn');
const licenseCanvas = document.getElementById('admin-license-canvas');
const toastEl = document.getElementById('dash-toast');
const toastMsg = document.getElementById('toast-msg');

let currentUser = null;
let currentAdminEmail = null;
let currentAdminName = 'ADMIN';
let currentBadge = { name: '01 — Tvarit', icon: '🏎️', className: 'admin-badge-tvarit', color: '#0284c7' };
let currentModsCount = 0;
let currentAdminId = 'ADM-0001';

// Badge Calculation
export const computeAdminBadge = (count, email = '') => {
    if (email === 'admin@enroute.in' || count >= 15) {
        return { 
            level: 5, 
            name: '05 — Vajrāstra', 
            icon: '⚡', 
            className: 'admin-badge-vajrastra', 
            color: '#854d0e',
            accessLevel: 'Level 5 (Root Authority)'
        };
    }
    if (count >= 10) {
        return { 
            level: 4, 
            name: '04 — Vyomrath', 
            icon: '🚀', 
            className: 'admin-badge-vyomrath', 
            color: '#9333ea',
            accessLevel: 'Level 4 (Senior Architect)'
        };
    }
    if (count >= 5) {
        return { 
            level: 3, 
            name: '03 — Vajragati', 
            icon: '⚔️', 
            className: 'admin-badge-vajragati', 
            color: '#b45309',
            accessLevel: 'Level 3 (Lead Creator)'
        };
    }
    if (count >= 3) {
        return { 
            level: 2, 
            name: '02 — Agniyān', 
            icon: '🔥', 
            className: 'admin-badge-agniyan', 
            color: '#ea580c',
            accessLevel: 'Level 2 (Active Creator)'
        };
    }
    return { 
        level: 1, 
        name: '01 — Tvarit', 
        icon: '🏎️', 
        className: 'admin-badge-tvarit', 
        color: '#0284c7',
        accessLevel: 'Level 1 (Junior Admin)'
    };
};

// Toast notification helper
function showToast(msg) {
    if (!toastEl) return;
    toastMsg.textContent = msg;
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translateY(0)';
    setTimeout(() => {
        toastEl.style.opacity = '0';
        toastEl.style.transform = 'translateY(20px)';
    }, 3200);
}

// Generate deterministic Admin ID from UID
function getAdminCode(uid) {
    if (!uid) return 'ADM-0001';
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = (hash << 5) - hash + uid.charCodeAt(i);
        hash |= 0;
    }
    const num = String(Math.abs(hash % 9000) + 1).padStart(4, '0');
    return `ADM-${num}`;
}

// Format Issue Date
function getFormattedIssueDate() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
}

// Draw Master Admin Identification Card inspired by the official reference design
function drawAdminLicenseCard() {
    if (!licenseCanvas) return;
    const ctx = licenseCanvas.getContext('2d');
    const w = licenseCanvas.width;
    const h = licenseCanvas.height;

    // 1. Clean Crisp Light Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    // Subtle gradient mesh on background
    const bgMesh = ctx.createLinearGradient(0, 0, w, h);
    bgMesh.addColorStop(0, '#ffffff');
    bgMesh.addColorStop(0.4, '#f8fafc');
    bgMesh.addColorStop(0.85, '#f1f5f9');
    bgMesh.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = bgMesh;
    ctx.fillRect(0, 0, w, h);

    // 2. Perforated Dot Matrix Pattern (Top & Bottom)
    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
    for (let x = 60; x < w - 80; x += 18) {
        for (let y = 14; y <= 32; y += 9) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        for (let y = h - 32; y <= h - 14; y += 9) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 3. Card Outer Border (Rounded Rectangle)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(24, 24, w - 48, h - 48, 28);
    ctx.stroke();

    // 4. Right Side Diagonal Background Highlights & Watermarks
    // Subtle angular speed polygon
    ctx.fillStyle = 'rgba(238, 242, 255, 0.65)';
    ctx.beginPath();
    ctx.moveTo(w * 0.52, 24);
    ctx.lineTo(w - 120, 24);
    ctx.lineTo(w - 120, h - 90);
    ctx.lineTo(w * 0.42, h - 90);
    ctx.closePath();
    ctx.fill();

    // Watermark Text: "MORE THAN A GAME"
    ctx.save();
    ctx.font = '900 68px "Space Grotesk", sans-serif';
    ctx.fillStyle = 'rgba(203, 213, 225, 0.32)';
    ctx.textAlign = 'right';
    ctx.fillText('MORE', w - 160, 290);
    ctx.fillText('THAN', w - 160, 355);
    ctx.fillText('A GAME', w - 160, 420);
    ctx.restore();

    // 5. Right Dark Vertical Access Spine
    const spineX = w - 96;
    const spineY = 48;
    const spineW = 60;
    const spineH = h - 96;

    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(spineX, spineY, spineW, spineH, 26);
    ctx.fill();

    // Red vertical accent tick at top of spine
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(spineX + spineW / 2 - 1, spineY + 120, 2, 48);

    // Globe icon in spine
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.8;
    const globeCenterX = spineX + spineW / 2;
    const globeCenterY = spineY + 45;
    ctx.beginPath();
    ctx.arc(globeCenterX, globeCenterY, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(globeCenterX, globeCenterY, 6, 13, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(globeCenterX - 13, globeCenterY);
    ctx.lineTo(globeCenterX + 13, globeCenterY);
    ctx.stroke();

    // Vertical Rotated Text in Spine: "ADMIN ACCESS"
    ctx.save();
    ctx.translate(globeCenterX, spineY + 360);
    ctx.rotate(Math.PI / 2);
    ctx.font = '700 13px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.letterSpacing = '5px';
    ctx.textAlign = 'center';
    ctx.fillText('A D M I N   A C C E S S', 0, 4);
    ctx.restore();

    // 6. Left Avatar Photo Slab (Futuristic Metallic Red-Glow Slab)
    const slabX = 65;
    const slabY = 155;
    const slabW = 270;
    const slabH = 490;

    // Red Neon Glow behind slab
    ctx.shadowColor = 'rgba(239, 68, 68, 0.45)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(slabX, slabY, slabW, slabH, 24);
    ctx.fill();
    ctx.shadowBlur = 0; // Reset shadow

    // Red neon edge accent curve on bottom right of slab
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(slabX, slabY, slabW, slabH, 24);
    ctx.stroke();

    // Inner dark container
    const slabInnerGrad = ctx.createLinearGradient(slabX, slabY, slabX, slabY + slabH);
    slabInnerGrad.addColorStop(0, '#090d16');
    slabInnerGrad.addColorStop(0.6, '#0f172a');
    slabInnerGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = slabInnerGrad;
    ctx.beginPath();
    ctx.roundRect(slabX + 2, slabY + 2, slabW - 4, slabH - 4, 22);
    ctx.fill();

    // Slab Top-Left Vertical Text: "PEOPLE ROADS STORIES FOREVER"
    ctx.save();
    ctx.font = '700 8.5px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('PEOPLE', slabX + 22, slabY + 32);
    ctx.fillText('ROADS', slabX + 22, slabY + 46);
    ctx.fillText('STORIES', slabX + 22, slabY + 60);
    ctx.fillText('FOREVER', slabX + 22, slabY + 74);
    ctx.restore();

    // Mountain silhouettes in background of photo slab
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(slabX + 2, slabY + 380);
    ctx.lineTo(slabX + 80, slabY + 300);
    ctx.lineTo(slabX + 140, slabY + 340);
    ctx.lineTo(slabX + 210, slabY + 280);
    ctx.lineTo(slabX + slabW - 2, slabY + 360);
    ctx.lineTo(slabX + slabW - 2, slabY + slabH - 2);
    ctx.lineTo(slabX + 2, slabY + slabH - 2);
    ctx.closePath();
    ctx.fill();

    // Stylized Metallic Cut-out Initial (e.g. "A") in Center of Slab
    const initialChar = (currentAdminName || 'A').trim().charAt(0).toUpperCase();
    const initialCenterX = slabX + slabW / 2;
    const initialCenterY = slabY + 265;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 135px "Space Grotesk", sans-serif';
    const initGrad = ctx.createLinearGradient(initialCenterX - 50, initialCenterY - 100, initialCenterX + 50, initialCenterY + 40);
    initGrad.addColorStop(0, '#ffffff');
    initGrad.addColorStop(0.5, '#cbd5e1');
    initGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = initGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 12;
    ctx.fillText(initialChar, initialCenterX, initialCenterY);
    ctx.restore();

    // Slab Bottom Text: "ENROUTEIN"
    ctx.font = '800 10px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.letterSpacing = '3px';
    ctx.fillText('ENROUTEIN', slabX + 22, slabY + slabH - 24);

    // 7. Top Header Section
    // Enroute Logo + Branding
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = '../assets/images/fevicon.png';
    logoImg.onload = () => {
        ctx.drawImage(logoImg, 65, 55, 62, 62);
        renderHeaderAndDetails();
    };
    logoImg.onerror = () => {
        renderHeaderAndDetails();
    };

    function renderHeaderAndDetails() {
        // Logo Text
        ctx.fillStyle = '#090d16';
        ctx.font = '900 30px "Space Grotesk", sans-serif';
        ctx.fillText('ENROUTEIN', 140, 80);

        ctx.font = '800 13px "Space Grotesk", sans-serif';
        ctx.letterSpacing = '2px';
        ctx.fillText('MOTORSPORT AUTHORITY', 140, 100);

        ctx.fillStyle = '#64748b';
        ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
        ctx.letterSpacing = '1px';
        ctx.fillText('DRIVE VIRTUALLY   •   STAY LEGENDARY', 140, 120);

        // Top Right Text: COMMUNITY / SIMULATION / CREATORS / DRIVERS / BEYOND
        ctx.fillStyle = '#64748b';
        ctx.font = '700 9.5px "Space Grotesk", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('COMMUNITY', w - 180, 68);
        ctx.fillText('SIMULATION', w - 180, 80);
        ctx.fillText('CREATORS', w - 180, 92);
        ctx.fillText('DRIVERS', w - 180, 104);
        ctx.fillText('BEYOND', w - 180, 116);
        ctx.textAlign = 'left';

        // Horizontal line under top-right text
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w - 285, 125);
        ctx.lineTo(w - 180, 125);
        ctx.stroke();

        // 8. Main Center Block
        const mainX = 370;

        // Subtitle: "// OFFICIAL ADMINISTRATOR"
        ctx.fillStyle = '#ef4444';
        ctx.font = '900 16px "Space Grotesk", sans-serif';
        ctx.fillText('//', mainX, 190);

        ctx.fillStyle = '#090d16';
        ctx.font = '800 13px "Space Grotesk", sans-serif';
        ctx.letterSpacing = '2px';
        ctx.fillText(' OFFICIAL ADMINISTRATOR', mainX + 22, 190);

        // Big Administrator Name
        ctx.fillStyle = '#090d16';
        ctx.font = '900 52px "Space Grotesk", sans-serif';
        const displayAdminName = (currentAdminName || 'ADMIN').toUpperCase();
        ctx.fillText(displayAdminName, mainX, 252);

        // Tagline under name: "MANAGE • MODERATE • DRIVE THE COMMUNITY"
        ctx.fillStyle = '#64748b';
        ctx.font = '700 11.5px "Space Grotesk", sans-serif';
        ctx.letterSpacing = '1.5px';
        ctx.fillText('MANAGE   •   MODERATE   •   DRIVE THE COMMUNITY', mainX, 282);

        // Thin Separator Line
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mainX, 302);
        ctx.lineTo(mainX + 410, 302);
        ctx.stroke();

        // Two Column Grid: ADMIN ID (Left) & ACCESS LEVEL (Right)
        const col1X = mainX;
        const col2X = mainX + 240;
        const row1Y = 328;

        // Label: ADMIN ID
        ctx.fillStyle = '#64748b';
        ctx.font = '800 11px "Space Grotesk", sans-serif';
        ctx.letterSpacing = '1px';
        ctx.fillText('ADMIN ID', col1X, row1Y);

        // Box: ADM-0001
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(col1X, row1Y + 10, 160, 46, 10);
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = '900 21px "Space Grotesk", monospace';
        ctx.fillText(currentAdminId, col1X + 16, row1Y + 41);

        // Copy icon inside box
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(col1X + 128, row1Y + 23, 13, 15);
        ctx.strokeRect(col1X + 124, row1Y + 27, 13, 15);

        // Label: ACCESS LEVEL
        ctx.fillStyle = '#64748b';
        ctx.font = '800 11px "Space Grotesk", sans-serif';
        ctx.letterSpacing = '1px';
        ctx.fillText('ACCESS LEVEL', col2X, row1Y);

        // Red Gradient Pill: Crown Icon + ADMIN / Creator Badge
        const pillGrad = ctx.createLinearGradient(col2X, row1Y + 10, col2X + 210, row1Y + 56);
        pillGrad.addColorStop(0, '#ef4444');
        pillGrad.addColorStop(1, '#dc2626');
        ctx.fillStyle = pillGrad;
        ctx.beginPath();
        ctx.roundRect(col2X, row1Y + 10, 215, 46, 12);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 13.5px "Space Grotesk", sans-serif';
        const tierTitle = (currentBadge.name.split('—')[1] || currentBadge.name).trim().toUpperCase();
        ctx.fillText(`👑  LEVEL 0${currentBadge.level || 5} — ${tierTitle}`, col2X + 12, row1Y + 38);

        // Field: DEPARTMENT
        const row2Y = 422;
        ctx.fillStyle = '#64748b';
        ctx.font = '800 11px "Space Grotesk", sans-serif';
        ctx.letterSpacing = '1px';
        ctx.fillText('DEPARTMENT', col1X, row2Y);

        ctx.fillStyle = '#090d16';
        ctx.font = '900 20px "Space Grotesk", sans-serif';
        ctx.fillText('COMMUNITY OPERATIONS', col1X, row2Y + 28);

        // Field: ISSUE DATE & VALID UNTIL
        const row3Y = 492;
        ctx.fillStyle = '#64748b';
        ctx.font = '800 11px "Space Grotesk", sans-serif';
        ctx.letterSpacing = '1px';
        ctx.fillText('ISSUE DATE', col1X, row3Y);
        ctx.fillText('VALID UNTIL', col1X + 170, row3Y);

        ctx.fillStyle = '#090d16';
        ctx.font = '800 17px "Space Grotesk", sans-serif';
        ctx.fillText(getFormattedIssueDate(), col1X, row3Y + 26);

        // Divider between dates
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(col1X + 148, row3Y + 5);
        ctx.lineTo(col1X + 148, row3Y + 30);
        ctx.stroke();

        ctx.font = '900 17px "Space Grotesk", sans-serif';
        ctx.fillText('LIFETIME', col1X + 170, row3Y + 26);

        // Flowing Signature
        const sigY = 575;
        ctx.font = 'italic 34px "Brush Script MT", "Caveat", "Segoe Script", cursive';
        ctx.fillStyle = '#090d16';
        ctx.fillText('Enroutein..', col1X, sigY);

        ctx.font = '800 9px "Space Grotesk", sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.letterSpacing = '1px';
        ctx.fillText('AUTHORIZED SIGNATURE', col1X + 50, sigY + 22);

        // Crisp Barcode on Right
        const barX = w - 410;
        const barY = 540;
        const barW = 280;
        const barH = 55;

        ctx.fillStyle = '#090d16';
        const bars = [4,2,6,2,3,1,5,2,4,1,3,2,6,1,4,2,3,1,5,2,7,2,3,1,4,2,6,1,3,2,5,2,4,1,3,2,5,3,2,1,6,2,4,1,5,2,4,2,6,1];
        let currBarX = barX;
        for (let b of bars) {
            ctx.fillRect(currBarX, barY, b, barH);
            currBarX += b + 2;
        }

        ctx.font = '800 12px "Space Grotesk", monospace';
        ctx.letterSpacing = '3px';
        ctx.fillStyle = '#090d16';
        ctx.textAlign = 'center';
        ctx.fillText('ENROUTEIN  •  VERIFIED', barX + barW / 2, barY + barH + 20);
        ctx.textAlign = 'left';

        // 9. Bottom Ribbon
        const bottomY = h - 68;
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(40, bottomY - 14);
        ctx.lineTo(w - 40, bottomY - 14);
        ctx.stroke();

        // 3 Slanted Racing Stripes: "///"
        ctx.fillStyle = '#334155';
        for (let i = 0; i < 3; i++) {
            const stripeX = 65 + i * 14;
            ctx.beginPath();
            ctx.moveTo(stripeX + 6, bottomY);
            ctx.lineTo(stripeX + 12, bottomY);
            ctx.lineTo(stripeX + 6, bottomY + 22);
            ctx.lineTo(stripeX, bottomY + 22);
            ctx.closePath();
            ctx.fill();
        }

        ctx.fillStyle = '#090d16';
        ctx.font = '800 11px "Space Grotesk", sans-serif';
        ctx.letterSpacing = '1px';
        ctx.fillText('OFFICIAL IDENTIFICATION CARD', 125, bottomY + 8);

        ctx.fillStyle = '#64748b';
        ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('ENROUTEIN.STORE   •   BUSSID MODS   •   GLOBAL COMMUNITY', 125, bottomY + 22);

        // Right side of bottom ribbon: Red accent line + "KEEP DRIVING // KEEP EXPLORING"
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(w - 380, bottomY + 12, 60, 4);

        ctx.fillStyle = '#475569';
        ctx.font = '800 11px "Space Grotesk", sans-serif';
        ctx.letterSpacing = '1.5px';
        ctx.textAlign = 'right';
        ctx.fillText('KEEP DRIVING // KEEP EXPLORING', w - 75, bottomY + 16);
        ctx.textAlign = 'left';
    }
}

// Download Canvas as PNG
function downloadLicensePNG() {
    if (!licenseCanvas) return;
    const link = document.createElement('a');
    link.download = `Enroute_Admin_Card_${currentAdminName.replace(/\s+/g, '_')}.png`;
    link.href = licenseCanvas.toDataURL('image/png');
    link.click();
    showToast('Official Admin ID Card downloaded!');
}

// Open Modal
function openModal() {
    drawAdminLicenseCard();
    if (licenseModal) {
        licenseModal.classList.add('active');
    }
}

// Close Modal
function closeModal() {
    if (licenseModal) {
        licenseModal.classList.remove('active');
    }
}

// WhatsApp Share Text
function getShareText() {
    const siteUrl = 'https://enroutein.web.app';
    return `🔥 *ENROUTEIN OFFICIAL MOTORSPORT AUTHORITY* 🚀\n\n` +
           `👨‍💻 *Official Administrator:* ${currentAdminName}\n` +
           `🪪 *Admin ID:* ${currentAdminId}\n` +
           `👑 *Creator Badge Tier:* ${currentBadge.icon} ${currentBadge.name}\n` +
           `⚡ *Access Level:* Level ${currentBadge.level} — ${currentBadge.name} (Root Authority)\n` +
           `📦 *Fleet Mods Deployed:* ${currentModsCount} Verified Mod(s)\n\n` +
           `Explore the best Bus Simulator Indonesia mods, luxury liveries, and routes exclusively crafted at EnrouteIn!\n` +
           `👉 Visit Enroute Studio: ${siteUrl}`;
}

// Initialize Auth & Data
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        currentAdminEmail = user.email;
        emailInput.value = user.email;
        currentAdminId = getAdminCode(user.uid);
        
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().name) {
                currentAdminName = userDoc.data().name;
                nameInput.value = currentAdminName;
            } else if (user.displayName) {
                currentAdminName = user.displayName;
                nameInput.value = currentAdminName;
            } else {
                currentAdminName = user.email.split('@')[0];
                nameInput.value = currentAdminName;
            }

            // Count uploaded products
            const q = query(collection(db, "products"), where("addedBy", "==", user.email));
            const snapshot = await getDocs(q);
            currentModsCount = snapshot.size;

            // Calculate Creator Badge (Level 5 for admin@enroute.in)
            currentBadge = computeAdminBadge(currentModsCount, user.email);

            // Update Hero Card Elements
            if (heroName) heroName.textContent = currentAdminName;
            if (heroEmail) heroEmail.textContent = user.email;
            if (heroInitial) heroInitial.textContent = currentAdminName.charAt(0).toUpperCase();
            if (idCodeEl) idCodeEl.textContent = currentAdminId;
            if (modsCountEl) modsCountEl.textContent = `${currentModsCount} Mod${currentModsCount === 1 ? '' : 's'}`;
            if (badgeNameEl) badgeNameEl.textContent = currentBadge.name;
            if (badgePill) {
                badgePill.className = `admin-badge-tier ${currentBadge.className}`;
                badgePill.innerHTML = `<span>${currentBadge.icon}</span><span>${currentBadge.name}</span>`;
            }

            // Draw canvas card
            drawAdminLicenseCard();
        } catch (error) {
            console.error("Error fetching admin profile:", error);
            drawAdminLicenseCard();
        }
    } else {
        window.location.href = 'login.html';
    }
});

// Event Listeners for Actions
if (viewLicenseBtn) {
    viewLicenseBtn.addEventListener('click', openModal);
}
if (shareModalBtn) {
    shareModalBtn.addEventListener('click', openModal);
}
if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
        drawAdminLicenseCard();
        setTimeout(downloadLicensePNG, 150);
    });
}
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
}
if (modalDownloadBtn) {
    modalDownloadBtn.addEventListener('click', downloadLicensePNG);
}

// WhatsApp Share
if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
        const text = encodeURIComponent(getShareText());
        const waUrl = `https://api.whatsapp.com/send?text=${text}`;
        window.open(waUrl, '_blank');
    });
}

// Copy Text
if (copyTextBtn) {
    copyTextBtn.addEventListener('click', () => {
        const text = getShareText();
        navigator.clipboard.writeText(text).then(() => {
            showToast('Admin Passport details copied!');
        }).catch(() => {
            showToast('Failed to copy text.');
        });
    });
}

// Dismiss modal when clicking outside
if (licenseModal) {
    licenseModal.addEventListener('click', (e) => {
        if (e.target === licenseModal) {
            closeModal();
        }
    });
}

// Update Name
accountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const newName = nameInput.value.trim();
    const btn = document.getElementById('save-account-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            name: newName
        });
        currentAdminName = newName;
        if (heroName) heroName.textContent = newName;
        if (heroInitial) heroInitial.textContent = newName.charAt(0).toUpperCase();
        drawAdminLicenseCard();
        showToast('Admin Profile updated successfully!');
    } catch (error) {
        console.error("Error updating name:", error);
        alert('Failed to update name.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('adminEmail');
        window.location.href = 'login.html';
    });
});

// Delete Account
deleteBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    
    const isSuperAdmin = currentAdminEmail === 'admin@enroute.in';
    if (isSuperAdmin) {
        alert("The main admin account cannot be deleted.");
        return;
    }

    const confirmMsg = "Are you ABSOLUTELY sure? This will delete your account and ALL products you have uploaded permanently. This action cannot be undone.";
    if (!confirm(confirmMsg)) return;
    
    const doubleCheck = prompt('Type "DELETE" to confirm:');
    if (doubleCheck !== "DELETE") {
        alert("Account deletion cancelled.");
        return;
    }

    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    try {
        // 1. Delete all products uploaded by this admin
        const q = query(collection(db, "products"), where("addedBy", "==", currentAdminEmail));
        const snapshot = await getDocs(q);
        
        const deletePromises = snapshot.docs.map(productDoc => deleteDoc(doc(db, "products", productDoc.id)));
        await Promise.all(deletePromises);
        
        // 2. Delete user doc from firestore
        await deleteDoc(doc(db, "users", currentUser.uid));
        
        // 3. Delete auth user
        await deleteUser(currentUser);
        
        // Cleanup
        localStorage.removeItem('userRole');
        localStorage.removeItem('adminEmail');
        alert("Account and all associated products deleted successfully.");
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Error deleting account:", error);
        if (error.code === 'auth/requires-recent-login') {
            alert("Please logout and log back in to verify your identity before deleting your account.");
        } else {
            alert("An error occurred while deleting your account. Check console for details.");
        }
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete My Account';
    }
});
