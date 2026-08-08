document.getElementById("forgotPasswordForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const message = document.getElementById("message");

  try {
    const response = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    message.textContent = data.message;
    message.style.color = data.success ? "green" : "red";
  } catch (error) {
    console.error(error);
    message.textContent = "Unable to send the email right now. Please try again later.";
    message.style.color = "red";
  }
});
