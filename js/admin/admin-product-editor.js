import { db } from '../firebase-config.js';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ENV } from '../.env.js';

// ShareMods API Configuration
const SHAREMODS_API_KEY = (ENV && ENV.SHAREMODS_API_KEY) ? ENV.SHAREMODS_API_KEY : '';

function getShareModsApiKey() {
    let key = (typeof SHAREMODS_API_KEY === 'string') ? SHAREMODS_API_KEY : '';
    if (!key && typeof ENV !== 'undefined' && ENV.SHAREMODS_API_KEY) {
        key = ENV.SHAREMODS_API_KEY;
    }
    if (key.includes('key=')) {
        const match = key.match(/key=([a-zA-Z0-9]+)/);
        if (match) return match[1];
    }
    return key.trim();
}

// Format Currency
const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price || 0);
};

// Date Formatter for Local Inputs
const formatDateTimeLocal = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const tzOffset = date.getTimezoneOffset() * 60000;
        return (new Date(date - tzOffset)).toISOString().slice(0, 16);
    } catch (_) {
        return '';
    }
};

// Google Drive & CDN Image Converter
const getImageUrl = (url) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';
    }

    const cleanUrl = url.trim();
    if (cleanUrl.includes('googleusercontent.com/d/')) {
        return cleanUrl;
    }

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
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }

    return cleanUrl;
};

// Unique ID Generator
const generateId = () => {
    return 'prod_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// DOM References
const form = document.getElementById('product-editor-form');
const pageTitle = document.getElementById('studio-page-title');
const modePill = document.getElementById('studio-mode-pill');
const breadcrumbAction = document.getElementById('breadcrumb-current-action');
const deleteBtn = document.getElementById('studio-delete-btn');
const saveBottomBtn = document.getElementById('studio-save-bottom-btn');
const saveBottomLabel = document.getElementById('studio-save-bottom-label');
const manualDownloadInput = document.getElementById('manual-download-url');
const toggleManualLinkBtn = document.getElementById('toggle-manual-link-btn');
const manualLinkContainer = document.getElementById('manual-link-container');

const updateSaveButtonsText = (txt) => {
    document.querySelectorAll('#studio-save-bottom-label, #studio-save-label, #studio-save-sidebar-label, .btn-studio-save span').forEach(el => {
        el.textContent = txt;
    });
};

// Form Input Elements
const fId = document.getElementById('p-id');
const fAddedBy = document.getElementById('p-added-by');
const fName = document.getElementById('p-name');
const titleCharCount = document.getElementById('title-char-count');
const fPricingType = document.getElementById('p-pricing-type');
const fCategory = document.getElementById('p-category');
const fVariantName = document.getElementById('p-variant-name');

// Release & Mode Cards
const modeCardLive = document.getElementById('mode-card-live');
const modeCardUpcoming = document.getElementById('mode-card-upcoming');
const modeCardScheduled = document.getElementById('mode-card-scheduled');
const statusLiveRadio = document.getElementById('status-live');
const statusUpcomingRadio = document.getElementById('status-upcoming');
const statusScheduledRadio = document.getElementById('status-scheduled');
const upcomingPreorderPanel = document.getElementById('upcoming-preorder-panel');
const scheduledDatetimeGroup = document.getElementById('scheduled-datetime-group');
const fScheduledDate = document.getElementById('p-scheduled-date');

// Pre-Booking Inputs
const fAllowPrebooking = document.getElementById('p-allow-prebooking');
const prebookingFieldsWrap = document.getElementById('prebooking-fields-wrap');
const fPrebookingDeposit = document.getElementById('p-prebooking-deposit');
const fExpectedDate = document.getElementById('p-expected-date');
const fPrebookingSlots = document.getElementById('p-prebooking-slots');
const fPrebookingPerkNote = document.getElementById('p-prebooking-perk-note');
const fPrebookingPerks = document.getElementById('p-prebooking-perks');

// Pricing & Offers
const commercialPricingFields = document.getElementById('commercial-pricing-fields');
const freeChannelFields = document.getElementById('free-channel-fields');
const fOriginalPrice = document.getElementById('p-original-price');
const fOfferPrice = document.getElementById('p-offer-price');
const offerLifetimeChoice = document.getElementById('offer-lifetime-choice');
const offerLimitedChoice = document.getElementById('offer-limited-choice');
const offerLifetimeRadio = document.getElementById('p-offer-lifetime');
const offerLimitedRadio = document.getElementById('p-offer-limited');
const offerExpiryGroup = document.getElementById('offer-expiry-group');
const fOfferExpiry = document.getElementById('p-offer-expiry');
const fChannelLink = document.getElementById('p-channel-link');

// ShareMods Upload DOM
const shareModsUploadZone = document.getElementById('sharemods-upload-zone');
const shareModsFileInput = document.getElementById('sharemods-file-input');
const shareModsUploadContent = document.getElementById('sharemods-upload-content');
const shareModsUploadProgress = document.getElementById('sharemods-upload-progress');
const shareModsUploadSuccess = document.getElementById('sharemods-upload-success');
const shareModsFileName = document.getElementById('sharemods-file-name');
const shareModsFileSize = document.getElementById('sharemods-file-size');
const shareModsProgressBar = document.getElementById('sharemods-progress-bar');
const shareModsProgressLabel = document.getElementById('sharemods-progress-label');
const shareModsProgressPercent = document.getElementById('sharemods-progress-percent');
const shareModsSuccessFilename = document.getElementById('sharemods-success-filename');
const shareModsRemoveFile = document.getElementById('sharemods-remove-file');
const shareModsReuploadBtn = document.getElementById('sharemods-reupload-btn');
const fDownload = document.getElementById('p-download');
const fDownloadSource = document.getElementById('p-download-source');

// Images & Media
const fImage1 = document.getElementById('p-image-1');
const fImage2 = document.getElementById('p-image-2');
const fImage3 = document.getElementById('p-image-3');
const fImage4 = document.getElementById('p-image-4');
const slotPreview1 = document.getElementById('slot-preview-1');
const slotPreview2 = document.getElementById('slot-preview-2');
const slotPreview3 = document.getElementById('slot-preview-3');
const slotPreview4 = document.getElementById('slot-preview-4');
const fYoutube = document.getElementById('p-youtube');

// Specs & Telemetry
const fVersion = document.getElementById('p-version');
const fBrand = document.getElementById('p-brand');
const fEngine = document.getElementById('p-engine');
const fPolygons = document.getElementById('p-polygons');
const fSize = document.getElementById('p-size');
const fInterior = document.getElementById('p-interior');
const fFeatured = document.getElementById('p-featured');

// Variants & Documentation
const studioVariantsList = document.getElementById('studio-variants-list');
const studioAddVariantBtn = document.getElementById('studio-add-variant-btn');
const fSummary = document.getElementById('p-summary');
const fDesc = document.getElementById('p-description');
const relatedContainer = document.getElementById('p-related-container');

// Live Preview DOM Elements
const previewStatusPill = document.getElementById('preview-status-pill');
const previewPreorderPill = document.getElementById('preview-preorder-pill');
const previewCoverImg = document.getElementById('preview-cover-img');
const previewCategoryTag = document.getElementById('preview-category-tag');
const previewProductTitle = document.getElementById('preview-product-title');
const previewUploaderTag = document.getElementById('preview-uploader-tag');
const previewPriceDisplay = document.getElementById('preview-price-display');
const previewOriginalDisplay = document.getElementById('preview-original-display');
const previewPriceSubtext = document.getElementById('preview-price-subtext');
const previewActionBtn = document.getElementById('preview-action-btn');

// Inspector Stats
const inspectorModeText = document.getElementById('inspector-mode-text');
const inspectorPreorderText = document.getElementById('inspector-preorder-text');
const inspectorFileText = document.getElementById('inspector-file-text');
const inspectorAuthorText = document.getElementById('inspector-author-text');

// State
let allProducts = [];
let editingProductId = null;
let currentEditingCreatedAt = null;
let currentEditingAddedBy = null;
let shareModsUploadedUrl = '';
let shareModsCurrentXHR = null;

// =====================================================
// Fetch All Products for Variant & Related Mod Linking
// =====================================================
const loadCatalogProducts = async () => {
    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateRelatedModsChecklist();
    } catch (err) {
        console.warn('Could not load products catalog for relations:', err);
    }
};

// Populate Related Mods Checkboxes
const populateRelatedModsChecklist = (selectedIds = []) => {
    if (!relatedContainer) return;
    relatedContainer.innerHTML = '';

    const filterList = allProducts.filter(p => p.id !== editingProductId);
    if (filterList.length === 0) {
        relatedContainer.innerHTML = '<span style="color:var(--admin-text-muted);font-size:0.8rem;grid-column:1/-1;">No other catalog products available to link yet.</span>';
        return;
    }

    filterList.forEach(p => {
        const isChecked = selectedIds.includes(p.id);
        const item = document.createElement('label');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '0.45rem';
        item.style.cursor = 'pointer';
        item.style.fontSize = '0.8rem';
        item.style.padding = '4px 6px';
        item.style.borderRadius = '6px';
        item.style.background = '#ffffff';
        item.style.border = '1px solid #e2e8f0';

        item.innerHTML = `
            <input type="checkbox" value="${p.id}" class="related-mod-checkbox" ${isChecked ? 'checked' : ''} style="accent-color:var(--studio-blue); width:15px; height:15px;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px;" title="${p.name}">${p.name}</span>
        `;
        relatedContainer.appendChild(item);
    });
};

// Create Dynamic Variant Row
const createVariantRow = (selectedId = '', labelVal = '') => {
    const row = document.createElement('div');
    row.className = 'variant-builder-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1.6fr 1.4fr 40px';
    row.style.gap = '0.65rem';
    row.style.alignItems = 'center';
    row.style.background = '#f8fafc';
    row.style.padding = '0.65rem 0.85rem';
    row.style.borderRadius = '12px';
    row.style.border = '1px solid #e2e8f0';

    const select = document.createElement('select');
    select.className = 'studio-input variant-product-select';
    select.style.padding = '0.5rem 0.75rem';
    select.style.fontSize = '0.82rem';

    let optionsHtml = '<option value="">Select Linked Catalog Mod...</option>';
    allProducts.forEach(p => {
        if (p.id !== editingProductId) {
            const isSel = (p.id === selectedId) ? 'selected' : '';
            optionsHtml += `<option value="${p.id}" ${isSel}>${p.name}</option>`;
        }
    });
    select.innerHTML = optionsHtml;

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'studio-input variant-label-input';
    labelInput.placeholder = 'e.g. Sleeper Coach, Livery A';
    labelInput.value = labelVal;
    labelInput.style.padding = '0.5rem 0.75rem';
    labelInput.style.fontSize = '0.82rem';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.title = 'Remove Variant';
    removeBtn.innerHTML = '&times;';
    removeBtn.style.background = '#fee2e2';
    removeBtn.style.color = '#dc2626';
    removeBtn.style.border = 'none';
    removeBtn.style.borderRadius = '8px';
    removeBtn.style.width = '32px';
    removeBtn.style.height = '32px';
    removeBtn.style.fontSize = '1.2rem';
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.display = 'flex';
    removeBtn.style.alignItems = 'center';
    removeBtn.style.justifyContent = 'center';
    removeBtn.style.lineHeight = '1';

    removeBtn.addEventListener('click', () => {
        row.remove();
    });

    row.appendChild(select);
    row.appendChild(labelInput);
    row.appendChild(removeBtn);
    return row;
};

// Add Variant button handler
if (studioAddVariantBtn) {
    studioAddVariantBtn.addEventListener('click', () => {
        const row = createVariantRow();
        studioVariantsList.appendChild(row);
    });
}

// =====================================================
// Real-Time Live Preview Inspector Synchronization
// =====================================================
const updateLivePreview = () => {
    try {
        const nameVal = (fName && fName.value.trim()) || 'Vehicle Mod';
        if (previewProductTitle) previewProductTitle.textContent = nameVal;

        // Character counter
        if (titleCharCount && fName) {
            titleCharCount.textContent = `${fName.value.length}/100 chars`;
        }

        // Category
        const catMap = {
            'mod': 'Vehicle Mod',
            'livery': 'Vehicle Livery / Skin',
            'sound': 'Sound & Horn Mod',
            'map': 'Map & Route Mod'
        };
        if (previewCategoryTag && fCategory) {
            previewCategoryTag.textContent = catMap[fCategory.value] || 'Vehicle Mod';
        }

        // Cover Image
        const coverUrl = fImage1 ? fImage1.value.trim() : '';
        if (coverUrl) {
            const cdnUrl = getImageUrl(coverUrl);
            if (previewCoverImg) previewCoverImg.src = cdnUrl;
            if (slotPreview1) slotPreview1.innerHTML = `<img src="${cdnUrl}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';">`;
        } else {
            if (previewCoverImg) previewCoverImg.src = 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';
            if (slotPreview1) slotPreview1.innerHTML = '<span>Cover</span>';
        }

        // Secondary Image Slots
        const updateSlotThumb = (inputEl, previewBoxEl, labelText) => {
            if (!previewBoxEl) return;
            const url = inputEl ? inputEl.value.trim() : '';
            if (url) {
                const cdn = getImageUrl(url);
                previewBoxEl.innerHTML = `<img src="${cdn}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';">`;
            } else {
                previewBoxEl.innerHTML = `<span>${labelText}</span>`;
            }
        };
        updateSlotThumb(fImage2, slotPreview2, 'Exterior');
        updateSlotThumb(fImage3, slotPreview3, 'Cockpit');
        updateSlotThumb(fImage4, slotPreview4, 'Night View');

        // Status Mode
        const selectedModeEl = document.querySelector('input[name="p-status"]:checked');
        const selectedMode = selectedModeEl ? selectedModeEl.value : 'live';
        const isUpcoming = selectedMode === 'upcoming';
        const isScheduled = selectedMode === 'scheduled';
        const isPrebooking = isUpcoming && Boolean(fAllowPrebooking && fAllowPrebooking.checked);

        if (previewStatusPill) {
            if (isUpcoming) {
                previewStatusPill.className = 'studio-live-pill upcoming';
                previewStatusPill.textContent = '🚀 UPCOMING';
                previewStatusPill.style.display = 'inline-flex';
            } else if (isScheduled) {
                previewStatusPill.className = 'studio-live-pill scheduled';
                previewStatusPill.textContent = '⏳ SCHEDULED';
                previewStatusPill.style.display = 'inline-flex';
            } else {
                previewStatusPill.className = 'studio-live-pill live';
                previewStatusPill.textContent = '🟢 LIVE STOREFRONT';
                previewStatusPill.style.display = 'inline-flex';
            }
        }

        if (previewPreorderPill) {
            if (isUpcoming && isPrebooking) {
                previewPreorderPill.style.display = 'inline-flex';
                previewPreorderPill.textContent = 'PRIORITY PRE-ORDER';
            } else {
                previewPreorderPill.style.display = 'none';
            }
        }

        if (inspectorModeText) {
            inspectorModeText.textContent = isUpcoming ? 'Upcoming Release' : (isScheduled ? 'Scheduled Drop' : 'Instant Live');
        }
        if (inspectorPreorderText) {
            inspectorPreorderText.textContent = (isUpcoming && isPrebooking) ? 'Active' : 'Disabled';
        }

        // Pricing & Pre-Booking Display
        const isFree = Boolean(fPricingType && fPricingType.value === 'free');
        if (isFree) {
            if (previewPriceDisplay) {
                previewPriceDisplay.textContent = 'FREE';
                previewPriceDisplay.style.color = '#059669';
            }
            if (previewOriginalDisplay) previewOriginalDisplay.style.display = 'none';
            if (previewPriceSubtext) previewPriceSubtext.textContent = 'Community Sub2Unlock Download';
            if (previewActionBtn) {
                previewActionBtn.textContent = 'Free Instant Download';
                previewActionBtn.style.background = '#059669';
            }
        } else if (isPrebooking) {
            const depositVal = parseFloat(fPrebookingDeposit ? fPrebookingDeposit.value : 0) || 0;
            const origVal = parseFloat(fOriginalPrice ? fOriginalPrice.value : 0) || 0;
            if (previewPriceDisplay) {
                previewPriceDisplay.textContent = `Pre-Book: ${formatPrice(depositVal)}`;
                previewPriceDisplay.style.color = '#C87960';
            }
            if (previewOriginalDisplay) {
                if (origVal > 0) {
                    previewOriginalDisplay.style.display = 'inline-block';
                    previewOriginalDisplay.textContent = `Full: ${formatPrice(origVal)}`;
                } else {
                    previewOriginalDisplay.style.display = 'none';
                }
            }
            if (previewPriceSubtext) previewPriceSubtext.textContent = `Priority Reservation Deposit`;
            if (previewActionBtn) {
                previewActionBtn.textContent = `Pre-Book Now — ${formatPrice(depositVal)}`;
                previewActionBtn.style.background = '#C87960';
            }
        } else {
            const origPrice = parseFloat(fOriginalPrice ? fOriginalPrice.value : 0) || 0;
            const offerPrice = parseFloat(fOfferPrice ? fOfferPrice.value : NaN);
            const hasOffer = !isNaN(offerPrice) && offerPrice > 0 && offerPrice < origPrice;

            if (previewPriceDisplay) {
                previewPriceDisplay.textContent = formatPrice(hasOffer ? offerPrice : origPrice);
                previewPriceDisplay.style.color = '#202124';
            }
            if (previewOriginalDisplay) {
                if (hasOffer) {
                    previewOriginalDisplay.style.display = 'inline-block';
                    previewOriginalDisplay.textContent = formatPrice(origPrice);
                } else {
                    previewOriginalDisplay.style.display = 'none';
                }
            }
            if (previewPriceSubtext) {
                previewPriceSubtext.textContent = hasOffer ? 'Promotional Discount Applied' : 'Standard Catalog Price';
            }
            if (previewActionBtn) {
                previewActionBtn.textContent = 'View Details & Buy';
                previewActionBtn.style.background = 'var(--color-primary, #007DC6)';
                previewActionBtn.style.color = '#FFFFFF';
                previewActionBtn.style.borderColor = 'var(--color-primary-hover, #005A91)';
            }
        }

        // Author
        if (inspectorAuthorText) {
            inspectorAuthorText.textContent = (fAddedBy && fAddedBy.value) || (localStorage.getItem('adminEmail') || 'Enroute Admin');
        }
    } catch (e) {
        console.warn('updateLivePreview warning:', e);
    }
};

// =====================================================
// Mode Switcher Interactions
// =====================================================
const setListingMode = (mode) => {
    [modeCardLive, modeCardUpcoming, modeCardScheduled].forEach(c => {
        if (c) c.classList.remove('active', 'active-emerald', 'active-purple');
    });

    if (mode === 'live') {
        if (modeCardLive) modeCardLive.classList.add('active-emerald');
        if (statusLiveRadio) statusLiveRadio.checked = true;
        if (upcomingPreorderPanel) upcomingPreorderPanel.style.display = 'none';
        if (scheduledDatetimeGroup) scheduledDatetimeGroup.style.display = 'none';
        if (fScheduledDate) {
            fScheduledDate.required = false;
        }
    } else if (mode === 'upcoming') {
        if (modeCardUpcoming) modeCardUpcoming.classList.add('active-purple');
        if (statusUpcomingRadio) statusUpcomingRadio.checked = true;
        if (upcomingPreorderPanel) upcomingPreorderPanel.style.display = 'block';
        if (scheduledDatetimeGroup) scheduledDatetimeGroup.style.display = 'none';
        if (fScheduledDate) fScheduledDate.required = false;
        if (fExpectedDate) fExpectedDate.required = true;
        if (prebookingFieldsWrap) {
            prebookingFieldsWrap.style.display = (fAllowPrebooking && fAllowPrebooking.checked) ? 'block' : 'none';
        }
    } else if (mode === 'scheduled') {
        if (modeCardScheduled) modeCardScheduled.classList.add('active');
        if (statusScheduledRadio) statusScheduledRadio.checked = true;
        if (upcomingPreorderPanel) upcomingPreorderPanel.style.display = 'none';
        if (scheduledDatetimeGroup) scheduledDatetimeGroup.style.display = 'block';
        if (fScheduledDate) fScheduledDate.required = true;
        if (fExpectedDate) fExpectedDate.required = false;
    }
    updateLivePreview();
};

if (modeCardLive) modeCardLive.addEventListener('click', () => setListingMode('live'));
if (modeCardUpcoming) modeCardUpcoming.addEventListener('click', () => setListingMode('upcoming'));
if (modeCardScheduled) modeCardScheduled.addEventListener('click', () => setListingMode('scheduled'));

// Pre-booking Toggle
if (fAllowPrebooking) {
    fAllowPrebooking.addEventListener('change', () => {
        if (prebookingFieldsWrap) {
            prebookingFieldsWrap.style.display = fAllowPrebooking.checked ? 'block' : 'none';
        }
        if (fPrebookingDeposit) {
            fPrebookingDeposit.required = fAllowPrebooking.checked;
        }
        updateLivePreview();
    });
}

// Promotional Offer Period Switcher
offerLifetimeChoice.addEventListener('click', () => {
    offerLifetimeChoice.classList.add('active');
    offerLimitedChoice.classList.remove('active');
    offerLifetimeRadio.checked = true;
    offerExpiryGroup.style.display = 'none';
    fOfferExpiry.required = false;
    updateLivePreview();
});

offerLimitedChoice.addEventListener('click', () => {
    offerLimitedChoice.classList.add('active');
    offerLifetimeChoice.classList.remove('active');
    offerLimitedRadio.checked = true;
    offerExpiryGroup.style.display = 'block';
    fOfferExpiry.required = true;
    updateLivePreview();
});

// Pricing Type Switcher (Commercial vs Free)
fPricingType.addEventListener('change', (e) => {
    if (e.target.value === 'free') {
        commercialPricingFields.style.display = 'none';
        freeChannelFields.style.display = 'block';
        fOriginalPrice.required = false;
        fChannelLink.required = true;
    } else {
        commercialPricingFields.style.display = 'block';
        freeChannelFields.style.display = 'none';
        fOriginalPrice.required = true;
        fChannelLink.required = false;
    }
    updateLivePreview();
});

// Live input sync listeners
[fName, fCategory, fOriginalPrice, fOfferPrice, fPrebookingDeposit, fImage1, fImage2, fImage3, fImage4].forEach(el => {
    if (el) {
        el.addEventListener('input', updateLivePreview);
        el.addEventListener('change', updateLivePreview);
    }
});

// =====================================================
// ShareMods File Upload Handling & Manual Link
// =====================================================
const resetShareModsUpload = () => {
    if (shareModsCurrentXHR) {
        try { shareModsCurrentXHR.abort(); } catch (_) {}
        shareModsCurrentXHR = null;
    }
    shareModsUploadedUrl = '';
    if (fDownload) fDownload.value = '';
    if (fDownloadSource) fDownloadSource.value = 'manual';
    if (shareModsFileInput) shareModsFileInput.value = '';
    if (manualDownloadInput) manualDownloadInput.value = '';
    if (shareModsUploadContent) shareModsUploadContent.style.display = 'block';
    if (shareModsUploadProgress) shareModsUploadProgress.style.display = 'none';
    if (shareModsUploadSuccess) shareModsUploadSuccess.style.display = 'none';
    if (shareModsProgressBar) {
        shareModsProgressBar.style.width = '0%';
        shareModsProgressBar.style.background = 'var(--studio-blue)';
    }
    if (shareModsProgressPercent) shareModsProgressPercent.textContent = '0%';
    if (shareModsProgressLabel) {
        shareModsProgressLabel.textContent = 'Uploading Mod Archive...';
        shareModsProgressLabel.style.color = 'var(--studio-blue)';
    }
    if (shareModsUploadZone) {
        shareModsUploadZone.classList.remove('has-file');
        shareModsUploadZone.style.borderColor = 'rgba(37, 99, 235, 0.35)';
        shareModsUploadZone.style.background = '#f8fafc';
    }
    if (inspectorFileText) inspectorFileText.textContent = 'None Attached';
};

const handleShareModsUpload = async (file) => {
    if (!file) return;

    const apiKey = getShareModsApiKey();
    if (!apiKey) {
        alert("Cloud storage upload key is not configured. Please contact administrator.");
        return;
    }

    const MAX_SIZE = 200 * 1024 * 1024; // 200MB
    if (file.size > MAX_SIZE) {
        alert(`Selected file (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 200MB limit for cloud upload.`);
        resetShareModsUpload();
        return;
    }

    const sizeFormatted = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    shareModsFileName.textContent = file.name;
    shareModsFileSize.textContent = sizeFormatted;

    shareModsUploadContent.style.display = 'none';
    shareModsUploadProgress.style.display = 'block';
    shareModsUploadSuccess.style.display = 'none';
    if (shareModsUploadZone) {
        shareModsUploadZone.classList.add('has-file');
        shareModsUploadZone.style.borderColor = 'var(--studio-blue)';
        shareModsUploadZone.style.background = 'var(--studio-blue-light)';
    }
    shareModsProgressBar.style.width = '0%';
    shareModsProgressBar.style.background = 'var(--studio-blue)';
    shareModsProgressPercent.textContent = '0%';
    shareModsProgressLabel.textContent = 'Connecting to Storage Server...';
    shareModsProgressLabel.style.color = 'var(--studio-blue)';

    try {
        // Step 1: Query the serverless backend for an active upload server node and session ID
        let uploadServerUrl = '';
        let sessId = '';

        try {
            const apiRes = await fetch(`/api/sharemods-server?key=${encodeURIComponent(apiKey)}`);
            if (apiRes.ok) {
                const apiData = await apiRes.json();
                if (apiData.uploadServerUrl) {
                    uploadServerUrl = apiData.uploadServerUrl;
                    sessId = apiData.sessId || '';
                }
            } else {
                console.warn('/api/sharemods-server status:', apiRes.status);
            }
        } catch (e) {
            console.warn('Backend proxy /api/sharemods-server unreachable:', e);
        }

        // Local development server fallback (port 3001)
        if (!uploadServerUrl) {
            try {
                const localRes = await fetch(`http://localhost:3001/api/sharemods-server?key=${encodeURIComponent(apiKey)}`);
                if (localRes.ok) {
                    const localData = await localRes.json();
                    if (localData.uploadServerUrl) {
                        uploadServerUrl = localData.uploadServerUrl;
                        sessId = localData.sessId || '';
                    }
                }
            } catch (_) {}
        }

        // Direct fallback if proxy is temporarily unreachable
        if (!uploadServerUrl) {
            uploadServerUrl = 'https://bio7.sharemods.com/cgi-bin/upload.cgi';
        }

        shareModsProgressLabel.textContent = 'Uploading Mod Archive...';

        // Step 2: Upload file directly to dedicated storage node (supports CORS Origin: *)
        const formData = new FormData();
        if (sessId) {
            formData.append('sess_id', sessId);
        }
        formData.append('key', apiKey);
        formData.append('file_0', file);

        const downloadUrl = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            shareModsCurrentXHR = xhr;

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    shareModsProgressBar.style.width = `${percent}%`;
                    shareModsProgressPercent.textContent = `${percent}%`;
                    if (percent >= 100) {
                        shareModsProgressLabel.textContent = 'Finalizing Mod Archive...';
                    }
                }
            });

            xhr.addEventListener('load', () => {
                shareModsCurrentXHR = null;
                if (xhr.status >= 200 && xhr.status < 300) {
                    const responseText = xhr.responseText;
                    let fileCode = null;
                    let fileUrl = null;

                    try {
                        const data = JSON.parse(responseText);
                        if (Array.isArray(data) && data[0]) {
                            fileCode = data[0].file_code;
                            fileUrl = data[0].url || data[0].download_url;
                        } else if (data.file_code) {
                            fileCode = data.file_code;
                        } else if (data.result) {
                            if (typeof data.result === 'string') {
                                if (data.result.startsWith('http')) {
                                    fileUrl = data.result;
                                } else {
                                    fileCode = data.result;
                                }
                            } else if (data.result.file_code) {
                                fileCode = data.result.file_code;
                            } else if (data.result.url) {
                                fileUrl = data.result.url;
                            }
                        } else if (data.files && data.files[0]) {
                            const f = data.files[0];
                            fileUrl = f.url || f.download_url;
                            fileCode = f.file_code;
                        }
                    } catch (_) {
                        // XML or plain text fallback
                        const parser = new DOMParser();
                        const xml = parser.parseFromString(responseText, 'text/xml');
                        const urlNode = xml.querySelector('url') || xml.querySelector('download_url');
                        const codeNode = xml.querySelector('file_code');
                        if (urlNode) {
                            fileUrl = urlNode.textContent;
                        } else if (codeNode) {
                            fileCode = codeNode.textContent;
                        }
                    }

                    // Regex fallback for sharemods URLs
                    if (!fileUrl && !fileCode) {
                        const match = responseText.match(/https?:\/\/(?:www\.)?sharemods\.com\/([a-zA-Z0-9_\-\.\/]+)/);
                        if (match) fileUrl = match[0];
                    }

                    // Canonical ShareMods download page link (never causes "no such file with this filename" error)
                    if (!fileUrl && fileCode) {
                        fileUrl = `https://sharemods.com/${fileCode}`;
                    }

                    if (fileUrl) {
                        resolve(fileUrl);
                    } else if (responseText.trim().startsWith('http')) {
                        resolve(responseText.trim());
                    } else {
                        reject(new Error('Could not extract download URL from storage server response.'));
                    }
                } else {
                    reject(new Error(`Storage server upload failed with HTTP status ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                shareModsCurrentXHR = null;
                reject(new Error('Network error during file upload. Please check your connection or CORS settings.'));
            });

            xhr.addEventListener('abort', () => {
                shareModsCurrentXHR = null;
                reject(new Error('Upload cancelled.'));
            });

            xhr.open('POST', uploadServerUrl, true);
            xhr.send(formData);
        });

        // Step 3: Upload succeeded — update UI
        shareModsUploadedUrl = downloadUrl;
        if (fDownload) fDownload.value = downloadUrl;
        if (fDownloadSource) fDownloadSource.value = 'sharemods';
        if (manualDownloadInput) manualDownloadInput.value = downloadUrl;

        shareModsProgressBar.style.width = '100%';
        shareModsProgressBar.style.background = 'var(--studio-emerald)';
        shareModsProgressPercent.textContent = '100%';
        shareModsProgressLabel.textContent = 'Upload Complete!';
        shareModsProgressLabel.style.color = 'var(--studio-emerald)';

        setTimeout(() => {
            shareModsUploadProgress.style.display = 'none';
            shareModsUploadSuccess.style.display = 'block';
            shareModsSuccessFilename.textContent = `${file.name} (${sizeFormatted})`;
            if (shareModsUploadZone) {
                shareModsUploadZone.classList.add('has-file');
                shareModsUploadZone.style.borderColor = 'var(--studio-emerald)';
                shareModsUploadZone.style.background = 'var(--studio-emerald-light)';
            }
            if (inspectorFileText) inspectorFileText.textContent = `Attached (${sizeFormatted})`;
        }, 400);

        console.log('ShareMods upload success:', downloadUrl);

    } catch (error) {
        console.error('ShareMods upload error:', error);
        shareModsProgressLabel.textContent = 'Upload failed!';
        shareModsProgressLabel.style.color = '#ef4444';
        shareModsProgressPercent.textContent = '';
        shareModsProgressBar.style.width = '100%';
        shareModsProgressBar.style.background = '#ef4444';

        setTimeout(() => {
            resetShareModsUpload();
        }, 3500);

        alert(`Upload Error: ${error.message || 'Failed to complete cloud upload.'}`);
    }
};

// ShareMods upload zone click & drag-drop
shareModsUploadZone.addEventListener('click', (e) => {
    if (e.target.closest('#sharemods-remove-file') || e.target.closest('#sharemods-reupload-btn')) return;
    if (shareModsUploadSuccess.style.display === 'block') return;
    shareModsFileInput.click();
});

shareModsFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        handleShareModsUpload(e.target.files[0]);
    }
});

shareModsUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    shareModsUploadZone.style.borderColor = 'var(--studio-blue)';
    shareModsUploadZone.style.background = 'var(--studio-blue-light)';
});

shareModsUploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!shareModsUploadZone.classList.contains('has-file')) {
        shareModsUploadZone.style.borderColor = 'rgba(37, 99, 235, 0.35)';
        shareModsUploadZone.style.background = '#f8fafc';
    }
});

shareModsUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleShareModsUpload(e.dataTransfer.files[0]);
    }
});

shareModsRemoveFile.addEventListener('click', (e) => {
    e.stopPropagation();
    resetShareModsUpload();
});

shareModsReuploadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetShareModsUpload();
    shareModsFileInput.click();
});

// Manual direct download link input handling
if (toggleManualLinkBtn && manualLinkContainer) {
    toggleManualLinkBtn.addEventListener('click', () => {
        const isHidden = manualLinkContainer.style.display === 'none';
        manualLinkContainer.style.display = isHidden ? 'block' : 'none';
        toggleManualLinkBtn.textContent = isHidden 
            ? 'Hide direct download link input' 
            : 'Or provide direct download link (Google Drive, Mega, MediaFire, etc.)';
        if (isHidden && manualDownloadInput) {
            manualDownloadInput.focus();
        }
    });
}

if (manualDownloadInput) {
    const statusEl = document.getElementById('direct-link-status');
    const updateLinkStatus = () => {
        const url = manualDownloadInput.value.trim();
        if (!url) {
            if (statusEl) {
                statusEl.innerHTML = `<span>Paste a <strong>Google Drive</strong>, <strong>Dropbox</strong>, or direct file link (.zip, .bussidmod, .rar). Customers will download <strong>directly on the website</strong> without opening any external sites!</span>`;
                statusEl.style.color = '#166534';
            }
            if (!shareModsUploadSuccess || shareModsUploadSuccess.style.display !== 'block') {
                shareModsUploadedUrl = '';
                if (fDownload) fDownload.value = '';
                if (inspectorFileText) inspectorFileText.textContent = 'None Attached';
            }
            return;
        }

        shareModsUploadedUrl = url;
        if (fDownload) fDownload.value = url;
        if (fDownloadSource) fDownloadSource.value = url.includes('sharemods.com') ? 'sharemods' : 'manual';

        if (url.includes('drive.google.com')) {
            if (statusEl) {
                statusEl.innerHTML = `<span>🟢 <strong>Google Drive Verified:</strong> 1-Click in-place direct download is active on the website!</span>`;
                statusEl.style.color = '#15803d';
            }
            if (inspectorFileText) inspectorFileText.textContent = 'Google Drive (In-Place)';
        } else if (url.includes('dropbox.com')) {
            if (statusEl) {
                statusEl.innerHTML = `<span>🟢 <strong>Dropbox Verified:</strong> 1-Click in-place direct download active!</span>`;
                statusEl.style.color = '#15803d';
            }
            if (inspectorFileText) inspectorFileText.textContent = 'Dropbox (In-Place)';
        } else if (/\.(zip|rar|7z|bussidmod|bussidvehicle)($|\?)/i.test(url)) {
            if (statusEl) {
                statusEl.innerHTML = `<span>🟢 <strong>Direct File Archive:</strong> 1-Click in-place direct download active!</span>`;
                statusEl.style.color = '#15803d';
            }
            if (inspectorFileText) inspectorFileText.textContent = 'Direct Archive (In-Place)';
        } else {
            if (statusEl) {
                statusEl.innerHTML = `<span>⚡ In-Place Download Link Attached.</span>`;
                statusEl.style.color = '#166534';
            }
            if (inspectorFileText) inspectorFileText.textContent = 'Direct Link';
        }
    };

    manualDownloadInput.addEventListener('input', updateLinkStatus);
    manualDownloadInput.addEventListener('change', updateLinkStatus);
}

// =====================================================
// Load Existing Product on Edit Mode (?id=...)
// =====================================================
const initProductEditor = async () => {
    // 1. Extract query parameter 'id' from search, hash, or sessionStorage fallback
    let id = null;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        id = urlParams.get('id') || urlParams.get('productId');
        if (!id && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#\??/, ''));
            id = hashParams.get('id') || hashParams.get('productId');
        }
    } catch (_) {}

    if (!id) {
        try {
            id = sessionStorage.getItem('editProductId');
        } catch (_) {}
    }

    if (id) {
        id = decodeURIComponent(String(id).trim());
        editingProductId = id;
        try { sessionStorage.setItem('editProductId', id); } catch (_) {}

        if (pageTitle) pageTitle.innerHTML = 'Edit Product <span style="font-size: 0.8rem; font-weight: 500; color: var(--admin-text-muted);">(Loading...)</span>';
        if (breadcrumbAction) breadcrumbAction.textContent = 'Edit Product';
        if (modePill) {
            modePill.textContent = 'Editing Mode';
            modePill.style.background = '#fef3c7';
            modePill.style.color = '#d97706';
            modePill.style.borderColor = 'rgba(217, 119, 6, 0.25)';
        }
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
        updateSaveButtonsText('Update Product');

        // 2. Fetch the target product document
        try {
            let docSnap = await getDoc(doc(db, "products", id));
            if (!docSnap || !docSnap.exists()) {
                // Retry once in case auth session or connection is settling
                await new Promise(r => setTimeout(r, 400));
                docSnap = await getDoc(doc(db, "products", id));
            }

            if (!docSnap || !docSnap.exists()) {
                alert(`Product not found (ID: ${id}). Returning to products list.`);
                try { sessionStorage.removeItem('editProductId'); } catch (_) {}
                window.location.href = 'products.html';
                return;
            }

            const p = docSnap.data();
            if (pageTitle) pageTitle.textContent = 'Edit Product';
            if (fId) fId.value = id;
            if (fName) fName.value = p.name || '';
            if (fPricingType) fPricingType.value = p.pricingType || 'paid';
            if (fCategory) fCategory.value = p.category || 'mod';
            if (fVariantName) fVariantName.value = p.variantName || '';

            // Creator & Timestamps preservation
            currentEditingCreatedAt = p.createdAt || null;
            currentEditingAddedBy = p.addedBy || null;
            if (fAddedBy) fAddedBy.value = currentEditingAddedBy || '';

            // Pricing
            const isFree = p.pricingType === 'free';
            if (isFree) {
                if (fPricingType) fPricingType.value = 'free';
                if (commercialPricingFields) commercialPricingFields.style.display = 'none';
                if (freeChannelFields) freeChannelFields.style.display = 'block';
                if (fChannelLink) fChannelLink.value = p.channelLink || '';
                if (fOriginalPrice) fOriginalPrice.required = false;
            } else {
                if (fPricingType) fPricingType.value = 'paid';
                if (commercialPricingFields) commercialPricingFields.style.display = 'block';
                if (freeChannelFields) freeChannelFields.style.display = 'none';
                if (fOriginalPrice) fOriginalPrice.value = p.originalPrice ?? p.price ?? '';
                if (fOfferPrice) fOfferPrice.value = (p.offerPrice !== undefined && p.offerPrice !== null) ? p.offerPrice : '';

                if (p.offerPeriodType === 'limited') {
                    if (offerLimitedChoice) offerLimitedChoice.classList.add('active');
                    if (offerLifetimeChoice) offerLifetimeChoice.classList.remove('active');
                    if (offerLimitedRadio) offerLimitedRadio.checked = true;
                    if (offerExpiryGroup) offerExpiryGroup.style.display = 'block';
                    if (fOfferExpiry) fOfferExpiry.value = formatDateTimeLocal(p.offerExpiryDate);
                } else {
                    if (offerLifetimeChoice) offerLifetimeChoice.classList.add('active');
                    if (offerLimitedChoice) offerLimitedChoice.classList.remove('active');
                    if (offerLifetimeRadio) offerLifetimeRadio.checked = true;
                    if (offerExpiryGroup) offerExpiryGroup.style.display = 'none';
                }
            }

            // Release State & Pre-Booking
            const statusVal = p.status || 'live';
            if (statusVal === 'upcoming' || p.isUpcoming) {
                setListingMode('upcoming');
                if (fAllowPrebooking) fAllowPrebooking.checked = Boolean(p.allowPreBooking ?? true);
                if (prebookingFieldsWrap) prebookingFieldsWrap.style.display = (fAllowPrebooking && fAllowPrebooking.checked) ? 'block' : 'none';
                if (fPrebookingDeposit) fPrebookingDeposit.value = p.preBookingDeposit ?? '';
                if (fExpectedDate) fExpectedDate.value = formatDateTimeLocal(p.expectedReleaseDate || p.scheduledDate);
                if (fPrebookingSlots) fPrebookingSlots.value = p.preBookingSlots ?? '';
                if (fPrebookingPerkNote) fPrebookingPerkNote.value = p.preBookingPerkNote || '';
                if (fPrebookingPerks) fPrebookingPerks.value = Array.isArray(p.preBookingPerks) ? p.preBookingPerks.join(', ') : (p.preBookingPerks || '');
            } else if (statusVal === 'scheduled') {
                setListingMode('scheduled');
                if (fScheduledDate) fScheduledDate.value = formatDateTimeLocal(p.scheduledDate);
            } else {
                setListingMode('live');
            }

            // Media & Images
            const imgs = p.images || (p.image ? [p.image] : []);
            if (fImage1) fImage1.value = imgs[0] || p.image || '';
            if (fImage2) fImage2.value = imgs[1] || '';
            if (fImage3) fImage3.value = imgs[2] || '';
            if (fImage4) fImage4.value = imgs[3] || '';
            if (fYoutube) fYoutube.value = p.youtube || '';

            // Cloud Archive / Download
            const hasShareModsLink = p.downloadSource === 'sharemods' || ((p.downloadLink || '').includes('sharemods.com'));
            if (p.downloadLink) {
                shareModsUploadedUrl = p.downloadLink;
                if (fDownload) fDownload.value = p.downloadLink;
                if (fDownloadSource) fDownloadSource.value = hasShareModsLink ? 'sharemods' : 'manual';
                if (manualDownloadInput) {
                    manualDownloadInput.value = p.downloadLink;
                    manualDownloadInput.dispatchEvent(new Event('input'));
                }

                if (hasShareModsLink) {
                    if (shareModsUploadContent) shareModsUploadContent.style.display = 'none';
                    if (shareModsUploadProgress) shareModsUploadProgress.style.display = 'none';
                    if (shareModsUploadSuccess) shareModsUploadSuccess.style.display = 'block';
                    if (shareModsSuccessFilename) shareModsSuccessFilename.textContent = `${p.name || 'Vehicle'} (Mod Archive Attached)`;
                    if (shareModsUploadZone) {
                        shareModsUploadZone.classList.add('has-file');
                        shareModsUploadZone.style.borderColor = 'var(--studio-emerald)';
                        shareModsUploadZone.style.background = 'var(--studio-emerald-light)';
                    }
                    if (inspectorFileText) inspectorFileText.textContent = 'Attached';
                } else {
                    if (inspectorFileText) inspectorFileText.textContent = 'Direct Link';
                }
            } else {
                resetShareModsUpload();
            }

            // Specs
            if (fVersion) fVersion.value = p.version || '';
            if (fBrand) fBrand.value = p.brand || '';
            if (fEngine) fEngine.value = p.engine || '';
            if (fPolygons) fPolygons.value = p.polygons || '';
            if (fSize) fSize.value = p.size || '';
            if (fInterior) fInterior.checked = Boolean(p.interior);
            if (fFeatured) fFeatured.checked = Boolean(p.featured);

            // Documentation
            if (fSummary) fSummary.value = p.summary || '';
            if (fDesc) fDesc.value = p.description || '';

            // Linked Variants
            if (studioVariantsList) {
                studioVariantsList.innerHTML = '';
                if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                    p.variants.forEach(v => {
                        const vId = (typeof v === 'object' && v !== null) ? v.id : v;
                        const vLabel = (typeof v === 'object' && v !== null) ? v.label : '';
                        if (vId) {
                            const row = createVariantRow(vId, vLabel);
                            studioVariantsList.appendChild(row);
                        }
                    });
                }
            }

            // Trigger thumbnail updates for all image slots
            [fImage1, fImage2, fImage3, fImage4].forEach(inp => {
                if (inp) inp.dispatchEvent(new Event('input', { bubbles: true }));
            });

            updateLivePreview();
        } catch (fetchErr) {
            console.error("Error fetching product for edit:", fetchErr);
            alert("Could not load product details: " + (fetchErr.message || fetchErr));
        }
    } else {
        // New Product Initial defaults
        editingProductId = null;
        try { sessionStorage.removeItem('editProductId'); } catch (_) {}
        if (pageTitle) pageTitle.textContent = 'Add New Product';
        if (breadcrumbAction) breadcrumbAction.textContent = 'Add Product';
        if (modePill) {
            modePill.textContent = 'Creating Mod';
            modePill.style.background = 'var(--studio-blue-light)';
            modePill.style.color = 'var(--studio-blue-text)';
            modePill.style.borderColor = 'var(--studio-blue-border)';
        }
        if (deleteBtn) deleteBtn.style.display = 'none';
        updateSaveButtonsText('Save Product');
        setListingMode('live');
        updateLivePreview();
    }

    // 3. Load catalog products in background to populate relations checklist
    loadCatalogProducts().then(() => {
        if (id) {
            getDoc(doc(db, "products", id)).then(snap => {
                if (snap.exists()) {
                    populateRelatedModsChecklist(snap.data().relatedMods || []);
                }
            }).catch(() => {});
        }
    });
};

// =====================================================
// Delete Handler
// =====================================================
if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
        if (!editingProductId) return;
        if (confirm("Are you sure you want to permanently delete this product? This action cannot be reversed.")) {
            try {
                await deleteDoc(doc(db, "products", editingProductId));
                try { sessionStorage.removeItem('editProductId'); } catch (_) {}
                alert("Product deleted successfully.");
                window.location.href = 'products.html';
            } catch (err) {
                console.error("Error deleting product:", err);
                alert("Failed to delete product.");
            }
        }
    });
}

// =====================================================
// Form Submission & Validation
// =====================================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameVal = fName.value.trim();
    if (!nameVal) {
        alert("Please enter a Product Title.");
        fName.focus();
        return;
    }

    const isFree = fPricingType.value === 'free';
    if (!isFree && (!fOriginalPrice.value || parseFloat(fOriginalPrice.value) < 0)) {
        alert("Please enter a valid Original Price.");
        fOriginalPrice.focus();
        return;
    }

    if (isFree && !fChannelLink.value.trim()) {
        alert("Please enter a YouTube Channel Link for Sub2Unlock.");
        fChannelLink.focus();
        return;
    }

    const selectedMode = document.querySelector('input[name="p-status"]:checked').value;
    const isUpcoming = selectedMode === 'upcoming';
    const isScheduled = selectedMode === 'scheduled';
    const isPrebooking = isUpcoming && Boolean(fAllowPrebooking && fAllowPrebooking.checked);

    if (isUpcoming && !fExpectedDate.value) {
        alert("Please set the Premiere / Release Date & Time for this upcoming mod.");
        fExpectedDate.focus();
        return;
    }

    if (isPrebooking) {
        const depositVal = parseFloat(fPrebookingDeposit.value);
        if (isNaN(depositVal) || depositVal <= 0) {
            alert("Please specify the Priority Reservation Deposit amount for this upcoming pre-booking.");
            fPrebookingDeposit.focus();
            return;
        }
    }

    if (isScheduled && !fScheduledDate.value) {
        alert("Please set a Target Launch Date & Time for scheduled release.");
        fScheduledDate.focus();
        return;
    }

    if (!fImage1.value.trim()) {
        alert("Please provide at least the primary Slot 1 Cover Image URL.");
        fImage1.focus();
        return;
    }

    if (shareModsCurrentXHR) {
        alert("The mod archive file is currently uploading. Please wait for upload to complete before saving.");
        return;
    }

    if (shareModsFileInput && shareModsFileInput.files && shareModsFileInput.files.length > 0 && !shareModsUploadedUrl && !fDownload.value.trim() && !(manualDownloadInput && manualDownloadInput.value.trim())) {
        alert("A file was selected but has not completed uploading yet. Please wait for upload to finish.");
        return;
    }

    const finalDownloadLink = shareModsUploadedUrl || fDownload.value.trim() || (manualDownloadInput ? manualDownloadInput.value.trim() : '');
    if (!finalDownloadLink) {
        if (!confirm("No mod archive or download link attached yet. Do you want to save this product anyway? Customers won't be able to download files until a link is added.")) {
            return;
        }
    }

    if (!fDesc.value.trim()) {
        alert("Please provide the Mod Documentation & Installation Guide.");
        fDesc.focus();
        return;
    }

    // Buttons state
    const setSaving = (saving) => {
        document.querySelectorAll('.btn-studio-save').forEach(b => {
            b.disabled = saving;
        });
        const txt = saving ? 'Saving Product...' : (editingProductId ? 'Update Product' : 'Save & Publish Product');
        updateSaveButtonsText(txt);
    };
    setSaving(true);

    // Prepare Related Mods
    const selectedRelated = Array.from(document.querySelectorAll('.related-mod-checkbox:checked')).map(cb => cb.value);

    // Prepare Variants
    const selectedVariants = [];
    const seenVariantIds = new Set();
    document.querySelectorAll('.variant-builder-row').forEach(row => {
        const selectEl = row.querySelector('.variant-product-select');
        const inputEl = row.querySelector('.variant-label-input');
        if (selectEl && selectEl.value && !seenVariantIds.has(selectEl.value)) {
            seenVariantIds.add(selectEl.value);
            selectedVariants.push({
                id: selectEl.value,
                label: inputEl ? inputEl.value.trim() : ''
            });
        }
    });

    // Pricing math
    const origPrice = isFree ? 0 : parseFloat(fOriginalPrice.value);
    const offerPriceRaw = fOfferPrice.value.trim();
    const hasOffer = !isFree && offerPriceRaw !== '' && !isNaN(parseFloat(offerPriceRaw));
    const offerPriceVal = hasOffer ? parseFloat(offerPriceRaw) : null;
    const selectedOfferPeriod = document.querySelector('input[name="p-offer-period"]:checked') ? document.querySelector('input[name="p-offer-period"]:checked').value : 'lifetime';
    const offerExpiryVal = (selectedOfferPeriod === 'limited' && fOfferExpiry.value) ? new Date(fOfferExpiry.value).toISOString() : null;

    let effectivePrice = origPrice;
    if (isFree) {
        effectivePrice = 0;
    } else if (hasOffer && offerPriceVal < origPrice) {
        if (selectedOfferPeriod === 'lifetime') {
            effectivePrice = offerPriceVal;
        } else if (selectedOfferPeriod === 'limited') {
            if (offerExpiryVal && new Date(offerExpiryVal) > new Date()) {
                effectivePrice = offerPriceVal;
            } else {
                effectivePrice = origPrice;
            }
        }
    }

    const scheduledDateValue = isScheduled ? new Date(fScheduledDate.value).toISOString() : (isUpcoming && fExpectedDate.value ? new Date(fExpectedDate.value).toISOString() : null);

    const productId = editingProductId || fId.value || generateId();
    const adminEmail = localStorage.getItem('adminEmail') || 'admin@enroute.in';

    const productPayload = {
        name: nameVal,
        pricingType: fPricingType.value,
        category: fCategory.value,
        variantName: fVariantName.value.trim(),
        variants: selectedVariants,
        price: effectivePrice,
        originalPrice: origPrice,
        offerPrice: offerPriceVal,
        offerPeriodType: selectedOfferPeriod,
        offerExpiryDate: offerExpiryVal,
        channelLink: isFree ? fChannelLink.value.trim() : '',
        images: [fImage1.value, fImage2.value, fImage3.value, fImage4.value].filter(url => url.trim() !== ''),
        image: fImage1.value.trim(),
        downloadLink: finalDownloadLink,
        downloadSource: (shareModsUploadedUrl || (finalDownloadLink.includes('sharemods.com'))) ? 'sharemods' : 'manual',
        version: fVersion.value.trim(),
        brand: fBrand.value.trim(),
        engine: fEngine.value.trim(),
        polygons: fPolygons.value,
        size: fSize.value.trim(),
        interior: fInterior.checked,
        featured: fFeatured.checked,
        status: selectedMode,
        scheduledDate: scheduledDateValue,

        // UPCOMING & PREMIERE TELEMETRY
        isUpcoming: isUpcoming,
        isPremiere: isUpcoming,
        allowPreBooking: isPrebooking,
        preBookingDeposit: isPrebooking ? (parseFloat(fPrebookingDeposit.value) || 0) : null,
        expectedReleaseDate: scheduledDateValue,
        preBookingSlots: (isPrebooking && fPrebookingSlots.value) ? parseInt(fPrebookingSlots.value, 10) : null,
        preBookingPerkNote: isPrebooking ? fPrebookingPerkNote.value.trim() : '',
        preBookingPerks: isPrebooking ? fPrebookingPerks.value.trim() : '',

        summary: fSummary.value.trim(),
        youtube: fYoutube.value.trim(),
        relatedMods: selectedRelated,
        description: fDesc.value.trim(),
        updatedAt: serverTimestamp()
    };

    if (!editingProductId) {
        productPayload.createdAt = serverTimestamp();
        productPayload.addedBy = adminEmail;
    } else {
        productPayload.addedBy = currentEditingAddedBy || adminEmail;
    }

    try {
        await setDoc(doc(db, "products", productId), productPayload, { merge: true });
        try { sessionStorage.removeItem('editProductId'); } catch (_) {}
        alert(editingProductId ? "Product updated successfully!" : "Product published successfully!");
        window.location.href = 'products.html';
    } catch (saveError) {
        console.error("Error saving product to Firestore:", saveError);
        alert("Failed to save product. Please check connection and permissions.");
    } finally {
        setSaving(false);
    }
});

// Initialize on page load
initProductEditor();
