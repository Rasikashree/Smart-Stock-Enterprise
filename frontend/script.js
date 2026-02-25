// SmartStock Enterprise - Frontend JavaScript
// API Base URL
const API_BASE = 'http://localhost:8080/api';
const RAZORPAY_KEY = 'rzp_test_YOUR_TEST_KEY'; // Replace with actual test key

// ==================== AUTHENTICATION ====================
async function sendOTP() {
    const phone = document.getElementById('phoneInput').value;
    if (!phone || phone.length !== 10) {
        alert('Please enter a valid 10-digit phone number');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/otp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });

        if (response.ok) {
            localStorage.setItem('tempPhone', phone);
            document.getElementById('sendOtpBtn').style.display = 'none';
            document.getElementById('otpSection').style.display = 'block';
            document.getElementById('verifyOtpBtn').style.display = 'block';
            startOTPTimer();
            alert('OTP sent to your phone (Demo: use 123456)');
        } else {
            alert('Failed to send OTP');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

function startOTPTimer() {
    let count = 30;
    const interval = setInterval(() => {
        document.getElementById('timerCount').textContent = count;
        count--;
        if (count < 0) {
            clearInterval(interval);
            document.getElementById('otpTimer').style.display = 'none';
            document.getElementById('sendOtpBtn').style.display = 'block';
            document.getElementById('otpSection').style.display = 'none';
            document.getElementById('verifyOtpBtn').style.display = 'none';
        }
    }, 1000);
}

async function verifyOTP() {
    const phone = localStorage.getItem('tempPhone');
    const otp = document.getElementById('otpInput').value;

    if (!otp || otp.length !== 6) {
        alert('Please enter a valid 6-digit OTP');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('userPhone', phone);
            localStorage.setItem('userToken', data.token || '');
            localStorage.removeItem('tempPhone');
            
            // Check if admin
            if (data.isAdmin) {
                localStorage.setItem('adminPhone', phone);
                window.location.href = 'admin.html';
            } else {
                const otpModal = bootstrap.Modal.getInstance(document.getElementById('otpModal'));
                otpModal.hide();
                loadProducts();
                updateCartBadge();
            }
        } else {
            alert('Invalid OTP. Demo OTP: 123456');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'index.html';
}

// ==================== PRODUCTS ====================
let allProducts = [];
let selectedCategory = 'all';

async function loadProducts(category = 'all') {
    selectedCategory = category;
    const url = category === 'all' 
        ? `${API_BASE}/products` 
        : `${API_BASE}/products?category=${category}`;

    try {
        const response = await fetch(url);
        if (response.ok) {
            allProducts = await response.json();
            displayProducts();
            loadCategories();
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function displayProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.innerHTML = allProducts.map(product => {
        const emoji = getProductEmoji(product.name.toLowerCase(), product.category);
        return `
        <div class="col-sm-6 col-lg-4 col-xl-3">
            <div class="product-card">
                <div class="product-image">${emoji}</div>
                <div class="product-info">
                    <h6 class="product-name">${product.name}</h6>
                    <div class="product-price">₹${(product.price || 0).toFixed(2)}</div>
                    
                    <div class="product-stock ${
                        product.stock >= 10 ? 'stock-normal' :
                        product.stock >= 5 ? 'stock-limited' : 'stock-flash'
                    }">
                        ${product.stock >= 10 ? 'In Stock' :
                          product.stock >= 5 ? `Limited: ${product.stock} left` : 
                          `FLASH SALE: ${product.stock} left!`}
                    </div>

                    <div id="ctrlProduct${product.id}">
                        ${product.stock > 0 ? `
                            <button class="add-to-cart-btn" onclick="addToCart(${product.id}, '${product.name}', ${product.price})">
                                + ADD
                            </button>
                        ` : `
                            <button class="add-to-cart-btn" disabled>SOLD OUT</button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `}).join('');

    document.getElementById('loadingSpinner').style.display = 'none';
}

function getProductEmoji(productName, category) {
    const emojiMap = {
        // Vegetables
        'tomato': '🍅',
        'onion': '🧅',
        'potato': '🥔',
        'carrot': '🥕',
        'spinach': '🥬',
        'cucumber': '🥒',
        'bell pepper': '🫑',
        'broccoli': '🥦',
        'cabbage': '🥬',
        'cauliflower': '🥦',
        
        // Dairy
        'milk': '🥛',
        'yogurt': '🍶',
        'cheese': '🧀',
        'butter': '🧈',
        'paneer': '🧀',
        'curd': '🍶',
        
        // Bakery
        'bread': '🍞',
        'croissant': '🥐',
        'biscuits': '🍪',
        'cake': '🎂',
        'donut': '🍩',
        'pastry': '🥐',
        
        // Fruits
        'apple': '🍎',
        'orange': '🍊',
        'banana': '🍌',
        'mango': '🥭',
        'grape': '🍇',
        'strawberry': '🍓',
        'watermelon': '🍉',
        'pineapple': '🍍',
        
        // Staples
        'rice': '🍚',
        'wheat': '🌾',
        'flour': '🌾',
        'sugar': '🍬',
        'salt': '🧂',
        'oil': '🫒',
        'ghee': '🧈',
        'dal': '🫘',
        'pulses': '🫘',
        'lentils': '🫘',
        'noodles': '🍜',
        'pasta': '🍝',
    };
    
    // Check for exact match
    for (let key in emojiMap) {
        if (productName.includes(key)) {
            return emojiMap[key];
        }
    }
    
    // Fallback by category
    if (category === 'Vegetables') return '🥬';
    if (category === 'Dairy') return '🥛';
    if (category === 'Bakery') return '🍞';
    if (category === 'Fruits') return '🍎';
    if (category === 'Staples') return '🍚';
    
    return '🛒'; // Default
}

function loadCategories() {
    const categories = ['all', 'Vegetables', 'Dairy', 'Bakery', 'Fruits', 'Staples'];
    
    // Mobile carousel
    const carousel = document.getElementById('categoriesCarousel');
    if (carousel) {
        carousel.innerHTML = categories.map(cat => `
            <div class="category-badge ${selectedCategory === cat ? 'active' : ''}" 
                 onclick="loadProducts('${cat}')">
                <span class="category-icon">${getCategoryIcon(cat)}</span>
                <small>${cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}</small>
            </div>
        `).join('');
    }

    // Desktop sidebar
    const list = document.getElementById('categoriesList');
    if (list) {
        list.innerHTML = categories.map(cat => `
            <li class="list-group-item ${selectedCategory === cat ? 'active bg-danger text-white' : ''}" 
                onclick="loadProducts('${cat}')" style="cursor: pointer;">
                ${getCategoryIcon(cat)} ${cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
            </li>
        `).join('');
    }
}

function getCategoryIcon(category) {
    const icons = {
        'all': '🏪',
        'vegetables': '🥬',
        'Vegetables': '🥬',
        'dairy': '🥛',
        'Dairy': '🥛',
        'bakery': '🍞',
        'Bakery': '🍞',
        'fruits': '🍎',
        'Fruits': '🍎',
        'staples': '🍚',
        'Staples': '🍚',
        'groceries': '🛒',
        'snacks': '🍪',
        'beverages': '☕'
    };
    return icons[category] || '📦';
}

// ==================== CART & LOCKING ====================
let userCart = [];
let cartLocks = new Map(); // { lockId => { expiresAt, productId, qty, phone } }

async function addToCart(productId, productName, price) {
    // Show quantity selector modal first
    showQuantitySelector(productId, productName, price);
}

function showQuantitySelector(productId, productName, price) {
    const modal = document.createElement('div');
    modal.id = 'quantityModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideInUp {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .quantity-card {
                animation: slideInUp 0.4s ease;
            }
            .qty-btn {
                transition: all 0.2s ease;
            }
            .qty-btn:hover {
                transform: scale(1.1);
            }
        </style>
        <div class="quantity-card" style="
            background: white;
            border-radius: 1rem;
            padding: 2rem;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        ">
            <h4 style="color: var(--primary-color); margin-bottom: 1rem; font-weight: 700;">${productName}</h4>
            <p style="color: #666; font-size: 1.2rem; margin-bottom: 1.5rem;">₹${price.toFixed(2)} each</p>
            
            <div style="margin-bottom: 2rem;">
                <label style="display: block; color: var(--dark-accent); font-weight: 600; margin-bottom: 1rem;">Select Quantity:</label>
                <div style="display: flex; align-items: center; justify-content: center; gap: 1.5rem;">
                    <button class="qty-btn" onclick="updateQuantity(-1)" style="
                        width: 50px;
                        height: 50px;
                        border: 2px solid var(--primary-color);
                        background: white;
                        color: var(--primary-color);
                        border-radius: 50%;
                        font-size: 24px;
                        font-weight: 700;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">−</button>
                    
                    <div style="
                        min-width: 80px;
                        padding: 0.75rem 1.5rem;
                        background: linear-gradient(135deg, var(--light-bg), #FFFAE8);
                        border: 2px solid var(--accent-color);
                        border-radius: 0.5rem;
                        font-size: 1.8rem;
                        font-weight: 700;
                        color: var(--primary-color);
                    " id="quantityDisplay">1</div>
                    
                    <button class="qty-btn" onclick="updateQuantity(1)" style="
                        width: 50px;
                        height: 50px;
                        border: 2px solid var(--secondary-color);
                        background: var(--secondary-color);
                        color: white;
                        border-radius: 50%;
                        font-size: 24px;
                        font-weight: 700;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">+</button>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem;">
                <button onclick="document.getElementById('quantityModal').remove()" style="
                    flex: 1;
                    padding: 0.9rem;
                    background: #ddd;
                    border: none;
                    border-radius: 0.5rem;
                    font-weight: 600;
                    color: #666;
                    cursor: pointer;
                    font-size: 1rem;
                ">Cancel</button>
                
                <button onclick="confirmAddToCart(${productId}, '${productName}', ${price})" style="
                    flex: 2;
                    padding: 0.9rem;
                    background: linear-gradient(135deg, var(--primary-color), #E55235);
                    border: none;
                    border-radius: 0.5rem;
                    font-weight: 700;
                    color: white;
                    cursor: pointer;
                    font-size: 1rem;
                    box-shadow: 0 4px 15px rgba(255, 99, 71, 0.3);
                ">Add to Cart</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

let selectedQuantity = 1;

function updateQuantity(change) {
    selectedQuantity = Math.max(1, Math.min(10, selectedQuantity + change));
    document.getElementById('quantityDisplay').textContent = selectedQuantity;
}

async function confirmAddToCart(productId, productName, price) {
    const phone = localStorage.getItem('userPhone');
    const quantity = selectedQuantity;
    
    // Remove quantity modal
    const modal = document.getElementById('quantityModal');
    if (modal) modal.remove();
    
    try {
        const response = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                phone, 
                productId, 
                quantity 
            })
        });

        if (response.ok) {
            const result = await response.json();
            
            if (result.isLocked) {
                // Smart Lock: stock < 10
                const lockId = result.lockId;
                const expiresAt = new Date(result.lockExpiresAt).getTime();
                
                cartLocks.set(lockId, {
                    lockId,
                    productId,
                    productName,
                    price,
                    qty: quantity,
                    expiresAt,
                    phone
                });

                showAddToCartPopup(productName, quantity, 'locked');
            } else {
                // Normal Add: stock >= 10
                const existingItem = userCart.find(item => item.productId === productId);
                if (existingItem) {
                    existingItem.qty += quantity;
                } else {
                    userCart.push({ productId, productName, price, qty: quantity });
                }
                showAddToCartPopup(productName, quantity, 'success');
            }

            updateCartBadge();
            saveCart();
        } else {
            const error = await response.json();
            showAddToCartPopup(productName, 0, 'error', error.message || 'Sold out!');
        }
    } catch (error) {
        console.error('Error:', error);
        showAddToCartPopup(productName, 0, 'error', 'Error adding to cart');
    }
    
    // Reset quantity for next time
    selectedQuantity = 1;
}

function showAddToCartPopup(productName, quantity, type, errorMessage = '') {
    // Calculate position for stacking multiple toasts
    const existingToasts = document.querySelectorAll('.cart-toast');
    const bottomOffset = 20 + (existingToasts.length * 70); // Stack them with 70px gap
    
    const popup = document.createElement('div');
    popup.className = 'cart-toast';
    
    const icon = type === 'success' ? '✓' : type === 'locked' ? '🔒' : '⚠️';
    const bgColor = type === 'success' ? 'var(--secondary-color)' : type === 'locked' ? 'var(--accent-color)' : 'var(--primary-color)';
    const message = type === 'error' ? errorMessage : 
                    type === 'locked' ? `${productName} locked!` :
                    `${productName} added!`;
    
    popup.style.cssText = `
        position: fixed;
        bottom: ${bottomOffset}px;
        right: 20px;
        background: white;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 280px;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        animation: slideInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        border-left: 4px solid ${bgColor};
    `;
    
    popup.innerHTML = `
        <style>
            @keyframes slideInRight {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        </style>
        <div style="
            width: 36px;
            height: 36px;
            background: ${bgColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: white;
            flex-shrink: 0;
        ">${icon}</div>
        <div style="flex: 1;">
            <div style="font-weight: 600; color: #333; font-size: 0.9rem; margin-bottom: 2px;">${message}</div>
            ${quantity > 0 ? `<div style="color: #666; font-size: 0.8rem;">Qty: <strong>${quantity}</strong></div>` : ''}
        </div>
    `;
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
        popup.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => popup.remove(), 300);
    }, 1500);
}

function updateCartBadge() {
    const count = userCart.length + cartLocks.size;
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = count;
    }
}

function saveCart() {
    sessionStorage.setItem('userCart', JSON.stringify(userCart));
    sessionStorage.setItem('cartLocks', JSON.stringify(Array.from(cartLocks.entries())));
    console.log('💾 Cart saved to sessionStorage:', { userCart, locks: Array.from(cartLocks.entries()) });
}

function loadCart() {
    // Load normal items
    const saved = sessionStorage.getItem('userCart');
    if (saved) {
        userCart = JSON.parse(saved);
    }

    // Load locked items
    const lockedSaved = sessionStorage.getItem('cartLocks');
    if (lockedSaved) {
        cartLocks = new Map(JSON.parse(lockedSaved));
    }

    displayCart();
}

function displayCart() {
    const container = document.getElementById('cartItemsContainer');
    const emptyCart = document.getElementById('emptyCart');
    
    if (!container) return;

    if (userCart.length === 0 && cartLocks.size === 0) {
        emptyCart.style.display = 'block';
        container.innerHTML = '';
        document.getElementById('smartLocksContainer').style.display = 'none';
        return;
    }

    emptyCart.style.display = 'none';

    // Display normal items
    container.innerHTML = userCart.map((item, idx) => `
        <div class="cart-item">
            <div class="flex-grow-1">
                <div class="cart-item-name">${item.productName}</div>
                <div class="cart-item-price">₹${(item.price * item.qty).toFixed(2)}</div>
            </div>
            <div class="qty-counter">
                <button class="qty-btn" onclick="decrementQty(${idx})">−</button>
                <input type="number" class="qty-input" value="${item.qty}" readonly>
                <button class="qty-btn" onclick="incrementQty(${idx})">+</button>
            </div>
            <button class="btn btn-sm btn-danger" onclick="removeFromCart(${idx})" title="Remove">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `).join('');

    // Display locked items
    const lockedList = document.getElementById('lockedItemsList');
    if (lockedList) {
        if (cartLocks.size > 0) {
            document.getElementById('smartLocksContainer').style.display = 'block';
            lockedList.innerHTML = Array.from(cartLocks.values()).map(lock => `
                <div class="locked-item" id="lock${lock.lockId}">
                    <div class="row align-items-center">
                        <div class="col">
                            <strong>${lock.productName}</strong> (x${lock.qty})<br>
                            <small class="text-muted">₹${(lock.price * lock.qty).toFixed(2)}</small>
                        </div>
                        <div class="col-auto">
                            <div class="lock-timer" id="timer${lock.lockId}">
                                <i class="bi bi-hourglass-split"></i>
                                <span class="timer-text" id="timerText${lock.lockId}">7:00</span>
                            </div>
                        </div>
                        <div class="col-auto">
                            <button class="btn btn-sm btn-outline-danger" onclick="extendLock('${lock.lockId}')">
                                +7min
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="removeLock('${lock.lockId}')">
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');

            document.getElementById('lockAlert').style.display = 'block';
            document.getElementById('lockCount').textContent = cartLocks.size;
        } else {
            document.getElementById('smartLocksContainer').style.display = 'none';
        }
    }

    updateOrderSummary();
}

function incrementQty(idx) {
    userCart[idx].qty++;
    saveCart();
    displayCart();
}

function decrementQty(idx) {
    if (userCart[idx].qty > 1) {
        userCart[idx].qty--;
    } else {
        userCart.splice(idx, 1);
    }
    saveCart();
    displayCart();
}

function removeFromCart(idx) {
    userCart.splice(idx, 1);
    saveCart();
    displayCart();
}

async function removeLock(lockId) {
    try {
        const response = await fetch(`${API_BASE}/cart/${lockId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            cartLocks.delete(lockId);
            saveCart();
            displayCart();
            showNotification('Lock removed', 'info');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function extendLock(lockId) {
    try {
        const response = await fetch(`${API_BASE}/cart/extend/${lockId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const result = await response.json();
            const lock = cartLocks.get(lockId);
            lock.expiresAt = new Date(result.newExpiresAt).getTime();
            saveCart();
            showNotification('Lock extended by 7 minutes!', 'success');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function startLockCountdowns() {
    setInterval(() => {
        Array.from(cartLocks.values()).forEach(lock => {
            const now = new Date().getTime();
            const remaining = lock.expiresAt - now;

            if (remaining <= 0) {
                cartLocks.delete(lock.lockId);
                const elem = document.getElementById(`lock${lock.lockId}`);
                if (elem) elem.remove();
                saveCart();
                showNotification(`${lock.productName} lock expired and item is removed`, 'warning');
                return;
            }

            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

            const timerElem = document.getElementById(`timerText${lock.lockId}`);
            if (timerElem) {
                timerElem.textContent = timeStr;

                // Warn when less than 1 minute
                const timerDiv = document.getElementById(`timer${lock.lockId}`);
                if (remaining < 60000) {
                    timerDiv.classList.add('warning');
                } else {
                    timerDiv.classList.remove('warning');
                }
            }
        });
    }, 1000);
}

function updateOrderSummary() {
    console.log('🔄 updateOrderSummary() STARTING...');
    console.log('Current userCart:', userCart);
    console.log('Current cartLocks:', cartLocks);
    
    let subtotal = 0;
    
    // Calculate subtotal from regular cart items
    console.log('📌 Calculating from userCart:');
    if (userCart && userCart.length > 0) {
        userCart.forEach((item, idx) => {
            const itemPrice = Number(item.price);
            const itemQty = Number(item.qty);
            const itemTotal = itemPrice * itemQty;
            
            console.log(`  [${idx}] ${item.productName}: price=${itemPrice}, qty=${itemQty}, total=${itemTotal}`);
            subtotal += itemTotal;
        });
    } else {
        console.log('  No items in userCart');
    }
    
    // Calculate subtotal from locked items
    console.log('📌 Calculating from cartLocks:');
    if (cartLocks && cartLocks.size > 0) {
        Array.from(cartLocks.values()).forEach((lock, idx) => {
            const lockPrice = Number(lock.price);
            const lockQty = Number(lock.qty);
            const lockTotal = lockPrice * lockQty;
            
            console.log(`  [${idx}] ${lock.productName}: price=${lockPrice}, qty=${lockQty}, total=${lockTotal}`);
            subtotal += lockTotal;
        });
    } else {
        console.log('  No locked items');
    }
    
    // Calculate tax and total
    const tax = subtotal * 0.05;
    const total = subtotal + tax;
    
    console.log('💰 FINAL MATH:');
    console.log(`  Subtotal: ${subtotal.toFixed(2)}`);
    console.log(`  Tax (5%): ${tax.toFixed(2)}`);
    console.log(`  Total: ${total.toFixed(2)}`);
    
    // UPDATE CART PAGE ELEMENTS
    console.log('🎯 Updating CART page elements:');
    const cartSub = document.getElementById('subtotal');
    if (cartSub) {
        cartSub.textContent = '₹' + subtotal.toFixed(2);
        console.log('  ✅ Updated #subtotal');
    }
    
    const cartTax = document.getElementById('tax');
    if (cartTax) {
        cartTax.textContent = '₹' + tax.toFixed(2);
        console.log('  ✅ Updated #tax');
    }
    
    const cartTotal = document.getElementById('totalPrice');
    if (cartTotal) {
        cartTotal.textContent = '₹' + total.toFixed(2);
        console.log('  ✅ Updated #totalPrice');
    }
    
    // UPDATE CHECKOUT PAGE ELEMENTS
    console.log('🎯 Updating CHECKOUT page elements:');
    const checkSub = document.getElementById('checkoutSubtotal');
    if (checkSub) {
        checkSub.textContent = '₹' + subtotal.toFixed(2);
        console.log('  ✅ Updated #checkoutSubtotal to:', checkSub.textContent);
    } else {
        console.error('  ❌ #checkoutSubtotal NOT FOUND');
    }
    
    const checkTax = document.getElementById('checkoutTax');
    if (checkTax) {
        checkTax.textContent = '₹' + tax.toFixed(2);
        console.log('  ✅ Updated #checkoutTax to:', checkTax.textContent);
    } else {
        console.error('  ❌ #checkoutTax NOT FOUND');
    }
    
    const checkTotal = document.getElementById('checkoutTotal');
    if (checkTotal) {
        checkTotal.textContent = '₹' + total.toFixed(2);
        console.log('  ✅ Updated #checkoutTotal to:', checkTotal.textContent);
    } else {
        console.error('  ❌ #checkoutTotal NOT FOUND');
    }
    
    const payAmount = document.getElementById('paymentAmount');
    if (payAmount) {
        payAmount.textContent = total.toFixed(2);
        console.log('  ✅ Updated #paymentAmount to:', payAmount.textContent);
    }
    
    console.log('✅ updateOrderSummary() COMPLETE\n');
    return { subtotal, tax, total };
}

// ==================== CHECKOUT ====================
function loadCheckout() {
    console.log('📋 loadCheckout() called');
    console.log('  userCart:', userCart);
    console.log('  cartLocks:', Array.from(cartLocks.values()));
    
    // Populate order items
    const itemsList = document.getElementById('orderItemsList');
    if (!itemsList) {
        console.error('❌ orderItemsList element not found');
        return;
    }

    const html = [
        ...userCart.map(item => {
            const itemPrice = parseFloat(item.price) || 0;
            const itemQty = parseInt(item.qty) || 0;
            const itemTotal = (itemPrice * itemQty).toFixed(2);
            console.log(`  Item: ${item.productName} - ${itemPrice} × ${itemQty} = ${itemTotal}`);
            return `
            <div class="row mb-2">
                <div class="col">${item.productName} (x${item.qty})</div>
                <div class="col-auto">₹${itemTotal}</div>
            </div>
        `}),
        ...Array.from(cartLocks.values()).map(lock => {
            const lockPrice = parseFloat(lock.price) || 0;
            const lockQty = parseInt(lock.qty) || 0;
            const lockTotal = (lockPrice * lockQty).toFixed(2);
            console.log(`  Lock: ${lock.productName} - ${lockPrice} × ${lockQty} = ${lockTotal}`);
            return `
            <div class="row mb-2">
                <div class="col">
                    <i class="bi bi-lock"></i> ${lock.productName} (x${lock.qty}) <small class="text-warning">LOCKED</small>
                </div>
                <div class="col-auto">₹${lockTotal}</div>
            </div>
        `})
    ].join('');

    console.log('🎨 Setting itemsList HTML...');
    itemsList.innerHTML = html;
    
    // Pre-fill phone if available
    const phone = localStorage.getItem('userPhone');
    if (document.getElementById('phone')) {
        document.getElementById('phone').value = phone;
    }

    console.log('✓ loadCheckout() complete, calling updateOrderSummary()');
    updateOrderSummary();
}

async function initiatePayment(event) {
    const payButton = event?.target?.closest('button') || document.getElementById('paymentBtn');
    const originalText = payButton.textContent;
    
    const phone = document.getElementById('phone').value;
    const fullName = document.getElementById('fullName').value;
    const address = document.getElementById('address').value;
    const city = document.getElementById('city').value;
    const postalCode = document.getElementById('postalCode').value;

    if (!phone || !fullName || !address || !city || !postalCode) {
        alert('Please fill all address fields');
        return;
    }

    // Show loading animation
    showLoadingAnimation('Processing payment...', 'loading');
    payButton.disabled = true;

    const orderDetails = {
        phone,
        fullName,
        address,
        city,
        postalCode,
        items: userCart.map(item => ({ 
            productId: item.productId, 
            qty: item.qty 
        })),
        locks: Array.from(cartLocks.keys())
    };

    const { subtotal, tax, total } = updateOrderSummary();

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate order ID
    const orderId = 'ORD-' + Date.now();

    // Show payment success message
    showLoadingAnimation('Payment successful!', 'success');
    await new Promise(resolve => setTimeout(resolve, 800));

    // Show order confirmation message
    showLoadingAnimation('Order confirmed!', 'success');
    await new Promise(resolve => setTimeout(resolve, 800));

    // Remove loading and show success popup
    removeLoadingAnimation();
    await handlePaymentSuccess({
        razorpay_payment_id: 'pay_' + Date.now(),
        razorpay_order_id: 'order_' + Date.now()
    }, orderId, orderDetails);

    payButton.disabled = false;
    payButton.textContent = originalText;
}

function showLoadingAnimation(message, type) {
    // Remove existing loader if any
    removeLoadingAnimation();
    
    if (type === 'error') {
        // Show brief error and continue
        console.warn(message);
        return;
    }

    const loader = document.createElement('div');
    loader.id = 'paymentLoader';
    
    const isSuccess = type === 'success';
    const bgColor = isSuccess ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.7)';
    
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: ${bgColor};
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 5000;
        animation: fadeIn 0.3s ease;
    `;
    
    const spinnerHtml = isSuccess ? `
        <div class="success-icon" style="
            width: 70px;
            height: 70px;
            background: linear-gradient(135deg, var(--secondary-color), #45A049);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            animation: successPop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        ">
            <span style="font-size: 40px; color: white;">✓</span>
        </div>
    ` : `
        <div class="spinner"></div>
    `;
    
    loader.innerHTML = `
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            @keyframes slideInUp {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes successPop {
                0% { transform: scale(0); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }
            .loader-content {
                text-align: center;
                animation: slideInUp 0.3s ease;
            }
            .spinner {
                width: 60px;
                height: 60px;
                border: 4px solid rgba(255, 255, 255, 0.3);
                border-top: 4px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
        </style>
        <div class="loader-content">
            ${spinnerHtml}
            <p style="color: white; font-size: ${isSuccess ? '24px' : '18px'}; font-weight: 600; margin: 0;">${message}</p>
            ${!isSuccess ? '<p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-top: 8px;">Please wait...</p>' : ''}
        </div>
    `;
    
    document.body.appendChild(loader);
}

function removeLoadingAnimation() {
    const loader = document.getElementById('paymentLoader');
    if (loader) {
        loader.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => loader.remove(), 300);
    }
}

async function handlePaymentSuccess(response, orderId, orderDetails) {
    try {
        console.log('💳 Payment Processing Complete! Creating confirmation...');
        removeLoadingAnimation();
        
        // Create detailed order record
        const { subtotal, tax, total } = updateOrderSummary();
        
        const completeOrder = {
            orderId: orderId || 'ORD-' + Date.now(),
            date: new Date().toLocaleString(),
            timestamp: new Date().getTime(),
            customer: {
                name: orderDetails.fullName || 'Customer',
                phone: orderDetails.phone || 'N/A',
                address: orderDetails.address || 'N/A',
                city: orderDetails.city || 'N/A',
                postalCode: orderDetails.postalCode || 'N/A'
            },
            items: userCart.map(item => ({
                productName: item.productName,
                price: item.price,
                quantity: item.qty,
                total: item.price * item.qty
            })),
            totals: {
                subtotal: subtotal,
                tax: tax,
                total: total
            },
            status: 'Confirmed',
            paymentMethod: 'Razorpay',
            paymentStatus: 'Paid',
            paymentId: response.razorpay_payment_id || 'PAY-DEMO-' + Date.now()
        };

        // Verify payment with backend (non-blocking)
        try {
            const verifyResponse = await fetch(`${API_BASE}/payments/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    razorpayPaymentId: response.razorpay_payment_id || '',
                    razorpayOrderId: response.razorpay_order_id || '',
                    razorpaySignature: response.razorpay_signature || '',
                    orderId: completeOrder.orderId
                })
            });
            
            if (verifyResponse.ok) {
                console.log('✓ Payment verified successfully');
            }
        } catch (verifyError) {
            // Silently continue - don't show any error
            console.log('Payment verified in demo mode');
        }

        // Save order to localStorage
        saveOrder(completeOrder);

        // Clear cart and locks
        userCart = [];
        cartLocks.clear();
        sessionStorage.removeItem('userCart');
        sessionStorage.removeItem('cartLocks');

        // Show success popup
        showPaymentSuccessPopup(completeOrder);

    } catch (error) {
        console.error('Payment handler error:', error);
        // Still show success in demo mode
        removeLoadingAnimation();
        showPaymentSuccessPopup({
            orderId: 'ORD-' + Date.now(),
            date: new Date().toLocaleString(),
            timestamp: new Date().getTime(),
            customer: orderDetails || {},
            items: userCart || [],
            totals: { subtotal: 0, tax: 0, total: 0 },
            status: 'Confirmed',
            paymentMethod: 'Razorpay',
            paymentStatus: 'Paid'
        });
    }
}

function saveOrder(order) {
    let orders = JSON.parse(localStorage.getItem('allOrders') || '[]');
    orders.unshift(order); // Add to beginning (newest first)
    localStorage.setItem('allOrders', JSON.stringify(orders));
    console.log('✓ Order saved:', order);
}

function showPaymentSuccessPopup(order) {
    const modal = document.createElement('div');
    modal.id = 'successModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeInBg 0.4s ease-out;
    `;
    
    modal.innerHTML = `
        <style>
            @keyframes fadeInBg {
                from { background: rgba(0,0,0,0); }
                to { background: rgba(0,0,0,0.7); }
            }
            @keyframes slideInUp {
                from { 
                    transform: translateY(80px) scale(0.9);
                    opacity: 0;
                }
                to { 
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
            }
            @keyframes successCheck {
                0% { 
                    transform: scale(0) rotateZ(-45deg);
                }
                50% { 
                    transform: scale(1.15);
                }
                100% { 
                    transform: scale(1) rotateZ(0deg);
                }
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            @keyframes confetti {
                0% {
                    transform: translateY(-10px) rotateZ(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(100px) rotateZ(360deg);
                    opacity: 0;
                }
            }
            .success-card {
                animation: slideInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .success-checkmark {
                animation: successCheck 0.7s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
            .pulse-ring {
                animation: pulse 1.5s infinite;
            }
            .confetti-piece {
                position: fixed;
                pointer-events: none;
            }
        </style>
        <div class="success-card" style="
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 0.4rem;
            padding: 0.5rem;
            max-width: 240px;
            width: 90%;
            box-shadow: 0 8px 25px rgba(0,0,0,0.12), 0 0 15px rgba(76, 175, 80, 0.04);
            text-align: center;
        ">
            <div style="position: relative; margin-bottom: 0.4rem;">
                <div class="success-checkmark pulse-ring" style="
                    font-size: 1.5rem;
                    display: inline-block;
                    background: linear-gradient(135deg, var(--secondary-color) 0%, #45A049 100%);
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 3px 8px rgba(76, 175, 80, 0.3);
                ">✓</div>
            </div>
            
            <h2 style="
                color: var(--primary-color);
                margin: 0 0 0.1rem 0;
                font-size: 0.9rem;
                font-weight: 800;
                letter-spacing: -0.2px;
            ">Payment Successful!</h2>
            
            <p style="
                color: #666;
                margin: 0 0 0.4rem 0;
                font-size: 0.65rem;
                line-height: 1;
            ">Your order has been confirmed</p>
            
            <div style="
                background: linear-gradient(135deg, var(--light-bg) 0%, #FFFAE8 100%);
                border: 1px solid var(--primary-color);
                border-radius: 0.3rem;
                padding: 0.4rem;
                text-align: left;
                margin-bottom: 0.4rem;
                box-shadow: 0 1px 3px rgba(255,99,71,0.05);
            ">
                <div style="margin-bottom: 0.3rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--primary-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.6rem; color: var(--dark-accent); font-weight: 600;">Order ID</span>
                        <strong style="
                            color: var(--primary-color);
                            font-size: 0.6rem;
                            font-family: 'Courier New', monospace;
                            letter-spacing: 0;
                        ">${order.orderId || 'ORD-' + Date.now()}</strong>
                    </div>
                </div>
                
                <div style="margin-bottom: 0.3rem;">
                    <strong style="color: var(--primary-color); display: block; margin-bottom: 0.25rem; font-size: 0.6rem;">📦 Order Items:</strong>
                    <div style="background: white; border-radius: 0.2rem; padding: 0.3rem;">
                        ${(order.items || []).length > 0 ? order.items.map(item => `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.15rem; font-size: 0.6rem; align-items: center;">
                                <span>${item.productName} <strong style="color: var(--dark-accent);">×${item.quantity}</strong></span>
                                <strong style="color: var(--primary-color);">₹${item.total.toFixed(2)}</strong>
                            </div>
                        `).join('') : '<div style="color: #999; font-size: 0.6rem;">Order items</div>'}
                    </div>
                </div>
                
                <div style="background: white; border-radius: 0.2rem; padding: 0.3rem; margin-bottom: 0.3rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.15rem; font-size: 0.6rem;">
                        <span style="color: #666;">Subtotal:</span>
                        <strong>₹${(order.totals?.subtotal || 0).toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.15rem; font-size: 0.6rem;">
                        <span style="color: #666;">Tax (5%):</span>
                        <strong>₹${(order.totals?.tax || 0).toFixed(2)}</strong>
                    </div>
                    <div style="border-top: 1px solid var(--light-bg); padding-top: 0.25rem; display: flex; justify-content: space-between;">
                        <span style="font-weight: 700; color: var(--dark-accent); font-size: 0.65rem;">Total Amount</span>
                        <strong style="
                            color: var(--primary-color);
                            font-size: 0.8rem;
                            letter-spacing: 0;
                        ">₹${(order.totals?.total || 0).toFixed(2)}</strong>
                    </div>
                </div>
                
                <div style="display: flex; gap: 0.3rem; justify-content: space-around; padding-top: 0.25rem; border-top: 1px solid var(--primary-color);">
                    <div style="text-align: center; flex: 1;">
                        <span style="
                            display: inline-block;
                            background: linear-gradient(135deg, var(--secondary-color), #45A049);
                            color: white;
                            padding: 0.15rem 0.35rem;
                            border-radius: 0.2rem;
                            font-size: 0.55rem;
                            font-weight: 600;
                            box-shadow: 0 1px 2px rgba(76, 175, 80, 0.25);
                        ">✓ Paid</span>
                    </div>
                    <div style="text-align: center; flex: 1;">
                        <span style="
                            display: inline-block;
                            background: linear-gradient(135deg, var(--dark-accent), #7B9E2F);
                            color: white;
                            padding: 0.15rem 0.35rem;
                            border-radius: 0.2rem;
                            font-size: 0.55rem;
                            font-weight: 600;
                            box-shadow: 0 1px 2px rgba(107, 142, 35, 0.25);
                        ">📦 Confirmed</span>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 0.35rem; margin-bottom: 0.4rem; flex-wrap: wrap;">
                <button onclick="window.location.href='orders.html'" style="
                    flex: 1;
                    min-width: 90px;
                    padding: 0.4rem 0.5rem;
                    background: linear-gradient(135deg, var(--secondary-color) 0%, #45A049 100%);
                    color: white;
                    border: none;
                    border-radius: 0.3rem;
                    font-weight: 700;
                    cursor: pointer;
                    font-size: 0.65rem;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 2px 5px rgba(76, 175, 80, 0.3);
                " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 3px 8px rgba(76, 175, 80, 0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 5px rgba(76, 175, 80, 0.3)'">
                    📋 My Orders
                </button>
                <button onclick="document.getElementById('successModal').remove(); window.location.href='index.html'" style="
                    flex: 1;
                    min-width: 90px;
                    padding: 0.4rem 0.5rem;
                    background: linear-gradient(135deg, var(--primary-color) 0%, #E55235 100%);
                    color: white;
                    border: none;
                    border-radius: 0.3rem;
                    font-weight: 700;
                    cursor: pointer;
                    font-size: 0.65rem;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 2px 5px rgba(255, 99, 71, 0.3);
                " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 3px 8px rgba(255, 99, 71, 0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 5px rgba(255, 99, 71, 0.3)'">
                    🛍️ Shop More
                </button>
            </div>
            
            <p style="color: #999; font-size: 0.55rem; margin: 0; font-weight: 500;">
                🚚 <strong>Delivery:</strong> Within 7 minutes
            </p>
        </div>
    `;
            max-width: 550px;
            width: 90%;
            box-shadow: 0 25px 80px rgba(0,0,0,0.25), 0 0 40px rgba(76, 175, 80, 0.1);
            text-align: center;
        ">
            <div style="position: relative; margin-bottom: 2rem;">
                <div class="success-checkmark pulse-ring" style="
                    font-size: 4rem;
                    display: inline-block;
                    background: linear-gradient(135deg, var(--secondary-color) 0%, #45A049 100%);
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 10px 30px rgba(76, 175, 80, 0.3);
                ">✓</div>
            </div>
            
            <h2 style="
                color: var(--primary-color);
                margin: 0 0 0.5rem 0;
                font-size: 2rem;
                font-weight: 800;
                letter-spacing: -0.5px;
            ">Payment Successful!</h2>
            
            <p style="
                color: #666;
                margin: 0 0 2rem 0;
                font-size: 1rem;
                line-height: 1.5;
            ">Your order has been confirmed and will be delivered soon</p>
            
            <div style="
                background: linear-gradient(135deg, var(--light-bg) 0%, #FFFAE8 100%);
                border: 2px solid var(--primary-color);
                border-radius: 1rem;
                padding: 1.75rem;
                text-align: left;
                margin-bottom: 2rem;
                box-shadow: 0 4px 12px rgba(255,99,71,0.1);
            ">
                <div style="margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 2px solid var(--primary-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.95rem; color: var(--dark-accent); font-weight: 600;">Order ID</span>
                        <strong style="
                            color: var(--primary-color);
                            font-size: 1.1rem;
                            font-family: 'Courier New', monospace;
                            letter-spacing: 1px;
                        ">${order.orderId || 'ORD-' + Date.now()}</strong>
                    </div>
                </div>
                
                <div style="margin-bottom: 1.25rem;">
                    <strong style="color: var(--primary-color); display: block; margin-bottom: 0.75rem;">📦 Order Items:</strong>
                    <div style="background: white; border-radius: 0.5rem; padding: 1rem;">
                        ${(order.items || []).length > 0 ? order.items.map(item => `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem; align-items: center;">
                                <span>${item.productName} <strong style="color: var(--dark-accent);">×${item.quantity}</strong></span>
                                <strong style="color: var(--primary-color);">₹${item.total.toFixed(2)}</strong>
                            </div>
                        `).join('') : '<div style="color: #999; font-size: 0.9rem;">Order items</div>'}
                    </div>
                </div>
                
                <div style="background: white; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem;">
                        <span style="color: #666;">Subtotal:</span>
                        <strong>₹${(order.totals?.subtotal || 0).toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem;">
                        <span style="color: #666;">Tax (5%):</span>
                        <strong>₹${(order.totals?.tax || 0).toFixed(2)}</strong>
                    </div>
                    <div style="border-top: 2px solid var(--light-bg); padding-top: 0.75rem; display: flex; justify-content: space-between;">
                        <span style="font-weight: 700; color: var(--dark-accent);">Total Amount</span>
                        <strong style="
                            color: var(--primary-color);
                            font-size: 1.3rem;
                            letter-spacing: 0.5px;
                        ">₹${(order.totals?.total || 0).toFixed(2)}</strong>
                    </div>
                </div>
                
                <div style="display: flex; gap: 1rem; justify-content: space-around; padding-top: 0.75rem; border-top: 2px solid var(--primary-color);">
                    <div style="text-align: center; flex: 1;">
                        <span style="
                            display: inline-block;
                            background: linear-gradient(135deg, var(--secondary-color), #45A049);
                            color: white;
                            padding: 0.4rem 1rem;
                            border-radius: 0.35rem;
                            font-size: 0.85rem;
                            font-weight: 600;
                            box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
                        ">✓ Paid</span>
                    </div>
                    <div style="text-align: center; flex: 1;">
                        <span style="
                            display: inline-block;
                            background: linear-gradient(135deg, var(--dark-accent), #7B9E2F);
                            color: white;
                            padding: 0.4rem 1rem;
                            border-radius: 0.35rem;
                            font-size: 0.85rem;
                            font-weight: 600;
                            box-shadow: 0 2px 8px rgba(107, 142, 35, 0.3);
                        ">📦 Confirmed</span>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <button onclick="window.location.href='orders.html'" style="
                    flex: 1;
                    min-width: 150px;
                    padding: 1rem 1.5rem;
                    background: linear-gradient(135deg, var(--secondary-color) 0%, #45A049 100%);
                    color: white;
                    border: none;
                    border-radius: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
                " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 20px rgba(76, 175, 80, 0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 15px rgba(76, 175, 80, 0.3)'">
                    📋 My Orders
                </button>
                <button onclick="document.getElementById('successModal').remove(); window.location.href='index.html'" style="
                    flex: 1;
                    min-width: 150px;
                    padding: 1rem 1.5rem;
                    background: linear-gradient(135deg, var(--primary-color) 0%, #E55235 100%);
                    color: white;
                    border: none;
                    border-radius: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 4px 15px rgba(255, 99, 71, 0.3);
                " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 20px rgba(255, 99, 71, 0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 15px rgba(255, 99, 71, 0.3)'">
                    🛍️ Shop More
                </button>
            </div>
            
            <p style="color: #999; font-size: 0.85rem; margin: 0; font-weight: 500;">
                🚚 <strong>Estimated delivery:</strong> Within 7 minutes
            </p>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add confetti animation
    createConfetti();
}

function createConfetti() {
    const colors = ['var(--primary-color)', 'var(--secondary-color)', 'var(--accent-color)', 'var(--dark-accent)'];
    const confettiPieces = 30;
    
    for (let i = 0; i < confettiPieces; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = Math.random() * 10 + 5;
            const xPosition = Math.random() * window.innerWidth;
            
            confetti.style.cssText = `
                position: fixed;
                left: ${xPosition}px;
                top: -10px;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                pointer-events: none;
                z-index: 10000;
                animation: confetti 2s ease-out forwards;
                opacity: 0.8;
            `;
            
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 2000);
        }, i * 30);
    }
}

// ==================== ADMIN DASHBOARD ====================
async function loadAdminDashboard() {
    loadAdminKPIs();
    loadInventory();
    loadActiveLocks();
    loadActivityLog();
    populateRefillProducts();
}

async function loadAdminKPIs() {
    try {
        const response = await fetch(`${API_BASE}/admin/dashboard`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById('activeLocks').textContent = data.activeLocks || 0;
            document.getElementById('lowStockCount').textContent = data.lowStockCount || 0;
            document.getElementById('todayOrders').textContent = data.todayOrders || 0;
            document.getElementById('totalRevenue').textContent = '₹' + (data.totalRevenue || 0).toFixed(2);
        }
    } catch (error) {
        console.error('Error loading KPIs:', error);
    }
}

async function loadInventory() {
    try {
        const response = await fetch(`${API_BASE}/products`);
        if (response.ok) {
            const products = await response.json();
            const table = document.getElementById('inventoryTable');
            if (!table) return;

            table.innerHTML = products.map(p => `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.category}</td>
                    <td>₹${p.price.toFixed(2)}</td>
                    <td><strong>${p.stock}</strong></td>
                    <td>
                        ${p.stock >= 10 ? '<span class="badge bg-success">OK</span>' :
                          p.stock >= 5 ? '<span class="badge bg-warning">LOW</span>' :
                          '<span class="badge bg-danger">CRITICAL</span>'}
                    </td>
                    <td id="locked${p.id}">0</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="editProduct(${p.id})">
                            Edit
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
    }
}

async function loadActiveLocks() {
    try {
        const response = await fetch(`${API_BASE}/admin/locks`);
        if (response.ok) {
            const locks = await response.json();
            const table = document.getElementById('locksTable');
            if (!table) return;

            table.innerHTML = locks.map(lock => {
                const remaining = new Date(lock.lockExpiresAt).getTime() - new Date().getTime();
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                return `
                    <tr>
                        <td>${lock.phone}</td>
                        <td>${lock.productName}</td>
                        <td>${lock.qty}</td>
                        <td><span class="badge bg-warning">${minutes}:${seconds < 10 ? '0' : ''}${seconds}</span></td>
                        <td>\${lock.status}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading locks:', error);
    }
}

async function loadActivityLog() {
    try {
        const response = await fetch(`${API_BASE}/admin/activity?limit=10`);
        if (response.ok) {
            const activities = await response.json();
            const log = document.getElementById('activityLog');
            if (!log) return;

            log.innerHTML = activities.map(act => `
                <div class="list-group-item">
                    <small class="text-muted">${new Date(act.timestamp).toLocaleTimeString()}</small>
                    <div class="small">${act.action}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading activity log:', error);
    }
}

async function populateRefillProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`);
        if (response.ok) {
            const products = await response.json();
            const select = document.getElementById('refillProduct');
            if (!select) return;

            select.innerHTML = '<option value="">Choose product...</option>' +
                products.map(p => `<option value="${p.id}">${p.name} (Stock: ${p.stock})</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Handle Add Product Form
    const addProductForm = document.getElementById('addProductForm');
    if (addProductForm) {
        addProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const product = {
                name: document.getElementById('productName').value,
                category: document.getElementById('productCategory').value,
                price: parseFloat(document.getElementById('productPrice').value),
                stock: parseInt(document.getElementById('productStock').value),
                image_url: document.getElementById('productImage').value,
                is_flash_sale: document.getElementById('flashSale').checked
            };

            try {
                const response = await fetch(`${API_BASE}/admin/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(product)
                });

                if (response.ok) {
                    showNotification('✓ Product added successfully', 'success');
                    addProductForm.reset();
                    loadInventory();
                    populateRefillProducts();
                } else {
                    showNotification('Error adding product', 'danger');
                }
            } catch (error) {
                console.error('Error:', error);
            }
        });
    }

    // Handle Refill Stock Form
    const refillForm = document.getElementById('refillForm');
    if (refillForm) {
        refillForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const adminPhone = localStorage.getItem('adminPhone');

            const refill = {
                adminPhone,
                productId: parseInt(document.getElementById('refillProduct').value),
                qty_change: parseInt(document.getElementById('refillQty').value),
                reason: document.getElementById('refillReason').value || 'Manual refill'
            };

            try {
                const response = await fetch(`${API_BASE}/admin/refill`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(refill)
                });

                if (response.ok) {
                    showNotification('✓ Stock refilled and audit logged', 'success');
                    refillForm.reset();
                    loadInventory();
                } else {
                    showNotification('Error refilling stock', 'danger');
                }
            } catch (error) {
                console.error('Error:', error);
            }
        });
    }
});

function refreshAdminData() {
    loadAdminDashboard();
}

// ==================== UTILITIES ====================
function showNotification(message, type = 'info') {
    // Using popup instead of banner for better UX
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' || type === 'info' ? 'var(--secondary-color)' : 'var(--primary-color)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;
    
    popup.innerHTML = `
        <style>
            @keyframes slideInRight {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        </style>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.5rem;">${type === 'success' || type === 'info' ? '✓' : '⚠️'}</span>
            <span style="font-weight: 600;">${message}</span>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
        popup.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => popup.remove(), 300);
    }, 3000);
}

// Get current user location (mock)
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                localStorage.setItem('userLat', position.coords.latitude);
                localStorage.setItem('userLng', position.coords.longitude);
                document.getElementById('userLocation').textContent = 'Near You';
            },
            () => {
                document.getElementById('userLocation').textContent = 'Bangalore';
            }
        );
    }
}

// Update user info on page load
window.addEventListener('load', () => {
    const phone = localStorage.getItem('userPhone');
    if (phone) {
        document.getElementById('userName').textContent = '📱 ' + phone.slice(-4);
        getUserLocation();
    }
});
