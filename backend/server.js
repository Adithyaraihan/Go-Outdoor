require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const midtransClient = require("midtrans-client");
const createAuthRoutes = require("./authRoutes");
const MySQLStore = require("express-mysql-session")(session);

const app = express();
const port = process.env.PORT || 8080;

const allowedOrigins = [
  "http://localhost:3000",
  "https://gooutdoor-frontend.vercel.app",
];

// MMIDDLEWARE
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../frontend")));

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.use(
  session({
    secret: process.env.SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

let snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      const email = profile.emails[0].value;
      const fullname = profile.displayName;
      const googleId = profile.id;
      try {
        const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
          email,
        ]);
        if (users.length > 0) {
          const user = users[0];
          if (!user.google_id) {
            await db.query(
              "UPDATE users SET google_id = ?, is_verified = TRUE WHERE email = ?",
              [googleId, email]
            );
          }
          return done(null, user);
        } else {
          const newUser = {
            fullname,
            email,
            google_id: googleId,
            is_verified: true,
          };
          const [result] = await db.query("INSERT INTO users SET ?", newUser);
          newUser.id = result.insertId;
          return done(null, newUser);
        }
      } catch (err) {
        return done(err);
      }
    }
  )
);

// login lokal
passport.use(
  new LocalStrategy(
    { usernameField: "identifier" },
    async (identifier, password, done) => {
      try {
        const [users] = await db.query(
          "SELECT * FROM users WHERE email = ? OR fullname = ?",
          [identifier, identifier]
        );
        if (users.length === 0) {
          return done(null, false, {
            message: "Username atau email tidak ditemukan.",
          });
        }
        const user = users[0];
        if (!user.password && user.google_id) {
          return done(null, false, {
            message:
              "Akun ini terdaftar via Google. Silakan login dengan Google.",
          });
        }
        if (!user.is_verified) {
          return done(null, false, {
            message: "Akun Anda belum diverifikasi. Silakan cek email.",
          });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Password salah." });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    done(null, users.length > 0 ? users[0] : false);
  } catch (err) {
    done(err, null);
  }
});

// Middleware untuk melindungi path yang memerlukan login
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res
    .status(401)
    .json({ error: "Akses ditolak. Anda harus login terlebih dahulu." });
};

const authRoutes = createAuthRoutes(db, passport);
app.use("/auth", authRoutes);

// === ENDPOINT PRODUK ===
app.get("/api/products", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM products");
    res.json(results);
  } catch (err) {
    console.error("Error saat mengambil produk:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat mengambil produk." });
  }
});

// === ENDPOINT KERANJANG===
app.get("/api/cart", ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const sql = `
        SELECT ci.id AS cartId, ci.quantity, p.name, p.price, p.image, p.stock
        FROM cart_items ci JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?`;
  try {
    const [results] = await db.query(sql, [userId]);
    res.json(results);
  } catch (err) {
    console.error("Error saat mengambil item keranjang:", err);
    res
      .status(500)
      .json({ error: "Terjadi kesalahan saat mengambil item keranjang." });
  }
});

// === ENDPOINT MENAMBAHKAN ITEM  KE KERANJANG ===
app.post("/api/cart/add", ensureAuthenticated, async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user.id;
  try {
    const [results] = await db.query(
      "SELECT * FROM cart_items WHERE product_id = ? AND user_id = ?",
      [productId, userId]
    );
    if (results.length > 0) {
      await db.query(
        "UPDATE cart_items SET quantity = quantity + ? WHERE product_id = ? AND user_id = ?",
        [quantity, productId, userId]
      );
      res
        .status(200)
        .json({ message: "Kuantitas produk berhasil diperbarui." });
    } else {
      await db.query(
        "INSERT INTO cart_items (product_id, quantity, user_id) VALUES (?, ?, ?)",
        [productId, quantity, userId]
      );
      res
        .status(201)
        .json({ message: "Produk berhasil ditambahkan ke keranjang." });
    }
  } catch (err) {
    console.error("Error saat menambahkan produk:", err);
    res
      .status(500)
      .json({ error: "Terjadi kesalahan saat menambahkan produk." });
  }
});

// === ENDPOINT UPDATE KERANJANG===
app.put("/api/cart/update", ensureAuthenticated, async (req, res) => {
  const { cartId, newQuantity } = req.body;
  const userId = req.user.id;
  try {
    if (newQuantity <= 0) {
      await db.query("DELETE FROM cart_items WHERE id = ? AND user_id = ?", [
        cartId,
        userId,
      ]);
      res
        .status(200)
        .json({ message: "Item berhasil dihapus dari keranjang." });
    } else {
      await db.query(
        "UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?",
        [newQuantity, cartId, userId]
      );
      res.status(200).json({ message: "Kuantitas berhasil diperbarui." });
    }
  } catch (err) {
    console.error("Error saat memperbarui kuantitas:", err);
    res.status(500).json({ error: "Gagal memperbarui kuantitas item." });
  }
});

// === ENDPOINTS PESANAN (UNTUK MENGIRIM KE MIDTRANS) ===
app.post("/api/process-order", ensureAuthenticated, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.id;
    const { customerName, customerEmail, rentDays } = req.body;

    const [cartItems] = await connection.query(
      `SELECT p.id, p.name, p.price, ci.quantity 
       FROM cart_items ci 
       JOIN products p ON ci.product_id = p.id 
       WHERE ci.user_id = ?`,
      [userId]
    );

    if (cartItems.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Keranjang Anda kosong." });
    }

    let totalAmount = 0;
    cartItems.forEach((item) => {
      totalAmount += item.price * item.quantity;
    });

    const orderId = "GO-RENTAL-" + Date.now();
    const [orderResult] = await connection.query(
      "INSERT INTO orders (user_id, order_id, total_amount, status, customer_name, customer_email, rent_days) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        userId,
        orderId,
        totalAmount,
        "pending",
        customerName,
        customerEmail,
        rentDays,
      ]
    );
    const newOrderId = orderResult.insertId;

    const orderItemsQueries = cartItems.map((item) =>
      connection.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price_per_item) VALUES (?, ?, ?, ?)",
        [newOrderId, item.id, item.quantity, item.price] // Gunakan harga asli per hari
      )
    );
    await Promise.all(orderItemsQueries);

    const grossAmount = totalAmount * rentDays;
    const itemDetails = cartItems.map((item) => {
      return {
        id: item.id,
        price: item.price * rentDays,
        quantity: item.quantity,
        name: `${item.name.substring(0, 40)} (${rentDays} hari)`,
      };
    });

    let parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      customer_details: {
        first_name: customerName,
        email: customerEmail,
      },
      item_details: itemDetails,
    };

    const transaction = await snap.createTransaction(parameter);

    await connection.query("DELETE FROM cart_items WHERE user_id = ?", [
      userId,
    ]);

    await connection.commit();

    res.json({ token: transaction.token, orderId: orderId });
  } catch (error) {
    await connection.rollback();
    console.error("Error saat proses order:", error);
    res.status(500).json({ error: "Gagal memproses pesanan." });
  } finally {
    connection.release();
  }
});

// === ENDPOINT DAFTAR PESANAN ===
app.get("/api/orders", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const [orders] = await db.query(
      `SELECT id, order_id, total_amount, status, created_at, rent_days 
       FROM orders 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );

    const detailedOrders = await Promise.all(
      orders.map(async (order) => {
        const [items] = await db.query(
          `SELECT p.name, oi.quantity, oi.price_per_item 
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
          [order.id]
        );
        return { ...order, items };
      })
    );

    res.status(200).json(detailedOrders);
  } catch (error) {
    console.error("Error saat mengambil daftar pesanan:", error);
    res.status(500).json({ error: "Gagal mengambil daftar pesanan." });
  }
});

// === ENDPOINT WEBHOOK MIDTRANS ===
app.post("/api/midtrans-notification", async (req, res) => {
  try {
    const statusResponse = await snap.transaction.notification(req.body);
    let orderId = statusResponse.order_id;
    let transactionStatus = statusResponse.transaction_status;
    let fraudStatus = statusResponse.fraud_status;

    console.log(
      `Notifikasi untuk Order ID ${orderId}: Transaction status: ${transactionStatus}, Fraud status: ${fraudStatus}`
    );

    if (transactionStatus == "settlement" || transactionStatus == "capture") {
      if (fraudStatus == "accept") {
        const midtransTransactionId = statusResponse.transaction_id;
        await db.query(
          "UPDATE orders SET status = ?, midtrans_transaction_id = ? WHERE order_id = ?",
          ["paid", midtransTransactionId, orderId]
        );
        console.log(`Pembayaran untuk order ${orderId} berhasil.`);
      }
    } else if (
      transactionStatus == "deny" ||
      transactionStatus == "expire" ||
      transactionStatus == "cancel"
    ) {
      await db.query("UPDATE orders SET status = ? WHERE order_id = ?", [
        "failed",
        orderId,
      ]);
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error saat menangani notifikasi Midtrans:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.redirect("../index.html");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server GoOutdoor berjalan di port ${port}`);
});
