import { db } from '../firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM
const tableBody = document.getElementById('products-table-body');
const addBtn = document.getElementById('add-product-btn');
const modal = document.getElementById('product-modal');
const closeBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-modal-btn');
const productForm = document.getElementById('product-form');
const modalTitle = document.getElementById('modal-title');
const saveBtn = document.getElementById('save-product-btn');

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
    }

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

// Handlers
addBtn.addEventListener('click', () => {
    openModal(false);
});

closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

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
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

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
        downloadLink: fDownload.value,
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
        productData.createdAt = serverTimestamp(); // Only set on create
        productData.addedBy = adminEmail || 'unknown';
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
        saveBtn.textContent = 'Save Product';
    }
});

// Init
document.addEventListener('DOMContentLoaded', loadProducts);
