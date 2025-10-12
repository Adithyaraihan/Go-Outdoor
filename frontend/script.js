const AppState = {
  currentUser: null, //logic jika sudah login akun
  cartTotalPrice: 0,
};

const navbarNav = document.querySelector(".navbar-nav");
const hamburger = document.querySelector("#hamburger-menu");
const cart = document.querySelector(".shoping-cart");
const shoppingCartBtn = document.querySelector("#shoping-cart");
const closeCartBtn = document.querySelector(".close-cart-btn");
const produkContainer = document.querySelector(".produk-container");
const cartItemsContainer = document.querySelector(".cart-items-container");
const checkoutButton = document.querySelector(".btn-checkout");
const rentDaysInput = document.getElementById("rent-days");
const totalPriceElement = document.getElementById("total-price");
const userProfileElement = document.querySelector("#user-profile");
const loginButtonElement = document.querySelector("#login-button");
const logoutButton = document.querySelector("#logout-button");
const overlay = document.createElement("div");
overlay.classList.add("overlay");
document.body.appendChild(overlay);


async function checkLoginStatus() {
  try {
    const response = await fetch("https://go-outdoor-production.up.railway.app/auth/profile");
    if (response.ok) {
      AppState.currentUser = await response.json();
    } else {
      AppState.currentUser = null;
    }
  } catch (error) {
    console.error("Gagal memeriksa status login:", error);
    AppState.currentUser = null;
  }
  updateUIBasedOnLoginStatus();
}

function updateUIBasedOnLoginStatus() {
  if (AppState.currentUser) {
    if (userProfileElement) {
      userProfileElement.innerHTML = `
        <a href="#" style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-feather="user"></i>
          ${AppState.currentUser.fullname.split(" ")[0]}
        </a>`;
      userProfileElement.style.display = "flex";
      userProfileElement.style.alignItems = "center";
    }
    // jika login maka tombol login hilang
    if (loginButtonElement) loginButtonElement.style.display = "none";
    if (logoutButton) logoutButton.style.display = "flex";

    // tombol buat aktifkan logout
    if (logoutButton) {
      logoutButton.addEventListener("click", handleLogout);
    }
    feather.replace();
  } else {
    if (userProfileElement) userProfileElement.style.display = "none";
    if (logoutButton) logoutButton.style.display = "none";
    if (loginButtonElement) loginButtonElement.style.display = "flex";
  }
}

async function fetchProducts() {
  try {
    const response = await fetch("https://go-outdoor-production.up.railway.app/api/products");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const products = await response.json();
    produkContainer.innerHTML = ""; 
    products.forEach((product) => {
      const card = document.createElement("div");
      card.classList.add("card");
      card.innerHTML = `
        <img src="${product.image}" alt="${product.name}">
        <h3>${product.name}</h3>
        <p class="harga">Rp ${parseFloat(product.price).toLocaleString(
          "id-ID"
        )} / hari</p>
        <div class="card-action">
          <button class="btn-cart" data-id="${product.id}" data-stock="${
        product.stock
      }">Add to cart</button>
        </div>
      `;
      produkContainer.appendChild(card);
    });
  } catch (error) {
    console.error("Gagal mengambil produk:", error);
    produkContainer.innerHTML = "<p>Gagal memuat produk. Coba lagi nanti.</p>";
  }
}

async function fetchCartItems() {
  if (!AppState.currentUser) {
    cartItemsContainer.innerHTML =
      '<div class="cart-item-placeholder">Anda harus login untuk melihat keranjang.</div>';
    checkoutButton.style.display = "none";
    updateFinalPrice();
    return;
  }

  try {
    const response = await fetch("https://go-outdoor-production.up.railway.app/api/cart");
    const cartItems = await response.json();

    cartItemsContainer.innerHTML = "";
    AppState.cartTotalPrice = 0;

    if (cartItems.length === 0) {
      cartItemsContainer.innerHTML =
        '<div class="cart-item-placeholder">Keranjang kosong.</div>';
      checkoutButton.style.display = "none";
    } else {
      checkoutButton.style.display = "block";
      cartItems.forEach((item) => {
        const itemPrice = parseFloat(item.price);
        AppState.cartTotalPrice += itemPrice * item.quantity;
        const cartItemDiv = document.createElement("div");
        cartItemDiv.classList.add("cart-item");
        cartItemDiv.innerHTML = `
          <img src="${item.image}" alt="${item.name}">
          <div class="item-detail">
              <h3>${item.name}</h3>
              <div class="item-price">Rp ${itemPrice.toLocaleString(
                "id-ID"
              )}</div>
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
  } catch (error) {
    console.error("Gagal mengambil item keranjang:", error);
  }
}

// ===================================================================================
// FUNGSI HELPER & EVENT HANDLER
// ===================================================================================

function updateFinalPrice() {
  const days = parseInt(rentDaysInput.value) || 1;
  const finalPrice = AppState.cartTotalPrice * days;
  totalPriceElement.textContent = `Rp ${finalPrice.toLocaleString("id-ID")}`;
}

const toggleOverlay = () => {
  overlay.classList.toggle(
    "active",
    cart.classList.contains("active") || navbarNav.classList.contains("active")
  );
};

async function handleLogout(e) {
  e.preventDefault();
  try {
    await fetch("https://go-outdoor-production.up.railway.app/auth/logout", { method: "POST" });
    AppState.currentUser = null;
    updateUIBasedOnLoginStatus();
    fetchCartItems(); // menampilkan pesan harus login dulu
    Swal.fire("Anda berhasil logout.");
  } catch (error) {
    console.error("Gagal logout:", error);
    Swal.fire("Gagal logout. Coba lagi.");
  }
}

async function handleAddToCart(e) {
  const addToCartBtn = e.target.closest(".btn-cart");
  if (!addToCartBtn) return;

  if (!AppState.currentUser) {
    Swal.fire(
      "Anda harus login terlebih dahulu untuk menambahkan item ke keranjang!"
    );
    return;
  }

  const productId = addToCartBtn.dataset.id;
  try {
    const response = await fetch("https://go-outdoor-production.up.railway.app/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    const result = await response.json();
    Swal.fire(result.message);
    if (response.ok) fetchCartItems();
  } catch (error) {
    console.error("Gagal menambahkan produk:", error);
  }
}

async function handleCartInteraction(e) {
  const target = e.target;
  const cartId = target.dataset.id;

  if (target.closest(".btn-remove")) {
    Swal.fire({
      title: "Anda yakin ingin menghapus item ini?",
      text: "kamu akan mengahpusnya dari keranjang!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        updateCartItemQuantity(cartId, 0);

        Swal.fire({
          title: "Deleted!",
          text: "Item dihapus.",
          icon: "success",
        });
      }
    });
  }

  const quantityControl = target.closest(".quantity-control");
  if (quantityControl) {
    const input = quantityControl.querySelector(".item-quantity");
    const currentQuantity = parseInt(input.value);
    if (target.classList.contains("btn-plus")) {
      const stock = parseInt(target.dataset.stock);
      if (currentQuantity < stock)
        await updateCartItemQuantity(cartId, currentQuantity + 1);
      else Swal.fire(`Stok hanya tersisa ${stock} item.`);
    } else if (target.classList.contains("btn-minus")) {
      await updateCartItemQuantity(cartId, currentQuantity - 1);
    }
  }
}

async function updateCartItemQuantity(cartId, newQuantity) {
  try {
    await fetch("https://go-outdoor-production.up.railway.app/api/cart/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId, newQuantity }),
    });
    fetchCartItems(); 
  } catch (error) {
    console.error("Gagal memperbarui kuantitas:", error);
  }
}

async function handleCheckout(e) {
  e.preventDefault();
  if (!AppState.currentUser) {
    Swal.fire(
      "Sesi Anda telah berakhir. Silakan login kembali untuk melanjutkan."
    );
    return;
  }

  const rentDays = parseInt(rentDaysInput.value) || 1;
  checkoutButton.disabled = true;
  checkoutButton.textContent = "Memproses...";

  try {
    const response = await fetch("https://go-outdoor-production.up.railway.app/api/process-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: AppState.currentUser.fullname,
        customerEmail: AppState.currentUser.email,
        userId: AppState.currentUser.id,
        rentDays: rentDays,
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    window.snap.pay(result.token, {
      onSuccess: function (result) {
        Swal.fire("Pembayaran berhasil!");
        fetchCartItems();
        fetchProducts();
      },
      onPending: function (result) {
        Swal.fire("Menunggu pembayaran Anda.");
        fetchCartItems();
      },
      onError: function (result) {
        Swal.fire("Pembayaran gagal!");
        console.error("Payment Error:", result);
      },
      onClose: function () {
        Swal.fire("Anda menutup jendela pembayaran.");
      },
    });
  } catch (error) {
    console.error("Error saat checkout:", error);
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: `Terjadi kesalahan: ${error.message}`,
    });
  } finally {
    checkoutButton.disabled = false;
    checkoutButton.textContent = "Checkout";
  }
}

// ===================================================================================
// INISIALISASI & EVENT LISTENERS
// ===================================================================================

async function initializeApp() {
  await checkLoginStatus();
  await fetchProducts();

  hamburger.addEventListener("click", (e) => {
    e.preventDefault();
    cart.classList.remove("active"); 
    navbarNav.classList.toggle("active");
    toggleOverlay();
  });

  shoppingCartBtn.addEventListener("click", (e) => {
    e.preventDefault();
    navbarNav.classList.remove("active");
    cart.classList.toggle("active");
    if (cart.classList.contains("active")) fetchCartItems();
    toggleOverlay();
  });
  closeCartBtn.addEventListener("click", () => cart.classList.remove("active"));
  overlay.addEventListener("click", () => {
    cart.classList.remove("active");
    navbarNav.classList.remove("active");
    toggleOverlay();
  });
  rentDaysInput.addEventListener("input", updateFinalPrice);
  produkContainer.addEventListener("click", handleAddToCart);
  cart.addEventListener("click", handleCartInteraction);
  checkoutButton.addEventListener("click", handleCheckout);
}

document.addEventListener("DOMContentLoaded", initializeApp);
