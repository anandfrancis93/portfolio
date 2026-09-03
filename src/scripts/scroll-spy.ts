// Marks the header link for the section in view with aria-current="location", which the
// stylesheet renders in brand ink with an underline. Rebuilds when the header changes height
// at the tablet breakpoint. Without JavaScript nothing is highlighted, which is acceptable.
const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-nav-link]"));
const targets = new Map<HTMLElement, HTMLAnchorElement>();

for (const link of links) {
  const hash = new URL(link.href, location.href).hash;
  const section = hash ? document.getElementById(hash.slice(1)) : null;
  if (section) targets.set(section, link);
}

if (targets.size > 0 && "IntersectionObserver" in window) {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  const visible = new Map<Element, number>();
  let observer: IntersectionObserver | null = null;

  const update = () => {
    let best: Element | null = null;
    let bestRatio = 0;
    for (const [section, ratio] of visible) {
      if (ratio > bestRatio) {
        best = section;
        bestRatio = ratio;
      }
    }
    for (const [section, link] of targets) {
      if (section === best) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  };

  const observe = () => {
    observer?.disconnect();
    visible.clear();
    const headerHeight = header?.offsetHeight ?? 0;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target, entry.intersectionRatio);
          else visible.delete(entry.target);
        }
        update();
      },
      { rootMargin: `-${headerHeight}px 0px -40% 0px`, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const section of targets.keys()) observer.observe(section);
  };

  observe();
  window.matchMedia("(width >= 768px)").addEventListener("change", observe);
}

// Keeps this file a module so its top-level names never collide with the other scripts.
export {};
