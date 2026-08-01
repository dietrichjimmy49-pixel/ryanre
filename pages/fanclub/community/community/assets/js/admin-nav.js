/* ===========================================================================
   ADMIN NAV — révèle l'item "Admin" du menu communauté si le profil
   Supabase (table `profiles`) de l'utilisateur connecté a is_admin = true.
   Masqué par défaut pour tout le monde, y compris un membre approuvé.
   ========================================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", async function () {
    var navItem = document.getElementById("admin-nav-item");
    if (!navItem || typeof SupabaseDB === "undefined") return;

    var current = await SupabaseDB.getCurrentProfile();
    if (current.profile && current.profile.is_admin) {
      navItem.hidden = false;
    }
  });
})();
