// AURUM Lüks Pazaryeri Uygulama Mantığı (Vanilla JS)

// --- Supabase Yapılandırması ---
// Veritabanı bağlantısı kurmak istediğinizde burayı kendi bilgilerinizle doldurabilirsiniz.
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof supabase !== 'undefined') {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("[AURUM] Supabase bağlantısı kuruldu.");
    } catch (e) {
        console.warn("[AURUM] Supabase başlatılamadı, yerel JSON moduna geçiliyor:", e);
    }
}

// Global Durum Yönetimi (State)
let allProducts = [];
let filteredProducts = [];
let cart = [];
let favorites = new Set();
let activeVertical = "all";
let currentImageIndex = 0;
let activeProduct = null;

// Filtre Seçenekleri Durumu
const currentFilters = {
    search: "",
    priceLimit: 12000000,
    creator: "all",
    style: "all",
    period: "all",
    origin: "all",
    sort: "price-desc"
};

// DOM Elemanları
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

// Sepet DOM Elemanları
const cartBtn = document.getElementById("cart-btn");
const cartDrawer = document.getElementById("cart-drawer");
const cartDrawerClose = document.getElementById("cart-drawer-close");
const cartItemsContainer = document.getElementById("cart-items-container");
const cartSubtotal = document.getElementById("cart-subtotal");
const cartTotal = document.getElementById("cart-total");
const cartCountBadge = document.getElementById("cart-count");
const favCountBadge = document.getElementById("fav-count");
const checkoutBtn = document.getElementById("checkout-btn");

// Ödeme DOM Elemanları
const checkoutDrawer = document.getElementById("checkout-drawer");
const checkoutDrawerClose = document.getElementById("checkout-drawer-close");
const checkoutForm = document.getElementById("checkout-form");
const checkoutItemsCount = document.getElementById("checkout-items-count");
const checkoutTotalPrice = document.getElementById("checkout-total-price");
const successModal = document.getElementById("success-modal");
const successOrderId = document.getElementById("success-order-id");
const successOrderTotal = document.getElementById("success-order-total");
const successContinueBtn = document.getElementById("success-continue-btn");

// Detay Modalı DOM Elemanları
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

// --- 1. Veri Yükleme ve Başlangıç ---
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    setupEventListeners();
    loadLocalCart();
    
    // Fare Takipçisi Altın Işıltı
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
        
        // Supabase bağlantısı aktifse veritabanından çek
        if (supabaseClient) {
            console.log("[AURUM] Supabase veritabanından veri çekiliyor...");
            const { data: dbData, error } = await supabaseClient
                .from("products")
                .select("*")
                .order("price", { ascending: false });
                
            if (error) throw error;
            data = dbData;
        }
        
        // Supabase boş veya başarısızsa yerel JSON fallback'ini kullan
        if (!data || data.length === 0) {
            console.log("[AURUM] Supabase boş veya devre dışı, yerel products.json çekiliyor...");
            const response = await fetch("scraper/products.json");
            data = await response.json();
        }
        
        allProducts = data;
        filteredProducts = [...allProducts];
        
        // Filtre dropdown seçeneklerini dinamik doldur
        populateFilterDropdowns();
        
        // Ürünleri listele
        renderProducts();
        
        // Canlı satış popuplarını başlat
        startSalesNotifications();
        
    } catch (error) {
        console.error("[AURUM] Veri yüklenirken hata oluştu:", error);
        productsGrid.innerHTML = `
            <div class="loader-container">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px; color: #ff6b6b;"></i>
                <p>Ürünler yüklenirken bir hata oluştu. Lütfen scraper'ın çalışıp 'scraper/products.json' dosyasını ürettiğinden emin olun.</p>
            </div>
        `;
    }
}

function showLoader() {
    productsGrid.innerHTML = `
        <div class="loader-container">
            <div class="aurum-spinner"></div>
            <p>Nadir eserler yükleniyor...</p>
        </div>
    `;
}

// --- 2. Filtreleri Doldurma Mantığı ---
function populateFilterDropdowns() {
    const creators = new Set();
    const styles = new Set();
    const periods = new Set();
    const origins = new Set();
    let maxPrice = 12000000;

    allProducts.forEach(p => {
        // Fiyat limitlerini belirle
        if (p.price > maxPrice) maxPrice = Math.ceil(p.price);
        
        // Özellikleri ayrıştır
        const specs = p.specs || {};
        if (specs["Creator"]) creators.add(specs["Creator"]);
        if (specs["Style"]) styles.add(specs["Style"]);
        if (specs["Period"]) periods.add(specs["Period"]);
        if (specs["Place of Origin"]) origins.add(specs["Place of Origin"]);
    });

    // Slider'ı dinamik olarak maksimum fiyata çek
    priceSlider.max = maxPrice;
    priceSlider.value = maxPrice;
    currentFilters.priceLimit = maxPrice;
    priceMaxLabel.textContent = formatCurrency(maxPrice);
    currentPriceLimitLabel.textContent = formatCurrency(maxPrice);

    // Dropdownları doldur
    fillSelect(creatorSelect, creators);
    fillSelect(styleSelect, styles);
    fillSelect(periodSelect, periods);
    fillSelect(originSelect, origins);
}

function fillSelect(selectElement, itemsSet) {
    // İlk "Tümü" seçeneği hariç temizle
    selectElement.innerHTML = '<option value="all">Tümü</option>';
    
    // Sıralı dizi yapıp ekleyelim
    Array.from(itemsSet).sort().forEach(item => {
        if (!item) return;
        const opt = document.createElement("option");
        opt.value = item;
        opt.textContent = item;
        selectElement.appendChild(opt);
    });
}

// --- 3. Ürün Listeleme (Render) ---
function renderProducts() {
    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = `
            <div class="loader-container">
                <i class="fa-solid fa-hourglass-empty" style="font-size: 40px; color: var(--accent-gold);"></i>
                <p>Aradığınız kriterlere uygun eser bulunamadı. Lütfen filtrelerinizi gevşetin.</p>
            </div>
        `;
        productCountLabel.textContent = "0 Başyapıt Gösteriliyor";
        return;
    }

    productCountLabel.textContent = `${filteredProducts.length} Seçkin Eser Gösteriliyor`;
    productsGrid.innerHTML = "";

    filteredProducts.forEach(product => {
        const specs = product.specs || {};
        const creator = specs["Creator"] || "Bilinmiyor";
        const origin = specs["Place of Origin"] || "";
        const isFav = favorites.has(product.id) ? "active" : "";
        const originalPriceVal = product.original_price || (product.price / 1.15);
        
        const card = document.createElement("div");
        card.className = "product-card";
        card.setAttribute("data-id", product.id);
        
        // Kart içeriği
        card.innerHTML = `
            <div class="product-image-container">
                <button class="favorite-card-btn ${isFav}" data-id="${product.id}" title="Favorilere Ekle">
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
        
        // Tıklama olayları (Favori hariç karta tıklanınca detay aç)
        card.addEventListener("click", (e) => {
            if (e.target.closest(".favorite-card-btn")) return;
            openProductDetail(product);
        });

        // Favori tıklandığında
        const favBtn = card.querySelector(".favorite-card-btn");
        favBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFavorite(product.id);
            favBtn.classList.toggle("active");
        });

        productsGrid.appendChild(card);
    });
}

// --- 4. Filtreleme ve Sıralama Algoritması ---
function filterAndSortProducts() {
    filteredProducts = allProducts.filter(p => {
        const specs = p.specs || {};
        
        // 1. Kategori Dikey Filtresi (furniture, art, jewelry, fashion vb.)
        if (activeVertical !== "all") {
            const prodVert = (p.vertical || "").toLowerCase();
            const activeV = activeVertical.toLowerCase();
            
            if (activeV === "furniture" && prodVert !== "furniture") return false;
            if (activeV === "jewelry" && prodVert !== "jewelry") return false;
            if (activeV === "art" && prodVert !== "art") return false;
            if (activeV === "other" && ["furniture", "jewelry", "art"].includes(prodVert)) return false;
        }

        // 2. Arama Filtresi (Başlık, Açıklama, Tasarımcı)
        if (currentFilters.search) {
            const query = currentFilters.search.toLowerCase();
            const titleMatch = (p.title || "").toLowerCase().includes(query);
            const descMatch = (p.description || "").toLowerCase().includes(query);
            const creatorMatch = (specs["Creator"] || "").toLowerCase().includes(query);
            const styleMatch = (specs["Style"] || "").toLowerCase().includes(query);
            if (!titleMatch && !descMatch && !creatorMatch && !styleMatch) return false;
        }

        // 3. Fiyat Sınırı
        if (p.price > currentFilters.priceLimit) return false;

        // 4. Tasarımcı Filtresi
        if (currentFilters.creator !== "all" && specs["Creator"] !== currentFilters.creator) return false;

        // 5. Stil Filtresi
        if (currentFilters.style !== "all" && specs["Style"] !== currentFilters.style) return false;

        // 6. Dönem Filtresi
        if (currentFilters.period !== "all" && specs["Period"] !== currentFilters.period) return false;

        // 7. Menşei Filtresi
        if (currentFilters.origin !== "all" && specs["Place of Origin"] !== currentFilters.origin) return false;

        return true;
    });

    // Sıralama
    if (currentFilters.sort === "price-desc") {
        filteredProducts.sort((a, b) => b.price - a.price);
    } else if (currentFilters.sort === "price-asc") {
        filteredProducts.sort((a, b) => a.price - b.price);
    } else if (currentFilters.sort === "title-asc") {
        filteredProducts.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    renderProducts();
}

// --- 5. Olay Dinleyicileri (Event Listeners) ---
function setupEventListeners() {
    // Arama Çubuğu
    globalSearch.addEventListener("input", (e) => {
        currentFilters.search = e.target.value.trim();
        filterAndSortProducts();
    });

    // Fiyat Slider
    priceSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        currentFilters.priceLimit = val;
        currentPriceLimitLabel.textContent = formatCurrency(val);
        filterAndSortProducts();
    });

    // Dropdown filtreler
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

    // Sıralama
    sortSelect.addEventListener("change", (e) => {
        currentFilters.sort = e.target.value;
        filterAndSortProducts();
    });

    // Filtreleri Temizle
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

    // Kategori Tab Değişimi
    categoryTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            categoryTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            activeVertical = tab.getAttribute("data-vertical");
            filterAndSortProducts();
        });
    });

    // Sepet Aç/Kapat
    cartBtn.addEventListener("click", () => cartDrawer.classList.add("active"));
    cartDrawerClose.addEventListener("click", () => cartDrawer.classList.remove("active"));
    cartDrawer.addEventListener("click", (e) => {
        if (e.target === cartDrawer) cartDrawer.classList.remove("active");
    });

    // Ödeme Ekranı Aç/Kapat
    checkoutBtn.addEventListener("click", () => {
        if (cart.length === 0) {
            alert("Sepetiniz boş!");
            return;
        }
        cartDrawer.classList.remove("active");
        openCheckout();
    });
    checkoutDrawerClose.addEventListener("click", () => checkoutDrawer.classList.remove("active"));
    checkoutDrawer.addEventListener("click", (e) => {
        if (e.target === checkoutDrawer) checkoutDrawer.classList.remove("active");
    });

    // Ödeme Formu Gönderimi
    checkoutForm.addEventListener("submit", (e) => {
        e.preventDefault();
        processCheckout();
    });

    // Başarı Modalı Kapat
    successContinueBtn.addEventListener("click", () => {
        successModal.classList.remove("active");
    });

    // Detay Modalı Kapat
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

    // Modal Galeri Navigasyonu
    modalPrevBtn.addEventListener("click", () => navigateGallery(-1));
    modalNextBtn.addEventListener("click", () => navigateGallery(1));

    // Modal Sepete Ekle
    modalAddToCartBtn.addEventListener("click", () => {
        if (activeProduct) {
            addToCart(activeProduct);
            // Küçük animasyon bildirimi
            const origText = modalAddToCartBtn.innerHTML;
            modalAddToCartBtn.innerHTML = '<i class="fa-solid fa-check"></i> SEPETE EKLENDİ';
            modalAddToCartBtn.style.background = "#2ecc71";
            setTimeout(() => {
                modalAddToCartBtn.innerHTML = origText;
                modalAddToCartBtn.style.background = "";
            }, 1500);
        }
    });

    // Hero Scroll Butonu
    document.getElementById("scroll-to-catalog").addEventListener("click", () => {
        document.getElementById("catalog-section").scrollIntoView({ behavior: "smooth" });
    });
}

// --- 6. Gelişmiş Galeri ve Detay Görünümü ---
function openProductDetail(product) {
    activeProduct = product;
    currentImageIndex = 0;
    
    // Detay Modalını Doldur
    modalVertical.textContent = (product.vertical || "Masterpiece").toUpperCase();
    modalTitle.textContent = product.title;
    modalPrice.textContent = formatCurrency(product.price);
    
    const originalPriceVal = product.original_price || (product.price / 1.15);
    modalOriginalPrice.textContent = `Piyasa Değeri: ${formatCurrency(originalPriceVal)}`;
    
    modalDescription.textContent = product.description || "Bu seçkin esere ait özel bir açıklama bulunmamaktadır.";
    
    // Özellikler Tablosunu oluştur
    modalSpecsTable.innerHTML = "";
    const specs = product.specs || {};
    
    // Göstermek istediğimiz özel anahtarlar sırasıyla
    const specKeysToShow = [
        "Creator", "Dimensions", "Style", "Materials and Techniques", 
        "Place of Origin", "Period", "Date of Manufacture", "Condition", "Seller Location", "Reference Number"
    ];
    
    let specCount = 0;
    specKeysToShow.forEach(key => {
        let val = specs[key];
        if (val) {
            const tr = document.createElement("tr");
            
            // Eğer dizi ise virgülle birleştirerek göster
            let displayVal = "";
            if (Array.isArray(val)) {
                displayVal = val.join(", ");
            } else {
                displayVal = val;
            }
            
            tr.innerHTML = `
                <td>${translateSpecKey(key)}</td>
                <td>${displayVal}</td>
            `;
            modalSpecsTable.appendChild(tr);
            specCount++;
        }
    });

    // Eğer hiç spesifikasyon eşleşmediyse tüm listeyi yazdır
    if (specCount === 0) {
        for (let key in specs) {
            const tr = document.createElement("tr");
            let val = specs[key];
            let displayVal = Array.isArray(val) ? val.join(", ") : val;
            tr.innerHTML = `<td>${key}</td><td>${displayVal}</td>`;
            modalSpecsTable.appendChild(tr);
        }
    }

    // Galeri Resimlerini Ayarla
    const images = product.images || [];
    if (images.length > 0) {
        modalMainImg.src = images[0];
        
        // Thumbnail'ları yükle
        modalThumbnails.innerHTML = "";
        images.forEach((img, idx) => {
            const thumb = document.createElement("div");
            thumb.className = `thumbnail ${idx === 0 ? 'active' : ''}`;
            thumb.innerHTML = `<img src="${img}" alt="Görsel ${idx + 1}">`;
            thumb.addEventListener("click", () => {
                setMainImage(idx);
            });
            modalThumbnails.appendChild(thumb);
        });

        // Navigasyon butonlarını göster/gizle
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

    // Modalı Aç
    productModal.classList.add("active");
}

function setMainImage(index) {
    if (!activeProduct || !activeProduct.images || activeProduct.images.length === 0) return;
    
    currentImageIndex = index;
    modalMainImg.src = activeProduct.images[index];
    
    // Thumbnail aktif durumunu güncelle
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
    const translations = {
        "Creator": "Tasarımcı / Yaratıcı",
        "Dimensions": "Boyutlar",
        "Style": "Stil / Tarz",
        "Materials and Techniques": "Malzeme & Teknik",
        "Place of Origin": "Menşei (Ülke)",
        "Period": "Dönem",
        "Date of Manufacture": "Üretim Tarihi",
        "Condition": "Durum Raporu",
        "Seller Location": "Galerici Konumu",
        "Reference Number": "Referans Kodu"
    };
    return translations[key] || key;
}

// --- 7. Sepet Yönetimi Mantığı ---
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
    
    // Sıfırsa gizleme/efekt ekleme
    if (totalQty === 0) {
        cartCountBadge.style.display = "none";
    } else {
        cartCountBadge.style.display = "flex";
        // Küçük titreşim efekti
        cartCountBadge.parentElement.classList.add("pulse");
        setTimeout(() => cartCountBadge.parentElement.classList.remove("pulse"), 300);
    }
}

function saveCartAndRender() {
    // LocalStorage kaydı
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
                <p>Sepetiniz şu anda boş.</p>
                <p style="font-size: 12px; color: var(--text-muted);">Sıradışı koleksiyonumuzdan nadide parçalar ekleyerek başlayın.</p>
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
            <button class="cart-item-remove" data-id="${p.id}" title="Sepetten Çıkar">
                <i class="fa-regular fa-trash-can"></i>
            </button>
        `;

        // Buton olayları
        cartItemDiv.querySelector(".dec-btn").addEventListener("click", () => updateCartQuantity(p.id, -1));
        cartItemDiv.querySelector(".inc-btn").addEventListener("click", () => updateCartQuantity(p.id, 1));
        cartItemDiv.querySelector(".cart-item-remove").addEventListener("click", () => removeFromCart(p.id));

        cartItemsContainer.appendChild(cartItemDiv);
    });

    cartSubtotal.textContent = formatCurrency(subtotalVal);
    cartTotal.textContent = formatCurrency(subtotalVal);
}

// --- 8. Favoriler Mantığı ---
function toggleFavorite(productId) {
    if (favorites.has(productId)) {
        favorites.delete(productId);
    } else {
        favorites.add(productId);
    }
    
    // Favori rozetini güncelle
    favCountBadge.textContent = favorites.size;
    favCountBadge.style.display = favorites.size === 0 ? "none" : "flex";
}

// --- 9. Güvenli Ödeme ve Simülasyon ---
function openCheckout() {
    const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
    const totalVal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    
    checkoutItemsCount.textContent = `${totalQty} Nadir Ürün`;
    checkoutTotalPrice.textContent = formatCurrency(totalVal);
    
    checkoutDrawer.classList.add("active");
}

function processCheckout() {
    const payBtn = document.getElementById("place-order-btn");
    const origBtnText = payBtn.innerHTML;
    
    // Butonu yükleniyor durumuna sok
    payBtn.disabled = true;
    payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GÜVENLİ BANKA BAĞLANTISI KURULUYOR...';
    
    setTimeout(() => {
        payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ÖDEME İŞLENİYOR...';
        
        setTimeout(() => {
            // Sepet değerlerini alıp sepeti sıfırla
            const totalVal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
            
            // Sepeti Temizle
            cart = [];
            saveCartAndRender();
            updateCartBadge();
            
            // Çekmeceyi kapat
            checkoutDrawer.classList.remove("active");
            payBtn.disabled = false;
            payBtn.innerHTML = origBtnText;
            
            // Başarı Modalı Aç
            const randomId = "AUR-" + Math.floor(1000000 + Math.random() * 9000000);
            successOrderId.textContent = "#" + randomId;
            successOrderTotal.textContent = formatCurrency(totalVal);
            successModal.classList.add("active");
            
            // Formu sıfırla
            checkoutForm.reset();
            
        }, 1500);
    }, 1200);
}

// --- 10. Yardımcı Fonksiyonlar ---
function formatCurrency(value) {
    // USD formatında para birimi biçimlendirme
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(value);
}

// --- 11. Canlı Satış Popupları ve Sosyal Kanıt ---
function startSalesNotifications() {
    const notificationElement = document.getElementById("sales-notification");
    if (!notificationElement) return;

    const locations = [
        "Londra, İngiltere", "Paris, Fransa", "New York, ABD", "Cenevre, İsviçre", 
        "Tokyo, Japonya", "Milano, İtalya", "Monako", "Zürih, İsviçre", 
        "Los Angeles, ABD", "Münih, Almanya", "Dubai, BAE", "İstanbul, Türkiye"
    ];

    const actions = [
        "bir koleksiyoner tarafından satın alındı.",
        "koleksiyonuna eklenmek üzere rezerve edildi.",
        "adına özel sigortalı kurye ile yola çıktı.",
        "bir müşteri tarafından sepetine eklendi."
    ];

    function showNotification() {
        if (allProducts.length === 0) return;

        // Rastgele ürün seç
        const product = allProducts[Math.floor(Math.random() * allProducts.length)];
        const location = locations[Math.floor(Math.random() * locations.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];
        const timeText = "Az önce";

        // Resim kontrolü
        const imgUrl = product.images && product.images.length > 0 ? product.images[0] : 'placeholder.jpg';

        notificationElement.innerHTML = `
            <div class="sales-notif-img">
                <img src="${imgUrl}" alt="${product.title}">
            </div>
            <div class="sales-notif-info">
                <div class="sales-notif-title">${product.title}</div>
                <div class="sales-notif-text"><strong>${location}</strong> konumundan ${action}</div>
                <span class="sales-notif-time">${timeText}</span>
            </div>
            <button class="sales-notif-close" id="sales-notif-close-btn">&times;</button>
        `;

        // Göster
        notificationElement.classList.add("active");

        // Kapatma butonu dinleyicisi
        const closeBtn = notificationElement.querySelector("#sales-notif-close-btn");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                notificationElement.classList.remove("active");
            });
        }

        // 6 saniye sonra otomatik gizle
        setTimeout(() => {
            notificationElement.classList.remove("active");
        }, 6000);
    }

    // İlk bildirimi 5 saniye sonra göster
    setTimeout(() => {
        showNotification();
        // Her 22 saniyede bir yeni bildirim göster
        setInterval(showNotification, 22000);
    }, 5000);
}
