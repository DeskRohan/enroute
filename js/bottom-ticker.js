// ====================================================
// EnrouteIn - Universal Bottom Announcement Marquee Ticker
// ====================================================
(function() {
    // Avoid double instantiation
    if (document.getElementById('bottom-announcement-ticker')) return;

    const initTicker = () => {
        const ticker = document.createElement('div');
        ticker.id = 'bottom-announcement-ticker';
        ticker.className = 'bottom-announcement-ticker';
        ticker.setAttribute('role', 'region');
        ticker.setAttribute('aria-label', 'Announcement Bar');

        // Target appropriate link based on page directory depth
        const isSubfolder = window.location.pathname.includes('/admin/');
        const targetUrl = isSubfolder ? '../dashboard.html' : 'dashboard.html';

        ticker.innerHTML = `
            <div class="ticker-content">
                <a href="${targetUrl}" class="ticker-track">
                    <span class="ticker-item"><span class="ticker-badge">NEW</span> 🪪 <strong>VIP Driver Passport:</strong> View and download your official Virtual VIP Driver License in the My Account section!</span>
                    <span class="ticker-divider">★</span>
                    <span class="ticker-item">🚀 <strong>Explore New Features:</strong> Virtual Garage Fleet, Wishlist & Community Mod Voting Hub are now live!</span>
                    <span class="ticker-divider">★</span>
                    <span class="ticker-item">⚡ <strong>Instant BUSSID Mods:</strong> 1-Click High-Speed Cloud Downloads & Lifetime Simulation Cloud Storage!</span>
                    <span class="ticker-divider">★</span>
                    <span class="ticker-item"><span class="ticker-badge">NEW</span> 🪪 <strong>VIP Driver Passport:</strong> View and download your official Virtual VIP Driver License in the My Account section!</span>
                    <span class="ticker-divider">★</span>
                    <span class="ticker-item">🚀 <strong>Explore New Features:</strong> Virtual Garage Fleet, Wishlist & Community Mod Voting Hub are now live!</span>
                    <span class="ticker-divider">★</span>
                    <span class="ticker-item">⚡ <strong>Instant BUSSID Mods:</strong> 1-Click High-Speed Cloud Downloads & Lifetime Simulation Cloud Storage!</span>
                </a>
            </div>
            <a href="${targetUrl}" class="ticker-action-btn">
                <span>My Account</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </a>
        `;

        document.body.appendChild(ticker);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTicker);
    } else {
        initTicker();
    }
})();
