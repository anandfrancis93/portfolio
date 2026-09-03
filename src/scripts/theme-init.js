// Inlined in <head> before first paint: applies a stored theme so nothing flashes, and marks
// the document as script-capable so controls that need JavaScript can become visible without
// shifting layout. Its hash goes into the Content-Security-Policy in phase F.
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  try {
    var t = localStorage.getItem("theme");
    if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
  } catch (e) {
    /* storage unavailable: follow the operating system */
  }
})();
