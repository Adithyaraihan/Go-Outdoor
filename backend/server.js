// Import paket yang diperlukan
const express = require("express");
const mysql = require("mysql2/promise"); // Menggunakan versi promise
const cors = require("cors");
require("dotenv").config();

// Inisialisasi aplikasi Express
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Untuk parsing data JSON dari body request

// Konfigurasi koneksi database
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "go_outdoor_rental",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Serving file statis
app.use(express.static("../")); // Menjadikan folder root 'Web Rental Outdoor' sebagai folder statis

// ------------------------------------
//          API ENDPOINTS
// ------------------------------------

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
    res
      .status(500)
      .json({
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

// 6. Endpoint untuk proses checkout
app.post("/api/checkout", async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [cartItems] = await connection.query(
      "SELECT product_id, quantity FROM cart_items"
    );

    if (cartItems.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Keranjang belanja kosong." });
    }

    for (const item of cartItems) {
      const [product] = await connection.query(
        "SELECT name, stock FROM products WHERE id = ?",
        [item.product_id]
      );

      if (product.length === 0 || product[0].stock < item.quantity) {
        await connection.rollback();
        const productName =
          product.length > 0 ? product[0].name : "tidak dikenal";
        return res
          .status(400)
          .json({
            error: `Stok untuk produk '${productName}' tidak mencukupi.`,
          });
      }

      await connection.query(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
        [item.quantity, item.product_id]
      );
    }

    await connection.query("DELETE FROM cart_items");
    await connection.commit();
    res
      .status(200)
      .json({
        message: "Checkout berhasil! Keranjang belanja Anda telah dikosongkan.",
      });
  } catch (error) {
    await connection.rollback();
    console.error("Terjadi kesalahan saat checkout:", error);
    res
      .status(500)
      .json({ error: "Terjadi kesalahan saat memproses checkout." });
  } finally {
    connection.release();
  }
});

// Jalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
