// AURUM Exclusive Luxury Marketplace Logic (Vanilla JS)

// --- Supabase Configuration ---
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof supabase !== 'undefined') {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("[AURUM] Connected to Supabase.");
    } catch (e) {
        console.warn("[AURUM] Supabase initialization failed, switching to local JSON mode:", e);
    }
}

// Global State Management
let allProducts = [];
let filteredProducts = [];
let cart = [];
let favorites = new Set();
let activeVertical = "all";
let currentImageIndex = 0;
let activeProduct = null;

// Filter Options State
const currentFilters = {
    search: "",
    priceLimit: 12000000,
    creator: "all",
    style: "all",
    period: "all",
    origin: "all",
    sort: "price-desc"
};

// DOM Elements
const productsGrid = document.getElementById("products-grid");
const productCountLabel = document.getElementById("product-count-label");
const globalSearch = document.getElementById("global-search");
const priceSlider = document.getElementById("price-slider");
const priceMaxLabel = document.getElementById("price-max-label");
const currentPriceLimitLabel = document.getElementById("current-price-limit");
const creatorSelect = document.getElementById("filter-creator");
const styleSelect = document.getElementById("filter-style");
const periodSelect = document.getElementById("filter-period");
const originSelect = document.getElementById("filter-origin");
const sortSelect = document.getElementById("sort-select");
const clearFiltersBtn = document.getElementById("clear-filters-btn");
const categoryTabs = document.querySelectorAll(".category-tabs .tab-btn");

// Cart DOM Elements
const cartBtn = document.getElementById("cart-btn");
const cartDrawer = document.getElementById("cart-drawer");
const cartDrawerClose = document.getElementById("cart-drawer-close");
const cartItemsContainer = document.getElementById("cart-items-container");
const cartSubtotal = document.getElementById("cart-subtotal");
const cartTotal = document.getElementById("cart-total");
const cartCountBadge = document.getElementById("cart-count");
const favCountBadge = document.getElementById("fav-count");
const checkoutBtn = document.getElementById("checkout-btn");

// Checkout DOM Elements
const checkoutDrawer = document.getElementById("checkout-drawer");
const checkoutDrawerClose = document.getElementById("checkout-drawer-close");
const checkoutForm = document.getElementById("checkout-form");
const checkoutItemsCount = document.getElementById("checkout-items-count");
const checkoutTotalPrice = document.getElementById("checkout-total-price");
const successModal = document.getElementById("success-modal");
const successOrderId = document.getElementById("success-order-id");
const successOrderTotal = document.getElementById("success-order-total");
const successContinueBtn = document.getElementById("success-continue-btn");

// Detail Modal DOM Elements
const productModal = document.getElementById("product-modal");
const modalCloseBtn = document.getElementById("modal-close");
const modalMainImg = document.getElementById("modal-main-img");
const modalPrevBtn = document.getElementById("gallery-prev");
const modalNextBtn = document.getElementById("gallery-next");
const modalThumbnails = document.getElementById("modal-thumbnails-container");
const modalVertical = document.getElementById("modal-vertical");
const modalTitle = document.getElementById("modal-title");
const modalPrice = document.getElementById("modal-price");
const modalOriginalPrice = document.getElementById("modal-original-price");
const modalDescription = document.getElementById("modal-description");
const modalSpecsTable = document.getElementById("modal-specs-table");
const modalAddToCartBtn = document.getElementById("modal-add-to-cart");

// --- 1. Data Loading and Initializers ---
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    setupEventListeners();
    loadLocalCart();
    
    // Mouse Tracker Gold Glow
    const cursorGlow = document.getElementById("cursor-glow");
    document.addEventListener("mousemove", (e) => {
        if (cursorGlow) {
            cursorGlow.style.left = e.clientX + "px";
            cursorGlow.style.top = e.clientY + "px";
        }
    });
});

async function loadProducts() {
    showLoader();
    try {
        let data = [];
        
        // Fetch from database if Supabase connection is active
        if (supabaseClient) {
            console.log("[AURUM] Fetching data from Supabase database...");
            const { data: dbData, error } = await supabaseClient
                .from("products")
                .select("*")
                .order("price", { ascending: false });
                
            if (error) throw error;
            data = dbData;
        }
        
        // Use local JSON fallback if Supabase is empty or failed
        if (!data || data.length === 0) {
            console.log("[AURUM] Supabase empty or disabled, pulling local products.json...");
            const response = await fetch("scraper/products.json");
            data = await response.json();
        }
        
        allProducts = data;
        filteredProducts = [...allProducts];
        
        // Populate filter dropdowns dynamically
        populateFilterDropdowns();
        
        // Render products
        renderProducts();
        
        // Start live sales notifications loop
        startSalesNotifications();
        
    } catch (error) {
        console.error("[AURUM] Error loading products:", error);
        productsGrid.innerHTML = `
            <div class="loader-container">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px; color: #ff6b6b;"></i>
                <p>An error occurred while loading products. Please make sure the scraper has run and generated 'scraper/products.json'.</p>
            </div>
        `;
    }
}

function showLoader() {
    productsGrid.innerHTML = `
        <div class="loader-container">
            <div class="aurum-spinner"></div>
            <p>Loading rare masterpieces...</p>
        </div>
    `;
}

// --- 2. Dynamic Filters Population ---
function populateFilterDropdowns() {
    const creators = new Set();
    const styles = new Set();
    const periods = new Set();
    const origins = new Set();
    let maxPrice = 12000000;

    allProducts.forEach(p => {
        // Determine price limits
        if (p.price > maxPrice) maxPrice = Math.ceil(p.price);
        
        // Parse specifications
        const specs = p.specs || {};
        if (specs["Creator"]) creators.add(specs["Creator"]);
        if (specs["Style"]) styles.add(specs["Style"]);
        if (specs["Period"]) periods.add(specs["Period"]);
        if (specs["Place of Origin"]) origins.add(specs["Place of Origin"]);
    });

    // Adjust slider dynamically to maximum price
    priceSlider.max = maxPrice;
    priceSlider.value = maxPrice;
    currentFilters.priceLimit = maxPrice;
    priceMaxLabel.textContent = formatCurrency(maxPrice);
    currentPriceLimitLabel.textContent = formatCurrency(maxPrice);

    // Populate selects
    fillSelect(creatorSelect, creators);
    fillSelect(styleSelect, styles);
    fillSelect(periodSelect, periods);
    fillSelect(originSelect, origins);
}

function fillSelect(selectElement, itemsSet) {
    // Clear everything except the first option "All"
    selectElement.innerHTML = '<option value="all">All</option>';
    
    // Sort and append items
    Array.from(itemsSet).sort().forEach(item => {
        if (!item) return;
        const opt = document.createElement("option");
        opt.value = item;
        opt.textContent = item;
        selectElement.appendChild(opt);
    });
}

// --- 3. Render Products Grid ---
function renderProducts() {
    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = `
            <div class="loader-container">
                <i class="fa-solid fa-hourglass-empty" style="font-size: 40px; color: var(--accent-gold);"></i>
                <p>No masterpieces found matching your criteria. Please adjust your filters.</p>
            </div>
        `;
        productCountLabel.textContent = "0 Masterpieces Shown";
        return;
    }

    productCountLabel.textContent = `${filteredProducts.length} Exquisite Masterpieces Shown`;
    productsGrid.innerHTML = "";

    filteredProducts.forEach(product => {
        const specs = product.specs || {};
        const creator = specs["Creator"] || "Unknown";
        const origin = specs["Place of Origin"] || "";
        const isFav = favorites.has(product.id) ? "active" : "";
        const originalPriceVal = product.price * 1.25;
        
        const card = document.createElement("div");
        card.className = "product-card";
        card.setAttribute("data-id", product.id);
        
        // Card content
        card.innerHTML = `
            <div class="product-image-container">
                <button class="favorite-card-btn ${isFav}" data-id="${product.id}" title="Add to Favorites">
                    <i class="fa-solid fa-heart"></i>
                </button>
                <img src="${product.images && product.images.length > 0 ? product.images[0] : 'placeholder.jpg'}" alt="${product.title}" loading="lazy">
            </div>
            <div class="product-info">
                <div class="product-creator">${creator} ${origin ? '• ' + origin : ''}</div>
                <h3 class="product-title">${product.title}</h3>
                <div class="product-price-row">
                    <span class="product-price">${formatCurrency(product.price)}</span>
                    <span class="product-orig-price">${formatCurrency(originalPriceVal)}</span>
                </div>
            </div>
        `;
        
        // Click events
        card.addEventListener("click", (e) => {
            if (e.target.closest(".favorite-card-btn")) return;
            openProductDetail(product);
        });

        // Favorite button click
        const favBtn = card.querySelector(".favorite-card-btn");
        favBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFavorite(product.id);
            favBtn.classList.toggle("active");
        });

        productsGrid.appendChild(card);
    });
}

// --- 4. Filtering and Sorting Logic ---
function filterAndSortProducts() {
    filteredProducts = allProducts.filter(p => {
        const specs = p.specs || {};
        
        // 1. Category Vertical Filter
        if (activeVertical !== "all") {
            const prodVert = (p.vertical || "").toLowerCase();
            const activeV = activeVertical.toLowerCase();
            
            if (activeV === "furniture" && prodVert !== "furniture") return false;
            if (activeV === "jewelry" && prodVert !== "jewelry") return false;
            if (activeV === "art" && prodVert !== "art") return false;
            if (activeV === "other" && ["furniture", "jewelry", "art"].includes(prodVert)) return false;
        }

        // 2. Search Filter (Title, Description, Creator, Style)
        if (currentFilters.search) {
            const query = currentFilters.search.toLowerCase();
            const titleMatch = (p.title || "").toLowerCase().includes(query);
            const descMatch = (p.description || "").toLowerCase().includes(query);
            const creatorMatch = (specs["Creator"] || "").toLowerCase().includes(query);
            const styleMatch = (specs["Style"] || "").toLowerCase().includes(query);
            if (!titleMatch && !descMatch && !creatorMatch && !styleMatch) return false;
        }

        // 3. Price Filter
        if (p.price > currentFilters.priceLimit) return false;

        // 4. Creator Filter
        if (currentFilters.creator !== "all" && specs["Creator"] !== currentFilters.creator) return false;

        // 5. Style Filter
        if (currentFilters.style !== "all" && specs["Style"] !== currentFilters.style) return false;

        // 6. Period Filter
        if (currentFilters.period !== "all" && specs["Period"] !== currentFilters.period) return false;

        // 7. Place of Origin Filter
        if (currentFilters.origin !== "all" && specs["Place of Origin"] !== currentFilters.origin) return false;

        return true;
    });

    // Sorting
    if (currentFilters.sort === "price-desc") {
        filteredProducts.sort((a, b) => b.price - a.price);
    } else if (currentFilters.sort === "price-asc") {
        filteredProducts.sort((a, b) => a.price - b.price);
    } else if (currentFilters.sort === "title-asc") {
        filteredProducts.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    renderProducts();
}

// --- 5. Event Listeners ---
function setupEventListeners() {
    // Search input
    globalSearch.addEventListener("input", (e) => {
        currentFilters.search = e.target.value.trim();
        filterAndSortProducts();
    });

    // Price slider
    priceSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        currentFilters.priceLimit = val;
        currentPriceLimitLabel.textContent = formatCurrency(val);
        filterAndSortProducts();
    });

    // Select filters
    creatorSelect.addEventListener("change", (e) => {
        currentFilters.creator = e.target.value;
        filterAndSortProducts();
    });
    styleSelect.addEventListener("change", (e) => {
        currentFilters.style = e.target.value;
        filterAndSortProducts();
    });
    periodSelect.addEventListener("change", (e) => {
        currentFilters.period = e.target.value;
        filterAndSortProducts();
    });
    originSelect.addEventListener("change", (e) => {
        currentFilters.origin = e.target.value;
        filterAndSortProducts();
    });

    // Sort select
    sortSelect.addEventListener("change", (e) => {
        currentFilters.sort = e.target.value;
        filterAndSortProducts();
    });

    // Clear filters
    clearFiltersBtn.addEventListener("click", () => {
        globalSearch.value = "";
        currentFilters.search = "";
        
        priceSlider.value = priceSlider.max;
        currentFilters.priceLimit = parseInt(priceSlider.max);
        currentPriceLimitLabel.textContent = formatCurrency(priceSlider.max);

        creatorSelect.value = "all";
        currentFilters.creator = "all";
        styleSelect.value = "all";
        currentFilters.style = "all";
        periodSelect.value = "all";
        currentFilters.period = "all";
        originSelect.value = "all";
        currentFilters.origin = "all";

        filterAndSortProducts();
    });

    // Category tabs
    categoryTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            categoryTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            activeVertical = tab.getAttribute("data-vertical");
            filterAndSortProducts();
        });
    });

    // Cart Drawer Toggle
    cartBtn.addEventListener("click", () => cartDrawer.classList.add("active"));
    cartDrawerClose.addEventListener("click", () => cartDrawer.classList.remove("active"));
    cartDrawer.addEventListener("click", (e) => {
        if (e.target === cartDrawer) cartDrawer.classList.remove("active");
    });

    // Checkout Drawer Toggle
    checkoutBtn.addEventListener("click", () => {
        if (cart.length === 0) {
            alert("Your cart is empty!");
            return;
        }
        cartDrawer.classList.remove("active");
        openCheckout();
    });
    checkoutDrawerClose.addEventListener("click", () => checkoutDrawer.classList.remove("active"));
    checkoutDrawer.addEventListener("click", (e) => {
        if (e.target === checkoutDrawer) checkoutDrawer.classList.remove("active");
    });

    // Checkout Form Submit
    checkoutForm.addEventListener("submit", (e) => {
        e.preventDefault();
        processCheckout();
    });

    // Success Modal Close
    successContinueBtn.addEventListener("click", () => {
        successModal.classList.remove("active");
    });

    // Detail Modal Close
    modalCloseBtn.addEventListener("click", () => {
        productModal.classList.remove("active");
        activeProduct = null;
    });
    productModal.addEventListener("click", (e) => {
        if (e.target === productModal) {
            productModal.classList.remove("active");
            activeProduct = null;
        }
    });

    // Gallery navigation
    modalPrevBtn.addEventListener("click", () => navigateGallery(-1));
    modalNextBtn.addEventListener("click", () => navigateGallery(1));

    // Modal Add To Cart
    modalAddToCartBtn.addEventListener("click", () => {
        if (activeProduct) {
            addToCart(activeProduct);
            const origText = modalAddToCartBtn.innerHTML;
            modalAddToCartBtn.innerHTML = '<i class="fa-solid fa-check"></i> ADDED TO CART';
            modalAddToCartBtn.style.background = "#2ecc71";
            setTimeout(() => {
                modalAddToCartBtn.innerHTML = origText;
                modalAddToCartBtn.style.background = "";
            }, 1500);
        }
    });

    // Hero scroll button
    document.getElementById("scroll-to-catalog").addEventListener("click", () => {
        document.getElementById("catalog-section").scrollIntoView({ behavior: "smooth" });
    });

    // Mobile Filter Drawer Toggle
    const mobileFilterBtn = document.getElementById("mobile-filter-btn");
    const filterSidebar = document.querySelector(".filter-sidebar");
    if (mobileFilterBtn && filterSidebar) {
        mobileFilterBtn.addEventListener("click", () => {
            filterSidebar.classList.toggle("active");
            if (filterSidebar.classList.contains("active")) {
                mobileFilterBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Close Filters';
                mobileFilterBtn.classList.add("active");
            } else {
                mobileFilterBtn.innerHTML = '<i class="fa-solid fa-sliders"></i> Filter Options';
                mobileFilterBtn.classList.remove("active");
            }
        });
    }

    // Back to Top Scroll & Click
    const backToTopBtn = document.getElementById("back-to-top");
    if (backToTopBtn) {
        window.addEventListener("scroll", () => {
            if (window.scrollY > 400) {
                backToTopBtn.classList.add("visible");
            } else {
                backToTopBtn.classList.remove("visible");
            }
        });

        backToTopBtn.addEventListener("click", () => {
            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        });
    }
}

// --- 6. Product Details and Gallery ---
function openProductDetail(product) {
    activeProduct = product;
    currentImageIndex = 0;
    
    // Fill detail modal content
    modalVertical.textContent = (product.vertical || "Masterpiece").toUpperCase();
    modalTitle.textContent = product.title;
    modalPrice.textContent = formatCurrency(product.price);
    
    const originalPriceVal = product.price * 1.25;
    modalOriginalPrice.textContent = `Market Value: ${formatCurrency(originalPriceVal)}`;
    
    modalDescription.textContent = product.description || "No description is available for this exquisite masterpiece.";
    
    // Fill specifications table
    modalSpecsTable.innerHTML = "";
    const specs = product.specs || {};
    
    const specKeysToShow = [
        "Creator", "Dimensions", "Style", "Materials and Techniques", 
        "Place of Origin", "Period", "Date of Manufacture", "Condition", "Seller Location", "Reference Number"
    ];
    
    let specCount = 0;
    specKeysToShow.forEach(key => {
        let val = specs[key];
        if (val) {
            const tr = document.createElement("tr");
            let displayVal = Array.isArray(val) ? val.join(", ") : val;
            
            tr.innerHTML = `
                <td>${translateSpecKey(key)}</td>
                <td>${displayVal}</td>
            `;
            modalSpecsTable.appendChild(tr);
            specCount++;
        }
    });

    if (specCount === 0) {
        for (let key in specs) {
            const tr = document.createElement("tr");
            let val = specs[key];
            let displayVal = Array.isArray(val) ? val.join(", ") : val;
            tr.innerHTML = `<td>${key}</td><td>${displayVal}</td>`;
            modalSpecsTable.appendChild(tr);
        }
    }

    // Set Gallery Images
    const images = product.images || [];
    if (images.length > 0) {
        modalMainImg.src = images[0];
        
        // Thumbnails list
        modalThumbnails.innerHTML = "";
        images.forEach((img, idx) => {
            const thumb = document.createElement("div");
            thumb.className = `thumbnail ${idx === 0 ? 'active' : ''}`;
            thumb.innerHTML = `<img src="${img}" alt="Gallery ${idx + 1}">`;
            thumb.addEventListener("click", () => {
                setMainImage(idx);
            });
            modalThumbnails.appendChild(thumb);
        });

        if (images.length > 1) {
            modalPrevBtn.style.display = "flex";
            modalNextBtn.style.display = "flex";
        } else {
            modalPrevBtn.style.display = "none";
            modalNextBtn.style.display = "none";
        }
    } else {
        modalMainImg.src = "placeholder.jpg";
        modalThumbnails.innerHTML = "";
        modalPrevBtn.style.display = "none";
        modalNextBtn.style.display = "none";
    }

    // Show modal
    productModal.classList.add("active");
}

function setMainImage(index) {
    if (!activeProduct || !activeProduct.images || activeProduct.images.length === 0) return;
    
    currentImageIndex = index;
    modalMainImg.src = activeProduct.images[index];
    
    const thumbs = modalThumbnails.querySelectorAll(".thumbnail");
    thumbs.forEach((t, idx) => {
        if (idx === index) {
            t.classList.add("active");
            t.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        } else {
            t.classList.remove("active");
        }
    });
}

function navigateGallery(direction) {
    if (!activeProduct || !activeProduct.images || activeProduct.images.length <= 1) return;
    
    let newIndex = currentImageIndex + direction;
    if (newIndex >= activeProduct.images.length) newIndex = 0;
    if (newIndex < 0) newIndex = activeProduct.images.length - 1;
    
    setMainImage(newIndex);
}

function translateSpecKey(key) {
    // Scraped keys are already in English. Let's return them cleanly
    return key;
}

// --- 7. Cart Management ---
function addToCart(product) {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ product, quantity: 1 });
    }
    
    saveCartAndRender();
    updateCartBadge();
}

function updateCartQuantity(productId, delta) {
    const item = cart.find(item => item.product.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(item => item.product.id !== productId);
    }

    saveCartAndRender();
    updateCartBadge();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.product.id !== productId);
    saveCartAndRender();
    updateCartBadge();
}

function updateCartBadge() {
    const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
    cartCountBadge.textContent = totalQty;
    
    if (totalQty === 0) {
        cartCountBadge.style.display = "none";
    } else {
        cartCountBadge.style.display = "flex";
        cartCountBadge.parentElement.classList.add("pulse");
        setTimeout(() => cartCountBadge.parentElement.classList.remove("pulse"), 300);
    }
}

function saveCartAndRender() {
    localStorage.setItem("aurum_cart", JSON.stringify(cart));
    renderCart();
}

function loadLocalCart() {
    const local = localStorage.getItem("aurum_cart");
    if (local) {
        try {
            cart = JSON.parse(local);
            updateCartBadge();
        } catch (e) {
            cart = [];
        }
    }
}

function renderCart() {
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart-state">
                <i class="fa-solid fa-bag-shopping"></i>
                <p>Your cart is empty.</p>
                <p style="font-size: 12px; color: var(--text-muted);">Start by adding exquisite pieces from our collection.</p>
            </div>
        `;
        cartSubtotal.textContent = "$0";
        cartTotal.textContent = "$0";
        return;
    }

    cartItemsContainer.innerHTML = "";
    let subtotalVal = 0;

    cart.forEach(item => {
        const p = item.product;
        const itemTotal = p.price * item.quantity;
        subtotalVal += itemTotal;

        const cartItemDiv = document.createElement("div");
        cartItemDiv.className = "cart-item";
        cartItemDiv.innerHTML = `
            <div class="cart-item-img">
                <img src="${p.images && p.images.length > 0 ? p.images[0] : 'placeholder.jpg'}" alt="${p.title}">
            </div>
            <div class="cart-item-details">
                <h4 class="cart-item-title">${p.title}</h4>
                <div class="cart-item-price">${formatCurrency(p.price)}</div>
                <div class="cart-item-quantity">
                    <button class="qty-btn dec-btn" data-id="${p.id}"><i class="fa-solid fa-minus"></i></button>
                    <span class="qty-val">${item.quantity}</span>
                    <button class="qty-btn inc-btn" data-id="${p.id}"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
            <button class="cart-item-remove" data-id="${p.id}" title="Remove from Cart">
                <i class="fa-regular fa-trash-can"></i>
            </button>
        `;

        // Event listeners
        cartItemDiv.querySelector(".dec-btn").addEventListener("click", () => updateCartQuantity(p.id, -1));
        cartItemDiv.querySelector(".inc-btn").addEventListener("click", () => updateCartQuantity(p.id, 1));
        cartItemDiv.querySelector(".cart-item-remove").addEventListener("click", () => removeFromCart(p.id));

        cartItemsContainer.appendChild(cartItemDiv);
    });

    cartSubtotal.textContent = formatCurrency(subtotalVal);
    cartTotal.textContent = formatCurrency(subtotalVal);
}

// --- 8. Favorites ---
function toggleFavorite(productId) {
    if (favorites.has(productId)) {
        favorites.delete(productId);
    } else {
        favorites.add(productId);
    }
    favCountBadge.textContent = favorites.size;
    favCountBadge.style.display = favorites.size === 0 ? "none" : "flex";
}

// --- 9. Checkout Simulation ---
function openCheckout() {
    const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
    const totalVal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    
    checkoutItemsCount.textContent = `${totalQty} Rare Piece` + (totalQty > 1 ? "s" : "");
    checkoutTotalPrice.textContent = formatCurrency(totalVal);
    
    checkoutDrawer.classList.add("active");
}

function processCheckout() {
    const payBtn = document.getElementById("place-order-btn");
    const origBtnText = payBtn.innerHTML;
    
    payBtn.disabled = true;
    payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ESTABLISHING SECURE BANK CONNECTION...';
    
    setTimeout(() => {
        payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESSING PAYMENT...';
        
        setTimeout(() => {
            const totalVal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
            
            // Clear cart
            cart = [];
            saveCartAndRender();
            updateCartBadge();
            
            // Close drawer
            checkoutDrawer.classList.remove("active");
            payBtn.disabled = false;
            payBtn.innerHTML = origBtnText;
            
            // Show Success Modal
            const randomId = "AUR-" + Math.floor(1000000 + Math.random() * 9000000);
            successOrderId.textContent = "#" + randomId;
            successOrderTotal.textContent = formatCurrency(totalVal);
            successModal.classList.add("active");
            
            checkoutForm.reset();
            
        }, 1500);
    }, 1200);
}

// --- 10. Helper Functions ---
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(value);
}

// --- 11. Live Sales Notifications Loops (Social Proof) ---
function startSalesNotifications() {
    const notificationElement = document.getElementById("sales-notification");
    if (!notificationElement) return;

    const locations = [
        "London, UK", "Paris, France", "New York, USA", "Geneva, Switzerland", 
        "Tokyo, Japan", "Milan, Italy", "Monaco", "Zurich, Switzerland", 
        "Los Angeles, USA", "Munich, Germany", "Dubai, UAE", "Istanbul, Turkey"
    ];

    const actions = [
        "was purchased by a collector.",
        "was reserved for a private collection.",
        "is on its way via secure courier.",
        "was added to cart by a client."
    ];

    function showNotification() {
        if (allProducts.length === 0) return;

        // Choose random product, location, action
        const product = allProducts[Math.floor(Math.random() * allProducts.length)];
        const location = locations[Math.floor(Math.random() * locations.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];
        const timeText = "Just now";

        const imgUrl = product.images && product.images.length > 0 ? product.images[0] : 'placeholder.jpg';

        notificationElement.innerHTML = `
            <div class="sales-notif-img">
                <img src="${imgUrl}" alt="${product.title}">
            </div>
            <div class="sales-notif-info">
                <div class="sales-notif-title">${product.title}</div>
                <div class="sales-notif-text">from <strong>${location}</strong> ${action}</div>
                <span class="sales-notif-time">${timeText}</span>
            </div>
            <button class="sales-notif-close" id="sales-notif-close-btn">&times;</button>
        `;

        // Show toast
        notificationElement.classList.add("active");

        // Close button listener
        const closeBtn = notificationElement.querySelector("#sales-notif-close-btn");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                notificationElement.classList.remove("active");
            });
        }

        // Auto hide after 6 seconds
        setTimeout(() => {
            notificationElement.classList.remove("active");
        }, 6000);
    }

    // First notification after 5 seconds
    setTimeout(() => {
        showNotification();
        // Cycle every 22 seconds
        setInterval(showNotification, 22000);
    }, 5000);
}
