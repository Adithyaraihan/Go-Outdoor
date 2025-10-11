const { default: Swal } = require("sweetalert2");

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reset-form");
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    Swal.fire("Invalid or missing reset token.");
    form.style.display = "none";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById("new-password").value;

    if (newPassword.length < 8) {
      Swal.fire("Password baru harus terdiri dari minimal 8 karakter!");

      return;
    }

    try {
      const response = await fetch("auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await response.json();
      Swal.fire(data.message);
      if (response.ok) {
        window.location.href = "/login.html";
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "An error occurred. Please try again.!",
      });
    }
  });
});
