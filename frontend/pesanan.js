document.addEventListener("DOMContentLoaded", () => {
  const orderListContainer = document.getElementById("order-list-container");

  async function fetchAndDisplayOrders() {
    try {
      const response = await fetch("https://go-outdoor-production.up.railway.app/api/orders");

      if (response.status === 401) {
        orderListContainer.innerHTML = `
          <div class="order-empty-state">
            <p>Anda harus <a href="/login.html">login</a> terlebih dahulu untuk melihat daftar pesanan.</p>
          </div>
        `;
        return;
      }

      if (!response.ok) {
        throw new Error("Gagal mengambil data pesanan.");
      }

      const orders = await response.json();

      orderListContainer.innerHTML = "";

      if (orders.length === 0) {
        orderListContainer.innerHTML = `
          <div class="order-empty-state">
            <p>Anda belum memiliki pesanan.</p>
            <p><a href="index.html">Mulai berbelanja</a> untuk membuat pesanan pertama Anda!</p>
          </div>
        `;
        return;
      }

      orders.forEach((order) => {
        const orderCard = document.createElement("div");
        orderCard.className = "order-card";

        const orderDate = new Date(order.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        const totalAmount = parseFloat(order.total_amount) * order.rent_days;

        const itemsListHTML = order.items
          .map((item) => `<li>${item.quantity}x ${item.name}</li>`)
          .join("");

        orderCard.innerHTML = `
          <div class="order-details">
            <h3>Order #${order.order_id}</h3>
            <ul class="order-items-list">
              ${itemsListHTML}
            </ul>
            <p class="order-meta">
              <strong>Tanggal Pesan:</strong> ${orderDate}<br>
              <strong>Durasi Sewa:</strong> ${order.rent_days} hari
            </p>
          </div>
          <div class="order-summary">
            <div class="order-total">Rp ${totalAmount.toLocaleString("id-ID")}</div>
            <div>
              <span class="order-status status ${order.status}">${order.status}</span>
            </div>
          </div>
        `;

        orderListContainer.appendChild(orderCard);
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      orderListContainer.innerHTML = `
        <div class="order-empty-state">
          <p>Terjadi kesalahan saat memuat pesanan Anda.</p>
          <p>Silakan refresh halaman atau coba lagi nanti.</p>
        </div>
      `;
    }
  }

  fetchAndDisplayOrders();
});