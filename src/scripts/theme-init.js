// Inlined in <head> before first paint so a stored theme never flashes. Its hash goes into the
// Content-Security-Policy in phase F. Nothing else runs here.
(function () {
  try {
    var t = localStorage.getItem("theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) {
    /* storage unavailable: follow the operating system */
  }
})();
