// ===================================================================================
// VARIABEL GLOBAL & SELEKSI ELEMEN DOM
// ===================================================================================

let baseTotalPrice = 0;
const rentDaysInput = document.getElementById("rent-days");

const navbarNav = document.querySelector(".navbar-nav");
const hamburger = document.querySelector("#hamburger-menu");

const cart = document.querySelector(".shoping-cart");
const shoppingCartBtn = document.querySelector("#shoping-cart");
const closeCartBtn = document.querySelector(".close-cart-btn");
const produkContainer = document.querySelector(".produk-container");
const cartItemsContainer = document.querySelector(".cart-items-container");

// Tombol Checkout sekarang menjadi tombol utama di keranjang
const checkoutButton = document.querySelector(".btn-checkout");

// Halaman payment menu lama sudah tidak digunakan, tapi kita simpan selektornya
// jika ingin dipakai lagi, atau bisa dihapus jika yakin tidak dipakai.
const halaman_payment = document.querySelector(".payment-menu");
const close_payment = document.querySelector(".close-payment-btn");

const overlay = document.createElement("div");
overlay.classList.add("overlay");
document.body.appendChild(overlay);

// ===================================================================================
// DATA SIMULASI PENGGUNA
// ===================================================================================

const currentUser = {
  id: 1,
  name: "Budi Santoso",
  email: "budi.santoso@example.com",
};

// ===================================================================================
// FUNCTIONS
// ===================================================================================

function updateFinalPrice() {
  const days = parseInt(rentDaysInput.value) || 1;
  const finalPrice = baseTotalPrice * days;
  const totalPriceElement = document.getElementById("total-price");
  totalPriceElement.textContent = `Rp ${finalPrice.toLocaleString("id-ID")}`;
}

const toggleOverlay = () => {
  if (
    cart.classList.contains("active") ||
    navbarNav.classList.contains("active")
  ) {
    overlay.classList.add("active");
  } else {
    overlay.classList.remove("active");
  }
};

async function fetchProducts() {
  try {
    const response = await fetch("http://localhost:3000/api/products");
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
          <div class="quantity-control">
            <button class="btn-qty btn-minus">-</button>
            <input type="text" min="1" max="${
              product.stock
            }" value="01" class="qty">
            <button class="btn-qty btn-plus">+</button>
          </div>
          <button class="btn-cart" data-id="${product.id}" data-stock="${
        product.stock
      }">Add to cart</button>
        </div>
      `;
      produkContainer.appendChild(card);
    });
  } catch (error) {
    console.error("Gagal mengambil produk:", error);
  }
}

async function fetchCartItems() {
  try {
    const response = await fetch("http://localhost:3000/api/cart");
    const cartItems = await response.json();

    cartItemsContainer.innerHTML = "";
    baseTotalPrice = 0;

    if (cartItems.length === 0) {
      cartItemsContainer.innerHTML =
        '<div class="cart-item-placeholder">Keranjang kosong.</div>';
      checkoutButton.style.display = "none"; // Gunakan checkoutButton
      updateFinalPrice();
      return;
    }

    checkoutButton.style.display = "block"; // Gunakan checkoutButton
    cartItems.forEach((item) => {
      const itemPrice = parseFloat(item.price);
      baseTotalPrice += itemPrice * item.quantity;
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
              }" data-stock="${item.stock}">-</button>
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

    updateFinalPrice();
    feather.replace();
  } catch (error) {
    console.error("Gagal mengambil item keranjang:", error);
  }
}

async function deleteCartItem(cartId) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/cart/delete/${cartId}`,
      { method: "DELETE" }
    );
    const result = await response.json();
    alert(result.message);
    if (response.ok) fetchCartItems();
  } catch (error) {
    console.error("Gagal menghapus item:", error);
  }
}

async function updateCartItemQuantity(cartId, newQuantity) {
  try {
    const response = await fetch("http://localhost:3000/api/cart/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId, newQuantity }),
    });
    if (response.ok) {
      fetchCartItems();
    } else {
      const result = await response.json();
      alert(result.error);
    }
  } catch (error) {
    console.error("Gagal memperbarui kuantitas:", error);
  }
}

// ===================================================================================
// EVENT LISTENERS
// ===================================================================================

document.addEventListener("DOMContentLoaded", () => {
  fetchProducts();
  if (checkoutButton) checkoutButton.style.display = "none"; // Gunakan checkoutButton
});

rentDaysInput.addEventListener("input", updateFinalPrice);
hamburger.addEventListener("click", (e) => {
  e.preventDefault();
  navbarNav.classList.toggle("active");
  toggleOverlay();
});
shoppingCartBtn.addEventListener("click", (e) => {
  e.preventDefault();
  cart.classList.toggle("active");
  if (cart.classList.contains("active")) fetchCartItems();
  toggleOverlay();
});
closeCartBtn.addEventListener("click", () => {
  cart.classList.remove("active");
  toggleOverlay();
});
overlay.addEventListener("click", () => {
  cart.classList.remove("active");
  navbarNav.classList.remove("active");
  toggleOverlay();
});

// Event listener untuk produk (Add to cart)
produkContainer.addEventListener("click", async (e) => {
  const target = e.target;
  const addToCartBtn = target.closest(".btn-cart");
  if (addToCartBtn) {
    const productId = addToCartBtn.dataset.id;
    const card = addToCartBtn.closest(".card");
    const quantityInput = card.querySelector(".qty");
    const quantity = parseInt(quantityInput.value);
    const stock = parseInt(addToCartBtn.dataset.stock);
    if (quantity > 0 && quantity <= stock) {
      try {
        const response = await fetch("http://localhost:3000/api/cart/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, quantity }),
        });
        const result = await response.json();
        alert(result.message);
        if (response.ok) fetchCartItems();
      } catch (error) {
        console.error("Gagal menambahkan produk:", error);
      }
    } else {
      alert("Kuantitas tidak valid atau melebihi stok.");
    }
  }
  const quantityControl = target.closest(".quantity-control");
  if (quantityControl && target.closest(".card-action")) {
    const quantityInput = quantityControl.querySelector(".qty");
    if (quantityInput) {
      let currentQuantity = parseInt(quantityInput.value);
      const maxStock = parseInt(quantityInput.max);
      if (target.classList.contains("btn-plus") && currentQuantity < maxStock) {
        currentQuantity++;
      } else if (
        target.classList.contains("btn-minus") &&
        currentQuantity > 1
      ) {
        currentQuantity--;
      }
      quantityInput.value = currentQuantity.toString().padStart(2, "0");
    }
  }
});

// Event listener untuk interaksi di dalam keranjang
cart.addEventListener("click", async (e) => {
  const target = e.target;
  if (target.closest(".btn-remove")) {
    await deleteCartItem(target.closest(".btn-remove").dataset.id);
  }
  const quantityControl = target.closest(".quantity-control");
  if (quantityControl) {
    const cartId = target.dataset.id;
    const input = quantityControl.querySelector(".item-quantity");
    const currentQuantity = parseInt(input.value);
    if (target.classList.contains("btn-plus")) {
      const stock = parseInt(target.dataset.stock);
      if (currentQuantity < stock)
        await updateCartItemQuantity(cartId, currentQuantity + 1);
      else alert(`Stok hanya tersisa ${stock} item.`);
    } else if (target.classList.contains("btn-minus")) {
      if (currentQuantity > 1)
        await updateCartItemQuantity(cartId, currentQuantity - 1);
      else await deleteCartItem(cartId);
    }
  }
});

// Event listener untuk tombol checkout (FINAL)
checkoutButton.addEventListener("click", async (e) => {
  e.preventDefault();
  const rentDays = parseInt(rentDaysInput.value) || 1;
  if (rentDays <= 0) {
    alert("Jumlah hari sewa harus minimal 1 hari.");
    return;
  }
  checkoutButton.disabled = true;
  checkoutButton.textContent = "Memproses...";
  try {
    const response = await fetch("http://localhost:3000/api/process-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: currentUser.name,
        customerEmail: currentUser.email,
        userId: currentUser.id,
        rentDays,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    window.snap.pay(result.token, {
      onSuccess: function (result) {
        alert("Pembayaran berhasil!");
        fetchCartItems();
        fetchProducts();
      },
      onPending: function (result) {
        alert("Menunggu pembayaran Anda.");
        fetchCartItems();
      },
      onError: function (result) {
        alert("Pembayaran gagal!");
        console.error("Payment Error:", result);
      },
      onClose: function () {
        alert("Anda menutup jendela pembayaran.");
      },
    });
  } catch (error) {
    console.error("Error saat checkout:", error);
    alert(`Terjadi kesalahan: ${error.message}`);
  } finally {
    checkoutButton.disabled = false;
    checkoutButton.textContent = "Checkout";
  }
});
