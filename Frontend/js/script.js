function homePage() {
  window.location.href = "home.html";
}

function loginPage() {
  window.location.href = "login.html";
}

function signupPage() {
  window.location.href = "signup.html";
}

function dashboardPage() {
  window.location.href = "dashboard.html";
}

function productsPage() {
  window.location.href = "product.html";
}

function suppliersPage() {
  window.location.href = "supplier-list.html";
}

function reportsPage() {
  window.location.href = "reports.html";
}

function settingsPage() {
  window.location.href = "setting.html";
}

function accessDeniedPage() {
  window.location.href = "access.html";
}

function logoutPage() {
  window.location.href = "login.html";
}

// --------------------
// PRODUCT
// --------------------

function addProductPage() {
  window.location.href = "add-product.html";
}

function viewProductPage(product) {
  localStorage.setItem("selectedProduct", product);
  window.location.href = "view-product.html";
}

function editProductPage() {
  window.location.href = "edit-product.html";
}

function deleteProductPage() {
  const confirmed = confirm("Are you sure you want to delete this product?");

  if (confirmed) {
    window.location.href = "product.html";
  }
}

// --------------------
// SUPPLIER
// --------------------

function addSupplierPage() {
  window.location.href = "add-supplier.html";
}

function viewSupplierPage(supplier) {
  localStorage.setItem("selectedSupplier", supplier);
  window.location.href = "view-supplier.html";
}

function editSupplierPage(supplier) {
  localStorage.setItem("selectedSupplier", supplier);
  window.location.href = "edit-supplier.html";
}

function deleteSupplierPage() {
  const confirmed = confirm("Are you sure you want to delete this supplier?");

  if (confirmed) {
    window.location.href = "supplier-list.html";
  }
}

// --------------------
// REPORTS
// --------------------

function printReport() {
  window.print();
}

function exportPDF() {
  alert("Exporting report as PDF...");
}

// --------------------
// SETTINGS
// --------------------

function saveSettings() {
  alert("Settings saved successfully.");
}

// --------------------
// HOME
// --------------------

function scrollToFeatures() {
  const el = document.querySelector(".features");

  if (el) {
    el.scrollIntoView({
      behavior: "smooth",
    });
  }
}

// ==========================
// SIGNUP API
// ==========================

async function signup() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = await response.json();

    alert(data.message);

    if (data.success) {
      window.location.href = "login.html";
    }
  } catch (error) {
    console.error(error);
    alert("Server Error");
  }
}

// ==========================
// LOGIN API
// ==========================

async function login() {

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {

        const response = await fetch(
            "http://localhost:3000/api/login",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password
                })
            }
        );

        const data = await response.json();

        alert(data.message);

        if (data.success) {

            localStorage.setItem("userEmail", data.email);
            localStorage.setItem("userName", data.name);

            window.location.href = "dashboard.html";
        }

    } catch (error) {

        console.error(error);
        alert("Server Error");

    }

}