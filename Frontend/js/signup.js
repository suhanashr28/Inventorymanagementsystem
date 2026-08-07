document
  .getElementById("signupForm")
  .addEventListener("submit", async (e) => {

    e.preventDefault();

    const name =
      document.getElementById("name").value;

    const email =
      document.getElementById("email").value;

    const password =
      document.getElementById("password").value;

    const confirmPassword =
      document.getElementById("confirmPassword").value;

    const agreeTerms =
      document.getElementById("agreeTerms").checked;

    const message =
      document.getElementById("message");

    const passwordError = getPasswordError(password);

    if (passwordError) {
      message.textContent = passwordError;
      message.style.color = "red";
      return;
    }

    if (password !== confirmPassword) {

      message.textContent =
        "Passwords do not match.";

      message.style.color = "red";

      return;
    }

    if (!agreeTerms) {
      message.textContent = "Please agree to the Terms and Privacy Policy.";
      message.style.color = "red";
      return;
    }

    try {

      const response = await fetch(
        "/api/signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name,
            email,
            password
          })
        }
      );

      const data = await response.json();

      message.textContent =
        data.message;

      if (data.success) {

        message.style.color = "green";

        setTimeout(() => {
          window.location.href =
            "login.html";
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
    button.classList.toggle("is-visible", isHidden);
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
