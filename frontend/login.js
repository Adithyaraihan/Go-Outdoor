document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const identifier = document.getElementById("identifier").value;
      const password = document.getElementById("password").value;

      try {
        const response = await fetch(
          "https://go-outdoor-production.up.railway.app/auth/login",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password }),
            credentials: "include",
          }
        );

        const data = await response.json();

        if (response.ok) {
          Swal.fire("login berhasil!").then(() => {
            window.location.href = "/index.html";
          });
        } else {
          Swal.fire({
            icon: "error",
            title: "Gagal Login",
            text: data.message,
          });
        }
      } catch (error) {
        console.error("Fetch error:", error);
        Swal.fire({
          icon: "error",
          title: "Koneksi Gagal",
          text: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
        });
      }
    });
  }
});
