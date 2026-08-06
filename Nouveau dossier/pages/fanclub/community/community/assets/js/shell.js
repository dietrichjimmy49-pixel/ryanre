/* ===========================================================================
   SHELL — comportement JS minime commun aux 3 pages (sidebar + tiroir).
   ---------------------------------------------------------------------------
   Le tiroir lui-même reste piloté en CSS pur (voir shell.css : case à
   cocher #nav-toggle). Ce fichier ajoute uniquement la fermeture au
   clavier (Échap), pour rester cohérent avec les popups de la page —
   profil membre, détail de candidature — qui se ferment déjà à l'Échap.
   ========================================================================= */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var navToggle = document.getElementById("nav-toggle");
    if (!navToggle) return;

    // ---------------------------------------------------------------
    // SCROLL LOCK — shell.css already locks the background via
    // `body:has(.nav-toggle-input:checked) { overflow: hidden }`, but
    // :has() isn't supported everywhere and overflow:hidden alone isn't
    // fully reliable on mobile Safari/iOS. This JS fallback pins <body>
    // with position: fixed whenever the drawer opens, and restores the
    // exact scroll position when it closes, so scrolling stays locked
    // consistently across browsers.
    // ---------------------------------------------------------------
    var lockedScrollY = 0;

    function lockScroll() {
      lockedScrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = "-" + lockedScrollY + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
    }

    function unlockScroll() {
      if (document.body.style.position !== "fixed") return;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      window.scrollTo(0, lockedScrollY);
    }

    navToggle.addEventListener("change", function () {
      if (navToggle.checked) {
        document.documentElement.classList.add("nav-open");
        document.body.classList.add("nav-open");
        lockScroll();
      } else {
        document.documentElement.classList.remove("nav-open");
        document.body.classList.remove("nav-open");
        unlockScroll();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navToggle.checked) {
        navToggle.checked = false;
        navToggle.dispatchEvent(new Event("change"));
      }
    });

    // ---------------------------------------------------------------
    // GESTES TACTILES — glisser depuis le bord gauche pour ouvrir,
    // glisser vers la gauche sur le tiroir pour le refermer. Le tiroir
    // reste piloté par la case à cocher CSS-only (voir shell.css) : on
    // se contente de basculer .checked, aucune logique de layout ici.
    // Vient en complément du bouton "trois traits", jamais en
    // remplacement.
    // ---------------------------------------------------------------
    var EDGE_ZONE_PX = 24;
    var SWIPE_THRESHOLD_PX = 60;
    var touchStartX = null;
    var touchStartY = null;
    var openedFromEdge = false;

    document.addEventListener("touchstart", function (e) {
      var t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      openedFromEdge = !navToggle.checked && touchStartX <= EDGE_ZONE_PX;
    }, { passive: true });

    document.addEventListener("touchmove", function (e) {
      if (touchStartX === null) return;
      var t = e.touches[0];
      var dx = t.clientX - touchStartX;
      var dy = t.clientY - touchStartY;
      if (Math.abs(dy) > Math.abs(dx)) return; // scroll vertical, on n'interfère pas

      if (openedFromEdge && dx > SWIPE_THRESHOLD_PX) {
        navToggle.checked = true;
        navToggle.dispatchEvent(new Event("change"));
        touchStartX = null;
      } else if (navToggle.checked && dx < -SWIPE_THRESHOLD_PX) {
        navToggle.checked = false;
        navToggle.dispatchEvent(new Event("change"));
        touchStartX = null;
      }
    }, { passive: true });

    document.addEventListener("touchend", function () {
      touchStartX = null;
      touchStartY = null;
      openedFromEdge = false;
    }, { passive: true });
  });
})();
