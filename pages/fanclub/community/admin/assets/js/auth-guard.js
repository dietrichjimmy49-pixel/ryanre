/* ===========================================================================
   AUTH GUARD — protège Dashboard et Members
   ---------------------------------------------------------------------------
   Vérifie la vraie session Supabase + le is_admin de la table `profiles`.
   Comme cette vérification est asynchrone (appel réseau), la page est
   masquée (voir visibility:hidden posé en inline dans le <head>) jusqu'à
   ce qu'on soit sûr que c'est bien un admin — pour éviter un "flash" du
   contenu protégé avant une éventuelle redirection.
   ========================================================================= */

(function () {
  "use strict";

  async function check() {
    if (typeof SupabaseDB === "undefined") return;

    const current = await SupabaseDB.getCurrentProfile();
    if (!current.profile || !current.profile.is_admin) {
      window.location.replace("../community/login.html");
      return;
    }

    document.documentElement.style.visibility = "visible";
  }

  check();
})();
