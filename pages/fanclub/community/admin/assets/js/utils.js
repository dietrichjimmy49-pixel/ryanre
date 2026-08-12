/* ===========================================================================
   UTILS — petits utilitaires partagés par admin-app.js
   ========================================================================= */

const AdminUtils = (function () {

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load: " + url);
    return res.json();
  }

  function formatDateLong(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  function formatDateTime(isoString) {
    const d = new Date(isoString);
    const date = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return date + " at " + time;
  }

  /** "Submitted 2h ago" — calculé par rapport à l'heure système actuelle. */
  function relativeTime(isoString) {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return minutes + "m ago";
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + "h ago";
    const days = Math.round(hours / 24);
    return days + "d ago";
  }

  function fullName(person) {
    return person.firstName + " " + person.lastName;
  }

  return { fetchJSON, formatDateLong, formatDateTime, relativeTime, fullName };
})();
