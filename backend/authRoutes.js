const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("./emailService");

module.exports = function (db, passport) {
  const router = express.Router();

  router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/login.html" }),
    (req, res) => {
      res.redirect("/index.html");
    }
  );

  router.post("/register", async (req, res) => {
    const { fullname, email, password } = req.body;
    if (!fullname || !email || !password) {
      return res.status(400).json({ message: "Semua kolom wajib diisi." });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationCode = Math.floor(
        100000 + Math.random() * 900000
      ).toString();
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

      await db.query(
        "INSERT INTO users (fullname, email, password, verification_code, code_expires_at) VALUES (?, ?, ?, ?, ?)",
        [fullname, email, hashedPassword, verificationCode, expirationTime]
      );

      await sendVerificationEmail(email, verificationCode);
      res.status(201).json({
        message: "Registrasi berhasil! Silakan cek email untuk verifikasi.",
      });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Email sudah terdaftar." });
      }
      console.error("Error saat registrasi:", err);
      return res
        .status(500)
        .json({ message: "Terjadi kesalahan pada server." });
    }
  });

  router.post("/verify", async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
      return res
        .status(400)
        .json({ message: "Email dan kode verifikasi wajib diisi." });
    }

    try {
      const [users] = await db.query(
        "SELECT * FROM users WHERE email = ? AND verification_code = ?",
        [email, code]
      );

      if (users.length === 0) {
        return res
          .status(400)
          .json({ message: "Kode verifikasi atau email salah." });
      }

      const user = users[0];
      if (new Date() > new Date(user.code_expires_at)) {
        return res
          .status(400)
          .json({ message: "Kode verifikasi telah kedaluwarsa." });
      }

      await db.query(
        "UPDATE users SET is_verified = TRUE, verification_code = NULL, code_expires_at = NULL WHERE id = ?",
        [user.id]
      );

      res.status(200).json({
        message: "Akun berhasil diverifikasi! Anda sekarang bisa login.",
      });
    } catch (err) {
      console.error("Error saat verifikasi:", err);
      res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
  });

  router.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        return next(err); 
      }
      if (!user) {
        return res.status(401).json({ message: info.message });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        return res
          .status(200)
          .json({ message: `Selamat datang kembali, ${user.fullname}!` });
      });
    })(req, res, next);
  });

  router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email wajib diisi." });
    }

    try {
      const token = crypto.randomBytes(20).toString("hex");
      const expirationTime = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

      const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
        email,
      ]);

      if (users.length > 0) {
        const user = users[0];
        await db.query(
          "UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?",
          [token, expirationTime, user.id]
        );
        await sendPasswordResetEmail(user.email, token);
      }

      res.status(200).json({
        message:
          "Jika email Anda terdaftar, link untuk reset password telah dikirim.",
      });
    } catch (err) {
      console.error("Error saat lupa password:", err);
      res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
  });

  router.post("/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token dan password baru wajib diisi." });
    }

    try {
      const [users] = await db.query(
        "SELECT * FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()",
        [token]
      );

      if (users.length === 0) {
        return res.status(400).json({
          message: "Token reset password tidak valid atau telah kedaluwarsa.",
        });
      }

      const user = users[0];
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db.query(
        "UPDATE users SET password = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?",
        [hashedPassword, user.id]
      );

      res
        .status(200)
        .json({ message: "Password berhasil direset. Silakan login kembali." });
    } catch (err) {
      console.error("Error saat reset password:", err);
      res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
  });

  router.post("/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          return res.status(500).json({ message: "Gagal menghancurkan sesi." });
        }
        res.status(200).json({ message: "Anda berhasil logout." });
      });
    });
  });

  const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res
      .status(401)
      .json({ message: "Akses ditolak. Silakan login terlebih dahulu." });
  };

  router.get("/profile", ensureAuthenticated, (req, res) => {
    const { password, ...userProfile } = req.user;
    res.status(200).json(userProfile);
  });

  return router;
};
