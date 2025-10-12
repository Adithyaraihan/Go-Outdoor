document.getElementById("forgot-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;

  try {
    const response = await fetch("https://go-outdoor-production.up.railway.app/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    // alert(data.message);
    Swal.fire(data.message);
    if (response.ok) {
      document.getElementById("forgot-form").reset();
    }
  } catch (error) {
    footer;

    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "An error occurred. Please try again.",
    });
  }
});
