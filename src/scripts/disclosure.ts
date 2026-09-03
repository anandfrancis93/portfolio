// The experience entries are disclosures. Every entry is rendered expanded, so nothing is
// hidden without JavaScript; this script collapses the entries marked closed as soon as it
// runs (the stylesheet has already hidden them for script-capable documents, so nothing
// shifts). State lives in attributes the stylesheet reads: aria-expanded on the button drives
// the panel's geometry and the chevron; data-disclosure on the entry, with the panel's hidden
// attribute, decides whether the panel is in the layout and the accessibility tree. A close
// waits for its transition (durations are tokens, zero under reduced motion) before hiding;
// an open unhides first so the transition has a start state.

for (const entry of document.querySelectorAll<HTMLElement>("[data-disclosure]")) {
  const toggle = entry.querySelector<HTMLButtonElement>("[data-disclosure-toggle]");
  const panel = entry.querySelector<HTMLElement>("[data-disclosure-panel]");
  if (!toggle || !panel) continue;

  // Counts state changes so a close that is still animating cannot hide a reopened panel.
  let generation = 0;

  const collapse = () => {
    const mine = ++generation;
    toggle.setAttribute("aria-expanded", "false");
    // Flush styles so the transitions exist before they are looked up.
    void panel.offsetHeight;
    const transitions = typeof panel.getAnimations === "function" ? panel.getAnimations() : [];
    const finish = () => {
      if (mine !== generation) return;
      panel.hidden = true;
      entry.dataset.disclosure = "closed";
    };
    if (transitions.length === 0) finish();
    else void Promise.allSettled(transitions.map((t) => t.finished)).then(finish);
  };

  const expand = () => {
    generation += 1;
    entry.dataset.disclosure = "open";
    panel.hidden = false;
    // Lay out the collapsed geometry first so the open transition has a start state.
    void panel.offsetHeight;
    toggle.setAttribute("aria-expanded", "true");
  };

  if (entry.dataset.disclosure !== "open") {
    toggle.setAttribute("aria-expanded", "false");
    panel.hidden = true;
  }

  toggle.addEventListener("click", () => {
    if (toggle.getAttribute("aria-expanded") === "true") collapse();
    else expand();
  });
}

// Keeps this file a module so its top-level names never collide with the other scripts.
export {};
