const API_URL = 'http://localhost:5001/api';

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
const navMgmt = document.getElementById('nav-mgmt');
const navStats = document.getElementById('nav-stats');
const posWorkspace = document.getElementById('pos-workspace');
const trackingWorkspace = document.getElementById('tracking-workspace');
const mgmtWorkspace = document.getElementById('mgmt-workspace');
const statsWorkspace = document.getElementById('stats-workspace');

let currentUser = null;
const loginModal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    fetchMenu();
    setupNavigation();
    setupVoiceRecognition();
    setupAuthToggles(); // New: Setup view switches and password toggles
});

function setupAuthToggles() {
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const loginTitle = document.querySelector('#login-modal h2');

    // View Switching
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        loginView.classList.add('hidden');
        signupView.classList.remove('hidden');
        loginTitle.innerText = 'Staff Signup';
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        signupView.classList.add('hidden');
        loginView.classList.remove('hidden');
        loginTitle.innerText = 'Staff Login';
    });

    // Password Visibility Toggles
    const setupToggle = (btnId, inputId) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        btn.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.classList.toggle('fa-eye', isPassword);
            btn.classList.toggle('fa-eye-slash', !isPassword);
        });
    };

    setupToggle('toggle-login-password', 'login-password');
    setupToggle('toggle-signup-password', 'signup-password');
}

function checkAuth() {
    const saved = localStorage.getItem('aura_staff');
    if (saved) {
        currentUser = JSON.parse(saved);
        document.getElementById('user-name').innerText = currentUser.name;
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${currentUser.name}&background=d4a373&color=fff`;
        loginModal.classList.add('hidden');
    } else {
        loginModal.classList.remove('hidden');
    }
}

loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value; // Changed from name to password
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
            checkAuth();
        } else {
            errDiv.innerText = data.error;
        }
    } catch (err) {
        errDiv.innerText = "Server error. Make sure backend is running.";
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
        errDiv.innerText = "All fields are required.";
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
        errDiv.innerText = "Server error during signup.";
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
    const allWorkspaces = [posWorkspace, trackingWorkspace, mgmtWorkspace, statsWorkspace];
    const allNavs = [navPos, navTracking, navMgmt, navStats];

    const switchTab = (activeNav, activeWorkspace, action) => {
        allNavs.forEach(n => n.parentElement.classList.remove('active'));
        allWorkspaces.forEach(w => {
            w.classList.remove('active');
            w.classList.add('hidden');
        });

        activeNav.parentElement.classList.add('active');
        activeWorkspace.classList.add('active');
        activeWorkspace.classList.remove('hidden');

        if (action) action();
    };

    navPos.addEventListener('click', (e) => { e.preventDefault(); switchTab(navPos, posWorkspace); });
    navTracking.addEventListener('click', (e) => { e.preventDefault(); switchTab(navTracking, trackingWorkspace, loadActiveOrders); });
    navMgmt.addEventListener('click', (e) => { e.preventDefault(); switchTab(navMgmt, mgmtWorkspace, loadMenuMgmt); });
    navStats.addEventListener('click', (e) => { e.preventDefault(); switchTab(navStats, statsWorkspace, loadAnalytics); });
}

function getIconForMenu(name) {
    const n = name.toLowerCase();
    if (n.includes('espresso')) return 'assets/espresso_real_1775865380509.png';
    if (n.includes('latte')) return 'assets/latte_real_1775865471400.png';
    if (n.includes('cappuccino')) return 'assets/cappuccino_real_1775865504766.png';
    if (n.includes('muffin')) return 'assets/blueberry_muffin_real_1775865521281.png';
    if (n.includes('croissant')) return 'assets/croissant_real_1775865539272.png';
    if (n.includes('frap')) return 'assets/iced_frap_real_1775865675708.png';
    if (n.includes('green tea')) return 'assets/green_tea_real_1775866008916.png';
    if (n.includes('milk tea')) return 'https://images.unsplash.com/photo-1558857563-b37103eb4d8b?w=400&q=80';
    if (n.includes('ice cream')) return 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&q=80';
    if (n.includes('green tea')) return 'assets/green_tea_real_1775866008916.png';
    if (n.includes('milk tea')) return 'https://images.unsplash.com/photo-1558857563-b37103eb4d8b?w=400&q=80';
    if (n.includes('ice cream')) return 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&q=80';
    return '';
}

// Fetch Menu
async function fetchMenu() {
    try {
        const res = await fetch(`${API_URL}/menu`);
        menuItems = await res.json();
        renderMenu(menuItems);
    } catch (error) {
        console.error("Failed to load menu", error);
        menuGrid.innerHTML = `<p style="color:red">Failed to connect to backend...</p>`;
    }
}

// Render Menu
function renderMenu(items) {
    menuGrid.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `
            <div class="icon"><img src="${getIconForMenu(item.item_name)}" alt="${item.item_name}" onerror="this.src='https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&q=80'"></div>
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
                <p>Cart is empty</p>
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
        voiceBtn.title = "Voice Input Unsupported";
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
    if (command.includes('checkout') || command.includes('print bill')) {
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
        // Optional synthetic voice feedback
        const msg = new SpeechSynthesisUtterance(`Added ${quantity} ${matchedItem.item_name}`);
        window.speechSynthesis.speak(msg);
    } else {
        const msg = new SpeechSynthesisUtterance("Sorry, I didn't recognize that item.");
        window.speechSynthesis.speak(msg);
    }
}

// Checkout and Receipt
checkoutBtn.addEventListener('click', async () => {
    const custName = document.getElementById('cust-name').value || 'Walk-in Customer';
    const custPhone = document.getElementById('cust-phone').value || `000-${Math.floor(Math.random() * 10000)}`;
    const paymentMethod = document.getElementById('payment-method').value;

    const items = cart.map(c => ({
        item_id: c.item_id,
        quantity: c.quantity,
        price: c.price
    }));

    try {
        const res = await fetch(`${API_URL}/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerName: custName, customerPhone: custPhone, items, paymentMethod })
        });
        const data = await res.json();

        if (res.ok) {
            await displayReceipt(data.orderId);
            cart = [];
            updateCartUI();
            document.getElementById('cust-name').value = '';
            document.getElementById('cust-phone').value = '';
            // Silently refresh analytics data in the background after every order
            loadAnalytics();
            
            // Automatically switch to the Order Tracking tab to view the new order
            navTracking.click();
        } else {
            alert('Checkout failed: ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Server Error during checkout.');
    }
});

async function displayReceipt(orderId) {
    try {
        const res = await fetch(`${API_URL}/receipt/${orderId}`);
        const data = await res.json();

        const d = new Date(data.date);

        let html = `
            <div class="receipt-header">
                <h2>Aura Cafe</h2>
                <p>Order #${data.orderId}</p>
                <p>${d.toLocaleString()}</p>
                <p>Customer: ${data.customerName}</p>
            </div>
            <div class="receipt-items">
                ${data.items.map(i => `
                    <div class="receipt-item">
                        <span>${i.quantity}x ${i.name}</span>
                        <span>₹${i.subtotal.toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="receipt-total">
                <span>Total (${data.paymentMethod})</span>
                <span>₹${data.totalAmount.toFixed(2)}</span>
            </div>
            <div style="text-align:center; margin-top:20px; font-size: 0.8rem; border-top:1px dashed #ccc; padding-top:10px;">
                Thank you, come again!
            </div>
        `;

        printableReceipt.innerHTML = html;
        receiptModal.classList.remove('hidden');
    } catch (err) {
        console.error("Failed to load receipt", err);
    }
}

// Modal Actions
document.querySelector('.close-modal').addEventListener('click', () => {
    receiptModal.classList.add('hidden');
});

document.getElementById('new-order-btn').addEventListener('click', () => {
    receiptModal.classList.add('hidden');
});

document.getElementById('print-btn').addEventListener('click', () => {
    const printWindow = window.open('', '', 'height=600,width=400');
    printWindow.document.write('<html><head><title>Receipt</title>');
    printWindow.document.write('<style>body{font-family: monospace; padding: 20px;} .receipt-header{text-align:center;border-bottom:1px dashed #000;padding-bottom:10px;margin-bottom:10px;} .receipt-item, .receipt-total{display:flex; justify-content:space-between; margin-bottom:5px;} .receipt-total{border-top:1px dashed #000; padding-top:10px; font-weight:bold;}</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(printableReceipt.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
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
                datasets: [{ label: 'Daily Revenue (₹)', data: data.trends.map(t => parseFloat(t.daily_revenue)), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 }]
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

async function loadActiveOrders() {
    try {
        const res = await fetch(`${API_URL}/orders/active`);
        if (!res.ok) throw new Error('Failed to fetch active orders');
        
        const orders = await res.json();
        const grid = document.getElementById('active-orders-grid');
        grid.innerHTML = '';
        
        if (orders.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #888;">No active orders pending.</div>';
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
                <button class="btn-primary" style="margin-top:auto; width:100%; align-self:center;" onclick="markDelivered(${order.order_id})">
                    <i class="fa-solid fa-check"></i> Mark Delivered
                </button>
            `;
            grid.appendChild(el);
        });

        // Start live timer updates and periodic fetch
        clearInterval(trackingInterval);
        
        // Update local timers every second
        trackingInterval = setInterval(() => {
            updateOrderTimers();
            // Poll for fresh orders every 10 seconds
            if (new Date().getSeconds() % 10 === 0) {
               fetchFreshActiveOrdersSilent();
            }
        }, 1000);
        
        updateOrderTimers();

    } catch (err) {
        console.error(err);
    }
}

async function fetchFreshActiveOrdersSilent() {
    try {
        const res = await fetch(`${API_URL}/orders/active`);
        if (!res.ok) return;
        const freshOrders = await res.json();
        
        // Instead of clobbering the whole DOM, we can just do a full reload if the lengths differ
        // Or simple version: just reload if there are newly pending orders. 
        // For Cafe KDS, full reloading is fine because the staff only click 'Mark Delivered' which will refresh.
        // We'll just softly call loadActiveOrders() if it's the active tab.
        if (trackingWorkspace.classList.contains('active')) {
             // Only reload if order length differs to prevent flashing, or just fetch the data and compare
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
        const orderTime = new Date(badge.getAttribute('data-time'));
        const diffMs = now - orderTime;

        if (diffMs < 0) return; // Order time is slightly in the future due to server clock sync

        const diffSecs = Math.floor(diffMs / 1000);
        const mins = Math.floor(diffSecs / 60);
        const secs = diffSecs % 60;

        // ✅ AUTO-DELIVER after 10 minutes
        if (mins >= 10 && orderId && !autoDeliveredOrders.has(orderId)) {
            autoDeliveredOrders.add(orderId);
            badge.innerText = '10:00';
            badge.style.color = 'var(--danger)';

            // Show delivery successful toast
            showToast(`🎉 Order #${orderId} — Delivery Successful!`);

            // Auto mark as delivered on backend
            markDelivered(orderId);
            return;
        }

        if (mins >= 30) {
            badge.innerText = `30:00+`;
            badge.style.color = 'var(--danger)';
        } else {
            badge.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            // Color coding for urgency
            if (mins >= 10) {
                badge.style.color = 'var(--danger)'; // Red for > 10 mins
            } else if (mins >= 5) {
                badge.style.color = '#f59e0b'; // Orange for > 5 mins
            } else {
                badge.style.color = 'var(--primary-color)'; // Default
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
            console.log(`Order ${orderId} delivered in ${data.delivery_stats.time_taken_seconds} seconds.`);
            loadActiveOrders(); // Refresh table
        } else {
            alert('Failed to update: ' + data.error);
        }
    } catch(err) {
        console.error(err);
    }
}

// Menu Management Logic
const menuModal = document.getElementById('menu-modal');

async function loadMenuMgmt() {
    try {
        const res = await fetch(`${API_URL}/menu`);
        const items = await res.json();
        
        const tbody = document.getElementById('mgmt-menu-tbody');
        tbody.innerHTML = '';
        
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            tr.innerHTML = `
                <td style="padding:1rem;">${item.item_id}</td>
                <td style="padding:1rem;">${item.item_name}</td>
                <td style="padding:1rem;">₹${parseFloat(item.price).toFixed(2)}</td>
                <td style="padding:1rem; text-align:right;">
                    <button class="btn-secondary" onclick="openMenuModal(${item.item_id}, '${item.item_name.replace(/'/g, "\\'")}', ${item.price})" style="padding:0.4rem 0.8rem; font-size:0.8rem;"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-primary" onclick="deleteMenuItem(${item.item_id})" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:var(--danger); border-color:var(--danger);"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}

document.getElementById('add-menu-btn').addEventListener('click', () => openMenuModal());
document.getElementById('close-menu-modal').addEventListener('click', () => menuModal.classList.add('hidden'));

function openMenuModal(id = '', name = '', price = '') {
    document.getElementById('menu-modal-title').innerText = id ? 'Edit Menu Item' : 'Add Menu Item';
    document.getElementById('menu-item-id').value = id;
    document.getElementById('menu-item-name').value = name;
    document.getElementById('menu-item-price').value = price;
    menuModal.classList.remove('hidden');
}

document.getElementById('save-menu-btn').addEventListener('click', async () => {
    const id = document.getElementById('menu-item-id').value;
    const name = document.getElementById('menu-item-name').value;
    const price = document.getElementById('menu-item-price').value;
    
    if(!name || !price) { alert("Please enter both name and price"); return; }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/menu/${id}` : `${API_URL}/menu`;

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_name: name, price })
        });
        const data = await res.json();
        if (data.success) {
            menuModal.classList.add('hidden');
            loadMenuMgmt(); // refresh mgmt table
            fetchMenu(); // refresh POS grid globally!
        } else {
            alert("Error: " + data.error);
        }
    } catch (err) {
        console.error(err);
    }
});

async function deleteMenuItem(id) {
    if(!confirm("Are you sure you want to delete this menu item? Related order details will also be deleted.")) return;
    
    try {
        const res = await fetch(`${API_URL}/menu/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            loadMenuMgmt();
            fetchMenu();
        } else {
            alert("Delete failed: " + data.error);
        }
    } catch(err) { console.error(err); }
}
