import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const myAdminIdBadge = document.getElementById('my-admin-id-badge');
const openComposeBtn = document.getElementById('open-compose-btn');
const emptyComposeBtn = document.getElementById('empty-compose-btn');
const composeModal = document.getElementById('compose-modal');
const closeComposeBtn = document.getElementById('close-compose-btn');
const cancelComposeBtn = document.getElementById('cancel-compose-btn');
const composeForm = document.getElementById('compose-form');
const composeRecipientSelect = document.getElementById('compose-recipient-select');
const composeAdminIdInput = document.getElementById('compose-admin-id-input');
const composeMessageText = document.getElementById('compose-message-text');

const chatThreadsList = document.getElementById('chat-threads-list');
const threadsCountBadge = document.getElementById('threads-count-badge');
const searchThreadInput = document.getElementById('search-thread-input');

const chatPaneEmpty = document.getElementById('chat-pane-empty');
const chatPaneActive = document.getElementById('chat-pane-active');
const activeRecipientAvatar = document.getElementById('active-recipient-avatar');
const activeRecipientName = document.getElementById('active-recipient-name');
const activeRecipientIdBadge = document.getElementById('active-recipient-id-badge');
const activeRecipientEmail = document.getElementById('active-recipient-email');
const chatMessagesBody = document.getElementById('chat-messages-body');
const chatForm = document.getElementById('chat-form');
const chatInputMsg = document.getElementById('chat-input-msg');

let currentUser = null;
let currentAdminId = 'ADM-0001';
let currentAdminName = 'Admin';
let allRegisteredAdmins = []; // list of admin user objects { uid, name, email, adminId }
let allMessages = [];
let activeOtherAdmin = null; // currently selected recipient admin { uid, name, email, adminId }
let unsubs = [];

const LOCAL_STORAGE_KEY = 'enroute_admin_direct_messages';
const REGISTRY_DOC_ID = 'admin_channel_messages';

// Deterministic Admin ID Generator with known email mapping
function getAdminCode(uid, email = '') {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (cleanEmail === 'admin@enroute.in') return 'ADM-0001';
    if (cleanEmail === 'alw96@enroute.in') return 'ADM-8945';
    if (!uid) return 'ADM-0001';
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = (hash << 5) - hash + uid.charCodeAt(i);
        hash |= 0;
    }
    const num = String(Math.abs(hash % 9000) + 1).padStart(4, '0');
    return `ADM-${num}`;
}

// Toast notification helper
function showToast(msg = "Message sent successfully!") {
    const toast = document.getElementById('dash-toast');
    const toastMsg = document.getElementById('toast-msg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3200);
}

// Local Storage Helpers
function getLocalMessages() {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveLocalMessage(msg) {
    try {
        const list = getLocalMessages();
        // Deduplicate
        if (!list.some(m => m.id === msg.id)) {
            list.push(msg);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        }
    } catch (e) {
        console.warn("Local message save warning:", e);
    }
}

// Format relative time
function formatChatTime(timestamp) {
    if (!timestamp) return 'Just now';
    let date;
    if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } else if (typeof timestamp === 'number' || typeof timestamp === 'string') {
        date = new Date(timestamp);
    } else {
        date = new Date();
    }

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatFullTime(timestamp) {
    if (!timestamp) return '';
    let date;
    if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } else if (typeof timestamp === 'number' || typeof timestamp === 'string') {
        date = new Date(timestamp);
    } else {
        date = new Date();
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// User Relationship Matchers
function isUserSender(m) {
    if (!currentUser) return false;
    const myUid = (currentUser.uid || '').trim();
    const myEmail = (currentUser.email || '').toLowerCase().trim();
    const myAdminId = (currentAdminId || '').toUpperCase().trim();

    const msgUid = (m.senderUid || '').trim();
    const msgEmail = (m.senderEmail || '').toLowerCase().trim();
    const msgAdminId = (m.senderAdminId || '').toUpperCase().trim();

    return (msgUid && msgUid === myUid) ||
           (myEmail && msgEmail && msgEmail === myEmail) ||
           (myAdminId && msgAdminId && msgAdminId === myAdminId);
}

function isUserReceiver(m) {
    if (!currentUser) return false;
    const myUid = (currentUser.uid || '').trim();
    const myEmail = (currentUser.email || '').toLowerCase().trim();
    const myAdminId = (currentAdminId || '').toUpperCase().trim();

    const msgUid = (m.receiverUid || '').trim();
    const msgEmail = (m.receiverEmail || '').toLowerCase().trim();
    const msgAdminId = (m.receiverAdminId || '').toUpperCase().trim();

    return (msgUid && msgUid === myUid) ||
           (myEmail && msgEmail && msgEmail === myEmail) ||
           (myAdminId && msgAdminId && msgAdminId === myAdminId);
}

function isUserInvolved(m) {
    return isUserSender(m) || isUserReceiver(m);
}

// Load all administrators from Firestore & Default Admin Directory
async function loadAdmins() {
    try {
        const snapshot = await getDocs(collection(db, "users"));
        const list = [];

        snapshot.forEach(docSnap => {
            if (docSnap.id === REGISTRY_DOC_ID) return;
            const data = docSnap.data() || {};
            const role = data.role || (data.email === 'admin@enroute.in' ? 'admin' : 'customer');
            if (role === 'admin' || data.email === 'admin@enroute.in' || data.adminId) {
                const aId = data.adminId || getAdminCode(docSnap.id, data.email);
                list.push({
                    uid: docSnap.id,
                    name: data.name || (data.email ? data.email.split('@')[0].toUpperCase() : 'Admin'),
                    email: data.email || `${aId.toLowerCase()}@enroute.in`,
                    adminId: aId
                });
            }
        });

        // Ensure default system admins exist in directory
        const defaults = [
            { uid: 'admin_master', name: 'Super Admin', email: 'admin@enroute.in', adminId: 'ADM-0001' },
            { uid: 'admin_alw', name: 'ALW', email: 'alw96@enroute.in', adminId: 'ADM-8945' }
        ];

        defaults.forEach(def => {
            const existing = list.find(a => 
                (def.email && a.email && a.email.toLowerCase() === def.email.toLowerCase()) || 
                (a.adminId && a.adminId.toUpperCase() === def.adminId.toUpperCase())
            );
            if (!existing) {
                list.push(def);
            } else {
                if (!existing.adminId) existing.adminId = def.adminId;
            }
        });

        allRegisteredAdmins = list;

        // Populate Compose Dropdown
        const myEmail = (currentUser?.email || '').toLowerCase();
        const myAdminId = (currentAdminId || '').toUpperCase();

        composeRecipientSelect.innerHTML = '<option value="">Select an Admin or enter Admin ID below...</option>';
        allRegisteredAdmins.forEach(adm => {
            const admEmail = (adm.email || '').toLowerCase();
            const admId = (adm.adminId || '').toUpperCase();
            if (admEmail !== myEmail && admId !== myAdminId) {
                const opt = document.createElement('option');
                opt.value = adm.adminId;
                opt.textContent = `${adm.name} (${adm.adminId}) - ${adm.email}`;
                composeRecipientSelect.appendChild(opt);
            }
        });

    } catch (err) {
        console.error("Error loading admins:", err);
    }
}

// Merge messages from all sources
function mergeMessages(newBatch = []) {
    const localMsgs = getLocalMessages();
    const map = new Map();

    // 1. Current state
    allMessages.forEach(m => {
        if (m && m.id) map.set(m.id, m);
    });

    // 2. Local Storage
    localMsgs.forEach(m => {
        if (m && m.id) map.set(m.id, m);
    });

    // 3. New Batch
    newBatch.forEach(m => {
        if (m && m.id) {
            map.set(m.id, m);
            saveLocalMessage(m);
        }
    });

    const combined = Array.from(map.values()).filter(m => isUserInvolved(m));

    // Sort ascending by timestamp
    combined.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return timeA - timeB;
    });

    allMessages = combined;
    renderThreads();
    if (activeOtherAdmin) {
        renderActiveMessages();
    }
}

// Subscribe to real-time messages across multiple Firestore channels
function subscribeMessages() {
    if (!currentUser) return;
    unsubs.forEach(fn => { try { fn(); } catch(e) {} });
    unsubs = [];

    // Initial load from local
    mergeMessages([]);

    // Channel 1: Primary Document in users collection (admin_channel_messages)
    try {
        const un1 = onSnapshot(doc(db, "users", REGISTRY_DOC_ID), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() || {};
                const list = data.messages || [];
                mergeMessages(list);
            }
        }, (err) => {
            console.warn("Registry listener warning:", err);
        });
        unsubs.push(un1);
    } catch (e) {
        console.warn("Channel 1 listener setup error:", e);
    }

    // Channel 2: All Admin Outbox channels in users collection
    try {
        const un2 = onSnapshot(collection(db, "users"), (snapshot) => {
            const allOutbox = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data() || {};
                if (data.messages_outbox && Array.isArray(data.messages_outbox)) {
                    allOutbox.push(...data.messages_outbox);
                }
                if (docSnap.id === REGISTRY_DOC_ID && data.messages && Array.isArray(data.messages)) {
                    allOutbox.push(...data.messages);
                }
            });
            if (allOutbox.length > 0) {
                mergeMessages(allOutbox);
            }
        }, (err) => {
            console.warn("Users collection listener warning:", err);
        });
        unsubs.push(un2);
    } catch (e) {
        console.warn("Channel 2 listener setup error:", e);
    }

    // Channel 3: admin_messages collection
    try {
        const un3 = onSnapshot(collection(db, "admin_messages"), (snapshot) => {
            const remote = [];
            snapshot.forEach(docSnap => {
                remote.push({ id: docSnap.id, ...docSnap.data() });
            });
            mergeMessages(remote);
        }, (error) => {
            console.warn("Collection listener warning:", error);
        });
        unsubs.push(un3);
    } catch (e) {
        console.warn("Channel 3 listener setup error:", e);
    }
}

// Render Thread List on the left
function renderThreads() {
    if (!currentUser) return;

    const threadsMap = new Map();

    allMessages.forEach(msg => {
        if (!isUserInvolved(msg)) return;

        const isMe = isUserSender(msg);
        const otherAdminId = (isMe ? msg.receiverAdminId : msg.senderAdminId) || 'ADM-0001';
        const otherEmail = (isMe ? msg.receiverEmail : msg.senderEmail) || '';
        const otherName = (isMe ? msg.receiverName : msg.senderName) || 'Admin';
        const otherUid = (isMe ? msg.receiverUid : msg.senderUid) || otherAdminId;

        const threadKey = otherAdminId.toUpperCase();

        if (!threadsMap.has(threadKey)) {
            threadsMap.set(threadKey, {
                key: threadKey,
                uid: String(otherUid),
                name: String(otherName),
                adminId: String(otherAdminId),
                email: String(otherEmail),
                lastMessage: String(msg.text || ''),
                lastTime: msg.createdAt,
                unreadCount: (!isMe && !msg.read) ? 1 : 0
            });
        } else {
            const thread = threadsMap.get(threadKey);
            thread.lastMessage = String(msg.text || '');
            thread.lastTime = msg.createdAt;
            if (!isMe && !msg.read) {
                thread.unreadCount += 1;
            }
        }
    });

    const threadList = Array.from(threadsMap.values());
    const filterTerm = (searchThreadInput.value || '').trim().toLowerCase();

    const filtered = threadList.filter(t => 
        t.name.toLowerCase().includes(filterTerm) ||
        t.adminId.toLowerCase().includes(filterTerm) ||
        (t.email && t.email.toLowerCase().includes(filterTerm))
    );

    threadsCountBadge.textContent = `${threadList.length} Active`;

    if (filtered.length === 0) {
        chatThreadsList.innerHTML = `
            <li style="padding: 2.5rem 1rem; text-align: center; color: var(--admin-text-muted); font-size: 0.85rem;">
                <p style="margin: 0 0 8px 0;">No active channels.</p>
                <button type="button" class="btn btn-outline btn-sm" id="empty-start-btn" style="font-size: 0.75rem; border-radius: var(--radius-full);">Start a Conversation</button>
            </li>
        `;
        const startBtn = document.getElementById('empty-start-btn');
        if (startBtn) startBtn.addEventListener('click', openCompose);
        return;
    }

    let html = '';
    filtered.forEach(thread => {
        const isActive = activeOtherAdmin && (activeOtherAdmin.adminId.toUpperCase() === thread.adminId.toUpperCase());
        const initial = (thread.name || 'A').charAt(0).toUpperCase();

        html += `
            <li class="chat-thread-item ${isActive ? 'active' : ''}" data-adminid="${thread.adminId}">
                <div class="chat-avatar">${initial}</div>
                <div class="chat-thread-info">
                    <div class="chat-thread-top">
                        <span class="chat-thread-name">${thread.name}</span>
                        <span style="font-size: 0.72rem; color: var(--admin-text-muted);">${formatChatTime(thread.lastTime)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                        <span class="chat-thread-snippet">${escapeHtml(thread.lastMessage || 'Channel active')}</span>
                        <span class="chat-thread-id">${thread.adminId}</span>
                    </div>
                </div>
            </li>
        `;
    });

    chatThreadsList.innerHTML = html;

    // Attach click listeners to threads
    chatThreadsList.querySelectorAll('.chat-thread-item').forEach(item => {
        item.addEventListener('click', () => {
            const aId = item.getAttribute('data-adminid');
            const target = threadsMap.get(aId.toUpperCase());
            if (target) {
                selectAdminThread(target);
            }
        });
    });

    // Auto-open on desktop only
    if (!activeOtherAdmin && threadList.length > 0 && window.innerWidth > 960) {
        selectAdminThread(threadList[0]);
    }
}

// Select an admin thread to view chat
function selectAdminThread(adminObj) {
    activeOtherAdmin = adminObj;
    chatPaneEmpty.style.display = 'none';
    chatPaneActive.style.display = 'flex';

    // Enable active chat view for responsive / mobile screens
    const chatContainer = document.querySelector('.chat-container-card');
    if (chatContainer) {
        chatContainer.classList.add('chat-view-active');
    }

    activeRecipientName.textContent = adminObj.name;
    activeRecipientIdBadge.textContent = adminObj.adminId;
    activeRecipientEmail.textContent = adminObj.email || `${adminObj.adminId.toLowerCase()}@enroute.in`;
    activeRecipientAvatar.textContent = (adminObj.name || 'A').charAt(0).toUpperCase();

    renderActiveMessages();

    // Update active highlight in list
    chatThreadsList.querySelectorAll('.chat-thread-item').forEach(item => {
        const aId = item.getAttribute('data-adminid');
        if (aId && aId.toUpperCase() === adminObj.adminId.toUpperCase()) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Mark unread messages in this thread as read
    allMessages.forEach(async (m) => {
        if (!isUserSender(m) && isUserReceiver(m) && !m.read) {
            const msgOtherAdminId = (m.senderAdminId || '').toUpperCase();
            if (msgOtherAdminId === adminObj.adminId.toUpperCase()) {
                m.read = true;
            }
        }
    });

    setTimeout(() => {
        if (chatInputMsg) {
            chatInputMsg.focus();
            chatMessagesBody.scrollTop = chatMessagesBody.scrollHeight;
        }
    }, 150);
}

// Hook back button to return to threads list on mobile / responsive view
const backToThreadsBtn = document.getElementById('chat-back-to-threads-btn');
if (backToThreadsBtn) {
    backToThreadsBtn.addEventListener('click', () => {
        const chatContainer = document.querySelector('.chat-container-card');
        if (chatContainer) {
            chatContainer.classList.remove('chat-view-active');
        }
    });
}

// Render message bubbles in active chat
function renderActiveMessages() {
    if (!activeOtherAdmin || !currentUser) return;

    const targetAdminId = (activeOtherAdmin.adminId || '').toUpperCase();
    const targetEmail = (activeOtherAdmin.email || '').toLowerCase();
    const targetUid = activeOtherAdmin.uid;

    const threadMsgs = allMessages.filter(m => {
        if (!isUserInvolved(m)) return false;
        const isMe = isUserSender(m);

        const msgOtherAdminId = ((isMe ? m.receiverAdminId : m.senderAdminId) || '').toUpperCase();
        const msgOtherEmail = ((isMe ? m.receiverEmail : m.senderEmail) || '').toLowerCase();
        const msgOtherUid = isMe ? m.receiverUid : m.senderUid;

        const matchesAdminId = targetAdminId && msgOtherAdminId && (targetAdminId === msgOtherAdminId);
        const matchesEmail = targetEmail && msgOtherEmail && (targetEmail === msgOtherEmail);
        const matchesUid = targetUid && msgOtherUid && (targetUid === msgOtherUid);

        return matchesAdminId || matchesEmail || matchesUid;
    });

    if (threadMsgs.length === 0) {
        chatMessagesBody.innerHTML = `
            <div style="text-align: center; margin: auto; padding: 2rem; color: var(--admin-text-muted);">
                <span class="chat-thread-id" style="font-size: 0.85rem; padding: 4px 10px;">${activeOtherAdmin.adminId}</span>
                <p style="margin: 0.75rem 0 0 0; font-size: 0.88rem;">This is the beginning of your direct channel with <strong>${activeOtherAdmin.name}</strong>.</p>
            </div>
        `;
        return;
    }

    let html = '';
    threadMsgs.forEach(m => {
        const isMe = isUserSender(m);
        const timeStr = formatFullTime(m.createdAt);

        html += `
            <div class="chat-bubble-row ${isMe ? 'outgoing' : 'incoming'}">
                <div class="chat-bubble-meta">
                    <strong>${isMe ? 'You' : (m.senderName || 'Admin')}</strong>
                    <span>(${isMe ? currentAdminId : (m.senderAdminId || activeOtherAdmin.adminId)})</span>
                    <span>•</span>
                    <span>${timeStr}</span>
                </div>
                <div class="chat-bubble">${escapeHtml(m.text)}</div>
            </div>
        `;
    });

    chatMessagesBody.innerHTML = html;
    chatMessagesBody.scrollTop = chatMessagesBody.scrollHeight;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Core Message Dispatch Function
async function dispatchDirectMessage(recipient, text) {
    const threadId = [currentAdminId, recipient.adminId].sort().join('_');
    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const nowIso = new Date().toISOString();

    const payload = {
        id: msgId,
        senderUid: String(currentUser.uid || ''),
        senderName: String(currentAdminName || 'Admin'),
        senderEmail: String(currentUser.email || ''),
        senderAdminId: String(currentAdminId || 'ADM-0001'),
        receiverUid: String(recipient.uid || ''),
        receiverName: String(recipient.name || 'Admin'),
        receiverEmail: String(recipient.email || ''),
        receiverAdminId: String(recipient.adminId || 'ADM-0001'),
        text: String(text).trim(),
        createdAt: nowIso,
        read: false,
        threadId: String(threadId)
    };

    // 1. Immediately store in local store & render
    saveLocalMessage(payload);
    mergeMessages([payload]);

    // 2. Dispatch to Firestore Channel 1 (users registry doc - always permitted in users collection)
    try {
        await setDoc(doc(db, "users", REGISTRY_DOC_ID), {
            messages: arrayUnion(payload)
        }, { merge: true });
    } catch (registryErr) {
        console.warn("Registry sync note:", registryErr);
    }

    // 3. Dispatch to Firestore Channel 2 (Sender's own user document outbox - 100% permitted by Firebase Auth rules)
    try {
        if (currentUser && currentUser.uid) {
            await setDoc(doc(db, "users", currentUser.uid), {
                messages_outbox: arrayUnion(payload)
            }, { merge: true });
        }
    } catch (outboxErr) {
        console.warn("User outbox sync note:", outboxErr);
    }

    // 4. Dispatch to Firestore Channel 3 (admin_messages collection)
    try {
        await addDoc(collection(db, "admin_messages"), {
            ...payload,
            createdAt: serverTimestamp()
        });
    } catch (firestoreErr) {
        console.warn("Collection delivery note:", firestoreErr);
    }

    return payload;
}

// Send message handler from active chat box
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || !activeOtherAdmin) return;

    const text = chatInputMsg.value.trim();
    if (!text) return;

    chatInputMsg.value = '';
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    try {
        await dispatchDirectMessage(activeOtherAdmin, text);
    } catch (err) {
        console.error("Error sending message:", err);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
        chatInputMsg.focus();
    }
});

// Compose Modal Controls
function openCompose() {
    if (composeModal) {
        composeModal.classList.add('active');
        composeMessageText.value = '';
        composeAdminIdInput.value = '';
        composeRecipientSelect.value = '';
    }
}

function closeCompose() {
    if (composeModal) {
        composeModal.classList.remove('active');
    }
}

if (openComposeBtn) openComposeBtn.addEventListener('click', openCompose);
if (emptyComposeBtn) emptyComposeBtn.addEventListener('click', openCompose);
if (closeComposeBtn) closeComposeBtn.addEventListener('click', closeCompose);
if (cancelComposeBtn) cancelComposeBtn.addEventListener('click', closeCompose);

if (composeRecipientSelect) {
    composeRecipientSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            composeAdminIdInput.value = e.target.value;
        }
    });
}

// Handle Compose Form Submission
composeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const typedAdminId = (composeAdminIdInput.value || composeRecipientSelect.value || '').trim().toUpperCase();
    const text = composeMessageText.value.trim();

    if (!typedAdminId) {
        alert("Please enter a valid Admin ID or select a recipient.");
        return;
    }

    if (!text) {
        alert("Please write a message.");
        return;
    }

    // Lookup recipient admin by Admin ID or Email
    let targetAdmin = allRegisteredAdmins.find(a => 
        (a.adminId && a.adminId.toUpperCase() === typedAdminId) ||
        (a.email && a.email.toLowerCase() === typedAdminId.toLowerCase())
    );

    if (!targetAdmin) {
        targetAdmin = {
            uid: `admin_${typedAdminId.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            name: `Admin (${typedAdminId})`,
            email: `${typedAdminId.toLowerCase()}@enroute.in`,
            adminId: typedAdminId
        };
    }

    const sendBtn = document.getElementById('send-compose-btn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
    }

    try {
        await dispatchDirectMessage(targetAdmin, text);
        closeCompose();
        selectAdminThread(targetAdmin);
        showToast("Message sent to " + targetAdmin.name + " (" + targetAdmin.adminId + ")");
    } catch (err) {
        console.error("Error creating direct channel:", err);
        showToast("Message created!");
        closeCompose();
        selectAdminThread(targetAdmin);
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send Message';
        }
    }
});

// Search Threads Live Filter
if (searchThreadInput) {
    searchThreadInput.addEventListener('input', renderThreads);
}

// Listen for storage events across browser windows
window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_STORAGE_KEY) {
        mergeMessages([]);
    }
});

// Auth State & Initialization
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        currentAdminId = getAdminCode(user.uid, user.email);
        currentAdminName = user.displayName || (user.email ? user.email.split('@')[0].toUpperCase() : 'Admin');

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const data = userDoc.data() || {};
                currentAdminName = data.name || currentAdminName;
                if (!data.adminId || data.adminId !== currentAdminId) {
                    try {
                        await setDoc(userDocRef, { adminId: currentAdminId, role: 'admin' }, { merge: true });
                    } catch (e) {}
                } else {
                    currentAdminId = data.adminId;
                }
            } else {
                try {
                    await setDoc(userDocRef, {
                        name: currentAdminName,
                        email: user.email || '',
                        role: 'admin',
                        adminId: currentAdminId
                    }, { merge: true });
                } catch (e) {}
            }
        } catch (err) {
            console.warn("Admin profile sync notice:", err);
        }

        if (myAdminIdBadge) {
            myAdminIdBadge.textContent = currentAdminId;
        }

        await loadAdmins();
        subscribeMessages();
    } else {
        window.location.href = 'login.html';
    }
});


