const express = require("express");
const mysql = require("mysql2/promise"); // Menggunakan versi promise
const cors = require("cors");
const midtransClient = require("midtrans-client");
require("dotenv").config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

let snap = new midtransClient.Snap({
  isProduction: process.env.NODE_ENV === "production",
  serverKey: process.env.MIDTRANS_SERVER_KEY, // Ganti dengan Server Key Anda
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "go_outdoor_rental",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.use(express.static("../"));

// 1. Endpoint untuk mendapatkan semua produk
app.get("/api/products", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM products");
    res.json(results);
  } catch (err) {
    console.error("Error saat mengambil produk:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat mengambil produk." });
  }
});

// 2. Endpoint untuk menambahkan produk ke keranjang
app.post("/api/cart/add", async (req, res) => {
  const { productId, quantity } = req.body;

  if (quantity <= 0) {
    return res.status(400).json({ error: "Kuantitas harus lebih dari 0." });
  }

  try {
    const [results] = await db.query(
      "SELECT * FROM cart_items WHERE product_id = ?",
      [productId]
    );
    if (results.length > 0) {
      await db.query(
        "UPDATE cart_items SET quantity = quantity + ? WHERE product_id = ?",
        [quantity, productId]
      );
      res
        .status(200)
        .json({ message: "Kuantitas produk berhasil diperbarui." });
    } else {
      await db.query(
        "INSERT INTO cart_items (product_id, quantity) VALUES (?, ?)",
        [productId, quantity]
      );
      res
        .status(201)
        .json({ message: "Produk berhasil ditambahkan ke keranjang." });
    }
  } catch (err) {
    console.error("Error saat menambahkan produk:", err);
    res.status(500).json({
      error: "Terjadi kesalahan saat menambahkan produk ke keranjang.",
    });
  }
});

// 3. Endpoint untuk memperbarui kuantitas item di keranjang
app.put("/api/cart/update", async (req, res) => {
  const { cartId, newQuantity } = req.body;

  try {
    if (newQuantity <= 0) {
      await db.query("DELETE FROM cart_items WHERE id = ?", [cartId]);
      res
        .status(200)
        .json({ message: "Item berhasil dihapus dari keranjang." });
    } else {
      await db.query("UPDATE cart_items SET quantity = ? WHERE id = ?", [
        newQuantity,
        cartId,
      ]);
      res.status(200).json({ message: "Kuantitas berhasil diperbarui." });
    }
  } catch (err) {
    console.error("Error saat memperbarui kuantitas:", err);
    res.status(500).json({ error: "Gagal memperbarui kuantitas item." });
  }
});

// 4. Endpoint untuk menghapus item dari keranjang
app.delete("/api/cart/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM cart_items WHERE id = ?", [id]);
    res.status(200).json({ message: "Item berhasil dihapus dari keranjang." });
  } catch (err) {
    console.error("Error saat menghapus item:", err);
    res.status(500).json({ error: "Gagal menghapus item dari keranjang." });
  }
});

// 5. Endpoint untuk mendapatkan semua item di keranjang
app.get("/api/cart", async (req, res) => {
  const sql = `
        SELECT
            ci.id AS cartId,
            ci.quantity,
            p.name,
            p.price,
            p.image,
            p.stock
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
    `;
  try {
    const [results] = await db.query(sql);
    res.json(results);
  } catch (err) {
    console.error("Error saat mengambil item keranjang:", err);
    res
      .status(500)
      .json({ error: "Terjadi kesalahan saat mengambil item keranjang." });
  }
});

// 6. Endpoint untuk proses order
app.post("/api/process-order", async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Ambil item dari keranjang & hitung total di backend
    const [cartItems] = await connection.query(`
            SELECT p.id, p.name, p.price, ci.quantity 
            FROM cart_items ci JOIN products p ON ci.product_id = p.id
        `);

    if (cartItems.length === 0) {
      return res.status(400).json({ error: "Keranjang kosong." });
    }

    let totalAmount = 0;
    cartItems.forEach((item) => {
      totalAmount += item.price * item.quantity;
    });

    // 2. Buat Order ID unik di backend
    const orderId = "GO-RENTAL-" + Date.now();
    const { customerName, customerEmail, userId } = req.body;

    // 3. Simpan pesanan ke tabel `orders` dengan status 'pending'
    const [orderResult] = await connection.query(
      // Tambahkan user_id di sini
      "INSERT INTO orders (user_id, order_id, total_amount, status, customer_name, customer_email) VALUES (?, ?, ?, ?, ?, ?)",
      // Tambahkan userId ke dalam array values
      [userId, orderId, totalAmount, "pending", customerName, customerEmail]
    );
    const newOrderId = orderResult.insertId;

    // 4. Buat parameter untuk Midtrans
    let parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: totalAmount,
      },
      customer_details: {
        first_name: customerName,
        email: customerEmail,
      },
    };

    // 5. Buat transaksi Midtrans
    const transaction = await snap.createTransaction(parameter);
    let transactionToken = transaction.token;

    await connection.commit();
    res.json({ token: transactionToken, orderId: orderId });
  } catch (error) {
    await connection.rollback();
    console.error("Error saat proses order:", error);
    res.status(500).json({ error: "Gagal memproses pesanan." });
  } finally {
    connection.release();
  }
});

// APi webhook
app.post("/api/midtrans-notification", async (req, res) => {
  try {
    // Gunakan fungsi notifikasi dari library midtrans-client untuk verifikasi
    const statusResponse = await snap.transaction.notification(req.body);
    let orderId = statusResponse.order_id;
    let transactionStatus = statusResponse.transaction_status;
    let fraudStatus = statusResponse.fraud_status;

    console.log(
      `Notifikasi untuk Order ID ${orderId}: Transaction status: ${transactionStatus}, Fraud status: ${fraudStatus}`
    );

    // Logic untuk update database
    if (transactionStatus == "settlement" || transactionStatus == "capture") {
      if (fraudStatus == "accept") {
        // Pembayaran berhasil.
        // TODO 1: Update status di tabel `orders` menjadi 'paid'.
        // TODO 2: Ambil item dari pesanan (perlu tabel order_items).
        // TODO 3: Kurangi stok produk di tabel `products`.
        // TODO 4: Kosongkan keranjang belanja pengguna.
        await db.query("UPDATE orders SET status = ? WHERE order_id = ?", [
          "paid",
          orderId,
        ]);
        console.log(`Pembayaran untuk order ${orderId} berhasil.`);
      }
    } else if (transactionStatus == "pending") {
      // Pembayaran masih pending (misal: transfer bank belum dibayar).
      // Anda bisa mengabaikan atau mencatat log.
    } else if (
      transactionStatus == "deny" ||
      transactionStatus == "expire" ||
      transactionStatus == "cancel"
    ) {
      // Pembayaran gagal.
      // TODO: Update status di tabel `orders` menjadi 'failed' atau 'expired'.
      await db.query("UPDATE orders SET status = ? WHERE order_id = ?", [
        "failed",
        orderId,
      ]);
    }

    // Beri respons 200 OK agar Midtrans tidak mengirim notifikasi berulang kali
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error saat menangani notifikasi Midtrans:", error);
    res.status(500).json({ error: error.message });
  }
});

// Jalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
