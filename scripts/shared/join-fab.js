/* ===========================================================================
   JOIN FAB — logique de redirection intelligente.
   ---------------------------------------------------------------------------
   Par défaut (avant que la vérification n'ait eu le temps de s'exécuter,
   ou si elle échoue), le lien pointe vers login.html — c'est un choix
   sûr : au pire un membre déjà connecté doit re-cliquer une fois de plus
   depuis login.html (qui le renvoie lui-même automatiquement vers
   discussion.html s'il a une session active, voir login.js).

   Si une session Supabase active est détectée, on pointe directement
   vers discussion.html, pour épargner cette étape intermédiaire.
   ========================================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", async function () {
    var link = document.getElementById("join-fab");
    if (!link || typeof SupabaseDB === "undefined") return;

    var labelEl = link.querySelector(".join-fab__label");

    try {
      var session = await SupabaseDB.getSession();
      if (session) {
        link.href = "/pages/fanclub/community/community/discussion.html";
        link.setAttribute("aria-label", "Go to the community");
        if (labelEl) labelEl.textContent = "Profile";
      }
    } catch (err) {
      console.error("[join-fab] Could not check session:", err);
    }
  });
})();
