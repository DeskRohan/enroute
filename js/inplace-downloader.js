/**
 * Enroute Universal In-Place Mod Downloader
 * Ensures downloads execute on-page without navigating away or opening external ad portals.
 */

export function resolveDirectUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const clean = url.trim();

    // 1. Google Drive direct conversion
    const gDriveMatch = clean.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/i);
    if (gDriveMatch && gDriveMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${gDriveMatch[1]}&confirm=t`;
    }

    // 2. Dropbox direct conversion
    if (clean.includes('dropbox.com')) {
        let dbUrl = clean.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/[?&]dl=0/, '');
        if (!dbUrl.includes('dl=1') && !dbUrl.includes('dropboxusercontent.com')) {
            dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'dl=1';
        }
        return dbUrl;
    }

    // 3. OneDrive direct conversion
    if (clean.includes('1drv.ms') || clean.includes('onedrive.live.com')) {
        return clean.replace('redir?', 'download?');
    }

    return clean;
}

export function triggerBrowserFileDownload(downloadUrl, filename = '') {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    if (filename) {
        a.download = filename;
    }
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        if (document.body.contains(a)) {
            document.body.removeChild(a);
        }
    }, 2500);
}

export function showInPlaceDownloadModal(url, modName = '', filename = '', fileSize = '') {
    // Remove any existing modal
    const existing = document.getElementById('enroute-inplace-modal');
    if (existing) existing.remove();

    const displayName = modName || filename || 'BUSSID Vehicle Mod';
    const cleanFilename = filename || `${displayName.replace(/[^a-zA-Z0-9_-]/g, '_')}.bussidmod`;
    const sizeText = fileSize ? ` • ${Math.round(fileSize / (1024 * 1024))} MB` : '';

    const modal = document.createElement('div');
    modal.id = 'enroute-inplace-modal';
    modal.style.cssText = `
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(9, 13, 22, 0.75); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        padding: 1.25rem; font-family: system-ui, -apple-system, sans-serif;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-surface, #ffffff); border: 1px solid var(--color-border, #e2e8f0); border-radius: 16px; max-width: 480px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.25); overflow: hidden; animation: enrouteFadeIn 0.2s ease;">
            <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff; padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(37, 99, 235, 0.2); color: #60a5fa; display: flex; align-items: center; justify-content: center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </div>
                    <div>
                        <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #94a3b8;">Enroute In-Place Delivery</div>
                        <div style="font-size: 1.05rem; font-weight: 800; color: #fff;">Download Ready</div>
                    </div>
                </div>
                <button type="button" id="enroute-modal-close" style="background: rgba(255,255,255,0.1); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center;">&times;</button>
            </div>

            <div style="padding: 1.5rem;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.15rem; margin-bottom: 1.25rem;">
                    <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Vehicle Mod Package</div>
                    <div style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${displayName}</div>
                    <div style="font-size: 0.8rem; color: #475569; display: flex; align-items: center; gap: 6px;">
                        <span>📦 <code>${cleanFilename}</code></span>
                        <span>${sizeText}</span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <button type="button" id="enroute-trigger-download" style="width: 100%; background: #2563eb; color: #fff; border: none; border-radius: 10px; padding: 0.85rem; font-size: 0.95rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>Start In-Place Download</span>
                    </button>

                    <p style="font-size: 0.75rem; color: #64748b; margin: 0; text-align: center; line-height: 1.4;">
                        Your browser will download the file directly. Copy <code>.bussidmod</code> to your phone's <code>BUSSID/Mods</code> folder.
                    </p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('enroute-modal-close');
    const triggerBtn = document.getElementById('enroute-trigger-download');

    const closeModal = () => {
        if (document.body.contains(modal)) modal.remove();
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    triggerBtn.addEventListener('click', () => {
        triggerBtn.innerHTML = `<span>✓ Starting Download...</span>`;
        triggerBtn.style.background = '#059669';

        const directLink = resolveDirectUrl(url);
        triggerBrowserFileDownload(directLink, cleanFilename);

        setTimeout(() => {
            closeModal();
        }, 1800);
    });
}

/**
 * Universal in-place download executor
 */
export async function downloadModInPlace(url, modName = '', btn = null) {
    if (!url || url === '#' || url.trim() === '') {
        alert("The download file link is currently unavailable. Please reach out to customer support.");
        return;
    }

    const cleanUrl = url.trim();
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg>
            <span>Starting Download...</span>
        `;
    }

    // 1. Google Drive, Dropbox, or OneDrive (Instant in-place 0ms download)
    const directConvertedUrl = resolveDirectUrl(cleanUrl);
    if (directConvertedUrl !== cleanUrl) {
        triggerBrowserFileDownload(directConvertedUrl, `${(modName || 'mod').replace(/[^a-zA-Z0-9_-]/g, '_')}.bussidmod`);
        if (btn) {
            btn.innerHTML = `<span>✓ Download Started!</span>`;
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }, 3000);
        }
        return;
    }

    // 2. Direct binary files (.zip, .bussidmod, .rar, Cloudflare R2, Firebase Storage)
    if (/\.(zip|rar|7z|bussidmod|bussidvehicle)($|\?)/i.test(cleanUrl) || cleanUrl.includes('.r2.cloudflarestorage.com') || cleanUrl.includes('firebasestorage.googleapis.com')) {
        triggerBrowserFileDownload(cleanUrl, `${(modName || 'mod').replace(/[^a-zA-Z0-9_-]/g, '_')}.bussidmod`);
        if (btn) {
            btn.innerHTML = `<span>✓ Download Started!</span>`;
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }, 3000);
        }
        return;
    }

    // 3. Resolve via API backend without navigating away
    try {
        const apiBase = (window.location.hostname === 'localhost' && window.location.port !== '3001') ? 'http://localhost:3001' : '';
        const res = await fetch(`${apiBase}/api/direct-download?url=${encodeURIComponent(cleanUrl)}`);
        const data = await res.json();

        if (data.ok && data.directUrl) {
            triggerBrowserFileDownload(data.directUrl, data.filename || `${(modName || 'mod').replace(/[^a-zA-Z0-9_-]/g, '_')}.bussidmod`);
            if (btn) {
                btn.innerHTML = `<span>✓ Downloading!</span>`;
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }, 3000);
            }
            return;
        }

        // If direct streaming URL could not be resolved from cloud provider, show clean in-place modal on Enroute
        showInPlaceDownloadModal(cleanUrl, modName, data.filename, data.fileSize);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
        return;
    } catch (err) {
        console.warn("Direct download resolution notice:", err);
    }

    // In-place modal fallback (NEVER opens external website or redirect tab)
    showInPlaceDownloadModal(cleanUrl, modName);
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

