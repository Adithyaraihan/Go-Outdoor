document.addEventListener("DOMContentLoaded", () => {
  const verifyForm = document.getElementById("verify-form");
  const emailInput = document.getElementById("email");

  const params = new URLSearchParams(window.location.search);
  const emailFromUrl = params.get("email");
  if (emailFromUrl) {
    emailInput.value = decodeURIComponent(emailFromUrl);
  }

  verifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value;
    const code = document.getElementById("code").value;

    try {
      const response = await fetch(
        "https://go-outdoor-production.up.railway.app/auth/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        }
      );
      const data = await response.json();
      Swal.fire(data.message);

      if (response.ok) {
        window.location.href = "login.html";
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Cannot connect to the server.",
      });
    }
  });
});
