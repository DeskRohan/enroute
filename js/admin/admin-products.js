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
const fName = document.getElementById('p-name');
const fCategory = document.getElementById('p-category');
const fPrice = document.getElementById('p-price');
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

let allProducts = [];

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price);
};

// Google Drive Image URL Converter
const getImageUrl = (url) => {
    if (!url || url.trim() === '') return 'https://via.placeholder.com/50';

    // Non-Google Drive URLs — return as-is
    if (url.startsWith("http") && !url.includes("drive.google.com")) {
        return url;
    }

    let fileId = null;

    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /open\?id=([a-zA-Z0-9_-]+)/,
        /uc\?id=([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            fileId = match[1];
            break;
        }
    }

    if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }

    return url;
};

// Generate random ID for new products
const generateId = () => Math.random().toString(36).substring(2, 15);

const loadProducts = async () => {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center">Loading...</td></tr>`;
    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTable();
    } catch (error) {
        console.error("Error loading products:", error);
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load products</td></tr>`;
    }
};

const renderTable = () => {
    if (allProducts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary">No products found. Add one!</td></tr>`;
        return;
    }

    let html = '';
    allProducts.forEach(product => {
        html += `
            <tr>
                <td><img src="${getImageUrl(product.image)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                <td style="font-weight: 500;">${product.name}</td>
                <td style="text-transform: capitalize;">${product.category}</td>
                <td>${formatPrice(product.price)}</td>
                <td>${product.featured ? '<span style="color:var(--color-accent)">Yes</span>' : '<span class="text-secondary">No</span>'}</td>
                <td>
                    <button class="btn btn-sm btn-outline edit-btn" data-id="${product.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Edit</button>
                    <button class="btn btn-sm btn-outline delete-btn" data-id="${product.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--color-danger); border-color: var(--color-danger); margin-left: 0.5rem;">Delete</button>
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

    // Populate Related Mods checklist
    let html = '';
    allProducts.forEach(p => {
        if (p.id !== currentId) {
            html += `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" class="related-mod-checkbox" value="${p.id}" id="rel-${p.id}">
                    <label for="rel-${p.id}" style="font-size: 0.85rem; cursor: pointer;">${p.name}</label>
                </div>
            `;
        }
    });
    relatedContainer.innerHTML = html;

    modal.classList.add('active');
};

const closeModal = () => {
    modal.classList.remove('active');
    productForm.reset();
    fId.value = '';
    fImage1.value = '';
    fImage2.value = '';
    fImage3.value = '';
    fImage4.value = '';
};

// Handlers
addBtn.addEventListener('click', () => {
    openModal(false);
});

closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

const handleEdit = (e) => {
    const id = e.target.getAttribute('data-id');
    const product = allProducts.find(p => p.id === id);
    if (product) {
        fId.value = product.id;
        fName.value = product.name;
        fCategory.value = product.category;
        fPrice.value = product.price;

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
        openModal(true, id);

        // Check related mods
        if (product.relatedMods && Array.isArray(product.relatedMods)) {
            product.relatedMods.forEach(relId => {
                const cb = document.getElementById(`rel-${relId}`);
                if (cb) cb.checked = true;
            });
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
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const productId = fId.value || generateId();
    const selectedRelated = Array.from(document.querySelectorAll('.related-mod-checkbox:checked')).map(cb => cb.value);

    const productData = {
        name: fName.value,
        category: fCategory.value,
        price: parseFloat(fPrice.value),
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
        summary: fSummary.value,
        youtube: fYoutube.value,
        relatedMods: selectedRelated,
        description: fDesc.value,
        updatedAt: serverTimestamp()
    };

    if (!fId.value) {
        productData.createdAt = serverTimestamp(); // Only set on create
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
