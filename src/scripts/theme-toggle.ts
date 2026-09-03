// The theme toggle: shows the theme it takes you to, stores the choice, crossfades once, and
// keeps the browser chrome colour in step. Labels come from data attributes rendered by
// ThemeToggle.astro, so no copy lives here.
type Theme = "light" | "dark";

const root = document.documentElement;
const media = window.matchMedia("(prefers-color-scheme: dark)");
const themeColorMetas = Array.from(
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
);

function current(): Theme {
  const forced = root.getAttribute("data-theme");
  if (forced === "light" || forced === "dark") return forced;
  return media.matches ? "dark" : "light";
}

function baseDuration(): number {
  const raw = getComputedStyle(root).getPropertyValue("--duration-base").trim();
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) return 200;
  return raw.endsWith("ms") ? n : n * 1000;
}

// When a theme is forced, the two scheme-specific metas collapse to the chosen canvas colour.
function syncThemeColor() {
  const forced = root.getAttribute("data-theme");
  if (!forced) return;
  const canvas = getComputedStyle(root).getPropertyValue("--color-bg-canvas").trim();
  for (const meta of themeColorMetas) {
    meta.removeAttribute("media");
    meta.content = canvas;
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")) {
  const toDark = button.dataset.labelToDark ?? "";
  const toLight = button.dataset.labelToLight ?? "";

  const render = () => {
    const theme = current();
    button.dataset.mode = theme;
    button.setAttribute("aria-label", theme === "dark" ? toLight : toDark);
  };

  button.addEventListener("click", () => {
    const next: Theme = current() === "dark" ? "light" : "dark";
    root.classList.add("theme-transition");
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage unavailable: the choice lasts for this page */
    }
    render();
    syncThemeColor();
    window.setTimeout(() => root.classList.remove("theme-transition"), baseDuration());
  });

  media.addEventListener("change", render);
  render();
}

syncThemeColor();

// Keeps this file a module so its top-level names never collide with the other scripts.
export {};
