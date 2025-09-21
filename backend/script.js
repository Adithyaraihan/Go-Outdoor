// Navigasi
const navbarNav = document.querySelector(".navbar-nav");
const hamburger = document.querySelector("#hamburger-menu");

// Keranjang
const cart = document.querySelector(".shoping-cart");
const shoppingCartBtn = document.querySelector("#shoping-cart"); // Ikon keranjang di navbar
const closeCartBtn = document.querySelector(".close-cart-btn");
const produkContainer = document.querySelector(".produk-container");
const checkoutBtn = document.getElementById("checkout-button");
const cartItemsContainer = document.querySelector(".cart-items-container");

// Overlay
const overlay = document.createElement("div");
overlay.classList.add("overlay");
document.body.appendChild(overlay);

// Fungsi untuk mengaktifkan/menonaktifkan overlay
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

// Event listener untuk membuka/menutup menu hamburger
hamburger.addEventListener("click", (e) => {
  e.preventDefault();
  if (cart.classList.contains("active")) {
    cart.classList.remove("active");
  }
  navbarNav.classList.toggle("active");
  toggleOverlay();
});

// Event listener untuk membuka/menutup keranjang
shoppingCartBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (navbarNav.classList.contains("active")) {
    navbarNav.classList.remove("active");
  }
  cart.classList.toggle("active");
  if (cart.classList.contains("active")) {
    fetchCartItems();
  }
  toggleOverlay();
});

// Event listener untuk tombol 'x' di header keranjang
closeCartBtn.addEventListener("click", () => {
  cart.classList.remove("active");
  toggleOverlay();
});

// Event listener untuk menutup pop-up ketika mengklik di luar area pop-up
overlay.addEventListener("click", () => {
  cart.classList.remove("active");
  navbarNav.classList.remove("active");
  toggleOverlay();
});

// Event listener untuk menambahkan produk ke keranjang dari halaman utama
produkContainer.addEventListener("click", async (e) => {
  const targetAdd = e.target.closest(".btn-cart");
  if (targetAdd) {
    const productId = targetAdd.dataset.id;
    const card = targetAdd.closest(".card");
    const quantityInput = card.querySelector(".qty");
    const quantity = parseInt(quantityInput.value);
    const stock = parseInt(targetAdd.dataset.stock);

    if (quantity > 0 && quantity <= stock) {
      try {
        const response = await fetch("http://localhost:3000/api/cart/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ productId, quantity }),
        });
        const result = await response.json();

        if (response.ok) {
          alert(result.message);
          fetchCartItems();
        } else {
          alert(result.error);
        }
      } catch (error) {
        console.error("Terjadi kesalahan:", error);
      }
    } else {
      alert("Kuantitas tidak valid atau melebihi stok yang tersedia.");
    }
  }
});

// Event listener untuk tombol kuantitas di halaman utama
produkContainer.addEventListener("click", (e) => {
  const targetPlus = e.target.closest(".btn-plus-main");
  const targetMinus = e.target.closest(".btn-minus-main");

  if (targetPlus) {
    const input = targetPlus
      .closest(".quantity-control-main")
      .querySelector(".qty");
    const stock = parseInt(input.getAttribute("max"));
    if (parseInt(input.value) < stock) {
      input.value = parseInt(input.value) + 1;
    }
  }

  if (targetMinus) {
    const input = targetMinus
      .closest(".quantity-control-main")
      .querySelector(".qty");
    if (parseInt(input.value) > 1) {
      input.value = parseInt(input.value) - 1;
    }
  }
});

// Delegasi event pada container keranjang untuk update dan delete
cart.addEventListener("click", async (e) => {
  const targetPlus = e.target.closest(".btn-plus");
  const targetMinus = e.target.closest(".btn-minus");
  const targetRemove = e.target.closest(".btn-remove");

  if (targetRemove) {
    const cartId = targetRemove.dataset.id;
    await deleteCartItem(cartId);
  }

  if (targetPlus) {
    const cartId = targetPlus.dataset.id;
    const input = targetPlus
      .closest(".quantity-control")
      .querySelector(".item-quantity");
    const currentQuantity = parseInt(input.value);
    const stock = parseInt(targetPlus.dataset.stock);

    if (currentQuantity < stock) {
      await updateCartItemQuantity(cartId, currentQuantity + 1);
    } else {
      alert(`Maaf, stok ${stock} item untuk produk ini tidak mencukupi.`);
    }
  }

  if (targetMinus) {
    const cartId = targetMinus.dataset.id;
    const input = targetMinus
      .closest(".quantity-control")
      .querySelector(".item-quantity");
    const currentQuantity = parseInt(input.value);

    if (currentQuantity > 1) {
      await updateCartItemQuantity(cartId, currentQuantity - 1);
    } else {
      await deleteCartItem(cartId);
    }
  }
});

// Event listener untuk tombol checkout
if (checkoutBtn) {
  checkoutBtn.addEventListener("click", async () => {
    try {
      const response = await fetch("http://localhost:3000/api/checkout", {
        method: "POST",
      });
      const result = await response.json();

      if (response.ok) {
        alert(result.message);
        fetchCartItems();
        fetchProducts();
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error("Terjadi kesalahan saat checkout:", error);
    }
  });
}

// Event listener untuk tombol kuantitas di halaman produk
produkContainer.addEventListener("click", (e) => {
  const target = e.target;
  const quantityInput = target
    .closest(".quantity-control")
    ?.querySelector(".qty");

  if (!quantityInput) return;

  let currentQuantity = parseInt(quantityInput.value);
  const maxStock = parseInt(quantityInput.max);

  if (target.classList.contains("btn-plus")) {
    if (currentQuantity < maxStock) {
      currentQuantity++;
    }
  } else if (target.classList.contains("btn-minus")) {
    if (currentQuantity > 1) {
      currentQuantity--;
    }
  }

  // Format angka dengan nol di depan jika kurang dari 10
  quantityInput.value = currentQuantity.toString().padStart(2, "0");
});

// Fungsi untuk memuat item di keranjang
async function fetchCartItems() {
  try {
    const response = await fetch("http://localhost:3000/api/cart");
    const cartItems = await response.json();
    const totalPriceElement = document.getElementById("total-price");
    let totalPrice = 0;

    cartItemsContainer.innerHTML = "";

    if (cartItems.length === 0) {
      cartItemsContainer.innerHTML =
        '<div class="cart-item-placeholder">Keranjang kosong.</div>';
      totalPriceElement.textContent = `Rp 0`;
      return;
    }

    cartItems.forEach((item) => {
      const itemPrice = parseFloat(item.price);
      const itemTotal = itemPrice * item.quantity;
      totalPrice += itemTotal;

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

    totalPriceElement.textContent = `Rp ${totalPrice.toLocaleString("id-ID")}`;
    feather.replace();
  } catch (error) {
    console.error("Gagal mengambil item keranjang:", error);
  }
}

// Fungsi untuk menghapus item dari keranjang
async function deleteCartItem(cartId) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/cart/delete/${cartId}`,
      {
        method: "DELETE",
      }
    );
    const result = await response.json();

    if (response.ok) {
      alert(result.message);
      fetchCartItems();
    } else {
      alert(result.error);
    }
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
  }
}

// Fungsi baru untuk memperbarui kuantitas item
async function updateCartItemQuantity(cartId, newQuantity) {
  try {
    const response = await fetch("http://localhost:3000/api/cart/update", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cartId, newQuantity }),
    });
    const result = await response.json();

    if (response.ok) {
      fetchCartItems();
    } else {
      alert(result.error);
    }
  } catch (error) {
    console.error("Gagal memperbarui kuantitas:", error);
  }
}

// Fungsi untuk mengambil dan menampilkan produk
// Fungsi untuk mengambil dan menampilkan produk
async function fetchProducts() {
  try {
    const response = await fetch("http://localhost:3000/api/products");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
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

// Panggil fungsi saat halaman dimuat
document.addEventListener("DOMContentLoaded", fetchProducts);
