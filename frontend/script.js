const AppState = {
  currentUser: null,
  cartTotalPrice: 0,
};

// Configuration
const CONFIG = {
  BASE_URL: "https://go-outdoor-production.up.railway.app",
  DEFAULT_RENT_DAYS: 1,
};

// Custom Error Class
class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// API Client dengan error handling
const apiClient = {
  async request(endpoint, options = {}) {
    const url = `${CONFIG.BASE_URL}${endpoint}`;
    const config = {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new ApiError(errorMessage, response.status);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        "Network error: Tidak dapat terhubung ke server",
        0,
        error.message
      );
    }
  },

  get(endpoint) {
    return this.request(endpoint);
  },

  post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },
};

// DOM Elements
const elements = {
  navbarNav: document.querySelector(".navbar-nav"),
  hamburger: document.querySelector("#hamburger-menu"),
  cart: document.querySelector(".shoping-cart"),
  shoppingCartBtn: document.querySelector("#shoping-cart"),
  closeCartBtn: document.querySelector(".close-cart-btn"),
  produkContainer: document.querySelector(".produk-container"),
  cartItemsContainer: document.querySelector(".cart-items-container"),
  checkoutButton: document.querySelector(".btn-checkout"),
  rentDaysInput: document.getElementById("rent-days"),
  totalPriceElement: document.getElementById("total-price"),
  userProfileElement: document.querySelector("#user-profile"),
  loginButtonElement: document.querySelector("#login-button"),
  logoutButton: document.querySelector("#logout-button"),
};

const overlay = document.createElement("div");
overlay.classList.add("overlay");
document.body.appendChild(overlay);

// Login Status Management
async function checkLoginStatus() {
  try {
    AppState.currentUser = await apiClient.get("/auth/profile");
    console.log("User logged in:", AppState.currentUser.fullname);
  } catch (error) {
    AppState.currentUser = null;
    if (error.status !== 401) {
      console.warn("Login check failed:", error.message);
    }
  }
  updateUIBasedOnLoginStatus();
}

function updateUIBasedOnLoginStatus() {
  const { userProfileElement, loginButtonElement, logoutButton } = elements;

  if (AppState.currentUser) {
    if (userProfileElement) {
      userProfileElement.innerHTML = `
        <a href="#" style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-feather="user"></i>
          ${AppState.currentUser.fullname.split(" ")[0]}
        </a>`;
      userProfileElement.style.display = "flex";
    }

    if (loginButtonElement) loginButtonElement.style.display = "none";
    if (logoutButton) {
      logoutButton.style.display = "flex";
      logoutButton.onclick = handleLogout;
    }
    feather.replace();
  } else {
    if (userProfileElement) userProfileElement.style.display = "none";
    if (logoutButton) logoutButton.style.display = "none";
    if (loginButtonElement) loginButtonElement.style.display = "flex";
  }
}

// Product Management
async function fetchProducts() {
  const { produkContainer } = elements;

  if (!produkContainer) {
    console.error("Produk container not found");
    return;
  }

  try {
    produkContainer.innerHTML = '<div class="loading">Memuat produk...</div>';
    const products = await apiClient.get("/api/products");

    produkContainer.innerHTML = "";

    if (products.length === 0) {
      produkContainer.innerHTML =
        '<div class="no-products">Tidak ada produk tersedia.</div>';
      return;
    }

    products.forEach((product) => {
      const card = document.createElement("div");
      card.classList.add("card");
      card.innerHTML = `
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <h3>${product.name}</h3>
        <p class="harga">Rp ${parseFloat(product.price).toLocaleString(
          "id-ID"
        )} / hari</p>
        <div class="card-action">
          <button class="btn-cart" data-id="${product.id}" data-stock="${
        product.stock
      }">
            Add to cart
          </button>
        </div>
      `;
      produkContainer.appendChild(card);
    });
  } catch (error) {
    console.error("Gagal mengambil produk:", error);
    produkContainer.innerHTML = `
      <div class="error-message">
        <p>Gagal memuat produk.</p>
        <button onclick="fetchProducts()" class="retry-btn">Coba Lagi</button>
      </div>
    `;
  }
}

// Cart Management
async function fetchCartItems() {
  const { cartItemsContainer, checkoutButton } = elements;

  if (!cartItemsContainer) return;

  if (!AppState.currentUser) {
    cartItemsContainer.innerHTML = `
      <div class="cart-item-placeholder">
        <p>Anda harus login untuk melihat keranjang.</p>
        <a href="/login" class="btn-login">Login Sekarang</a>
      </div>
    `;
    if (checkoutButton) checkoutButton.style.display = "none";
    updateFinalPrice();
    return;
  }

  try {
    cartItemsContainer.innerHTML =
      '<div class="loading">Memuat keranjang...</div>';
    const cartItems = await apiClient.get("/api/cart");
    renderCartItems(cartItems);
  } catch (error) {
    console.error("Gagal mengambil item keranjang:", error);
    cartItemsContainer.innerHTML = `
      <div class="error-message">
        <p>Gagal memuat keranjang.</p>
        <button onclick="fetchCartItems()" class="retry-btn">Coba Lagi</button>
      </div>
    `;
  }
}

function renderCartItems(cartItems) {
  const { cartItemsContainer, checkoutButton } = elements;

  if (!cartItemsContainer) return;

  cartItemsContainer.innerHTML = "";
  AppState.cartTotalPrice = 0;

  if (cartItems.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="cart-item-placeholder">Keranjang kosong.</div>
    `;
    if (checkoutButton) checkoutButton.style.display = "none";
  } else {
    if (checkoutButton) checkoutButton.style.display = "block";
    cartItems.forEach((item) => {
      const itemPrice = parseFloat(item.price);
      AppState.cartTotalPrice += itemPrice * item.quantity;

      const cartItemDiv = document.createElement("div");
      cartItemDiv.classList.add("cart-item");
      cartItemDiv.innerHTML = `
        <img src="${item.image}" alt="${item.name}" loading="lazy">
        <div class="item-detail">
          <h3>${item.name}</h3>
          <div class="item-price">Rp ${itemPrice.toLocaleString("id-ID")}</div>
          <div class="quantity-control">
            <button class="btn-qty btn-minus" data-id="${
              item.cartId
            }">-</button>
            <input type="number" class="item-quantity" value="${
              item.quantity
            }" readonly>
            <button class="btn-qty btn-plus" data-id="${
              item.cartId
            }" data-stock="${item.stock}">+</button>
          </div>
        </div>
        <i data-feather="trash-2" class="remove-item btn-remove" data-id="${
          item.cartId
        }"></i>
      `;
      cartItemsContainer.appendChild(cartItemDiv);
    });
    feather.replace();
  }
  updateFinalPrice();
}

// Price Calculation
function updateFinalPrice() {
  const { rentDaysInput, totalPriceElement } = elements;

  if (!rentDaysInput || !totalPriceElement) return;

  const days = parseInt(rentDaysInput.value) || CONFIG.DEFAULT_RENT_DAYS;
  const finalPrice = AppState.cartTotalPrice * days;
  totalPriceElement.textContent = `Rp ${finalPrice.toLocaleString("id-ID")}`;
}

// Overlay Management
function toggleOverlay() {
  const { cart, navbarNav } = elements;
  const isActive =
    cart?.classList.contains("active") ||
    navbarNav?.classList.contains("active");
  overlay.classList.toggle("active", isActive);
}

// Event Handlers
async function handleLogout(e) {
  if (e) e.preventDefault();

  try {
    const result = await Swal.fire({
      title: "Logout",
      text: "Apakah Anda yakin ingin logout?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Ya, Logout",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      await apiClient.post("/auth/logout");
      AppState.currentUser = null;
      updateUIBasedOnLoginStatus();
      fetchCartItems();
      await Swal.fire("Berhasil!", "Anda berhasil logout.", "success");
    }
  } catch (error) {
    console.error("Gagal logout:", error);
    await Swal.fire("Error", "Gagal logout. Coba lagi.", "error");
  }
}

async function handleAddToCart(e) {
  const addToCartBtn = e.target.closest(".btn-cart");
  if (!addToCartBtn) return;

  if (!AppState.currentUser) {
    await Swal.fire({
      icon: "warning",
      title: "Login Required",
      text: "Anda harus login terlebih dahulu untuk menambahkan item ke keranjang!",
      confirmButtonText: "OK",
    });
    return;
  }

  const productId = addToCartBtn.dataset.id;
  const stock = parseInt(addToCartBtn.dataset.stock);

  try {
    const response = await apiClient.post("/api/cart/add", {
      productId,
      quantity: 1,
    });

    await Swal.fire("Berhasil!", response.message, "success");
    fetchCartItems();
  } catch (error) {
    console.error("Gagal menambahkan produk:", error);
    await Swal.fire(
      "Error",
      error.message || "Gagal menambahkan produk ke keranjang",
      "error"
    );
  }
}

async function handleCartInteraction(e) {
  const target = e.target;
  const cartId = target.dataset.id;

  if (target.closest(".btn-remove")) {
    const result = await Swal.fire({
      title: "Hapus Item",
      text: "Anda yakin ingin menghapus item ini dari keranjang?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Ya, Hapus!",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      await updateCartItemQuantity(cartId, 0);
      await Swal.fire(
        "Terhapus!",
        "Item berhasil dihapus dari keranjang.",
        "success"
      );
    }
    return;
  }

  const quantityControl = target.closest(".quantity-control");
  if (quantityControl) {
    const input = quantityControl.querySelector(".item-quantity");
    const currentQuantity = parseInt(input.value);

    if (target.classList.contains("btn-plus")) {
      const stock = parseInt(target.dataset.stock);
      if (currentQuantity < stock) {
        await updateCartItemQuantity(cartId, currentQuantity + 1);
      } else {
        await Swal.fire("Info", `Stok hanya tersisa ${stock} item.`, "info");
      }
    } else if (target.classList.contains("btn-minus")) {
      await updateCartItemQuantity(cartId, currentQuantity - 1);
    }
  }
}

async function updateCartItemQuantity(cartId, newQuantity) {
  try {
    await apiClient.put("/api/cart/update", { cartId, newQuantity });
    fetchCartItems();
  } catch (error) {
    console.error("Gagal memperbarui kuantitas:", error);
    await Swal.fire("Error", "Gagal memperbarui kuantitas item", "error");
  }
}

async function handleCheckout(e) {
  e.preventDefault();

  const { checkoutButton, rentDaysInput } = elements;

  if (!AppState.currentUser) {
    await Swal.fire({
      icon: "warning",
      title: "Sesi Habis",
      text: "Sesi Anda telah berakhir. Silakan login kembali untuk melanjutkan.",
      confirmButtonText: "Login",
    });
    return;
  }

  const rentDays = parseInt(rentDaysInput.value) || CONFIG.DEFAULT_RENT_DAYS;

  if (rentDays < 1) {
    await Swal.fire({
      icon: "error",
      title: "Hari Sewa Tidak Valid",
      text: "Minimal hari sewa adalah 1 hari.",
    });
    return;
  }

  // Save original state
  const originalText = checkoutButton.textContent;
  const originalDisabled = checkoutButton.disabled;

  try {
    checkoutButton.disabled = true;
    checkoutButton.textContent = "Memproses...";

    const result = await apiClient.post("/api/process-order", {
      customerName: AppState.currentUser.fullname,
      customerEmail: AppState.currentUser.email,
      userId: AppState.currentUser.id,
      rentDays: rentDays,
    });

    await processPayment(result);
  } catch (error) {
    console.error("Error saat checkout:", error);

    let errorMessage = "Terjadi kesalahan saat proses checkout";
    if (error instanceof ApiError) {
      errorMessage = error.message;
    }

    await Swal.fire({
      icon: "error",
      title: "Oops...",
      text: errorMessage,
    });
  } finally {
    // Restore original state
    checkoutButton.disabled = originalDisabled;
    checkoutButton.textContent = originalText;
  }
}

async function processPayment(paymentData) {
  return new Promise((resolve, reject) => {
    if (!window.snap) {
      reject(new Error("Payment gateway not loaded"));
      return;
    }

    window.snap.pay(paymentData.token, {
      onSuccess: function (result) {
        Swal.fire("Sukses!", "Pembayaran berhasil!", "success");
        fetchCartItems();
        fetchProducts();
        resolve(result);
      },
      onPending: function (result) {
        Swal.fire("Pending", "Menunggu pembayaran Anda.", "info");
        fetchCartItems();
        resolve(result);
      },
      onError: function (result) {
        Swal.fire("Gagal", "Pembayaran gagal!", "error");
        reject(new Error("Payment failed"));
      },
      onClose: function () {
        Swal.fire("Info", "Anda menutup jendela pembayaran.", "info");
        reject(new Error("Payment window closed"));
      },
    });
  });
}

// App Initialization
async function initializeApp() {
  try {
    console.log("Initializing app...");
    await checkLoginStatus();
    await fetchProducts();
    setupEventListeners();
    console.log("App initialized successfully");
  } catch (error) {
    console.error("Failed to initialize app:", error);
    showInitializationError();
  }
}

function setupEventListeners() {
  const {
    hamburger,
    shoppingCartBtn,
    closeCartBtn,
    produkContainer,
    cart,
    rentDaysInput,
    checkoutButton,
  } = elements;

  try {
    // Hamburger menu
    if (hamburger) {
      hamburger.addEventListener("click", (e) => {
        e.preventDefault();
        if (cart) cart.classList.remove("active");
        if (elements.navbarNav) elements.navbarNav.classList.toggle("active");
        toggleOverlay();
      });
    }

    // Shopping cart
    if (shoppingCartBtn) {
      shoppingCartBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (elements.navbarNav) elements.navbarNav.classList.remove("active");
        if (cart) {
          cart.classList.toggle("active");
          if (cart.classList.contains("active")) fetchCartItems();
        }
        toggleOverlay();
      });
    }

    // Close cart
    if (closeCartBtn) {
      closeCartBtn.addEventListener("click", () => {
        if (cart) cart.classList.remove("active");
        toggleOverlay();
      });
    }

    // Overlay
    overlay.addEventListener("click", () => {
      if (cart) cart.classList.remove("active");
      if (elements.navbarNav) elements.navbarNav.classList.remove("active");
      toggleOverlay();
    });

    // Rent days input
    if (rentDaysInput) {
      rentDaysInput.addEventListener("input", updateFinalPrice);
      // Set default value
      rentDaysInput.value = CONFIG.DEFAULT_RENT_DAYS;
    }

    // Product container
    if (produkContainer) {
      produkContainer.addEventListener("click", handleAddToCart);
    }

    // Cart interactions
    if (cart) {
      cart.addEventListener("click", handleCartInteraction);
    }

    // Checkout button
    if (checkoutButton) {
      checkoutButton.addEventListener("click", handleCheckout);
    }
  } catch (error) {
    console.error("Error setting up event listeners:", error);
  }
}

function showInitializationError() {
  const mainContainer = document.querySelector("main") || document.body;
  mainContainer.innerHTML = `
    <div class="initialization-error" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
      min-height: 50vh;
    ">
      <h2 style="color: #e74c3c; margin-bottom: 1rem;">Gagal memuat aplikasi</h2>
      <p style="margin-bottom: 2rem; color: #666;">
        Silakan refresh halaman atau coba lagi nanti.
      </p>
      <button onclick="location.reload()" style="
        padding: 0.75rem 1.5rem;
        background: #3498db;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 1rem;
      ">Refresh Halaman</button>
    </div>
  `;
}

// Global error handlers
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

// Make functions available globally for retry buttons
window.fetchProducts = fetchProducts;
window.fetchCartItems = fetchCartItems;

// Initialize app when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

// Add some basic styles for loading and error states
const style = document.createElement("style");
style.textContent = `
  .loading {
    text-align: center;
    padding: 2rem;
    color: #666;
  }
  
  .error-message {
    text-align: center;
    padding: 2rem;
    color: #e74c3c;
  }
  
  .retry-btn {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .retry-btn:hover {
    background: #2980b9;
  }
  
  .cart-item-placeholder {
    text-align: center;
    padding: 2rem;
    color: #666;
  }
  
  .btn-login {
    display: inline-block;
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #27ae60;
    color: white;
    text-decoration: none;
    border-radius: 4px;
  }
  
  .btn-login:hover {
    background: #219a52;
  }
  
  .no-products {
    text-align: center;
    padding: 2rem;
    color: #666;
  }
`;
document.head.appendChild(style);
