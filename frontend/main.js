const navbarNav = document.querySelector(".navbar-nav");
const hamburger = document.querySelector("#hamburger-menu");
const cart = document.querySelector(".shoping-cart");
const shoppingCartBtn = document.querySelector("#shoping-cart");

document.querySelector("#hamburger-menu").onclick = (e) => {
  navbarNav.classList.toggle("active");
  e.stopPropagation();
};

document.addEventListener("click", function (e) {
  const isClickInsideNavbar = navbarNav.contains(e.target) || hamburger.contains(e.target);
  const isClickInsideCart = cart.contains(e.target) || shoppingCartBtn.contains(e.target);

  if (!isClickInsideNavbar && navbarNav.classList.contains("active")) {
    navbarNav.classList.remove("active");
  }
});
