/* ===========================================================================
   UTILS — petites fonctions partagées entre forum-engine.js et
   members-directory.js. Rien de spécifique à une page ici.
   ========================================================================= */

const Utils = (function () {

  /* Générateur pseudo-aléatoire à graine FIXE (mulberry32) : donne
     exactement la même suite de nombres "aléatoires" à chaque chargement
     de page, dans n'importe quel navigateur. Sans ça, forum-engine.js
     utilisait Math.random() — chaque visiteur voyait donc une simulation
     totalement différente. Avec une graine fixe, tout le monde voit le
     même contenu, dans le même ordre : l'illusion d'une communauté
     active est cohérente pour tous, comme voulu. */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const seededRandom = mulberry32(1337);

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function randInt(min, max) {
    return Math.floor(seededRandom() * (max - min + 1)) + min;
  }

  function pickRandom(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /** Formatage des nombres pour l'affichage (site en anglais -> notation
   *  anglaise : point décimal, pas de virgule) :
   *  - < 1,000  : nombre exact, tel quel (ex. réactions 👍/❤️, "9 replies")
   *  - >= 1,000 : abrégé en K, une décimale (ex. 11,860 -> "11.9K")
   *  - >= 1,000,000 : abrégé en M, même logique (ex. 6,847,300 -> "6.8M")
   *  Évite les longs nombres à virgules sur les gros compteurs communautaires,
   *  tout en gardant les petits nombres lisibles tels quels. */
  function formatNumber(n) {
    if (typeof n !== "number" || !isFinite(n)) return String(n);

    const abs = Math.abs(n);

    if (abs >= 1000000) {
      return (n / 1000000).toFixed(1) + "M";
    }
    if (abs >= 1000) {
      return (n / 1000).toFixed(1) + "K";
    }
    return n.toLocaleString("en-US");
  }

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load: " + url);
    return res.json();
  }

  return { sleep, randInt, pickRandom, clamp, formatNumber, fetchJSON, random: seededRandom };
})();
