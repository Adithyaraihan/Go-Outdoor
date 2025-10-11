document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fullname = document.getElementById("fullname").value;
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      if (password.length < 8) {
        Swal.fire("Password harus terdiri dari 8 karakter");
        return;
      }
      try {
        const response = await fetch("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullname, email, password }),
        });
        const data = await response.json();
        Swal.fire(data.message);
        if (response.ok) {
          window.location.href = `verify.html?email=${encodeURIComponent(
            email
          )}`;
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Cannot connect to the server.",
        });
      }
    });
  }
});
