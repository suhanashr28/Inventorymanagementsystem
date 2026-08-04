document
  .getElementById("loginForm")
  .addEventListener("submit", async (e) => {

    e.preventDefault();

    const email =
      document.getElementById("email").value;

    const password =
      document.getElementById("password").value;

    const message =
      document.getElementById("message");

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