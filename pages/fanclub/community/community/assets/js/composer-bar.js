/* ===========================================================================
   COMPOSER-BAR — espacement dynamique
   ---------------------------------------------------------------------------
   La composer-bar change de hauteur selon le format (une ligne sur desktop,
   deux blocs empilés sur mobile) : plutôt que deviner sa hauteur à chaque
   palier avec un chiffre fixe dans le CSS (fragile, se désynchronise dès
   que le contenu change), on la mesure réellement et on met à jour la
   variable CSS --composer-bar-height en conséquence. .app-main--discussion
   n'a donc jamais besoin d'un padding-bottom deviné à l'avance.
   ========================================================================= */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var bar = document.querySelector(".composer-bar");
    if (!bar) return; // page sans composer-bar

    function updateHeight() {
      document.documentElement.style.setProperty("--composer-bar-height", bar.offsetHeight + "px");
    }

    updateHeight();

    if (window.ResizeObserver) {
      new ResizeObserver(updateHeight).observe(bar);
    } else {
      // Navigateur sans ResizeObserver : le redimensionnement de fenêtre
      // couvre l'essentiel des changements de palier responsive.
      window.addEventListener("resize", updateHeight);
    }
  });
})();
