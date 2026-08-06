/* ===========================================================================
   SCROLL HOME BUTTON — bouton flottant "retour à l'accueil" affiché
   uniquement une fois que le visiteur commence à scroller.

   Contexte : sur login.html et apply.html, le header du site est remplacé
   par un simple lien texte (.back-to-site) qui défile désormais avec la
   page (voir historique récent). Ce bouton flottant compense la perte de
   repère UX quand ce lien est sorti du viewport : un moyen rapide de
   revenir à la racine du site, sans réintroduire un header fixe complet.
   ========================================================================= */

(function () {
  const btn = document.getElementById("scroll-home-btn");
  if (!btn) return;

  const SHOW_AFTER_PX = 240; // seuil de scroll avant apparition
  let ticking = false;

  function updateVisibility() {
    const shouldShow = window.scrollY > SHOW_AFTER_PX;
    btn.classList.toggle("is-visible", shouldShow);
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(updateVisibility);
        ticking = true;
      }
    },
    { passive: true }
  );

  // État correct dès le chargement si la page est rouverte avec un
  // scroll déjà restauré par le navigateur.
  updateVisibility();
})();
