document
  .getElementById("loginForm")
  .addEventListener("submit", async (e) => {

    e.preventDefault();

    const email =
      document.getElementById("email").value;

    const password =
      document.getElementById("password").value;

    const rememberMe =
      document.getElementById("rememberMe").checked;

    const message =
      document.getElementById("message");

    const passwordError = getPasswordError(password);
    if (passwordError) {
      message.textContent = passwordError;
      message.style.color = "red";
      return;
    }

    if (!rememberMe) {
      message.textContent = "Please select Remember Me before logging in.";
      message.style.color = "red";
      return;
    }

    try {

      const response = await fetch(
        "/api/login",
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

      message.textContent = data.message;

      if (data.success) {

    message.style.color = "green";

    // Save user information
    localStorage.setItem("userEmail", data.email);
    localStorage.setItem("userName", data.name);

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 1000);



      } else {

        message.style.color = "red";

      }

    } catch (error) {

      console.log(error);

      message.textContent =
        "Server Error";

      message.style.color = "red";
    }
  });

document.querySelectorAll(".password-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const input = button.parentElement.querySelector("input");
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    button.textContent = isHidden ? "🙈" : "👁";
    button.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    button.setAttribute("aria-pressed", String(isHidden));
  });
});

function getPasswordError(password) {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/\d/.test(password)) return "Password must include a number.";
  if (!/[#?!@$%^&*-]/.test(password)) return "Password must include a special character, such as #.";
  return null;
}
