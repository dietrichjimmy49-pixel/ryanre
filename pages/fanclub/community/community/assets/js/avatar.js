/* ===========================================================================
   AVATAR — initiales + couleur déterministe
   ---------------------------------------------------------------------------
   Remplace les photos de profil par un cercle coloré + 2 lettres, dans
   l'esprit "pas de vraies photos pour des membres qui n'existent pas".
   La couleur ne dépend que du nom (ou de colorIndex si fourni dans les
   données) : un même membre garde toujours la même couleur, sur toutes
   les pages et à chaque rechargement.

   Palette : 8 tons dérivés de l'accent du site (--color-accent) et de
   teintes voisines, jamais de couleur criarde hors charte.
   ========================================================================= */

const Avatar = (function () {

  /**
   * Construit les initiales à partir d'un nom complet ("Daniel Rodriguez" -> "DR").
   * Gère les noms à un seul mot ("Sarah_M" -> "SA") sans planter.
   */
  function initialsFromName(fullName) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Hash simple et stable d'une chaîne, utilisé quand colorIndex n'est
   * pas fourni par les données (ex: auteurs générés par la simulation).
   */
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Retourne l'index de palette (1-8) pour un membre. Préfère colorIndex
   * s'il est fourni (cohérence garantie avec members.json), sinon dérive
   * un index stable depuis le nom.
   */
  function colorIndexFor(name, explicitIndex) {
    if (explicitIndex) return ((explicitIndex - 1) % 8) + 1;
    return (hashString(name) % 8) + 1;
  }

  /**
   * Construit l'élément DOM d'un avatar-initiales.
   * size: "sm" | "md" | "lg"
   * options: { online: bool, colorIndex: number }
   */
  function createElement(name, size, options) {
    options = options || {};
    const el = document.createElement("span");
    el.className = "avatar-initials avatar-initials--" + size +
      " avatar-initials--c" + colorIndexFor(name, options.colorIndex);
    el.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "avatar-initials__label";
    label.textContent = initialsFromName(name);
    el.appendChild(label);

    const dot = document.createElement("span");
    dot.className = "avatar-initials__dot";
    el.appendChild(dot);

    if (options.online) {
      el.classList.add("is-online");
    }

    return el;
  }

  return { initialsFromName, colorIndexFor, createElement };
})();
