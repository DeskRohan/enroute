import { db } from '../firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

// DOM
const tableBody = document.getElementById('products-table-body');
const addBtn = document.getElementById('add-product-btn');
const modal = document.getElementById('product-modal');
const closeBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-modal-btn');
const productForm = document.getElementById('product-form');
const modalTitle = document.getElementById('modal-title');
const saveBtn = document.getElementById('save-product-btn');

// Bohemian Multi-Step Wizard DOM
const wizardPrevBtn = document.getElementById('wizard-prev-btn');
const wizardNextBtn = document.getElementById('wizard-next-btn');
const wizardStepTrackerText = document.getElementById('wizard-step-tracker-text');
const wizardBody = document.getElementById('boho-wizard-body');

// Form Inputs
const fId = document.getElementById('product-id');
const fPricingType = document.getElementById('p-pricing-type');
const fName = document.getElementById('p-name');
const fCategory = document.getElementById('p-category');
const fOriginalPrice = document.getElementById('p-original-price');
const fOfferPrice = document.getElementById('p-offer-price');
const fOfferLifetimeCard = document.getElementById('offer-lifetime-card');
const fOfferLimitedCard = document.getElementById('offer-limited-card');
const fOfferLifetimeInput = document.getElementById('p-offer-lifetime');
const fOfferLimitedInput = document.getElementById('p-offer-limited');
const fOfferExpiryGroup = document.getElementById('offer-expiry-group');
const fOfferExpiryDate = document.getElementById('p-offer-expiry');
const fChannelLink = document.getElementById('p-channel-link');
const priceGroup = document.getElementById('price-group');
const channelLinkGroup = document.getElementById('channel-link-group');
const fImage1 = document.getElementById('p-image-1');
const fImage2 = document.getElementById('p-image-2');
const fImage3 = document.getElementById('p-image-3');
const fImage4 = document.getElementById('p-image-4');
const fDownload = document.getElementById('p-download');
const fDownloadSource = document.getElementById('p-download-source');

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
const fVersion = document.getElementById('p-version');
const fBrand = document.getElementById('p-brand');
const fEngine = document.getElementById('p-engine');
const fPolygons = document.getElementById('p-polygons');
const fSize = document.getElementById('p-size');
const fInterior = document.getElementById('p-interior');
const fFeatured = document.getElementById('p-featured');
const fSummary = document.getElementById('p-summary');
const fYoutube = document.getElementById('p-youtube');
const fDesc = document.getElementById('p-description');
const relatedContainer = document.getElementById('p-related-container');
const fVariantName = document.getElementById('p-variant-name');
const variantsList = document.getElementById('p-variants-list');
const addVariantRowBtn = document.getElementById('add-variant-row-btn');

// Publishing Status controls
const fStatusLiveCard = document.getElementById('status-live-card');
const fStatusScheduledCard = document.getElementById('status-scheduled-card');
const fStatusLiveInput = document.getElementById('p-status-live');
const fStatusScheduledInput = document.getElementById('p-status-scheduled');
const fScheduleDatetimeGroup = document.getElementById('schedule-datetime-group');
const fScheduledDate = document.getElementById('p-scheduled-date');

let allProducts = [];
let currentEditingId = null;
let currentEditingAddedBy = null; // Preserve original uploader on edit
let shareModsUploadedUrl = ''; // Holds the ShareMods download URL after successful upload
let shareModsCurrentXHR = null; // Reference to active upload XHR for cancellation

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price || 0);
};

const formatDateTimeLocal = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
};

// Google Drive Image URL Converter (Reliable Google UserContent CDN & direct links)
const getImageUrl = (url) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';
    }

    const cleanUrl = url.trim();

    // Already Google User Content CDN
    if (cleanUrl.includes('googleusercontent.com/d/')) {
        return cleanUrl;
    }

    let fileId = null;
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
            fileId = match[1];
            break;
        }
    }

    if (fileId) {
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    }

    return cleanUrl;
};

// Generate random ID for new products
const generateId = () => Math.random().toString(36).substring(2, 15);

// Variant Row Builders
const getOtherProductsOptions = (selectedId = '') => {
    let options = '';
    allProducts.forEach(p => {
        if (p.id !== currentEditingId) {
            const isSel = (p.id === selectedId) ? 'selected' : '';
            const priceText = (p.price === 0 || p.pricingType === 'free') ? 'FREE' : `₹${p.price}`;
            options += `<option value="${p.id}" ${isSel}>${p.name} (${priceText})</option>`;
        }
    });
    return options;
};

const createVariantRow = (selectedId = '', label = '') => {
    const row = document.createElement('div');
    row.className = 'variant-builder-row';
    row.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.75rem; align-items: center; background: #f8fafc; border: 1px solid var(--admin-border); border-radius: var(--radius-lg); padding: 0.65rem 0.85rem;';
    
    const optionsHtml = getOtherProductsOptions(selectedId);
    
    row.innerHTML = `
        <div>
            <label style="font-size: 0.72rem; font-weight: 700; color: var(--admin-text-secondary); text-transform: uppercase; margin-bottom: 3px; display: block;">Select Published Product</label>
            <select class="form-control variant-product-select" style="font-size: 0.85rem; padding: 0.45rem 0.65rem;" required>
                <option value="">-- Choose Published Product --</option>
                ${optionsHtml}
            </select>
        </div>
        <div>
            <label style="font-size: 0.72rem; font-weight: 700; color: var(--admin-text-secondary); text-transform: uppercase; margin-bottom: 3px; display: block;">Variant / Edition Badge</label>
            <input type="text" class="form-control variant-label-input" value="${label ? label.replace(/"/g, '&quot;') : ''}" placeholder="e.g., 6x2 Multi-Axle, Sleeper AC" style="font-size: 0.85rem; padding: 0.45rem 0.65rem;">
        </div>
        <div style="padding-top: 1.15rem;">
            <button type="button" class="btn btn-outline remove-variant-btn" style="padding: 0.45rem 0.6rem; color: var(--admin-danger); border-color: var(--admin-danger); border-radius: var(--radius-md);" title="Remove Variant">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
    `;

    // Auto-fill label if empty when a product is selected
    const selectEl = row.querySelector('.variant-product-select');
    const inputEl = row.querySelector('.variant-label-input');
    selectEl.addEventListener('change', () => {
        if (!inputEl.value.trim() && selectEl.value) {
            const chosenProd = allProducts.find(p => p.id === selectEl.value);
            if (chosenProd) {
                inputEl.value = chosenProd.variantName || chosenProd.name || '';
            }
        }
    });

    row.querySelector('.remove-variant-btn').addEventListener('click', () => {
        row.remove();
        updateVariantsEmptyState();
    });

    return row;
};

const updateVariantsEmptyState = () => {
    if (!variantsList) return;
    const existingRows = variantsList.querySelectorAll('.variant-builder-row');
    const emptyPlaceholder = document.getElementById('variants-empty-placeholder');
    if (existingRows.length === 0) {
        if (!emptyPlaceholder) {
            variantsList.innerHTML = `<div id="variants-empty-placeholder" style="text-align: center; padding: 1.25rem; background: #f8fafc; border-radius: var(--radius-lg); border: 1px dashed var(--admin-border); color: var(--admin-text-muted); font-size: 0.85rem;">No variants added yet. Click <strong>"+ Add Variant"</strong> to select from published products.</div>`;
        }
    } else {
        if (emptyPlaceholder) emptyPlaceholder.remove();
    }
};

const loadProducts = async () => {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center">Loading...</td></tr>`;
    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const adminEmail = localStorage.getItem('adminEmail');
        if (adminEmail !== 'admin@enroute.in') {
            allProducts = allProducts.filter(p => p.addedBy === adminEmail);
        }
        renderTable();
    } catch (error) {
        console.error("Error loading products:", error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load products</td></tr>`;
    }
};

const renderTable = () => {
    if (allProducts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary">No products found. Add one!</td></tr>`;
        return;
    }

    let html = '';
    const adminEmail = localStorage.getItem('adminEmail');
    const isSuperAdmin = adminEmail === 'admin@enroute.in';

    allProducts.forEach(product => {
        let actionsHtml = `
            <button class="btn btn-sm btn-outline edit-btn" data-id="${product.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Edit</button>
            <button class="btn btn-sm btn-outline delete-btn" data-id="${product.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--color-danger); border-color: var(--color-danger); margin-left: 0.5rem;">Delete</button>
        `;

        let statusHtml = '';
        if (product.status === 'scheduled') {
            const isFuture = product.scheduledDate && new Date(product.scheduledDate) > new Date();
            if (isFuture) {
                const formattedTime = new Date(product.scheduledDate).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                });
                statusHtml = `<span class="badge badge-primary" title="Scheduled to go live on ${formattedTime}">Scheduled<br><span style="font-size:0.65rem;font-weight:400;opacity:0.9;">${formattedTime}</span></span>`;
            } else {
                statusHtml = '<span class="badge badge-success">Live (Sched)</span>';
            }
        } else {
            statusHtml = '<span class="badge badge-success">Live</span>';
        }

        // Pricing column format
        let priceHtml = '';
        const isFree = (product.price === 0 || product.pricingType === 'free');
        if (isFree) {
            priceHtml = '<span class="badge badge-success" style="font-size: 0.75rem;">FREE</span>';
        } else {
            const original = product.originalPrice ?? product.price;
            const offer = product.offerPrice;
            const hasOffer = (offer !== undefined && offer !== null && offer !== '' && Number(offer) < Number(original));
            const isLimited = product.offerPeriodType === 'limited';
            const isExpired = isLimited && product.offerExpiryDate && new Date(product.offerExpiryDate) <= new Date();

            if (hasOffer && !isExpired) {
                if (isLimited) {
                    const expFormatted = new Date(product.offerExpiryDate).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short'
                    });
                    priceHtml = `
                        <div>
                            <span style="font-weight: 700; color: var(--admin-primary);">${formatPrice(offer)}</span>
                            <s class="text-secondary" style="font-size: 0.75rem; margin-left: 4px;">${formatPrice(original)}</s>
                            <br><span class="badge badge-warning" style="font-size: 0.65rem; padding: 2px 6px; margin-top: 2px; display: inline-block;">Till ${expFormatted}</span>
                        </div>
                    `;
                } else {
                    priceHtml = `
                        <div>
                            <span style="font-weight: 700; color: var(--admin-primary);">${formatPrice(offer)}</span>
                            <s class="text-secondary" style="font-size: 0.75rem; margin-left: 4px;">${formatPrice(original)}</s>
                            <br><span class="badge badge-primary" style="font-size: 0.65rem; padding: 2px 6px; margin-top: 2px; display: inline-block;">Lifetime Offer</span>
                        </div>
                    `;
                }
            } else if (hasOffer && isExpired) {
                priceHtml = `
                    <div>
                        <span style="font-weight: 700;">${formatPrice(original)}</span>
                        <br><span class="badge badge-secondary" style="font-size: 0.65rem; padding: 2px 6px; margin-top: 2px; display: inline-block; color: var(--admin-text-muted);">Offer Expired</span>
                    </div>
                `;
            } else {
                priceHtml = `<span style="font-weight: 600;">${formatPrice(original)}</span>`;
            }
        }

        html += `
            <tr>
                <td><img src="${getImageUrl(product.image)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                <td style="font-weight: 500;">${product.name}</td>
                <td>${(product.category === 'livery' ? 'Vehicle Livery/Skin' : 'Vehicle Mod')}</td>
                <td>${priceHtml}</td>
                <td>${product.featured ? '<span style="color:var(--color-accent)">Yes</span>' : '<span class="text-secondary">No</span>'}</td>
                <td>${statusHtml}</td>
                <td>
                    ${actionsHtml}
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;

    // Attach listeners
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEdit));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
};

// =====================================================
// Bohemian Multi-Step Product Wizard Controller
// =====================================================
let currentWizardStep = 1;
const TOTAL_WIZARD_STEPS = 4;
const WIZARD_STEP_TITLES = {
    1: 'Identity & Pricing',
    2: 'Media & Cloud',
    3: 'Specs & Variants',
    4: 'Story & Launch'
};

function getWizardPanes() {
    return document.querySelectorAll('.boho-step-pane');
}

function getWizardStepItems() {
    return document.querySelectorAll('.boho-step-item');
}

function getWizardStepDividers() {
    return document.querySelectorAll('.boho-step-divider');
}

function validateWizardStep(step) {
    if (step === 1) {
        if (!fName.value.trim()) {
            alert('Please enter a Product Name in Step 1.');
            fName.focus();
            return false;
        }
        if (fPricingType.value === 'free') {
            if (!fChannelLink.value.trim()) {
                alert('Please enter a YouTube Channel / Download Link for this free mod in Step 1.');
                fChannelLink.focus();
                return false;
            }
        } else {
            const price = parseFloat(fOriginalPrice.value);
            if (isNaN(price) || price < 0) {
                alert('Please enter a valid Original Price in Step 1.');
                fOriginalPrice.focus();
                return false;
            }
            if (fOfferLimitedInput && fOfferLimitedInput.checked && !fOfferExpiryDate.value) {
                alert('Please specify an Expiry Date for the limited time offer in Step 1.');
                fOfferExpiryDate.focus();
                return false;
            }
        }
    } else if (step === 2) {
        const downloadLink = (shareModsUploadedUrl || fDownload.value).trim();
        if (!downloadLink) {
            alert('Please upload your mod file before proceeding from Step 2.');
            if (shareModsUploadZone) {
                shareModsUploadZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
        }
        if (!fImage1.value.trim()) {
            alert('Please provide at least the Primary Cover Image URL (Slot 1) in Step 2.');
            fImage1.focus();
            return false;
        }
    } else if (step === 3) {
        // Step 3 (Specs & Variants) is optional
        return true;
    } else if (step === 4) {
        if (!fDesc.value.trim()) {
            alert('Please enter the Mod Documentation & Installation Guide in Step 4.');
            fDesc.focus();
            return false;
        }
    }
    return true;
}

function goToWizardStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > TOTAL_WIZARD_STEPS) return;
    currentWizardStep = stepNumber;

    const panes = getWizardPanes();
    const items = getWizardStepItems();
    const dividers = getWizardStepDividers();

    // 1. Show matching pane
    panes.forEach(pane => {
        const paneStep = parseInt(pane.getAttribute('data-step'), 10);
        if (paneStep === currentWizardStep) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    // 2. Update Stepper Header
    items.forEach(item => {
        const itemStep = parseInt(item.getAttribute('data-step'), 10);
        item.classList.remove('active', 'completed');
        if (itemStep === currentWizardStep) {
            item.classList.add('active');
        } else if (itemStep < currentWizardStep) {
            item.classList.add('completed');
        }
    });

    dividers.forEach(div => {
        const afterStep = parseInt(div.getAttribute('data-after'), 10);
        if (afterStep < currentWizardStep) {
            div.classList.add('completed');
        } else {
            div.classList.remove('completed');
        }
    });

    // 3. Update Footer Buttons
    if (wizardPrevBtn) {
        wizardPrevBtn.style.display = (currentWizardStep > 1) ? 'inline-flex' : 'none';
    }
    if (wizardNextBtn) {
        wizardNextBtn.style.display = (currentWizardStep < TOTAL_WIZARD_STEPS) ? 'inline-flex' : 'none';
    }
    if (saveBtn) {
        saveBtn.style.display = (currentWizardStep === TOTAL_WIZARD_STEPS) ? 'inline-flex' : 'none';
    }

    // 4. Update Tracker Pill
    if (wizardStepTrackerText) {
        wizardStepTrackerText.textContent = `Step ${currentWizardStep} of ${TOTAL_WIZARD_STEPS} • ${WIZARD_STEP_TITLES[currentWizardStep] || ''}`;
    }

    // 5. Scroll wizard body to top
    if (wizardBody) {
        wizardBody.scrollTop = 0;
    }
}

// Wizard navigation button listeners
if (wizardNextBtn) {
    wizardNextBtn.addEventListener('click', () => {
        if (!validateWizardStep(currentWizardStep)) return;
        goToWizardStep(currentWizardStep + 1);
    });
}

if (wizardPrevBtn) {
    wizardPrevBtn.addEventListener('click', () => {
        goToWizardStep(currentWizardStep - 1);
    });
}

// Allow clicking completed or immediate steps in header stepper
document.addEventListener('click', (e) => {
    const item = e.target.closest('.boho-step-item');
    if (!item) return;
    const targetStep = parseInt(item.getAttribute('data-step'), 10);
    if (isNaN(targetStep) || targetStep === currentWizardStep) return;

    if (targetStep > currentWizardStep) {
        // Validate intermediate steps before jumping forward
        for (let s = currentWizardStep; s < targetStep; s++) {
            if (!validateWizardStep(s)) {
                goToWizardStep(s);
                return;
            }
        }
    }
    goToWizardStep(targetStep);
});

const openModal = (isEdit = false, currentId = null) => {
    modalTitle.textContent = isEdit ? 'Edit Product' : 'Add Product';
    currentEditingId = currentId;

    // Populate Related Mods checklist
    let relHtml = '';
    allProducts.forEach(p => {
        if (p.id !== currentId) {
            relHtml += `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" class="related-mod-checkbox" value="${p.id}" id="rel-${p.id}">
                    <label for="rel-${p.id}" style="font-size: 0.85rem; cursor: pointer;">${p.name}</label>
                </div>
            `;
        }
    });
    relatedContainer.innerHTML = relHtml;

    if (!isEdit) {
        variantsList.innerHTML = '';
        updateVariantsEmptyState();
        resetShareModsUpload();
    }

    goToWizardStep(1);
    modal.classList.add('active');
};

const closeModal = () => {
    modal.classList.remove('active');
    productForm.reset();
    fId.value = '';
    fOriginalPrice.value = '';
    fOfferPrice.value = '';
    fVariantName.value = '';
    variantsList.innerHTML = '';
    currentEditingId = null;
    currentEditingAddedBy = null;
    fImage1.value = '';
    fImage2.value = '';
    fImage3.value = '';
    fImage4.value = '';

    // Reset Offer Period UI
    fOfferLifetimeCard.classList.add('active');
    fOfferLimitedCard.classList.remove('active');
    fOfferLifetimeInput.checked = true;
    fOfferExpiryGroup.style.display = 'none';
    fOfferExpiryDate.required = false;
    fOfferExpiryDate.value = '';

    // Reset Publishing Status UI
    fStatusLiveCard.classList.add('active');
    fStatusScheduledCard.classList.remove('active');
    fStatusLiveInput.checked = true;
    fScheduleDatetimeGroup.style.display = 'none';
    fScheduledDate.required = false;
    fScheduledDate.value = '';

    // Reset ShareMods Upload UI
    resetShareModsUpload();
    goToWizardStep(1);
};

// Handlers
addBtn.addEventListener('click', () => {
    openModal(false);
});

closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

if (addVariantRowBtn) {
    addVariantRowBtn.addEventListener('click', () => {
        const emptyPlaceholder = document.getElementById('variants-empty-placeholder');
        if (emptyPlaceholder) emptyPlaceholder.remove();
        const newRow = createVariantRow();
        variantsList.appendChild(newRow);
    });
}

// Offer Period selection logic
fOfferLifetimeCard.addEventListener('click', () => {
    fOfferLifetimeCard.classList.add('active');
    fOfferLimitedCard.classList.remove('active');
    fOfferLifetimeInput.checked = true;
    fOfferExpiryGroup.style.display = 'none';
    fOfferExpiryDate.required = false;
});

fOfferLimitedCard.addEventListener('click', () => {
    fOfferLimitedCard.classList.add('active');
    fOfferLifetimeCard.classList.remove('active');
    fOfferLimitedInput.checked = true;
    fOfferExpiryGroup.style.display = 'block';
    fOfferExpiryDate.required = true;
});

// Publishing Status card selection logic
fStatusLiveCard.addEventListener('click', () => {
    fStatusLiveCard.classList.add('active');
    fStatusScheduledCard.classList.remove('active');
    fStatusLiveInput.checked = true;
    fScheduleDatetimeGroup.style.display = 'none';
    fScheduledDate.required = false;
});

fStatusScheduledCard.addEventListener('click', () => {
    fStatusScheduledCard.classList.add('active');
    fStatusLiveCard.classList.remove('active');
    fStatusScheduledInput.checked = true;
    fScheduleDatetimeGroup.style.display = 'block';
    fScheduledDate.required = true;
});

fPricingType.addEventListener('change', (e) => {
    if (e.target.value === 'free') {
        priceGroup.style.display = 'none';
        fOriginalPrice.required = false;
        fOriginalPrice.value = 0;
        fOfferPrice.value = '';
        channelLinkGroup.style.display = 'block';
        fChannelLink.required = true;
    } else {
        priceGroup.style.display = 'block';
        fOriginalPrice.required = true;
        channelLinkGroup.style.display = 'none';
        fChannelLink.required = false;
    }
});

const handleEdit = (e) => {
    const id = e.target.getAttribute('data-id');
    const product = allProducts.find(p => p.id === id);
    if (product) {
        fId.value = product.id;
        currentEditingAddedBy = product.addedBy || null; // Preserve original uploader
        fName.value = product.name;
        fCategory.value = product.category;
        fVariantName.value = product.variantName || '';
        
        fPricingType.value = product.pricingType || (product.price === 0 ? 'free' : 'paid');
        if (fPricingType.value === 'free') {
            priceGroup.style.display = 'none';
            fOriginalPrice.required = false;
            fOriginalPrice.value = 0;
            fOfferPrice.value = '';
            channelLinkGroup.style.display = 'block';
            fChannelLink.required = true;
            fChannelLink.value = product.channelLink || '';
        } else {
            priceGroup.style.display = 'block';
            fOriginalPrice.required = true;
            fOriginalPrice.value = product.originalPrice ?? product.price ?? '';
            fOfferPrice.value = (product.offerPrice !== undefined && product.offerPrice !== null) ? product.offerPrice : '';
            channelLinkGroup.style.display = 'none';
            fChannelLink.required = false;
            fChannelLink.value = '';

            // Handle offer period type
            const offerPeriod = product.offerPeriodType || 'lifetime';
            if (offerPeriod === 'limited') {
                fOfferLimitedCard.classList.add('active');
                fOfferLifetimeCard.classList.remove('active');
                fOfferLimitedInput.checked = true;
                fOfferExpiryGroup.style.display = 'block';
                fOfferExpiryDate.required = true;
                fOfferExpiryDate.value = formatDateTimeLocal(product.offerExpiryDate);
            } else {
                fOfferLifetimeCard.classList.add('active');
                fOfferLimitedCard.classList.remove('active');
                fOfferLifetimeInput.checked = true;
                fOfferExpiryGroup.style.display = 'none';
                fOfferExpiryDate.required = false;
                fOfferExpiryDate.value = '';
            }
        }

        const imgs = product.images || [product.image];
        fImage1.value = imgs[0] || '';
        fImage2.value = imgs[1] || '';
        fImage3.value = imgs[2] || '';
        fImage4.value = imgs[3] || '';

        fDownload.value = product.downloadLink || '';
        fVersion.value = product.version || '';
        fBrand.value = product.brand || '';
        fEngine.value = product.engine || '';
        fPolygons.value = product.polygons || '';
        fSize.value = product.size || '';
        fInterior.checked = product.interior || false;
        fFeatured.checked = product.featured || false;
        fSummary.value = product.summary || '';
        fYoutube.value = product.youtube || '';
        fDesc.value = product.description;

        // Populate status fields
        if (product.status === 'scheduled') {
            fStatusScheduledCard.classList.add('active');
            fStatusLiveCard.classList.remove('active');
            fStatusScheduledInput.checked = true;
            fScheduleDatetimeGroup.style.display = 'block';
            fScheduledDate.required = true;
            fScheduledDate.value = formatDateTimeLocal(product.scheduledDate);
        } else {
            fStatusLiveCard.classList.add('active');
            fStatusScheduledCard.classList.remove('active');
            fStatusLiveInput.checked = true;
            fScheduleDatetimeGroup.style.display = 'none';
            fScheduledDate.required = false;
            fScheduledDate.value = '';
        }

        openModal(true, id);

        // Check related mods
        if (product.relatedMods && Array.isArray(product.relatedMods)) {
            product.relatedMods.forEach(relId => {
                const cb = document.getElementById(`rel-${relId}`);
                if (cb) cb.checked = true;
            });
        }

        // Check and populate linked product variants
        variantsList.innerHTML = '';
        if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
            product.variants.forEach(v => {
                const vId = (typeof v === 'object' && v !== null) ? v.id : v;
                const vLabel = (typeof v === 'object' && v !== null) ? v.label : '';
                if (vId) {
                    const row = createVariantRow(vId, vLabel);
                    variantsList.appendChild(row);
                }
            });
        }
        updateVariantsEmptyState();

        // Setup ShareMods upload state for editing
        const hasShareModsLink = product.downloadSource === 'sharemods' || 
            (product.downloadLink && product.downloadLink.includes('sharemods.com'));

        if (hasShareModsLink) {
            shareModsUploadedUrl = product.downloadLink;
            if (fDownloadSource) fDownloadSource.value = 'sharemods';
            if (shareModsUploadContent) shareModsUploadContent.style.display = 'none';
            if (shareModsUploadProgress) shareModsUploadProgress.style.display = 'none';
            if (shareModsUploadSuccess) shareModsUploadSuccess.style.display = 'block';
            
            let displayFilename = product.name ? `${product.name} (Mod Archive)` : 'Uploaded Mod File';
            try {
                const parts = product.downloadLink.split('/');
                const lastPart = parts[parts.length - 1];
                if (lastPart && lastPart.endsWith('.html')) {
                    displayFilename = decodeURIComponent(lastPart.replace('.html', ''));
                } else if (lastPart) {
                    displayFilename = decodeURIComponent(lastPart);
                }
            } catch (_) {}
            
            if (shareModsSuccessFilename) shareModsSuccessFilename.textContent = displayFilename;
            if (shareModsUploadZone) {
                shareModsUploadZone.classList.add('has-file');
                shareModsUploadZone.style.borderColor = 'var(--boho-sage)';
                shareModsUploadZone.style.background = 'var(--boho-sage-light)';
            }
        } else {
            resetShareModsUpload();
        }
    }
};

const handleDelete = async (e) => {
    const id = e.target.getAttribute('data-id');
    if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        try {
            await deleteDoc(doc(db, "products", id));
            allProducts = allProducts.filter(p => p.id !== id);
            renderTable();
        } catch (error) {
            console.error("Error deleting product:", error);
            alert("Failed to delete product.");
        }
    }
};

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate all wizard steps thoroughly before saving
    for (let s = 1; s <= TOTAL_WIZARD_STEPS; s++) {
        if (!validateWizardStep(s)) {
            goToWizardStep(s);
            return;
        }
    }

    const finalDownloadLink = shareModsUploadedUrl || fDownload.value.trim();
    if (!finalDownloadLink) {
        alert('Please upload your mod file in Step 2.');
        goToWizardStep(2);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>Saving...</span>`;

    const productId = fId.value || generateId();
    const selectedRelated = Array.from(document.querySelectorAll('.related-mod-checkbox:checked')).map(cb => cb.value);

    // Extract selected variants from dynamic builder rows
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

    const selectedStatus = document.querySelector('input[name="p-status"]:checked').value;
    const scheduledDateValue = selectedStatus === 'scheduled' ? new Date(fScheduledDate.value).toISOString() : null;

    const isFreePricing = fPricingType.value === 'free';
    const origPrice = isFreePricing ? 0 : parseFloat(fOriginalPrice.value);
    const offerPriceRaw = fOfferPrice.value.trim();
    const hasOffer = !isFreePricing && offerPriceRaw !== '' && !isNaN(parseFloat(offerPriceRaw));
    const offerPriceVal = hasOffer ? parseFloat(offerPriceRaw) : null;
    
    const selectedOfferPeriod = document.querySelector('input[name="p-offer-period"]:checked') ? document.querySelector('input[name="p-offer-period"]:checked').value : 'lifetime';
    const offerExpiryVal = (selectedOfferPeriod === 'limited' && fOfferExpiryDate.value) ? new Date(fOfferExpiryDate.value).toISOString() : null;

    // Determine current effective price
    let effectivePrice = origPrice;
    if (isFreePricing) {
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

    const productData = {
        name: fName.value,
        pricingType: fPricingType.value,
        category: fCategory.value,
        variantName: fVariantName.value.trim(),
        variants: selectedVariants,
        price: effectivePrice,
        originalPrice: origPrice,
        offerPrice: offerPriceVal,
        offerPeriodType: selectedOfferPeriod,
        offerExpiryDate: offerExpiryVal,
        channelLink: isFreePricing ? fChannelLink.value : '',
        images: [fImage1.value, fImage2.value, fImage3.value, fImage4.value].filter(url => url.trim() !== ''),
        image: fImage1.value, // Keep primary image for backwards compatibility
        downloadLink: (shareModsUploadedUrl || fDownload.value).trim(),
        downloadSource: (shareModsUploadedUrl || ((fDownload.value || '').includes('sharemods.com'))) ? 'sharemods' : 'manual',
        version: fVersion.value,
        brand: fBrand.value,
        engine: fEngine.value,
        polygons: fPolygons.value,
        size: fSize.value,
        interior: fInterior.checked,
        featured: fFeatured.checked,
        status: selectedStatus,
        scheduledDate: scheduledDateValue,
        summary: fSummary.value,
        youtube: fYoutube.value,
        relatedMods: selectedRelated,
        description: fDesc.value,
        updatedAt: serverTimestamp()
    };

    const adminEmail = localStorage.getItem('adminEmail');
    if (!fId.value) {
        // New product: set creation timestamp and uploader
        productData.createdAt = serverTimestamp();
        productData.addedBy = adminEmail || 'unknown';
    } else {
        // Editing existing product: always preserve original uploader
        // This ensures that even when the main admin edits a product,
        // the product stays attributed to the original uploader
        productData.addedBy = currentEditingAddedBy || adminEmail || 'unknown';
    }

    try {
        await setDoc(doc(db, "products", productId), productData, { merge: true });
        closeModal();
        loadProducts(); // Reload to get updated timestamps
    } catch (error) {
        console.error("Error saving product:", error);
        alert("Failed to save product.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Save Product</span>`;
    }
});

// =====================================================
// Transfer Mods Feature (Multi-Step Wizard)
// =====================================================
const transferModal = document.getElementById('transfer-modal');
const transferBtn = document.getElementById('transfer-mods-btn');
const closeTransferBtn = document.getElementById('close-transfer-modal-btn');
const transferCancelBtn = document.getElementById('transfer-cancel-btn');
const transferNext1Btn = document.getElementById('transfer-next-1-btn');
const transferNext2Btn = document.getElementById('transfer-next-2-btn');
const transferBack2Btn = document.getElementById('transfer-back-2-btn');
const transferBack3Btn = document.getElementById('transfer-back-3-btn');
const transferConfirmBtn = document.getElementById('transfer-confirm-btn');
const transferProductsList = document.getElementById('transfer-products-list');
const transferAdminsList = document.getElementById('transfer-admins-list');
const transferSummary = document.getElementById('transfer-summary');
const transferSelectedCount = document.getElementById('transfer-selected-count');
const transferModalTitle = document.getElementById('transfer-modal-title');
const transferModalDesc = document.getElementById('transfer-modal-desc');

let transferSelectedProducts = [];
let transferSelectedAdmin = null;
let transferAvailableAdmins = [];

const openTransferModal = async () => {
    // Reset state
    transferSelectedProducts = [];
    transferSelectedAdmin = null;
    showTransferStep(1);

    // Load products for current admin
    const adminEmail = localStorage.getItem('adminEmail');
    const isSuperAdmin = adminEmail === 'admin@enroute.in';

    // Get products belonging to this admin (or all for super admin)
    let transferableProducts = [];
    if (isSuperAdmin) {
        transferableProducts = [...allProducts];
    } else {
        transferableProducts = allProducts.filter(p => p.addedBy === adminEmail);
    }

    if (transferableProducts.length === 0) {
        transferProductsList.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: #94a3b8;">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.75rem; opacity: 0.5;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                <p style="font-weight: 600; margin: 0;">No products available to transfer.</p>
            </div>
        `;
        transferNext1Btn.disabled = true;
    } else {
        let html = '';
        transferableProducts.forEach(p => {
            const isFree = (p.price === 0 || p.pricingType === 'free');
            const priceText = isFree ? 'FREE' : `₹${p.originalPrice ?? p.price ?? 0}`;
            const imgUrl = getImageUrl(p.image || (p.images && p.images[0]) || '');
            const uploaderLabel = p.addedBy && p.addedBy !== adminEmail ? `<span style="font-size:0.7rem; color:#f59e0b; font-weight:600;">by ${p.addedBy}</span>` : '';
            html += `
                <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 0.85rem; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all 0.15s ease;" onmouseenter="this.style.borderColor='#8b5cf6'; this.style.background='rgba(139,92,246,0.04)'" onmouseleave="if(!this.querySelector('input').checked){this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc';}">
                    <input type="checkbox" class="transfer-product-cb" value="${p.id}" style="width: 17px; height: 17px; accent-color: #8b5cf6; cursor: pointer; flex-shrink: 0;">
                    <img src="${imgUrl}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800';" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; flex-shrink: 0;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; font-size: 0.85rem; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1px;">
                            <span style="font-size: 0.75rem; color: #64748b;">${p.category === 'livery' ? 'Livery' : 'Mod'}</span>
                            <span style="font-size: 0.75rem; font-weight: 700; color: ${isFree ? '#059669' : '#8b5cf6'};">${priceText}</span>
                            ${uploaderLabel}
                        </div>
                    </div>
                </label>
            `;
        });
        transferProductsList.innerHTML = html;
    }

    updateTransferCount();
    transferModal.classList.add('active');

    // Attach checkbox listeners
    document.querySelectorAll('.transfer-product-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            const label = cb.closest('label');
            if (cb.checked) {
                label.style.borderColor = '#8b5cf6';
                label.style.background = 'rgba(139,92,246,0.04)';
            } else {
                label.style.borderColor = '#e2e8f0';
                label.style.background = '#f8fafc';
            }
            updateTransferCount();
        });
    });
};

const updateTransferCount = () => {
    const checked = document.querySelectorAll('.transfer-product-cb:checked');
    transferSelectedCount.textContent = `${checked.length} selected`;
    transferNext1Btn.disabled = checked.length === 0;
};

const closeTransferModal = () => {
    transferModal.classList.remove('active');
    transferSelectedProducts = [];
    transferSelectedAdmin = null;
};

const showTransferStep = (step) => {
    document.getElementById('transfer-step-1').style.display = step === 1 ? 'block' : 'none';
    document.getElementById('transfer-step-2').style.display = step === 2 ? 'block' : 'none';
    document.getElementById('transfer-step-3').style.display = step === 3 ? 'block' : 'none';

    // Update step indicator visuals
    const step2Circle = document.getElementById('transfer-step-2-circle');
    const step2Label = document.getElementById('transfer-step-2-label');
    const step3Circle = document.getElementById('transfer-step-3-circle');
    const step3Label = document.getElementById('transfer-step-3-label');
    const line12 = document.getElementById('transfer-line-1-2');
    const line23 = document.getElementById('transfer-line-2-3');

    // Step 2
    if (step >= 2) {
        step2Circle.style.background = '#8b5cf6'; step2Circle.style.color = '#fff';
        step2Label.style.color = '#8b5cf6';
        line12.style.background = '#8b5cf6';
    } else {
        step2Circle.style.background = '#e2e8f0'; step2Circle.style.color = '#94a3b8';
        step2Label.style.color = '#94a3b8';
        line12.style.background = '#e2e8f0';
    }

    // Step 3
    if (step >= 3) {
        step3Circle.style.background = '#8b5cf6'; step3Circle.style.color = '#fff';
        step3Label.style.color = '#8b5cf6';
        line23.style.background = '#8b5cf6';
    } else {
        step3Circle.style.background = '#e2e8f0'; step3Circle.style.color = '#94a3b8';
        step3Label.style.color = '#94a3b8';
        line23.style.background = '#e2e8f0';
    }

    // Update title/desc
    if (step === 1) {
        transferModalTitle.textContent = 'Transfer Mods';
        transferModalDesc.textContent = 'Select the products you want to transfer to another admin.';
    } else if (step === 2) {
        transferModalTitle.textContent = 'Select Target Admin';
        transferModalDesc.textContent = 'Choose the admin who will receive ownership of the selected mods.';
    } else if (step === 3) {
        transferModalTitle.textContent = 'Confirm Transfer';
        transferModalDesc.textContent = 'Review the transfer details below before confirming.';
    }
};

const loadAdminsForTransfer = async () => {
    const adminEmail = localStorage.getItem('adminEmail');
    transferAdminsList.innerHTML = `<div style="text-align:center; padding:2rem; color:#94a3b8;">Loading admins...</div>`;

    try {
        const q = query(collection(db, "users"), where("role", "==", "admin"));
        const snapshot = await getDocs(q);
        transferAvailableAdmins = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Exclude current admin from the list
            if (data.email && data.email !== adminEmail) {
                transferAvailableAdmins.push({
                    id: docSnap.id,
                    email: data.email,
                    name: data.name || data.email.split('@')[0],
                    isVerified: data.isVerified || false
                });
            }
        });

        if (transferAvailableAdmins.length === 0) {
            transferAdminsList.innerHTML = `
                <div style="text-align: center; padding: 2.5rem 1rem; color: #94a3b8;">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.75rem; opacity: 0.5;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                    <p style="font-weight: 600; margin: 0;">No other admins found to transfer to.</p>
                </div>
            `;
            transferNext2Btn.disabled = true;
            return;
        }

        let html = '';
        transferAvailableAdmins.forEach(admin => {
            const initial = admin.name.charAt(0).toUpperCase();
            const verifiedBadge = admin.isVerified
                ? `<img src="../assets/images/varified.png" style="height: 14px; vertical-align: middle; margin-left: 2px;" title="Verified Admin">`
                : '';
            html += `
                <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0.85rem; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all 0.15s ease;" onmouseenter="this.style.borderColor='#8b5cf6'; this.style.background='rgba(139,92,246,0.04)'" onmouseleave="if(!this.querySelector('input').checked){this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc';}">
                    <input type="radio" name="transfer-admin" class="transfer-admin-radio" value="${admin.email}" style="width: 17px; height: 17px; accent-color: #8b5cf6; cursor: pointer; flex-shrink: 0;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; flex-shrink: 0;">${initial}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; font-size: 0.88rem; color: #1e293b; display: flex; align-items: center; gap: 0.25rem;">
                            ${admin.name} ${verifiedBadge}
                        </div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 1px;">${admin.email}</div>
                    </div>
                </label>
            `;
        });
        transferAdminsList.innerHTML = html;

        // Attach radio listeners
        document.querySelectorAll('.transfer-admin-radio').forEach(radio => {
            radio.addEventListener('change', () => {
                transferSelectedAdmin = radio.value;
                transferNext2Btn.disabled = false;

                // Visual feedback for selected admin
                document.querySelectorAll('.transfer-admin-radio').forEach(r => {
                    const label = r.closest('label');
                    if (r.checked) {
                        label.style.borderColor = '#8b5cf6';
                        label.style.background = 'rgba(139,92,246,0.04)';
                    } else {
                        label.style.borderColor = '#e2e8f0';
                        label.style.background = '#f8fafc';
                    }
                });
            });
        });

    } catch (error) {
        console.error("Error loading admins:", error);
        transferAdminsList.innerHTML = `<div style="text-align:center; padding:2rem; color:#ef4444;">Failed to load admins.</div>`;
    }
};

const renderTransferSummary = () => {
    const selectedIds = Array.from(document.querySelectorAll('.transfer-product-cb:checked')).map(cb => cb.value);
    const selectedProducts = allProducts.filter(p => selectedIds.includes(p.id));
    const targetAdmin = transferAvailableAdmins.find(a => a.email === transferSelectedAdmin);

    let productsListHtml = selectedProducts.map(p => {
        const isFree = (p.price === 0 || p.pricingType === 'free');
        return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid #f1f5f9;">
            <span style="font-weight: 600; font-size: 0.82rem; color: #1e293b;">${p.name}</span>
            <span style="font-size: 0.75rem; font-weight: 700; color: ${isFree ? '#059669' : '#8b5cf6'};">${isFree ? 'FREE' : '₹' + (p.originalPrice ?? p.price)}</span>
        </div>`;
    }).join('');

    const verifiedBadge = targetAdmin && targetAdmin.isVerified
        ? `<img src="../assets/images/varified.png" style="height: 13px; vertical-align: middle; margin-left: 2px;">`
        : '';

    transferSummary.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Products to Transfer (${selectedProducts.length})</div>
            ${productsListHtml}
        </div>
        <div style="display: flex; align-items: center; gap: 0.65rem; padding: 0.75rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">${targetAdmin ? targetAdmin.name.charAt(0).toUpperCase() : '?'}</div>
            <div>
                <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Transferring To</div>
                <div style="font-weight: 700; font-size: 0.88rem; color: #1e293b;">${targetAdmin ? targetAdmin.name : 'Unknown'} ${verifiedBadge}</div>
                <div style="font-size: 0.75rem; color: #64748b;">${targetAdmin ? targetAdmin.email : ''}</div>
            </div>
        </div>
    `;
};

const executeTransfer = async () => {
    transferConfirmBtn.disabled = true;
    transferConfirmBtn.textContent = 'Transferring...';

    const selectedIds = Array.from(document.querySelectorAll('.transfer-product-cb:checked')).map(cb => cb.value);

    try {
        const updatePromises = selectedIds.map(productId =>
            updateDoc(doc(db, "products", productId), {
                addedBy: transferSelectedAdmin
            })
        );
        await Promise.all(updatePromises);

        closeTransferModal();
        loadProducts(); // Reload products table

        // Show success toast
        const toast = document.createElement('div');
        toast.style.cssText = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #059669; color: white; padding: 12px 24px; border-radius: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 99999; animation: slideDownToast 0.3s ease; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 600; font-size: 0.9rem;";
        toast.textContent = `✓ ${selectedIds.length} mod${selectedIds.length > 1 ? 's' : ''} transferred successfully!`;
        document.body.appendChild(toast);

        // Add toast animation if not already present
        if (!document.getElementById('transfer-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'transfer-toast-styles';
            style.innerHTML = `@keyframes slideDownToast { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }`;
            document.head.appendChild(style);
        }

        setTimeout(() => toast.remove(), 3500);

    } catch (error) {
        console.error("Error transferring products:", error);
        alert("Failed to transfer products. Please try again.");
    } finally {
        transferConfirmBtn.disabled = false;
        transferConfirmBtn.textContent = 'Confirm Transfer';
    }
};

// Transfer Modal Event Listeners
if (transferBtn) {
    transferBtn.addEventListener('click', openTransferModal);
}
if (closeTransferBtn) {
    closeTransferBtn.addEventListener('click', closeTransferModal);
}
if (transferCancelBtn) {
    transferCancelBtn.addEventListener('click', closeTransferModal);
}

// Step 1 → Step 2
if (transferNext1Btn) {
    transferNext1Btn.addEventListener('click', async () => {
        transferSelectedProducts = Array.from(document.querySelectorAll('.transfer-product-cb:checked')).map(cb => cb.value);
        if (transferSelectedProducts.length === 0) return;

        showTransferStep(2);
        transferNext2Btn.disabled = true;
        transferSelectedAdmin = null;
        await loadAdminsForTransfer();
    });
}

// Step 2 → Step 3
if (transferNext2Btn) {
    transferNext2Btn.addEventListener('click', () => {
        if (!transferSelectedAdmin) return;
        showTransferStep(3);
        renderTransferSummary();
    });
}

// Step 2 ← Back to Step 1
if (transferBack2Btn) {
    transferBack2Btn.addEventListener('click', () => {
        showTransferStep(1);
    });
}

// Step 3 ← Back to Step 2
if (transferBack3Btn) {
    transferBack3Btn.addEventListener('click', () => {
        showTransferStep(2);
    });
}

// Confirm Transfer
if (transferConfirmBtn) {
    transferConfirmBtn.addEventListener('click', executeTransfer);
}

// =====================================================
// ShareMods File Upload Integration
// =====================================================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function resetShareModsUpload() {
    // Cancel any in-progress upload
    if (shareModsCurrentXHR) {
        shareModsCurrentXHR.abort();
        shareModsCurrentXHR = null;
    }
    shareModsUploadedUrl = '';
    if (shareModsFileInput) shareModsFileInput.value = '';
    if (fDownloadSource) fDownloadSource.value = '';
    
    // Reset UI states
    if (shareModsUploadContent) shareModsUploadContent.style.display = 'block';
    if (shareModsUploadProgress) shareModsUploadProgress.style.display = 'none';
    if (shareModsUploadSuccess) shareModsUploadSuccess.style.display = 'none';
    if (shareModsUploadZone) {
        shareModsUploadZone.classList.remove('has-file');
        shareModsUploadZone.style.borderColor = 'rgba(37, 99, 235, 0.35)';
        shareModsUploadZone.style.background = '#f8fafc';
    }
}

async function uploadToShareMods(file) {
    const apiKey = getShareModsApiKey();
    if (!apiKey) {
        alert('ShareMods API key is not configured. Please add it in js/.env or js/.env.js');
        resetShareModsUpload();
        return;
    }

    // Max file size check (200MB)
    const MAX_SIZE = 200 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        alert(`File is too large (${formatFileSize(file.size)}). Maximum upload size is 200MB.`);
        resetShareModsUpload();
        return;
    }

    // Show progress UI
    shareModsUploadContent.style.display = 'none';
    shareModsUploadProgress.style.display = 'block';
    shareModsUploadSuccess.style.display = 'none';
    shareModsUploadZone.classList.add('has-file');
    shareModsUploadZone.style.borderColor = 'var(--boho-clay)';
    shareModsUploadZone.style.background = 'var(--boho-clay-light)';

    shareModsFileName.textContent = file.name;
    shareModsFileSize.textContent = formatFileSize(file.size);
    shareModsProgressBar.style.width = '0%';
    shareModsProgressPercent.textContent = '0%';
    shareModsProgressLabel.textContent = 'Connecting to Storage Server...';
    shareModsProgressLabel.style.color = 'var(--boho-clay)';

    try {
        // Step 1: Get upload server URL and session ID
        let uploadServerUrl = '';
        let sessId = '';

        // 1a. Try our serverless proxy /api/sharemods-server (available on Vercel / full dev servers)
        try {
            const apiRes = await fetch(`/api/sharemods-server?key=${encodeURIComponent(apiKey)}`);
            if (apiRes.ok) {
                const apiData = await apiRes.json();
                if (apiData.uploadServerUrl) {
                    uploadServerUrl = apiData.uploadServerUrl;
                    sessId = apiData.sessId || '';
                }
            }
        } catch (e) {
            console.warn('Backend proxy /api/sharemods-server unreachable:', e);
        }

        // 1b. If running under npx serve on port 3000, query local server.js on port 3001
        if (!uploadServerUrl || !sessId) {
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

        // 1c. Direct fallback if API route completely unavailable
        if (!uploadServerUrl) {
            uploadServerUrl = 'https://bio7.sharemods.com/cgi-bin/upload.cgi';
        }

        shareModsProgressLabel.textContent = 'Uploading Mod File...';

        // Step 2: Upload file directly to storage server (supports CORS Origin: *)
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
                        shareModsProgressLabel.textContent = 'Finalizing Mod File...';
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

                    // Canonical ShareMods download page link (never causes "no such file with this filename" error)
                    if (!fileUrl && fileCode) {
                        fileUrl = `https://sharemods.com/${fileCode}`;
                    }

                    if (fileUrl) {
                        resolve(fileUrl);
                    } else if (responseText.trim().startsWith('http')) {
                        resolve(responseText.trim());
                    } else {
                        reject(new Error('Could not extract download URL from ShareMods response: ' + responseText.substring(0, 100)));
                    }
                } else {
                    reject(new Error(`ShareMods upload failed with status ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                shareModsCurrentXHR = null;
                reject(new Error('Network error during ShareMods upload.'));
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
        fDownload.value = downloadUrl;
        if (fDownloadSource) fDownloadSource.value = 'sharemods';

        shareModsUploadProgress.style.display = 'none';
        shareModsUploadSuccess.style.display = 'block';
        shareModsSuccessFilename.textContent = file.name;
        shareModsUploadZone.style.borderColor = 'var(--boho-sage)';
        shareModsUploadZone.style.background = 'var(--boho-sage-light)';

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

        alert(`ShareMods Upload Error: ${error.message}`);
    }
}

// ShareMods Upload Event Listeners
if (shareModsUploadZone) {
    // Click to open file picker
    shareModsUploadZone.addEventListener('click', (e) => {
        // Don't trigger file picker if clicking remove or re-upload buttons
        if (e.target.closest('#sharemods-remove-file') || e.target.closest('#sharemods-reupload-btn')) return;
        if (shareModsUploadSuccess && shareModsUploadSuccess.style.display === 'block') return;
        shareModsFileInput.click();
    });

    // Drag and drop support
    shareModsUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        shareModsUploadZone.style.borderColor = 'var(--boho-clay)';
        shareModsUploadZone.style.background = 'var(--boho-clay-light)';
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
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadToShareMods(files[0]);
        }
    });
}

if (shareModsFileInput) {
    shareModsFileInput.addEventListener('change', () => {
        if (shareModsFileInput.files.length > 0) {
            uploadToShareMods(shareModsFileInput.files[0]);
        }
    });
}

if (shareModsRemoveFile) {
    shareModsRemoveFile.addEventListener('click', (e) => {
        e.stopPropagation();
        resetShareModsUpload();
    });
}

if (shareModsReuploadBtn) {
    shareModsReuploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetShareModsUpload();
        shareModsFileInput.click();
    });
}


// Init
document.addEventListener('DOMContentLoaded', loadProducts);
