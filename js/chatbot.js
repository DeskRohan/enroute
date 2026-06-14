import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
});

const botData = {
    greeting: "Hi there! 👋 I'm Navya, your virtual road assistant. Please select a query below so I can help you.",
    options: [
        {
            id: "purchase",
            label: "Purchase / Payment Issue",
            dynamic: "purchase_flow"
        },
        {
            id: "install",
            label: "How to add the mod to game",
            response: "Go to your phone's file manager, copy the downloaded mod file. Then open your Documents folder -> BUSSID folder -> Mods folder, and paste the mod there."
        },
        {
            id: "download",
            label: "Where is my download?",
            response: "Once you purchase a mod, it will automatically appear in your Profile. Click the profile icon at the top right, and you will see your purchased items ready for download."
        },
        {
            id: "contact",
            label: "Contact Us",
            response: "You can reach out to us via email at enroutestorein@gmail.com, or directly through WhatsApp.",
            subOptions: [
                { id: "whatsapp", label: "Chat on WhatsApp", url: "https://wa.me/917621000916" },
                { id: "back", label: "Back to Main Menu", back: true }
            ]
        },
        {
            id: "end",
            label: "End Chat",
            end: true
        }
    ]
};

const createChatbotUI = () => {
    const widget = document.createElement('div');
    widget.className = 'chatbot-widget';

    widget.innerHTML = `
        <div class="chatbot-window" id="chatbot-window">
            <div class="chatbot-header">
                <div class="chatbot-header-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    Navya
                </div>
                <button class="chatbot-close" id="chatbot-close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="chatbot-messages" id="chatbot-messages">
                <!-- Messages will go here -->
            </div>
        </div>
        <button class="chatbot-button" id="chatbot-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </button>
    `;

    document.body.appendChild(widget);

    const btn = document.getElementById('chatbot-button');
    const win = document.getElementById('chatbot-window');
    const closeBtn = document.getElementById('chatbot-close');

    btn.addEventListener('click', () => {
        win.classList.add('active');
        btn.style.display = 'none';
        
        // Only show greeting once
        if (!win.dataset.started) {
            win.dataset.started = 'true';
            setTimeout(() => {
                addBotMessage(botData.greeting);
                showOptions(botData.options);
            }, 300);
        }
    });

    closeBtn.addEventListener('click', () => {
        win.classList.remove('active');
        setTimeout(() => {
            btn.style.display = 'flex';
        }, 300);
    });
};

const addBotMessage = (text) => {
    const messages = document.getElementById('chatbot-messages');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot';
    bubble.innerHTML = `<p>${text}</p>`;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
};

const addUserMessage = (text) => {
    const messages = document.getElementById('chatbot-messages');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.innerHTML = `<p>${text}</p>`;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
};

const handleDynamicFlow = async (flowName) => {
    if (flowName === 'purchase_flow') {
        if (!currentUser) {
            addBotMessage("You need to be logged in to view your purchases. Please log in first, or if your payment was deducted but you can't log in, contact us directly.");
            showOptions([
                { id: "whatsapp", label: "Contact Support (WhatsApp)", url: "https://wa.me/917621000916" },
                { id: "back", label: "Back to Main Menu", back: true }
            ]);
            return;
        }

        const messages = document.getElementById('chatbot-messages');
        const typing = document.createElement('div');
        typing.className = 'chat-bubble bot typing';
        typing.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
        messages.appendChild(typing);
        messages.scrollTop = messages.scrollHeight;

        try {
            const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid));
            const snapshot = await getDocs(q);
            typing.remove();

            if (snapshot.empty) {
                addBotMessage("You haven't purchased anything yet. If your payment was deducted but no order was created, please contact support for a quick resolution.");
                showOptions([
                    { id: "whatsapp", label: "Contact Support (WhatsApp)", url: "https://wa.me/917621000916" },
                    { id: "back", label: "Back to Main Menu", back: true }
                ]);
            } else {
                addBotMessage("Which mod are you facing an issue with? Please select from your recent orders:");
                let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Sort by date
                orders.sort((a, b) => {
                    const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (new Date(a.createdAt || 0)).getTime();
                    const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (new Date(b.createdAt || 0)).getTime();
                    return dateB - dateA;
                });

                // Take top 3 orders for the UI
                const orderOptions = orders.slice(0, 3).map(order => ({
                    id: order.id,
                    label: order.productName,
                    response: `You selected **${order.productName}**. What kind of issue are you facing with it?`,
                    subOptions: [
                        {
                            id: "corrupted",
                            label: "Mod file is corrupted / won't open",
                            response: "Please try re-downloading the file from your dashboard. If you're on mobile, ensure you're using ZArchiver or a supported extractor app.",
                            subOptions: [
                                { id: "whatsapp", label: "Still need help? Message on WhatsApp", url: `https://wa.me/917621000916?text=Hi, my mod file is corrupted. Order ID: ${order.id.slice(0, 8)} for ${encodeURIComponent(order.productName)}` },
                                { id: "back", label: "Back to Main Menu", back: true },
                                { id: "end", label: "End Chat", end: true }
                            ]
                        },
                        {
                            id: "not_showing",
                            label: "Mod not showing in game",
                            response: "Make sure you copied the mod file exactly into your Documents -> BUSSID -> Mods folder. If it still doesn't show up, completely restart the game.",
                            subOptions: [
                                { id: "whatsapp", label: "Still need help? Message on WhatsApp", url: `https://wa.me/917621000916?text=Hi, my mod is not showing in game. Order ID: ${order.id.slice(0, 8)} for ${encodeURIComponent(order.productName)}` },
                                { id: "back", label: "Back to Main Menu", back: true },
                                { id: "end", label: "End Chat", end: true }
                            ]
                        },
                        {
                            id: "other_issue",
                            label: "Other issue",
                            response: `Our support team will need your order ID (**${order.id.slice(0, 8)}**) to assist you. Please click the button below to message us on WhatsApp with these details.`,
                            subOptions: [
                                { id: "whatsapp", label: "Message on WhatsApp", url: `https://wa.me/917621000916?text=Hi, I have an issue with my order ${order.id.slice(0, 8)} for ${encodeURIComponent(order.productName)}` },
                                { id: "back", label: "Back to Main Menu", back: true }
                            ]
                        }
                    ]
                }));

                orderOptions.push({
                    id: "other",
                    label: "Other issue / Mod not listed",
                    response: "If your mod isn't listed or you have a different issue, please contact our support team directly.",
                    subOptions: [
                        { id: "whatsapp", label: "Contact Support (WhatsApp)", url: "https://wa.me/917621000916" },
                        { id: "back", label: "Back to Main Menu", back: true }
                    ]
                });

                showOptions(orderOptions);
            }
        } catch (error) {
            typing.remove();
            console.error(error);
            addBotMessage("Sorry, I couldn't fetch your purchases right now. Please contact support.");
            showOptions([
                { id: "whatsapp", label: "Contact Support (WhatsApp)", url: "https://wa.me/917621000916" },
                { id: "back", label: "Back to Main Menu", back: true }
            ]);
        }
    }
};

const showOptions = (options) => {
    const messages = document.getElementById('chatbot-messages');
    
    // Create typing indicator briefly before showing options
    const typing = document.createElement('div');
    typing.className = 'chat-bubble bot typing';
    typing.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    setTimeout(() => {
        typing.remove();
        
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'chat-options-container';
        
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'chat-option-btn';
            btn.innerHTML = opt.label;
            
            btn.onclick = () => {
                // Disable all buttons in this container to prevent multiple clicks
                const allBtns = optionsContainer.querySelectorAll('button');
                allBtns.forEach(b => b.disabled = true);
                
                if (opt.back) {
                    showOptions(botData.options);
                } else if (opt.end) {
                    addUserMessage(opt.label);
                    setTimeout(() => {
                        addBotMessage("Thanks for chatting! Have a great drive! 🚌");
                        setTimeout(() => {
                            const win = document.getElementById('chatbot-window');
                            const btnMain = document.getElementById('chatbot-button');
                            win.classList.remove('active');
                            setTimeout(() => {
                                btnMain.style.display = 'flex';
                                // Reset chat history so it greets again next time
                                document.getElementById('chatbot-messages').innerHTML = '';
                                win.dataset.started = '';
                            }, 300);
                        }, 1500);
                    }, 600);
                } else if (opt.url) {
                    window.open(opt.url, '_blank');
                    // Show same options again
                    setTimeout(() => showOptions(options), 500);
                } else {
                    addUserMessage(opt.label);
                    
                    if (opt.dynamic) {
                        handleDynamicFlow(opt.dynamic);
                    } else {
                        setTimeout(() => {
                            addBotMessage(opt.response);
                            
                            if (opt.subOptions) {
                                showOptions(opt.subOptions);
                            } else {
                                setTimeout(() => showOptions(botData.options), 1000);
                            }
                        }, 600);
                    }
                }
            };
            optionsContainer.appendChild(btn);
        });
        
        messages.appendChild(optionsContainer);
        messages.scrollTop = messages.scrollHeight;
    }, 500);
};

// Initialize
document.addEventListener('DOMContentLoaded', createChatbotUI);
