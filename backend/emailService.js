const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (email, code) => {
  const mailOptions = {
    from: `"Go Outdoor" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Kode Verifikasi Akun",
    html: `<h1>Selamat Datang di Go Outdor!</h1><p>Gunakan kode berikut untuk memverifikasi akun Anda:</p><h2>${code}</h2><p>Kode ini akan kedaluwarsa dalam 15 menit.</p>`,
  };
  await transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = async (email, token) => {
  const resetLink = `https://pat-uncivilizable-graham.ngrok-free.dev/reset-password.html?token=${token}`;
  const mailOptions = {
    from: `"Go Outdoor" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Permintaan Reset Password",
    html: `<h1>Anda Meminta Reset Password</h1><p>Klik link di bawah untuk mengatur ulang password. Link ini hanya berlaku selama 1 jam.</p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Reset Password</a><p>Jika Anda tidak meminta ini, abaikan email ini.</p>`,
  };
  await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
