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

/* ===========================================================================
   JOIN FAB + tous les CTA "Join" du site — logique de redirection intelligente.
   ---------------------------------------------------------------------------
   Par défaut (avant que la vérification n'ait eu le temps de s'exécuter,
   ou si elle échoue), chaque bouton garde son comportement d'origine —
   c'est un choix sûr : au pire un membre déjà connecté doit re-cliquer une
   fois de plus depuis login.html (qui le renvoie lui-même automatiquement
   vers discussion.html s'il a une session active, voir login.js).

   Si une session Supabase active est détectée, TOUS les boutons "Join"
   du site (bouton flottant + CTA nav/header/héro/bas de page, repérés par
   l'attribut data-join-cta) pointent directement vers discussion.html,
   pour épargner cette étape intermédiaire — peu importe lequel un membre
   déjà connecté rencontre en premier sur la page.
   ========================================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", async function () {
    var fab = document.getElementById("join-fab");
    var joinCtas = document.querySelectorAll("[data-join-cta]");
    if ((!fab && joinCtas.length === 0) || typeof SupabaseDB === "undefined") return;

    try {
      var session = await SupabaseDB.getSession();
      if (!session) return;

      var communityUrl = "/pages/fanclub/community/community/discussion.html";

      if (fab) {
        fab.href = communityUrl;
        fab.setAttribute("aria-label", "Go to the community");
        var labelEl = fab.querySelector(".join-fab__label");
        if (labelEl) labelEl.textContent = "Profile";
      }

      joinCtas.forEach(function (cta) {
        cta.href = communityUrl;
      });
    } catch (err) {
      console.error("[join-fab] Could not check session:", err);
    }
  });
})();
