// One subtle reveal per section as it enters the viewport, once. The hidden state is applied
// here, after the script has loaded, so content is never hidden without JavaScript. Durations
// come from tokens, which drop to zero under reduced motion; the stylesheet also removes the
// rise there, leaving opacity only.
const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

if (targets.length > 0 && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
  );

  for (const target of targets) {
    // Anything already on screen at load stays put; only sections below the fold reveal.
    const rect = target.getBoundingClientRect();
    if (rect.top < window.innerHeight) continue;
    target.classList.add("reveal");
    observer.observe(target);
  }
}

// Keeps this file a module so its top-level names never collide with the other scripts.
export {};
