/* ===========================================================================
   APPLY — inscription réelle via Supabase
   ---------------------------------------------------------------------------
   Le candidat crée maintenant un vrai compte (email + mot de passe qu'il
   choisit lui-même) dès la candidature. Supabase envoie un vrai e-mail de
   confirmation. Le compte existe tout de suite mais reste "en attente"
   (status = 'pending' en base, voir l'étape 2 du plan) tant qu'un admin
   ne l'a pas approuvé — la connexion le lui rappellera s'il essaie avant.
   ========================================================================= */

(function () {
  "use strict";

  const COUNTRIES = [
    "United States", "Canada", "United Kingdom", "Ireland", "France", "Germany",
    "Spain", "Portugal", "Italy", "Netherlands", "Belgium", "Switzerland",
    "Sweden", "Norway", "Denmark", "Finland", "Poland", "Austria",
    "Australia", "New Zealand", "Japan", "South Korea", "China", "India",
    "Philippines", "Singapore", "Mexico", "Brazil", "Argentina", "Colombia",
    "Chile", "South Africa", "Nigeria", "Egypt", "Turkey", "United Arab Emirates",
    "Other",
  ];

  function populateSelect(select, values) {
    values.forEach((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    });
  }

  function renderConfirmation(card, firstName, email) {
    card.innerHTML = `
      <header class="apply-header">
        <p class="apply-eyebrow">FAN CLUB · APPLICATION SUBMITTED</p>
        <h1 class="apply-title">You're on the list, ${firstName}.</h1>
        <p class="apply-subtitle">
          We've sent a confirmation e-mail to <strong>${email}</strong> —
          click the link inside to confirm your address (check your spam
          folder if you don't see it within a few minutes).
        </p>
        <p class="apply-subtitle">
          Every application is then personally reviewed. Once approved,
          you'll be able to sign in with the email and password you just
          chose.
        </p>
      </header>

      <div class="apply-actions">
        <a href="login.html" class="btn btn-primary apply-submit">
          Already approved? Sign in <span class="btn-arrow-icon">→</span>
        </a>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const countrySelect = document.getElementById("country");
    if (countrySelect) populateSelect(countrySelect, COUNTRIES);

    const form = document.getElementById("apply-form");
    if (!form) return;

    /* Anti-spam : un vrai humain met toujours plus de quelques secondes
       à lire et remplir ce formulaire ; un robot le fait quasi
       instantanément. Combiné au honeypot ci-dessous. */
    const formLoadedAt = Date.now();
    const MIN_FILL_TIME_MS = 3000;

    const honeypotInput = document.getElementById("website");

    const passwordInput = document.getElementById("password");
    const confirmInput = document.getElementById("password-confirm");
    const mismatchNote = document.getElementById("password-mismatch");
    const errorEl = document.getElementById("apply-error");

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }

    function clearError() {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }

    function clearMismatch() {
      mismatchNote.hidden = true;
      passwordInput.classList.remove("is-invalid");
      confirmInput.classList.remove("is-invalid");
    }

    function showMismatch() {
      mismatchNote.hidden = false;
      passwordInput.classList.add("is-invalid");
      confirmInput.classList.add("is-invalid");
    }

    passwordInput.addEventListener("input", clearMismatch);
    confirmInput.addEventListener("input", clearMismatch);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      /* Piège à robots rempli, ou soumission suspicieusement instantanée :
         on arrête là, silencieusement — pas de message d'erreur, pour ne
         pas donner d'indice à un robot sur ce qui l'a bloqué. Un vrai
         visiteur ne verra jamais ce cas puisqu'il ne remplit pas un champ
         invisible et met naturellement plus de 3 secondes à répondre. */
      if (honeypotInput && honeypotInput.value.trim() !== "") {
        console.warn("[apply] Blocked: honeypot field was filled (likely a bot).");
        return;
      }
      if (Date.now() - formLoadedAt < MIN_FILL_TIME_MS) {
        console.warn("[apply] Blocked: form submitted too quickly (likely a bot).");
        return;
      }

      if (!form.reportValidity()) return;
      clearError();

      if (passwordInput.value !== confirmInput.value) {
        showMismatch();
        confirmInput.focus();
        return;
      }
      clearMismatch();

      const submitBtn = form.querySelector(".apply-submit");
      submitBtn.disabled = true;

      const firstName = document.getElementById("first-name").value.trim();
      const email = document.getElementById("email").value.trim();

      const data = {
        email: email,
        password: passwordInput.value,
        firstName: firstName,
        lastName: document.getElementById("last-name").value.trim(),
        address: document.getElementById("address").value.trim(),
        city: document.getElementById("city").value.trim(),
        state: document.getElementById("state").value.trim(),
        zip: document.getElementById("zip").value.trim(),
        country: countrySelect.value,
        phone: document.getElementById("phone").value.trim(),
        favoriteMovie: document.getElementById("favorite-movie").value.trim() || "Not specified",
        motivation: document.getElementById("motivation").value.trim(),
      };

      try {
        const { error } = await SupabaseDB.signUp(data);

        if (error) {
          submitBtn.disabled = false;
          if (error.message && error.message.toLowerCase().includes("already registered")) {
            showError("An account already exists with this email. Try signing in instead.");
          } else {
            console.error("[apply] Supabase signUp error:", error.message);
            showError("Something went wrong submitting your application. Please try again.");
          }
          return;
        }

        const card = document.querySelector(".apply-card");
        renderConfirmation(card, firstName, email);
        card.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        console.error("[apply] Failed to submit the application:", err);
        submitBtn.disabled = false;
        showError("Something went wrong submitting your application. Please try again.");
      }
    });
  });
})();
