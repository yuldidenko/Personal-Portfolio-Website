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

  // Enter moves name -> email, and sends from the email field (matching
  // the enterkeyhint="next"/"send" labels on mobile keyboards).
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      emailInput.focus();
    }
  });
  emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !sendButton.disabled) {
      e.preventDefault();
      sendButton.click();
    }
  });

  function setStatus(text, isSuccess) {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("success", !!isSuccess);
  }

  const nameError = document.getElementById("name-error");
  const emailError = document.getElementById("email-error");

  // Field-level errors: shown under the field they belong to, marked on
  // the input (aria-invalid) and cleared as soon as the user edits it.
  function setFieldError(input, errorEl, text) {
    if (errorEl) errorEl.textContent = text || "";
    if (text) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }
  nameInput.addEventListener("input", () => setFieldError(nameInput, nameError, ""));
  emailInput.addEventListener("input", () => setFieldError(emailInput, emailError, ""));

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

    setStatus("");
    const nameOk = !!name;
    const emailOk = isValidEmail(email);
    setFieldError(nameInput, nameError, nameOk ? "" : "Please enter your name.");
    setFieldError(
      emailInput,
      emailError,
      emailOk ? "" : email ? "Please enter a valid email." : "Please enter your email."
    );
    if (!nameOk || !emailOk) {
      // Move focus to the first field that needs fixing.
      (nameOk ? emailInput : nameInput).focus();
      return;
    }

    // The label is markup (rolling letters + a screen-reader copy), so
    // it is saved and restored as HTML, not plain text.
    const originalLabel = sendButton.innerHTML;
    sendButton.disabled = true;
    sendButton.classList.add("is-loading");
    sendButton.setAttribute("aria-busy", "true");
    sendButton.textContent = "Sending…";
    setStatus("Sending...");

    emailjs
      .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        from_name: name,
        reply_to: email,
        image_data: exportFlattenedDrawing(),
      })
      .then(() => {
        setStatus("✓ Received! Thanks for the artwork.", true);
        sendButton.classList.remove("is-loading");
        sendButton.removeAttribute("aria-busy");
        sendButton.classList.add("is-success");
        sendButton.textContent = "Sent ✓";
        setTimeout(() => {
          sendButton.classList.remove("is-success");
          sendButton.disabled = false;
          sendButton.innerHTML = originalLabel;
        }, 2500);
      })
      .catch((err) => {
        console.error("EmailJS send failed:", err);
        setStatus("Something went wrong - please try again.");
        sendButton.classList.remove("is-loading");
        sendButton.removeAttribute("aria-busy");
        sendButton.disabled = false;
        sendButton.innerHTML = originalLabel;
      });
  });
});
