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

    const message =
      document.getElementById("message");

    if (password !== confirmPassword) {

      message.textContent =
        "Passwords do not match.";

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