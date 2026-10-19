const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001/api'
    : 'https://cafe-core-backend.onrender.com/api';

// State
let menuItems = [];
let cart = [];

// DOM Elements
const menuGrid = document.getElementById('menu-grid');
const cartItems = document.getElementById('cart-items');
const cartSubtotal = document.getElementById('cart-subtotal');
const cartTotal = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const receiptModal = document.getElementById('receipt-modal');
const printableReceipt = document.getElementById('printable-receipt');
const navPos = document.getElementById('nav-pos');
const navTracking = document.getElementById('nav-tracking');
const navHistory = document.getElementById('nav-history');
const navMgmt = document.getElementById('nav-mgmt');
const navStats = document.getElementById('nav-stats');
const posWorkspace = document.getElementById('pos-workspace');
const trackingWorkspace = document.getElementById('tracking-workspace');
const historyWorkspace = document.getElementById('history-workspace');
const mgmtWorkspace = document.getElementById('mgmt-workspace');
const statsWorkspace = document.getElementById('stats-workspace');

let currentUser = null;
let pendingAdminAction = null;
const loginModal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    fetchMenu();
    setupNavigation();
    setupVoiceRecognition();
    setupAuthToggles(); // Setup view switches, password toggles and demo accounts
    setupAdminAuthorization(); // Setup Admin Authorization modal & handlers
    setupPaymentSystem(); // Initialize Stripe & Online Payment Gateways
    setupCustomerInputRestrictions(); // Strictly restrict mobile number (digits only) and name (letters only)
});

function setupAuthToggles() {
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const loginTitle = document.querySelector('#login-modal h2');

    // View Switching
    const showSignup = document.getElementById('show-signup');
    if (showSignup) {
        showSignup.addEventListener('click', (e) => {
            e.preventDefault();
            loginView.classList.add('hidden');
            signupView.classList.remove('hidden');
            if (loginTitle) loginTitle.innerText = 'Create Staff Account';
        });
    }

    const showLogin = document.getElementById('show-login');
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            signupView.classList.add('hidden');
            loginView.classList.remove('hidden');
            if (loginTitle) loginTitle.innerText = 'Cafe Staff Login';
        });
    }

    // Password Visibility Toggles
    const setupToggle = (btnId, inputId) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (btn && input) {
            btn.addEventListener('click', () => {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                btn.classList.toggle('fa-eye', isPassword);
                btn.classList.toggle('fa-eye-slash', !isPassword);
            });
        }
    };

    setupToggle('toggle-login-password', 'login-password');
    setupToggle('toggle-signup-password', 'signup-password');

    // Quick Fill Demo Credentials
    const quickAdmin = document.getElementById('quick-fill-admin');
    if (quickAdmin) {
        quickAdmin.addEventListener('click', () => {
            document.getElementById('login-email').value = 'admin@aura.cafe';
            document.getElementById('login-password').value = 'admin123';
        });
    }

    const quickBarista = document.getElementById('quick-fill-barista');
    if (quickBarista) {
        quickBarista.addEventListener('click', () => {
            document.getElementById('login-email').value = 'bob@aura.cafe';
            document.getElementById('login-password').value = 'password123';
        });
    }
}

function isAdmin() {
    return !!(currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Manager'));
}

function promptAdminAuth(callback) {
    if (isAdmin()) {
        if (callback) callback();
        return;
    }
    pendingAdminAction = callback;
    const errDiv = document.getElementById('login-error');
    if (errDiv) errDiv.innerText = 'Please log in as Admin or Manager to do this.';
    if (loginModal) loginModal.classList.remove('hidden');
}

function updateMgmtAdminBanner() {
    const banner = document.getElementById('mgmt-admin-banner');
    const addMenuBtn = document.getElementById('add-menu-btn');
    const adminActive = isAdmin();

    if (addMenuBtn) {
        addMenuBtn.style.display = adminActive ? 'inline-flex' : 'none';
    }

    // Toggle edit and delete action buttons visibility if rows already exist
    const actionBtns = document.querySelectorAll('#mgmt-menu-tbody .btn-edit-item, #mgmt-menu-tbody .btn-del-item');
    actionBtns.forEach(btn => {
        btn.style.display = adminActive ? 'inline-flex' : 'none';
    });

    if (!banner) return;
    if (adminActive) {
        banner.style.display = 'flex';
        banner.className = 'admin-banner-notice admin-unlocked';
        banner.innerHTML = `
            <div class="banner-content">
                <i class="fa-solid fa-circle-check banner-icon"></i>
                <div>
                    <strong>Admin Mode On</strong> — You can now add items, change prices, or delete items.
                </div>
            </div>
            <span class="role-badge role-admin" style="font-size:0.75rem;"><i class="fa-solid fa-shield-halved"></i> Admin Mode</span>
        `;
    } else {
        banner.style.display = 'none';
        banner.innerHTML = '';
    }
}

function checkAuth() {
    const saved = localStorage.getItem('aura_staff');
    if (saved) {
        currentUser = JSON.parse(saved);
        document.getElementById('user-name').innerText = currentUser.name;
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=d4a373&color=fff`;
        
        // Update user role badge
        const roleBadge = document.getElementById('user-role-badge');
        if (roleBadge) {
            const role = (currentUser.role || 'Staff').trim();
            roleBadge.className = `role-badge role-${role.toLowerCase()}`;
            if (role === 'Admin') {
                roleBadge.innerHTML = `<i class="fa-solid fa-crown"></i> Admin`;
            } else if (role === 'Manager') {
                roleBadge.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Manager`;
            } else {
                roleBadge.innerHTML = `<i class="fa-solid fa-user"></i> ${role}`;
            }
        }

        // Update header admin button
        const headerAdminBtn = document.getElementById('header-admin-btn');
        const headerAdminText = document.getElementById('header-admin-text');
        if (headerAdminBtn && headerAdminText) {
            if (isAdmin()) {
                headerAdminBtn.classList.add('active-admin');
                headerAdminText.innerText = 'Admin Active';
            } else {
                headerAdminBtn.classList.remove('active-admin');
                headerAdminText.innerText = 'Admin Login';
            }
        }

        loginModal.classList.add('hidden');
        updateMgmtAdminBanner();
    } else {
        loginModal.classList.remove('hidden');
    }
}

function setupAdminAuthorization() {
    // Legacy stub - Admin and Staff login are unified
}

loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errDiv = document.getElementById('login-error');
    errDiv.innerText = '';

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('aura_token', data.token); // Store JWT
            localStorage.setItem('aura_staff', JSON.stringify(data.user));
            currentUser = data.user;
            checkAuth();
            showToast(`👋 Welcome ${data.user.name} (${data.user.role})!`);

            if (pendingAdminAction) {
                const action = pendingAdminAction;
                pendingAdminAction = null;
                action();
            }
        } else {
            errDiv.innerText = data.error;
        }
    } catch (err) {
        errDiv.innerText = "Cannot connect to server. Please make sure server is running.";
    }
});

document.getElementById('signup-btn').addEventListener('click', async () => {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;
    const errDiv = document.getElementById('signup-error');
    errDiv.innerText = '';

    if (!name || !email || !password) {
        errDiv.innerText = "Please fill in all fields.";
        return;
    }

    try {
        const res = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });
        const data = await res.json();
        if (data.success) {
            alert('Account created! You can now log in.');
            document.getElementById('show-login').click();
        } else {
            errDiv.innerText = data.error;
        }
    } catch (err) {
        errDiv.innerText = "Cannot connect to server. Could not create account.";
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('aura_token');
    localStorage.removeItem('aura_staff');
    currentUser = null;
    checkAuth();
});

// Navigation
function setupNavigation() {
    const allWorkspaces = [posWorkspace, trackingWorkspace, historyWorkspace, mgmtWorkspace, statsWorkspace];
    const allNavs = [navPos, navTracking, navHistory, navMgmt, navStats];

    const switchTab = (activeNav, activeWorkspace, action) => {
        allNavs.forEach(n => {
            if (n && n.parentElement) n.parentElement.classList.remove('active');
        });
        allWorkspaces.forEach(w => {
            if (w) {
                w.classList.remove('active');
                w.classList.add('hidden');
            }
        });

        if (activeNav && activeNav.parentElement) activeNav.parentElement.classList.add('active');
        if (activeWorkspace) {
            activeWorkspace.classList.add('active');
            activeWorkspace.classList.remove('hidden');
        }

        if (action) action();
    };

    if (navPos) navPos.addEventListener('click', (e) => { e.preventDefault(); switchTab(navPos, posWorkspace); });
    if (navTracking) navTracking.addEventListener('click', (e) => { e.preventDefault(); switchTab(navTracking, trackingWorkspace, loadActiveOrders); });
    if (navHistory) navHistory.addEventListener('click', (e) => { e.preventDefault(); switchTab(navHistory, historyWorkspace, loadPaymentHistory); });
    if (navMgmt) navMgmt.addEventListener('click', (e) => { e.preventDefault(); switchTab(navMgmt, mgmtWorkspace, loadMenuMgmt); });
    if (navStats) navStats.addEventListener('click', (e) => { e.preventDefault(); switchTab(navStats, statsWorkspace, loadAnalytics); });

    const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
    if (refreshOrdersBtn) {
        refreshOrdersBtn.addEventListener('click', () => {
            loadActiveOrders();
            showToast('🔄 Orders updated');
        });
    }

    const refreshHistoryBtn = document.getElementById('refresh-history-btn');
    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener('click', () => {
            const searchInput = document.getElementById('search-payment-history');
            const searchVal = searchInput ? searchInput.value.trim() : '';
            loadPaymentHistory(searchVal);
            showToast('🔄 Payment history updated');
        });
    }

    const searchHistoryInput = document.getElementById('search-payment-history');
    if (searchHistoryInput) {
        let debounceTimer;
        searchHistoryInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadPaymentHistory(e.target.value.trim());
            }, 300);
        });
    }

    // Filter Buttons (Cash, UPI, Card, Net Banking, All)
    document.querySelectorAll('.history-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.history-filter-btn').forEach(b => b.classList.remove('active-filter'));
            btn.classList.add('active-filter');
            applyHistoryFilter(btn.getAttribute('data-filter'));
        });
    });
}

function getIconForMenu(name, customImageUrl = '') {
    if (customImageUrl && typeof customImageUrl === 'string') {
        let clean = customImageUrl.trim();
        if (clean.startsWith('//')) {
            clean = 'https:' + clean;
        }
        if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:image/') || clean.startsWith('assets/')) {
            // Only return URL if it looks like a direct image (not a webpage link)
            const urlPath = clean.toLowerCase().split('?')[0];
            const hasImageExt = /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|tiff?)$/i.test(urlPath);
            const isKnownImageCDN = urlPath.includes('images.unsplash.com')
                || urlPath.includes('unsplash.com/photo')
                || urlPath.includes('cloudinary.com')
                || urlPath.includes('imgur.com')
                || urlPath.includes('pexels.com')
                || urlPath.includes('pixabay.com')
                || urlPath.includes('googleusercontent.com')
                || urlPath.includes('wp-content/uploads')
                || clean.startsWith('data:image/')
                || clean.startsWith('assets/');
            const isWebPage = urlPath.endsWith('/') || urlPath.endsWith('.html') || urlPath.endsWith('.htm');
            if ((hasImageExt || isKnownImageCDN) && !isWebPage) {
                return clean;
            }
            // Fall through to name-based auto-matching if it appears to be a webpage URL
        }
    }
    const n = (name || '').toLowerCase();
    
    // Exact cafe assets
    if (n.includes('espresso')) return 'assets/espresso_real_1775865380509.png';
    if (n.includes('latte')) return 'assets/latte_real_1775865471400.png';
    if (n.includes('cappuccino')) return 'assets/cappuccino_real_1775865504766.png';
    if (n.includes('muffin')) return 'assets/blueberry_muffin_real_1775865521281.png';
    if (n.includes('croissant')) return 'assets/croissant_real_1775865539272.png';
    if (n.includes('frap')) return 'assets/iced_frap_real_1775865675708.png';
    if (n.includes('green tea')) return 'assets/green_tea_real_1775866008916.png';
    
    // Smart food category matching based on name
    if (n.includes('mocha')) return 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400&q=80';
    if (n.includes('americano')) return 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=400&q=80';
    if (n.includes('cold brew') || n.includes('iced coffee')) return 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400&q=80';
    if (n.includes('tea') || n.includes('chai')) return 'https://images.unsplash.com/photo-1558857563-b37103eb4d8b?w=400&q=80';
    if (n.includes('ice cream') || n.includes('sundae') || n.includes('gelato')) return 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&q=80';
    if (n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80';
    if (n.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80';
    if (n.includes('sandwich') || n.includes('toast') || n.includes('panini')) return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80';
    if (n.includes('fries') || n.includes('finger')) return 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80';
    if (n.includes('cake') || n.includes('pastry') || n.includes('pie')) return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80';
    if (n.includes('brownie')) return 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80';
    if (n.includes('cookie') || n.includes('biscuit')) return 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80';
    if (n.includes('donut') || n.includes('doughnut')) return 'https://images.unsplash.com/photo-1527515545081-5db817172677?w=400&q=80';
    if (n.includes('pasta') || n.includes('spaghetti')) return 'https://images.unsplash.com/photo-1621996346565-e3d5d6281290?w=400&q=80';
    if (n.includes('shake') || n.includes('smoothie')) return 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80';
    if (n.includes('juice') || n.includes('lemonade') || n.includes('mojito')) return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80';
    if (n.includes('wrap') || n.includes('roll') || n.includes('burrito')) return 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80';
    if (n.includes('salad')) return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80';
    if (n.includes('waffle') || n.includes('pancake')) return 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=400&q=80';
    
    if (n.includes('samosa')) return 'https://images.unsplash.com/photo-1732519970445-8f2d6998961f?w=400&q=80';
    if (n.includes('kachori') || n.includes('pakora') || n.includes('vada') || n.includes('snack')) return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80';
    if (n.includes('maggie') || n.includes('maggi') || n.includes('noodle')) return 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&q=80';
    if (n.includes('biryani') || n.includes('rice')) return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80';
    
    // Default gourmet coffee & cafe food fallback
    return 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&q=80';
}

// Fetch Menu
async function fetchMenu() {
    try {
        const res = await fetch(`${API_URL}/menu`);
        menuItems = await res.json();
        renderMenu(menuItems);
    } catch (error) {
        console.error("Failed to load menu", error);
        menuGrid.innerHTML = `<p style="color:red">Could not connect to server. Please try again...</p>`;
    }
}

// Render Menu
function renderMenu(items) {
    menuGrid.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        const imgUrl = getIconForMenu(item.item_name, item.image_url);
        const fallbackIcon = getIconForMenu(item.item_name, '');
        div.innerHTML = `
            <div class="icon"><img referrerpolicy="no-referrer" src="${imgUrl}" alt="${item.item_name}" onerror="if (this.src !== '${fallbackIcon}') { this.src = '${fallbackIcon}'; } else { this.src='https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&q=80'; }"></div>
            <div class="name">${item.item_name}</div>
            <div class="price">₹${parseFloat(item.price).toFixed(2)}</div>
        `;
        div.addEventListener('click', () => addToCart(item));
        menuGrid.appendChild(div);
    });
}

// Search Menu
document.getElementById('search-menu').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = menuItems.filter(i => i.item_name.toLowerCase().includes(term));
    renderMenu(filtered);
});

// Cart Logic
function addToCart(item, quantity = 1) {
    const existing = cart.find(c => c.item_id === item.item_id);
    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({ ...item, quantity });
    }
    updateCartUI();
}

function updateQuantity(id, delta) {
    const item = cart.find(c => c.item_id === id);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) cart = cart.filter(c => c.item_id !== id);
        updateCartUI();
    }
}

function removeFromCart(id) {
    cart = cart.filter(c => c.item_id !== id);
    updateCartUI();
}

function updateCartUI() {
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-basket-shopping"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        cartSubtotal.innerText = '₹0.00';
        cartTotal.innerText = '₹0.00';
        checkoutBtn.disabled = true;
        return;
    }

    cartItems.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.item_name}</h4>
                <p>₹${parseFloat(item.price).toFixed(2)}</p>
            </div>
            <div class="cart-item-actions">
                <button class="qty-btn" onclick="updateQuantity(${item.item_id}, -1)">-</button>
                <span>${item.quantity}</span>
                <button class="qty-btn" onclick="updateQuantity(${item.item_id}, 1)">+</button>
                <button class="delete-btn" onclick="removeFromCart(${item.item_id})"><i class="fa-regular fa-trash-can"></i></button>
            </div>
        `;
        cartItems.appendChild(div);
    });

    cartSubtotal.innerText = `₹${total.toFixed(2)}`;
    cartTotal.innerText = `₹${total.toFixed(2)}`;
    checkoutBtn.disabled = false;
}

// Voice Recognition Feature
function setupVoiceRecognition() {
    const voiceBtn = document.getElementById('voice-btn');
    const voiceStatus = document.getElementById('voice-status');

    if (!('webkitSpeechRecognition' in window)) {
        console.warn("Speech API not supported in this browser.");
        voiceBtn.title = "Voice ordering not supported in this browser";
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    voiceBtn.addEventListener('click', () => {
        voiceBtn.classList.add('recording');
        voiceStatus.classList.remove('hidden');
        recognition.start();
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        console.log(`Voice Command: ${transcript}`);
        processVoiceCommand(transcript);

        voiceBtn.classList.remove('recording');
        voiceStatus.classList.add('hidden');
    };

    recognition.onerror = () => {
        voiceBtn.classList.remove('recording');
        voiceStatus.classList.add('hidden');
    };

    recognition.onend = () => {
        voiceBtn.classList.remove('recording');
        voiceStatus.classList.add('hidden');
    };
}

function processVoiceCommand(command) {
    // Basic NLP matcher "add 2 latte" or "1 espresso"

    // Check if checking out
    if (command.includes('checkout') || command.includes('print bill') || command.includes('pay')) {
        if (cart.length > 0) checkoutBtn.click();
        return;
    }

    const words = command.split(' ');
    let quantity = 1;

    // Find quantity
    for (let word of words) {
        if (!isNaN(parseInt(word))) {
            quantity = parseInt(word);
            break;
        } else if (word === 'two') quantity = 2;
        else if (word === 'three') quantity = 3;
        else if (word === 'four') quantity = 4;
        else if (word === 'five') quantity = 5;
    }

    // Find item
    let matchedItem = null;
    for (let item of menuItems) {
        // e.g., "espresso" included in transcript
        if (command.includes(item.item_name.toLowerCase())) {
            matchedItem = item;
            break;
        }
    }

    if (matchedItem) {
        addToCart(matchedItem, quantity);
        // Synthetic voice feedback
        const msg = new SpeechSynthesisUtterance(`Added ${quantity} ${matchedItem.item_name}`);
        window.speechSynthesis.speak(msg);
    } else {
        const msg = new SpeechSynthesisUtterance("Sorry, I could not find that item.");
        window.speechSynthesis.speak(msg);
    }
}

// ─── Customer Input Restrictions & Validation ──────────────────────────────────

function setupCustomerInputRestrictions() {
    const phoneInput = document.getElementById('cust-phone');
    const nameInput = document.getElementById('cust-name');
    const phoneErr = document.getElementById('cust-phone-err');
    const nameErr = document.getElementById('cust-name-err');

    if (!phoneInput || !nameInput) return;

    // ── Phone Input: STRICTLY only numeric digits (0-9), max 10 digits ──
    phoneInput.addEventListener('keydown', (e) => {
        // Allow navigation/editing keys: Backspace, Tab, Enter, Delete, Arrow keys, etc.
        const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
            return;
        }
        // If not a digit 0-9, strictly block it
        if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            showInputError(phoneInput, phoneErr, 'Only numbers (0-9) are allowed');
        }
    });

    phoneInput.addEventListener('input', (e) => {
        // Clean out any non-digits that might have been pasted
        const original = e.target.value;
        const cleaned = original.replace(/\D/g, '').slice(0, 10);
        if (original !== cleaned) {
            e.target.value = cleaned;
            showInputError(phoneInput, phoneErr, 'Only numbers allowed (10 digits)');
        } else if (cleaned.length === 10) {
            clearInputError(phoneInput, phoneErr);
        }
    });

    // ── Name Input: STRICTLY only alphabetic letters and spaces (a-z, A-Z, space) ──
    nameInput.addEventListener('keydown', (e) => {
        const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
            return;
        }
        // If not a letter or space, strictly block it
        if (!/^[a-zA-Z\s]$/.test(e.key)) {
            e.preventDefault();
            showInputError(nameInput, nameErr, 'Only letters are allowed');
        }
    });

    nameInput.addEventListener('input', (e) => {
        // Clean out any digits or symbols that might have been pasted
        const original = e.target.value;
        const cleaned = original.replace(/[^a-zA-Z\s]/g, '');
        if (original !== cleaned) {
            e.target.value = cleaned;
            showInputError(nameInput, nameErr, 'Only letters are allowed');
        } else if (cleaned.trim().length >= 2) {
            clearInputError(nameInput, nameErr);
        }
    });
}

function showInputError(inputEl, errEl, msg) {
    if (errEl) {
        errEl.innerText = msg;
        errEl.classList.remove('hidden');
    }
    inputEl.classList.add('invalid-input');
    inputEl.classList.add('input-shake');
    setTimeout(() => inputEl.classList.remove('input-shake'), 400);
}

function clearInputError(inputEl, errEl) {
    if (errEl) {
        errEl.classList.add('hidden');
    }
    inputEl.classList.remove('invalid-input');
}

function validateCustomerInputs() {
    const phoneInput = document.getElementById('cust-phone');
    const nameInput = document.getElementById('cust-name');
    const phoneErr = document.getElementById('cust-phone-err');
    const nameErr = document.getElementById('cust-name-err');

    let isValid = true;

    // Validate Phone Number
    const phone = (phoneInput.value || '').trim();
    if (!phone) {
        showInputError(phoneInput, phoneErr, 'Please enter a 10-digit phone number');
        phoneInput.focus();
        isValid = false;
    } else if (phone.length !== 10) {
        showInputError(phoneInput, phoneErr, `Please enter all 10 digits (You typed: ${phone.length}/10)`);
        phoneInput.focus();
        isValid = false;
    } else {
        clearInputError(phoneInput, phoneErr);
    }

    // Validate Customer Name
    const name = (nameInput.value || '').trim();
    if (!name) {
        showInputError(nameInput, nameErr, 'Please enter the customer name');
        if (isValid) nameInput.focus();
        isValid = false;
    } else if (name.length < 2) {
        showInputError(nameInput, nameErr, 'Name must have at least 2 letters');
        if (isValid) nameInput.focus();
        isValid = false;
    } else {
        clearInputError(nameInput, nameErr);
    }

    return isValid;
}

// ─── Payment Gateway & Online Systems ────────────────────────────────────────

const paymentModal = document.getElementById('payment-modal');
const closePaymentModalBtn = document.getElementById('close-payment-modal');
let upiCountdownInterval = null;

function setupPaymentSystem() {
    setupPaymentTabs();
    setupStripeGateway();
    setupUpiGateway();
    setupWalletGateway();
    setupCashGateway();

    if (closePaymentModalBtn) {
        closePaymentModalBtn.addEventListener('click', closePaymentModal);
    }

    // Check for Stripe redirect returns
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment_success') === 'true') {
        const sessionId = urlParams.get('session_id') || 'STRIPE_SESSION';
        showToast(`🎉 Card Payment Received! Ref: ${sessionId.slice(0, 14)}...`);
        // Clean URL params
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('payment_cancelled') === 'true') {
        showToast('⚠️ Payment was cancelled.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function setupPaymentTabs() {
    const tabs = document.querySelectorAll('.pay-tab');
    const contents = document.querySelectorAll('.pay-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden');
            });

            tab.classList.add('active');
            const targetEl = document.getElementById(target);
            if (targetEl) {
                targetEl.classList.remove('hidden');
                targetEl.classList.add('active');
            }
        });
    });

    // Wallet radio selection visual toggle
    const walletOptions = document.querySelectorAll('.wallet-option');
    walletOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            walletOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            const radio = opt.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });
}

function openPaymentModal() {
    if (cart.length === 0) {
        alert('Your cart is empty. Please add items from the menu first.');
        return;
    }

    // Validate Customer Inputs (Mobile number 10 digits only & Name letters only)
    if (!validateCustomerInputs()) {
        return;
    }

    let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const selectedMethod = document.getElementById('payment-method').value;

    // Update displayed amounts
    const amountStr = `₹${total.toFixed(2)}`;
    document.getElementById('payment-modal-amount').innerText = amountStr;
    document.getElementById('stripe-pay-btn-text').innerText = `Pay ${amountStr} by Card`;
    document.getElementById('cash-modal-total').innerText = amountStr;

    // Reset Cash input
    document.getElementById('cash-tendered-input').value = Math.ceil(total);
    calculateCashChange(total, Math.ceil(total));

    // Generate Dynamic UPI QR Code
    const upiUri = encodeURIComponent(`upi://pay?pa=aura.cafe@okaxis&pn=Aura Cafe&am=${total.toFixed(2)}&cu=INR&tn=Order Payment`);
    document.getElementById('upi-qr-image').src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${upiUri}`;

    // Start UPI 5-minute countdown
    startUpiCountdown(300);

    // Switch to corresponding tab
    if (selectedMethod.includes('UPI')) {
        document.getElementById('tab-btn-upi').click();
    } else if (selectedMethod.includes('Wallet') || selectedMethod.includes('Net Banking')) {
        document.getElementById('tab-btn-wallet').click();
    } else if (selectedMethod.includes('Cash')) {
        document.getElementById('tab-btn-cash').click();
    } else {
        document.getElementById('tab-btn-stripe').click();
    }

    paymentModal.classList.remove('hidden');
}

function closePaymentModal() {
    paymentModal.classList.add('hidden');
    if (upiCountdownInterval) clearInterval(upiCountdownInterval);
}

function startUpiCountdown(durationSeconds) {
    if (upiCountdownInterval) clearInterval(upiCountdownInterval);
    let remaining = durationSeconds;
    const timerDisplay = document.getElementById('upi-countdown');

    const updateTimer = () => {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        if (remaining <= 0) {
            clearInterval(upiCountdownInterval);
            timerDisplay.innerText = "Time Expired";
            timerDisplay.style.color = "var(--danger)";
        }
        remaining--;
    };

    updateTimer();
    upiCountdownInterval = setInterval(updateTimer, 1000);
}

// ─── Stripe Gateway Logic ───
function setupStripeGateway() {
    const payBtn = document.getElementById('stripe-pay-btn');
    const hostedBtn = document.getElementById('stripe-checkout-hosted-btn');
    const errDiv = document.getElementById('stripe-pay-error');

    // Test card autofill buttons
    document.getElementById('btn-autofill-visa').addEventListener('click', () => fillTestCard('4242 4242 4242 4242', 'pm_card_visa'));
    document.getElementById('btn-autofill-mc').addEventListener('click', () => fillTestCard('5555 5555 5555 5555', 'pm_card_mastercard'));
    document.getElementById('btn-autofill-amex').addEventListener('click', () => fillTestCard('3782 8224 6310 005', 'pm_card_amex'));

    // Instant Direct Card Payment via Stripe
    payBtn.addEventListener('click', async () => {
        errDiv.classList.add('hidden');
        errDiv.innerText = '';

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const custName = document.getElementById('cust-name').value || document.getElementById('stripe-cardholder').value || 'Customer';
        const custPhone = document.getElementById('cust-phone').value || '';
        const pmId = payBtn.getAttribute('data-pm') || 'pm_card_visa';

        payBtn.disabled = true;
        payBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing card payment...`;

        try {
            const res = await fetch(`${API_URL}/stripe/pay-card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: total,
                    paymentMethodId: pmId,
                    customerName: custName,
                    customerPhone: custPhone
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                showToast(`💳 Payment Successful! (${data.paymentIntentId})`);
                closePaymentModal();
                await createFinalOrder('Stripe Card', data.paymentIntentId);
            } else {
                errDiv.innerText = data.error || 'Payment failed. Please try again.';
                errDiv.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Stripe error:', err);
            errDiv.innerText = 'Cannot connect to payment server. Please try again.';
            errDiv.classList.remove('hidden');
        } finally {
            payBtn.disabled = false;
            payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> <span>Pay ₹${total.toFixed(2)} by Card</span>`;
        }
    });

    // Hosted Stripe Checkout Page
    hostedBtn.addEventListener('click', async () => {
        const custName = document.getElementById('cust-name').value || 'Walk-in Customer';
        const custPhone = document.getElementById('cust-phone').value || '';

        hostedBtn.disabled = true;
        hostedBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Opening payment page...`;

        try {
            const res = await fetch(`${API_URL}/stripe/checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart.map(c => ({
                        name: c.item_name,
                        price: c.price,
                        quantity: c.quantity
                    })),
                    customerName: custName,
                    customerPhone: custPhone
                })
            });

            const data = await res.json();

            if (res.ok && data.sessionUrl) {
                // Open Stripe Checkout in new window or redirect
                window.location.href = data.sessionUrl;
            } else {
                alert('Could not open payment page: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Cannot connect to payment server.');
        } finally {
            hostedBtn.disabled = false;
            hostedBtn.innerHTML = `<i class="fa-brands fa-stripe-s"></i> Pay on Stripe Page`;
        }
    });
}

function fillTestCard(num, pmId) {
    document.getElementById('stripe-card-num').value = num;
    document.getElementById('stripe-exp').value = '12/28';
    document.getElementById('stripe-cvc').value = '123';
    document.getElementById('stripe-pay-btn').setAttribute('data-pm', pmId);

    const icon = document.getElementById('card-brand-icon');
    if (pmId.includes('mastercard')) {
        icon.className = 'fa-brands fa-cc-mastercard card-brand-icon';
    } else if (pmId.includes('amex')) {
        icon.className = 'fa-brands fa-cc-amex card-brand-icon';
    } else {
        icon.className = 'fa-brands fa-cc-visa card-brand-icon';
    }
}

// ─── UPI Gateway Logic ───
function setupUpiGateway() {
    const copyBtn = document.getElementById('copy-upi-btn');
    const confirmBtn = document.getElementById('upi-confirm-btn');

    copyBtn.addEventListener('click', () => {
        const vpa = document.getElementById('upi-vpa-text').value;
        navigator.clipboard.writeText(vpa).then(() => {
            copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
            setTimeout(() => { copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> Copy`; }, 2000);
        });
    });

    confirmBtn.addEventListener('click', async () => {
        const utr = document.getElementById('upi-utr-input').value.trim();
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking UPI payment...`;

        try {
            const res = await fetch(`${API_URL}/payment/verify-online`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ method: 'UPI', amount: total, referenceId: utr })
            });
            const data = await res.json();

            showToast(`📱 UPI Payment Confirmed! Ref: ${data.transactionId}`);
            closePaymentModal();
            await createFinalOrder('UPI (QR Code)', data.transactionId);
        } catch (e) {
            console.error(e);
            alert('Could not verify UPI payment.');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> I Have Received This UPI Payment`;
        }
    });
}

// ─── Wallets & Net Banking Logic ───
function setupWalletGateway() {
    const confirmBtn = document.getElementById('wallet-confirm-btn');

    confirmBtn.addEventListener('click', async () => {
        const selectedRadio = document.querySelector('input[name="online-wallet"]:checked');
        const walletName = selectedRadio ? selectedRadio.value : 'Digital Wallet';
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing ${walletName}...`;

        try {
            const res = await fetch(`${API_URL}/payment/verify-online`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ method: walletName, amount: total })
            });
            const data = await res.json();

            showToast(`👛 ${walletName} Payment Done! Ref: ${data.transactionId}`);
            closePaymentModal();
            await createFinalOrder(walletName, data.transactionId);
        } catch (e) {
            console.error(e);
            alert('Could not complete wallet payment.');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> Complete Payment`;
        }
    });
}

// ─── Cash Drawer Logic ───
function setupCashGateway() {
    const input = document.getElementById('cash-tendered-input');
    const confirmBtn = document.getElementById('cash-confirm-btn');

    input.addEventListener('input', () => {
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        calculateCashChange(total, parseFloat(input.value) || 0);
    });

    document.getElementById('chip-exact').addEventListener('click', () => {
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        input.value = total.toFixed(2);
        calculateCashChange(total, total);
    });

    document.querySelectorAll('.cash-chip[data-val]').forEach(chip => {
        chip.addEventListener('click', () => {
            const val = parseFloat(chip.getAttribute('data-val'));
            input.value = val;
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            calculateCashChange(total, val);
        });
    });

    confirmBtn.addEventListener('click', async () => {
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tendered = parseFloat(input.value) || total;
        const change = Math.max(0, tendered - total);

        closePaymentModal();
        await createFinalOrder('Cash', `Cash Given: ₹${tendered.toFixed(2)}, Change Returned: ₹${change.toFixed(2)}`);
    });
}

function calculateCashChange(total, tendered) {
    const changeDisplay = document.getElementById('cash-change-display');
    const change = tendered - total;
    if (change < 0) {
        changeDisplay.innerText = `Need more: ₹${Math.abs(change).toFixed(2)}`;
        changeDisplay.style.color = "var(--danger)";
    } else {
        changeDisplay.innerText = `₹${change.toFixed(2)}`;
        changeDisplay.style.color = "var(--success)";
    }
}

// Trigger checkout modal
checkoutBtn.addEventListener('click', () => {
    openPaymentModal();
});

// Final Order Creator
async function createFinalOrder(paymentMethod, transactionId = '') {
    const custName = (document.getElementById('cust-name').value || '').trim() || 'Customer';
    const custPhone = (document.getElementById('cust-phone').value || '').trim() || '0000000000';

    const items = cart.map(c => ({
        item_id: c.item_id,
        quantity: c.quantity,
        price: c.price
    }));

    try {
        const res = await fetch(`${API_URL}/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerName: custName,
                customerPhone: custPhone,
                items,
                paymentMethod,
                transactionId
            })
        });
        const data = await res.json();

        if (res.ok) {
            // Automatically generate and present the official Tax Invoice & Bill
            await displayReceipt(data.orderId);

            // Clear current cart state
            cart = [];
            updateCartUI();

            // Silently refresh analytics metrics in the background
            loadAnalytics();

            showToast(`✅ Order #${data.orderId} Placed — Bill Ready!`);
        } else {
            alert('Could not place order: ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Cannot connect to server to place order.');
    }
}

async function displayReceipt(orderId) {
    try {
        const res = await fetch(`${API_URL}/receipt/${orderId}`);
        const data = await res.json();

        const d = new Date(data.date);
        const formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const formattedTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

        let html = `
            <div class="bill-brand-header">
                <h2>☕ AURA CAFE</h2>
                <div class="bill-brand-sub">Coffee & Cafe Kitchen</div>
                <div class="bill-brand-sub">Connaught Place, New Delhi | Ph: +91 11-4500-2200</div>
                <div class="bill-brand-sub" style="font-weight:700; color:#111827; margin-top:3px; letter-spacing:0.5px;">TAX INVOICE / CASH BILL</div>
            </div>

            <div class="bill-meta-grid">
                <div><span class="bill-meta-label">Bill No:</span> <span class="bill-meta-val">#ORD-${data.orderId}</span></div>
                <div style="text-align:right;"><span class="bill-meta-label">Date:</span> <span class="bill-meta-val">${formattedDate}</span></div>
                <div><span class="bill-meta-label">Time:</span> <span class="bill-meta-val">${formattedTime}</span></div>
                <div style="text-align:right;"><span class="bill-meta-label">Served by:</span> <span class="bill-meta-val">${currentUser ? currentUser.name : 'Staff'}</span></div>
                <div class="full-span" style="border-top:1px dashed #e5e7eb; padding-top:4px; margin-top:2px;">
                    <span class="bill-meta-label">Customer Name:</span> <span class="bill-meta-val">${data.customerName}</span>
                </div>
                <div class="full-span">
                    <span class="bill-meta-label">Phone Number:</span> <span class="bill-meta-val">+91 ${data.customerPhone}</span>
                </div>
            </div>

            <table class="bill-items-table">
                <thead>
                    <tr>
                        <th style="width:45%;">Item</th>
                        <th style="width:15%; text-align:center;">Qty</th>
                        <th style="width:20%; text-align:right;">Price</th>
                        <th style="width:20%; text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(i => `
                        <tr>
                            <td><strong>${i.name}</strong></td>
                            <td style="text-align:center;">${i.quantity}</td>
                            <td style="text-align:right;">₹${parseFloat(i.price).toFixed(2)}</td>
                            <td style="text-align:right;">₹${parseFloat(i.subtotal).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding: 0.2rem 0; color:#4b5563;">
                <span>Subtotal:</span>
                <span>₹${parseFloat(data.totalAmount).toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.82rem; padding: 0.2rem 0; color:#6b7280;">
                <span>GST (Included @ 5%):</span>
                <span>₹${(parseFloat(data.totalAmount) * 0.05).toFixed(2)}</span>
            </div>

            <div class="bill-total-banner">
                <span>TOTAL AMOUNT:</span>
                <span class="bill-grand-total">₹${parseFloat(data.totalAmount).toFixed(2)}</span>
            </div>

            <div class="bill-pay-badge">
                <i class="fa-solid fa-circle-check"></i>
                <span>PAID BY: ${data.paymentMethod}</span>
            </div>

            <div class="bill-footer">
                <div>Thank you for visiting Aura Cafe!</div>
                <div>Fresh coffee served every day | Please visit again</div>
                <div class="bill-barcode-line">||||||||||||||||||||||||||||||</div>
            </div>
        `;

        printableReceipt.innerHTML = html;
        receiptModal.classList.remove('hidden');
    } catch (err) {
        console.error("Failed to load receipt", err);
    }
}
window.displayReceipt = displayReceipt;

// ─── Payment History Logic ───────────────────────────────────────────────────
let allPaymentHistory = [];

async function loadPaymentHistory(search = '') {
    const tbody = document.getElementById('payment-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Loading past payments...</td></tr>';

    try {
        const url = search ? `${API_URL}/payments?search=${encodeURIComponent(search)}` : `${API_URL}/payments`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch payments');
        allPaymentHistory = await res.json();

        // Check active filter
        const activeBtn = document.querySelector('.history-filter-btn.active-filter');
        const filter = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
        applyHistoryFilter(filter);
    } catch (err) {
        console.error('Error loading payment history:', err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--danger);"><i class="fa-solid fa-circle-exclamation"></i> Could not load past payments.</td></tr>';
    }
}

function applyHistoryFilter(filter = 'all') {
    const tbody = document.getElementById('payment-history-tbody');
    if (!tbody) return;

    let filtered = allPaymentHistory;
    if (filter && filter !== 'all') {
        const f = filter.toLowerCase();
        filtered = allPaymentHistory.filter(p => {
            const m = (p.payment_method || '').toLowerCase();
            if (f === 'card') return m.includes('card') || m.includes('stripe');
            if (f === 'net banking') return m.includes('net banking') || m.includes('sbi') || m.includes('hdfc') || m.includes('icici');
            return m.includes(f);
        });
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:3rem 1rem; color:var(--text-secondary);">
                    <i class="fa-solid fa-magnifying-glass" style="font-size:2rem; margin-bottom:0.6rem; opacity:0.6;"></i>
                    <p style="margin:0;">No payments or bills found.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.08)';

        const d = parseOrderTimestamp(p.order_date);
        const formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const formattedTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

        // Highlight method pill
        let badgeColor = '#3b82f6';
        const methodStr = (p.payment_method || 'Cash').toLowerCase();
        if (methodStr.includes('cash')) badgeColor = '#10b981';
        else if (methodStr.includes('upi')) badgeColor = '#8b5cf6';
        else if (methodStr.includes('stripe') || methodStr.includes('card')) badgeColor = '#f59e0b';
        else if (methodStr.includes('net banking')) badgeColor = '#06b6d4';

        tr.innerHTML = `
            <td style="padding:0.9rem 1rem;">
                <span style="font-weight:700; color:var(--accent-color); font-family:monospace; font-size:0.92rem;">#ORD-${p.order_id}</span>
                <div style="font-size:0.75rem; color:var(--text-secondary);">PID #${p.payment_id}</div>
            </td>
            <td style="padding:0.9rem 1rem;">
                <div style="font-weight:500;">${formattedDate}</div>
                <div style="font-size:0.78rem; color:var(--text-secondary);">${formattedTime}</div>
            </td>
            <td style="padding:0.9rem 1rem;">
                <div style="font-weight:600;">${p.customer_name || 'Walk-in'}</div>
                <div style="font-size:0.78rem; color:var(--text-secondary); max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p.item_summary || ''}">${p.item_summary || 'Order Items'}</div>
            </td>
            <td style="padding:0.9rem 1rem;">
                <a href="tel:${p.customer_phone}" style="color:#93c5fd; text-decoration:none; font-family:monospace; font-size:0.9rem;">
                    <i class="fa-solid fa-phone" style="font-size:0.75rem; opacity:0.7;"></i> ${p.customer_phone || 'N/A'}
                </a>
            </td>
            <td style="padding:0.9rem 1rem;">
                <span style="background:rgba(255,255,255,0.08); border-left:3px solid ${badgeColor}; padding:0.25rem 0.6rem; border-radius:4px; font-size:0.8rem; font-weight:600; display:inline-block; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.payment_method}">
                    ${p.payment_method || 'Cash'}
                </span>
            </td>
            <td style="padding:0.9rem 1rem;">
                <strong style="color:#10b981; font-size:0.98rem;">₹${parseFloat(p.total_amount).toFixed(2)}</strong>
            </td>
            <td style="padding:0.9rem 1rem; text-align:right;">
                <button class="btn-secondary btn-view-bill-receipt" data-order-id="${p.order_id}" style="padding:0.35rem 0.75rem; font-size:0.8rem; display:inline-flex; align-items:center; gap:0.35rem;" title="View & Print Bill">
                    <i class="fa-solid fa-receipt"></i> Bill
                </button>
            </td>
        `;

        const billBtn = tr.querySelector('.btn-view-bill-receipt');
        if (billBtn) {
            billBtn.addEventListener('click', () => {
                displayReceipt(p.order_id);
            });
        }

        tbody.appendChild(tr);
    });
}
window.loadPaymentHistory = loadPaymentHistory;

// Modal Actions
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.add('hidden');
    });
});

document.getElementById('new-order-btn').addEventListener('click', () => {
    receiptModal.classList.add('hidden');
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-phone').value = '';
    clearInputError(document.getElementById('cust-phone'), document.getElementById('cust-phone-err'));
    clearInputError(document.getElementById('cust-name'), document.getElementById('cust-name-err'));
});

const viewTrackingBtn = document.getElementById('view-tracking-btn');
if (viewTrackingBtn) {
    viewTrackingBtn.addEventListener('click', () => {
        receiptModal.classList.add('hidden');
        document.getElementById('cust-name').value = '';
        document.getElementById('cust-phone').value = '';
        navTracking.click();
    });
}

document.getElementById('print-btn').addEventListener('click', () => {
    const printWindow = window.open('', '', 'height=650,width=440');
    printWindow.document.write('<html><head><title>Cafe Bill - Aura Cafe</title>');
    printWindow.document.write('<style>body{font-family: "Courier New", monospace; padding: 15px; max-width: 380px; margin: 0 auto; color: #000;} table{width: 100%; border-collapse: collapse;} th, td{padding: 4px 0;} .bill-brand-header{text-align:center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px;} .bill-meta-grid{display:grid; grid-template-columns: 1fr 1fr; font-size: 12px; gap: 4px; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;} .full-span{grid-column: span 2;} .bill-total-banner{display:flex; justify-content:space-between; font-size: 16px; font-weight: bold; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 0; margin: 8px 0;} .bill-grand-total{font-size: 18px; font-weight: 900;} .bill-pay-badge{text-align:center; border: 1px solid #000; padding: 4px; font-weight: bold; font-size: 12px; margin: 6px 0;} .bill-footer{text-align:center; font-size: 11px; margin-top: 10px; border-top: 1px dashed #000; padding-top: 6px;} .bill-barcode-line{letter-spacing: 4px; font-size: 20px; text-align: center; margin-top: 4px;}</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(printableReceipt.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
});

// Analytics Dashboard
let chartCache = {};
async function loadAnalytics() {
    try {
        const res = await fetch(`${API_URL}/stats`);
        const data = await res.json();

        // Parse values safely from MySQL string numbers
        const totalSales = parseFloat(data.metrics.total_sales) || 0;
        const totalOrders = parseInt(data.metrics.total_orders) || 0;
        const avgOrder = parseFloat(data.metrics.avg_order_value) || 0;
        
        document.getElementById('metric-sales').innerText = `₹${totalSales.toFixed(2)}`;
        document.getElementById('metric-orders').innerText = totalOrders;
        document.getElementById('metric-aov').innerText = `₹${avgOrder.toFixed(2)}`;

        const colors = ['rgba(212, 163, 115, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(139, 92, 246, 0.8)'];
        Chart.defaults.color = "rgba(255,255,255,0.7)";

        // Sales Trend Line Chart
        const trendCtx = document.getElementById('salesTrendChart').getContext('2d');
        if (chartCache.trend) chartCache.trend.destroy();
        chartCache.trend = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: data.trends.map(t => new Date(t.date).toLocaleDateString()),
                datasets: [{ label: 'Daily Sales (₹)', data: data.trends.map(t => parseFloat(t.daily_revenue)), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 }]
            },
            options: { scales: { y: { beginAtZero: true } } }
        });

        // Revenue by Method Doughnut
        const pieCtx = document.getElementById('revenuePieChart').getContext('2d');
        if (chartCache.pie) chartCache.pie.destroy();
        chartCache.pie = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: data.revMethods.map(m => m.payment_method),
                datasets: [{ data: data.revMethods.map(m => parseFloat(m.revenue)), backgroundColor: colors, borderWidth: 0 }]
            }
        });

        // Top Popular Items Bar Chart
        const barCtx = document.getElementById('popularItemsChart').getContext('2d');
        if (chartCache.bar) chartCache.bar.destroy();
        chartCache.bar = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: data.topItems.map(i => i.item_name),
                datasets: [{ label: 'Units Sold', data: data.topItems.map(i => parseInt(i.total_sold)), backgroundColor: 'rgba(212, 163, 115, 0.8)', borderRadius: 5 }]
            }
        });

        // Top Customers & Low Performers
        document.getElementById('top-customers-list').innerHTML =
            (data.topCust && data.topCust.length)
            ? data.topCust.map(c => `<li><span>${c.name}</span> <span style="color:#10b981;">${c.total_orders} Orders</span></li>`).join('')
            : '<li>No repeat customers yet</li>';

        document.getElementById('low-perf-list').innerHTML =
            (data.lowItems && data.lowItems.length)
            ? data.lowItems.map(i => `<li><span>${i.item_name}</span> <span style="color:#ef4444;">${parseInt(i.total_sold)} Units</span></li>`).join('')
            : '<li>No data yet</li>';

    } catch (err) { console.error("Failed to load stats", err); }
}

// Order Tracking Logic
let trackingInterval;
const autoDeliveredOrders = new Set(); // Track orders already auto-delivered

// Show a toast notification
function showToast(message, type = 'success') {
    // Remove any existing toast
    const existing = document.getElementById('delivery-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'delivery-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'};
        color: #fff;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        font-family: 'Outfit', sans-serif;
        font-size: 1rem;
        font-weight: 600;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 9999;
        animation: toastSlideIn 0.4s ease forwards;
        max-width: 380px;
    `;
    toast.innerHTML = `
        <i class="fa-solid fa-circle-check" style="font-size:1.4rem;"></i>
        <span>${message}</span>
    `;

    // Inject keyframe animation if not present
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes toastSlideIn {
                from { opacity: 0; transform: translateY(30px) scale(0.9); }
                to   { opacity: 1; transform: translateY(0)   scale(1); }
            }
            @keyframes toastFadeOut {
                from { opacity: 1; transform: translateY(0) scale(1); }
                to   { opacity: 0; transform: translateY(20px) scale(0.9); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function parseOrderTimestamp(dateStr) {
    if (!dateStr) return new Date();
    // SQLite CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" in UTC
    if (typeof dateStr === 'string' && !dateStr.includes('T') && !dateStr.endsWith('Z')) {
        const utcStr = dateStr.replace(' ', 'T') + 'Z';
        const parsed = new Date(utcStr);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? new Date() : fallback;
}

async function loadActiveOrders() {
    try {
        const res = await fetch(`${API_URL}/orders/active`);
        if (!res.ok) throw new Error('Failed to fetch active orders');
        
        const orders = await res.json();
        const grid = document.getElementById('active-orders-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        if (orders.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #888;">No active orders right now.</div>';
            clearInterval(trackingInterval);
            return;
        }

        orders.forEach(order => {
            const el = document.createElement('div');
            el.className = 'metric-card glass-panel';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.alignItems = 'flex-start';
            el.style.gap = '0.5rem';
            el.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem;">
                    <strong>Order #${order.order_id}</strong>
                    <strong class="timer-badge" data-time="${order.order_date}" data-order-id="${order.order_id}" style="color:var(--primary-color)">00:00</strong>
                </div>
                <div style="font-size:0.9rem; color:#ccc;">Customer: ${order.customer_name}</div>
                <ul style="padding-left:1.2rem; margin:0.5rem 0; width:100%; font-size:0.9rem;">
                    ${order.items.map(i => `<li>${i.quantity}x ${i.item_name}</li>`).join('')}
                </ul>
                <button class="btn-primary btn-mark-delivered" style="margin-top:auto; width:100%; align-self:center;" data-order-id="${order.order_id}">
                    <i class="fa-solid fa-check"></i> Mark as Delivered
                </button>
            `;
            const delBtn = el.querySelector('.btn-mark-delivered');
            if (delBtn) {
                delBtn.addEventListener('click', () => markDelivered(order.order_id));
            }
            grid.appendChild(el);
        });

        // Start live timer updates and periodic fetch
        clearInterval(trackingInterval);
        
        // Update local timers every second
        trackingInterval = setInterval(() => {
            updateOrderTimers();
            // Poll for fresh orders every 5 seconds
            if (new Date().getSeconds() % 5 === 0) {
               fetchFreshActiveOrdersSilent();
            }
        }, 1000);
        
        updateOrderTimers();

    } catch (err) {
        console.error('Error loading active orders:', err);
    }
}

async function fetchFreshActiveOrdersSilent() {
    try {
        const res = await fetch(`${API_URL}/orders/active`);
        if (!res.ok) return;
        const freshOrders = await res.json();
        
        if (trackingWorkspace && trackingWorkspace.classList.contains('active')) {
             const currentNodes = document.querySelectorAll('#active-orders-grid .metric-card');
             if (freshOrders.length !== currentNodes.length) {
                 loadActiveOrders();
             }
        }
    } catch (e) {
        // ignore idle fetch errors
    }
}

function updateOrderTimers() {
    const badges = document.querySelectorAll('.timer-badge');
    const now = new Date();

    badges.forEach(badge => {
        const orderId = parseInt(badge.getAttribute('data-order-id'));
        const orderTime = parseOrderTimestamp(badge.getAttribute('data-time'));
        const diffMs = now - orderTime;

        if (diffMs < 0) {
            badge.innerText = '00:00';
            return;
        }

        const diffSecs = Math.floor(diffMs / 1000);
        const mins = Math.floor(diffSecs / 60);
        const secs = diffSecs % 60;

        // Auto-deliver after 15 minutes of elapsed time
        if (mins >= 15 && orderId && !autoDeliveredOrders.has(orderId)) {
            autoDeliveredOrders.add(orderId);
            badge.innerText = '15:00';
            badge.style.color = 'var(--danger)';

            showToast(`🎉 Order #${orderId} marked delivered!`);
            markDelivered(orderId);
            return;
        }

        if (mins >= 30) {
            badge.innerText = `30:00+`;
            badge.style.color = 'var(--danger)';
        } else {
            badge.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            if (mins >= 10) {
                badge.style.color = 'var(--danger)';
            } else if (mins >= 5) {
                badge.style.color = '#f59e0b';
            } else {
                badge.style.color = 'var(--primary-color)';
            }
        }
    });
}

async function markDelivered(orderId) {
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}/deliver`, {
            method: 'PUT'
        });
        const data = await res.json();
        if (res.ok) {
            showToast(`✅ Order #${orderId} delivered!`);
            loadActiveOrders();
        } else {
            alert('Could not update order: ' + (data.error || 'Unknown error'));
        }
    } catch(err) {
        console.error('Error delivering order:', err);
    }
}
window.markDelivered = markDelivered;

// Menu Management Logic
const menuModal = document.getElementById('menu-modal');

async function loadMenuMgmt() {
    updateMgmtAdminBanner();
    try {
        const res = await fetch(`${API_URL}/menu`);
        const items = await res.json();
        
        const tbody = document.getElementById('mgmt-menu-tbody');
        tbody.innerHTML = '';
        
        const adminActive = isAdmin();
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            const actionButtonsHtml = adminActive ? `
                <button class="btn-secondary btn-edit-item" data-id="${item.item_id}" data-name="${item.item_name.replace(/"/g, '&quot;')}" data-price="${item.price}" data-image="${(item.image_url || '').replace(/"/g, '&quot;')}" style="padding:0.4rem 0.8rem; font-size:0.8rem; margin-right:0.4rem;" title="Edit Item (Admin Required)">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="btn-primary btn-del-item" data-id="${item.item_id}" data-name="${item.item_name.replace(/"/g, '&quot;')}" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:var(--danger); border-color:var(--danger);" title="Delete Item (Admin Required)">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            ` : ``;
            const iconSrc = getIconForMenu(item.item_name, item.image_url);
            tr.innerHTML = `
                <td style="padding:1rem;">${item.item_id}</td>
                <td style="padding:1rem; font-weight:600; display:flex; align-items:center; gap:0.8rem;">
                    <img referrerpolicy="no-referrer" src="${iconSrc}" alt="${item.item_name}" style="width:36px; height:36px; border-radius:6px; object-fit:cover; border:1px solid rgba(255,255,255,0.15);" onerror="this.src='https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&q=80'">
                    <span>${item.item_name}</span>
                </td>
                <td style="padding:1rem; color:var(--accent-color); font-weight:700;">₹${parseFloat(item.price).toFixed(2)}</td>
                <td style="padding:1rem; text-align:right;">
                    ${actionButtonsHtml}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Attach action handlers with Admin verification
        tbody.querySelectorAll('.btn-edit-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                const price = btn.getAttribute('data-price');
                const image = btn.getAttribute('data-image');
                promptAdminAuth(() => openMenuModal(id, name, price, image));
            });
        });

        tbody.querySelectorAll('.btn-del-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                promptAdminAuth(() => deleteMenuItem(id, name));
            });
        });

    } catch (err) { console.error(err); }
}

document.getElementById('add-menu-btn').addEventListener('click', () => {
    promptAdminAuth(() => openMenuModal());
});

document.getElementById('close-menu-modal').addEventListener('click', () => menuModal.classList.add('hidden'));

function updateModalPreview() {
    const name = (document.getElementById('menu-item-name').value || '').trim();
    let customImg = (document.getElementById('menu-item-image').value || '').trim();
    const previewEl = document.getElementById('menu-item-preview');
    const statusEl = document.getElementById('menu-item-preview-status');
    const titleEl = document.getElementById('menu-item-preview-title');

    if (!previewEl) return;

    if (customImg) {
        if (customImg.startsWith('//')) {
            customImg = 'https:' + customImg;
        }

        // Test if this is likely a webpage/article URL rather than a direct image file
        const lowerUrl = customImg.toLowerCase().split('?')[0];
        const isHtmlPage = lowerUrl.endsWith('.html') || lowerUrl.endsWith('.htm') || lowerUrl.endsWith('/');
        // Also check: URL has no image extension AND is not a known image CDN
        const hasImageExt = /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|tiff?)$/i.test(lowerUrl);
        const isKnownImageCDN = lowerUrl.includes('images.unsplash.com')
            || lowerUrl.includes('unsplash.com/photo')
            || lowerUrl.includes('cloudinary.com')
            || lowerUrl.includes('imgur.com')
            || lowerUrl.includes('pexels.com')
            || lowerUrl.includes('pixabay.com')
            || lowerUrl.includes('googleusercontent.com')
            || lowerUrl.includes('wp-content/uploads')
            || customImg.startsWith('data:image/');
        const isWebpageUrl = isHtmlPage || (!hasImageExt && !isKnownImageCDN);

        if (titleEl) titleEl.innerText = "Custom Image Link";

        if (isWebpageUrl) {
            const fallback = getIconForMenu(name, '');
            previewEl.src = fallback;
            if (statusEl) {
                statusEl.innerHTML = "⚠️ This is a <strong>webpage link</strong>, not an image link.<br>🔍 <em>Right-click image → click 'Copy image address'</em> and paste it here.";
                statusEl.style.color = "#f87171";
            }
            return;
        }

        if (statusEl) {
            statusEl.innerText = "Loading picture...";
            statusEl.style.color = "var(--accent-color)";
        }
        
        let imgTested = new Image();
        imgTested.referrerPolicy = "no-referrer";
        imgTested.onload = () => {
            if ((document.getElementById('menu-item-image').value || '').trim() === customImg) {
                previewEl.src = customImg;
                if (statusEl) {
                    statusEl.innerText = "✓ Picture loaded successfully!";
                    statusEl.style.color = "#4ade80";
                }
            }
        };

        imgTested.onerror = () => {
            if ((document.getElementById('menu-item-image').value || '').trim() === customImg) {
                const fallback = getIconForMenu(name, '');
                previewEl.src = fallback;
                if (statusEl) {
                    statusEl.innerHTML = "⚠️ Could not load picture. Right-click picture &amp; choose <em>'Copy image address'</em>.";
                    statusEl.style.color = "#fbbf24";
                }
            }
        };

        imgTested.src = customImg;
    } else {
        const autoSrc = getIconForMenu(name, '');
        previewEl.onload = null;
        previewEl.onerror = () => {
            previewEl.src = 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&q=80';
        };
        previewEl.src = autoSrc;

        if (titleEl) titleEl.innerText = name ? "Matched Photo" : "Default Photo";
        if (statusEl) {
            statusEl.innerText = name 
                ? `Matched for "${name}". Paste link above to change.`
                : "Type an item name or paste an image link.";
            statusEl.style.color = "var(--text-secondary)";
        }
    }
}

const nameInput = document.getElementById('menu-item-name');
const imgInput = document.getElementById('menu-item-image');
if (nameInput) {
    ['input', 'keyup', 'change'].forEach(evt => nameInput.addEventListener(evt, updateModalPreview));
}
if (imgInput) {
    ['input', 'keyup', 'change', 'blur'].forEach(evt => imgInput.addEventListener(evt, updateModalPreview));
    imgInput.addEventListener('paste', () => {
        setTimeout(updateModalPreview, 10);
        setTimeout(updateModalPreview, 100);
    });
}

function openMenuModal(id = '', name = '', price = '', imageUrl = '') {
    document.getElementById('menu-modal-title').innerText = id ? 'Edit Menu Item' : 'Add Menu Item';
    document.getElementById('menu-item-id').value = id;
    document.getElementById('menu-item-name').value = name;
    document.getElementById('menu-item-price').value = price;
    document.getElementById('menu-item-image').value = imageUrl || '';
    updateModalPreview();
    menuModal.classList.remove('hidden');
}

document.getElementById('save-menu-btn').addEventListener('click', async () => {
    const id = document.getElementById('menu-item-id').value;
    const name = document.getElementById('menu-item-name').value.trim();
    const price = document.getElementById('menu-item-price').value;
    const customImageVal = document.getElementById('menu-item-image').value.trim();

    // Determine what image URL to store:
    let imageUrl = '';
    if (customImageVal) {
        const resolvedFromCustom = getIconForMenu(name, customImageVal);
        const isValidImageLink = resolvedFromCustom === customImageVal
            || resolvedFromCustom === 'https:' + customImageVal.replace(/^\/\//, '');
        imageUrl = isValidImageLink ? customImageVal : getIconForMenu(name, '');
    } else {
        imageUrl = getIconForMenu(name, '');
    }

    if (!name || !price) {
        alert("Please enter both name and price");
        return;
    }

    const token = localStorage.getItem('aura_token');
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/menu/${id}` : `${API_URL}/menu`;

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ item_name: name, price: parseFloat(price), image_url: imageUrl })
        });
        const data = await res.json();
        if (data.success) {
            menuModal.classList.add('hidden');
            showToast(id ? `✅ Item "${name}" updated!` : `🎉 Item "${name}" added to menu!`);
            loadMenuMgmt(); // refresh mgmt table
            fetchMenu(); // refresh POS grid globally!
        } else if (res.status === 401 || res.status === 403) {
            menuModal.classList.add('hidden');
            promptAdminAuth(() => openMenuModal(id, name, price, imageUrl));
        } else {
            alert("Error: " + (data.error || "Could not save menu item"));
        }
    } catch (err) {
        console.error(err);
        alert("Cannot connect to server while saving menu item.");
    }
});

async function deleteMenuItem(id, itemName = 'item') {
    if (!confirm(`Are you sure you want to delete "${itemName}" from the menu?`)) return;
    
    const token = localStorage.getItem('aura_token');

    try {
        const res = await fetch(`${API_URL}/menu/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();
        if (data.success) {
            showToast(`🗑️ "${itemName}" was deleted from the menu.`);
            loadMenuMgmt();
            fetchMenu();
        } else if (res.status === 401 || res.status === 403) {
            promptAdminAuth(() => deleteMenuItem(id, itemName));
        } else {
            alert("Could not delete item: " + (data.error || "Server error"));
        }
    } catch (err) {
        console.error(err);
        alert("Cannot connect to server while deleting menu item.");
    }
}
