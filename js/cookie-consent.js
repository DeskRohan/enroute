// Cookie Consent Banner
(function () {
    try { if (localStorage.getItem('enroute_cookies_accepted')) return; } catch(e) { return; }

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML = `
        <div class="cookie-inner">
            <div class="cookie-text">
                <span class="cookie-icon">🍪</span>
                <p>We use cookies to enhance your browsing experience and analyze site traffic. By clicking "Accept", you consent to our use of cookies. 
                <a href="privacy.html" style="color: var(--color-primary); text-decoration: underline;">Learn more</a></p>
            </div>
            <div class="cookie-actions">
                <button id="cookie-accept" class="btn btn-primary">Accept</button>
                <button id="cookie-decline" class="btn btn-outline">Decline</button>
            </div>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        #cookie-banner {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 9999;
            background: rgba(255, 255, 255, 0.97);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-top: 1px solid #e5e7eb;
            padding: 1rem 1.5rem;
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
            animation: slideUp 0.4s ease;
        }
        @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .cookie-inner {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1.5rem;
        }
        .cookie-text {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex: 1;
        }
        .cookie-icon {
            font-size: 1.75rem;
            flex-shrink: 0;
        }
        .cookie-text p {
            margin: 0;
            font-size: 0.875rem;
            color: #4b5563;
            line-height: 1.5;
        }
        .cookie-actions {
            display: flex;
            gap: 0.75rem;
            flex-shrink: 0;
        }
        @media (max-width: 640px) {
            .cookie-inner {
                flex-direction: column;
                text-align: center;
            }
            .cookie-text {
                flex-direction: column;
            }
            .cookie-actions {
                width: 100%;
            }
            .cookie-actions .btn {
                flex: 1;
            }
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(banner);

    document.getElementById('cookie-accept').addEventListener('click', () => {
        try { localStorage.setItem('enroute_cookies_accepted', 'true'); } catch(e) {}
        banner.style.animation = 'none';
        banner.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        banner.style.transform = 'translateY(100%)';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 300);
    });

    document.getElementById('cookie-decline').addEventListener('click', () => {
        try { localStorage.setItem('enroute_cookies_accepted', 'declined'); } catch(e) {}
        banner.style.animation = 'none';
        banner.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        banner.style.transform = 'translateY(100%)';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 300);
    });
})();
