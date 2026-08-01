/* ===========================================================================
   LOGOUT — déconnexion réelle (Supabase Auth), pas juste visuelle.
   Ferme la session côté Supabase (supabaseClient.auth.signOut(), voir
   SupabaseDB.clearSession dans ../../assets/js/supabase-client.js) puis
   renvoie vers login.html, qui redemandera un vrai e-mail/mot de passe.
   ========================================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var link = document.getElementById("logout-link");
    if (!link || typeof SupabaseDB === "undefined") return;

    link.addEventListener("click", async function (e) {
      e.preventDefault();
      link.classList.add("is-loading");
      try {
        await SupabaseDB.clearSession();
      } finally {
        window.location.href = "login.html";
      }
    });
  });
})();
