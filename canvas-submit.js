// --- EmailJS setup (fill these in from your EmailJS dashboard) ---
// 1. Sign up at https://www.emailjs.com (free tier).
// 2. Add an Email Service (e.g. connect your Gmail) -> copy its Service ID.
// 3. Create an Email Template with:
//      - "To email" set to yuliia.didenko.mir@gmail.com (fixed there, not
//        sent from the browser, so a visitor can't redirect it elsewhere)
//      - "Reply To" set to {{reply_to}}
//      - Subject, e.g.: New canvas drawing from {{from_name}}
//      - Body (HTML) including {{from_name}}, {{reply_to}}, and the image:
//          <img src="{{image_data}}" style="max-width:100%;" />
//    Copy its Template ID.
// 4. Copy your Public Key from Account -> General.
// 5. Paste all three below.
const EMAILJS_PUBLIC_KEY = "Blz4Tsu_cGEiJ-0Ac";
const EMAILJS_SERVICE_ID = "service_svuxjd3";
const EMAILJS_TEMPLATE_ID = "template_7qg0rze";

// Free EmailJS plans cap request size (historically ~50KB), so the drawing
// is downscaled and flattened onto a white background before export rather
// than sent at full (possibly retina-scaled) canvas resolution.
const MAX_EXPORT_WIDTH = 700;

window.addEventListener("DOMContentLoaded", () => {
  if (typeof emailjs === "undefined") return;
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

  const canvas = document.getElementById("drawingCanvas");
  const sendButton = document.querySelector(".send-button");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const status = document.querySelector(".form-status");
  if (!canvas || !sendButton || !nameInput || !emailInput) return;

  function setStatus(text, isSuccess) {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("success", !!isSuccess);
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function exportFlattenedDrawing() {
    const scale = Math.min(1, MAX_EXPORT_WIDTH / canvas.clientWidth);
    const exportWidth = Math.round(canvas.clientWidth * scale);
    const exportHeight = Math.round(canvas.clientHeight * scale);

    const flattened = document.createElement("canvas");
    flattened.width = exportWidth;
    flattened.height = exportHeight;
    const flatCtx = flattened.getContext("2d");
    flatCtx.fillStyle = "#ffffff";
    flatCtx.fillRect(0, 0, exportWidth, exportHeight);
    flatCtx.drawImage(canvas, 0, 0, exportWidth, exportHeight);

    return flattened.toDataURL("image/png");
  }

  sendButton.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!name) {
      setStatus("Please enter your name.");
      return;
    }
    if (!isValidEmail(email)) {
      setStatus("Please enter a valid email.");
      return;
    }

    const originalLabel = sendButton.textContent;
    sendButton.disabled = true;
    setStatus("Sending...");

    emailjs
      .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        from_name: name,
        reply_to: email,
        image_data: exportFlattenedDrawing(),
      })
      .then(() => {
        setStatus("✓ Received! Thanks for the artwork.", true);
        sendButton.disabled = false;
        sendButton.textContent = originalLabel;
      })
      .catch((err) => {
        console.error("EmailJS send failed:", err);
        setStatus("Something went wrong - please try again.");
        sendButton.disabled = false;
        sendButton.textContent = originalLabel;
      });
  });
});
