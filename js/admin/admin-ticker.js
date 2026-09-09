// ====================================================
// EnrouteIn - Admin Section Top/Bottom Announcement Marquee
// ====================================================
import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

(function() {
    if (document.getElementById('admin-announcement-ticker')) return;

    const computeBadge = (count, email = '') => {
        if (email === 'admin@enroute.in' || count >= 15) return { name: '05 — Vajrāstra', icon: '⚡', level: 5 };
        if (count >= 10) return { name: '04 — Vyomrath', icon: '🚀', level: 4 };
        if (count >= 5)  return { name: '03 — Vajragati', icon: '⚔️', level: 3 };
        if (count >= 3)  return { name: '02 — Agniyān', icon: '🔥', level: 2 };
        if (count >= 1)  return { name: '01 — Tvarit', icon: '🏎️', level: 1 };
        return { name: '01 — Tvarit', icon: '🏎️', level: 1 };
    };

    const renderAdminTicker = (adminName, badge, modsCount) => {
        let ticker = document.getElementById('admin-announcement-ticker');
        if (!ticker) {
            ticker = document.createElement('div');
            ticker.id = 'admin-announcement-ticker';
            ticker.className = 'admin-announcement-ticker';
            document.body.appendChild(ticker);
        }

        const isAccountPage = window.location.pathname.includes('account.html');
        const targetUrl = isAccountPage ? '#admin-passport-hero' : 'account.html';

        const tickerMsg = `👋 Hi <strong>${adminName}</strong>! Get your official Admin Master License from the My Account section! • Access Level: <strong>Level ${badge.level || 1} (${badge.icon} ${badge.name})</strong> • Fleet Mods Uploaded: <strong>${modsCount} Deployed</strong> • Root Authority Verified`;

        ticker.innerHTML = `
            <div class="ticker-content">
                <a href="${targetUrl}" class="ticker-track">
                    <span>${tickerMsg}</span>
                    <span>★</span>
                    <span>${tickerMsg}</span>
                    <span>★</span>
                    <span>${tickerMsg}</span>
                    <span>★</span>
                    <span>${tickerMsg}</span>
                </a>
            </div>
            <a href="${targetUrl}" class="ticker-action-btn">
                <span>My Account</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </a>
        `;
    };

    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        try {
            let adminName = user.displayName || user.email.split('@')[0];
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().name) {
                adminName = userDoc.data().name;
            }

            // Count uploaded products
            const q = query(collection(db, "products"), where("addedBy", "==", user.email));
            const snapshot = await getDocs(q);
            const modsCount = snapshot.size;

            const badge = computeBadge(modsCount, user.email);
            renderAdminTicker(adminName, badge, modsCount);
        } catch (err) {
            console.warn("Could not compute admin ticker stats:", err);
            const fallbackBadge = computeBadge(1, user.email);
            renderAdminTicker(user.email.split('@')[0], fallbackBadge, 1);
        }
    });
})();
