// Marks the header link for the section in view with aria-current, which the stylesheet
// renders in brand ink. Without JavaScript nothing is highlighted, which is acceptable.
const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-nav-link]"));
const sections = links
  .map((link) => document.querySelector<HTMLElement>(link.getAttribute("href") ?? ""))
  .filter((section): section is HTMLElement => section !== null);

if (links.length > 0 && sections.length > 0 && "IntersectionObserver" in window) {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  const headerHeight = header?.offsetHeight ?? 0;
  const visible = new Map<Element, number>();

  const update = () => {
    let best: Element | null = null;
    let bestRatio = 0;
    for (const [section, ratio] of visible) {
      if (ratio > bestRatio) {
        best = section;
        bestRatio = ratio;
      }
    }
    for (const link of links) {
      const isCurrent = best !== null && link.getAttribute("href") === `#${best.id}`;
      if (isCurrent) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.set(entry.target, entry.intersectionRatio);
        else visible.delete(entry.target);
      }
      update();
    },
    { rootMargin: `-${headerHeight}px 0px -40% 0px`, threshold: [0, 0.25, 0.5, 0.75, 1] },
  );

  for (const section of sections) observer.observe(section);
}
