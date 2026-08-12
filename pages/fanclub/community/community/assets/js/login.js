/* ===========================================================================
   LOGIN — connexion réelle (membre ou admin) contre Supabase Auth
   ---------------------------------------------------------------------------
   SupabaseDB.signIn vérifie l'e-mail/mot de passe auprès de Supabase, puis
   le statut (pending/approved/revoked) et le rôle (is_admin) stockés dans
   la table `profiles`. Le message affiché diffère selon le cas : identifiants
   incorrects, candidature encore en attente, ou accès révoqué.
   ========================================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", async function () {
    /* Session déjà active : inutile de repasser par le formulaire de
       connexion, même si le visiteur atterrit ici via un lien externe,
       l'historique du navigateur, etc. */
    var existingSession = await SupabaseDB.getSession();
    if (existingSession) {
      window.location.replace("discussion.html");
      return;
    }

    var emailFromQuery = new URLSearchParams(window.location.search).get("email");
    if (emailFromQuery) {
      var prefillTarget = document.getElementById("email");
      if (prefillTarget) prefillTarget.value = emailFromQuery;
    }

    /* --- Bascule de visibilité du mot de passe --- */
    document.querySelectorAll(".login-field-toggle").forEach(function (button) {
      button.addEventListener("click", function () {
        var control = button.closest(".login-field-control");
        var input = control.querySelector("input");
        var iconUse = button.querySelector("use");
        var isShowing = input.type === "text";

        input.type = isShowing ? "password" : "text";
        button.setAttribute("aria-pressed", String(!isShowing));
        button.setAttribute("aria-label", isShowing ? "Show password" : "Hide password");
        iconUse.setAttribute("href", isShowing ? "#icon-eye" : "#icon-eye-off");
      });
    });

    /* --- Connexion --- */
    var form = document.getElementById("login-form");
    if (!form) return;

    var card = document.querySelector(".login-card");
    var emailInput = document.getElementById("email");
    var passwordInput = document.getElementById("password");
    var emailControl = emailInput.closest(".login-field-control");
    var passwordControl = passwordInput.closest(".login-field-control");
    var submitBtn = document.getElementById("login-submit");
    var errorEl = document.getElementById("login-error");

    function clearError() {
      errorEl.hidden = true;
      errorEl.textContent = "";
      card.classList.remove("is-shaking");
      emailControl.classList.remove("is-invalid");
      passwordControl.classList.remove("is-invalid");
    }

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      emailControl.classList.add("is-invalid");
      passwordControl.classList.add("is-invalid");
      card.classList.add("is-shaking");
      setTimeout(function () { card.classList.remove("is-shaking"); }, 450);
      passwordInput.value = "";
      passwordInput.focus();
    }

    emailInput.addEventListener("input", clearError);
    passwordInput.addEventListener("input", clearError);

    /* --- "Forgot your password?" : pas de vrai flux de réinitialisation
       dans cette démo (pas de backend, pas d'e-mails réels). On informe
       simplement l'utilisateur plutôt que de laisser un lien mort. --- */
    var forgotLink = document.querySelector(".login-forgot-link");
    if (forgotLink) {
      forgotLink.addEventListener("click", function (e) {
        e.preventDefault();
        errorEl.textContent = "This is a demo: password reset isn't available. Use one of the seeded member accounts instead.";
        errorEl.hidden = false;
      });
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      clearError();
      submitBtn.disabled = true;

      try {
        var outcome = await SupabaseDB.signIn(emailInput.value, passwordInput.value);

        switch (outcome.result) {
          case SupabaseDB.LOGIN_RESULT.SUCCESS_MEMBER:
            window.location.href = "discussion.html";
            return;

          case SupabaseDB.LOGIN_RESULT.SUCCESS_ADMIN:
            /* L'admin atterrit dans la communauté comme un membre normal
               (voir traffic, discussions...) ; l'item de nav "Admin" (voir
               admin-nav.js) se révèle automatiquement pour lui permettre
               de rejoindre le dashboard s'il le souhaite. */
            window.location.href = "discussion.html";
            return;

          case SupabaseDB.LOGIN_RESULT.PENDING:
            showError("Your application is still under review. We'll e-mail you once it's approved.");
            break;

          case SupabaseDB.LOGIN_RESULT.REJECTED:
            showError("Your application was not approved. If you think this is a mistake, please contact us.");
            break;

          case SupabaseDB.LOGIN_RESULT.REVOKED:
            showError("Access denied. Your account has been suspended for violating community guidelines.");
            break;

          default:
            showError("Incorrect email or password.");
        }
      } catch (err) {
        console.error("[login] Failed to verify credentials:", err);
        showError("Something went wrong. Please try again.");
      } finally {
        submitBtn.disabled = false;
      }
    });
  });
})();
