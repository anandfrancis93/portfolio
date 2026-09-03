// The mobile menu is a native <dialog>: showModal() gives the focus trap, Escape handling and
// the inert page for free. This script wires the open button, returns focus to it when the
// menu is dismissed, and lets focus follow the link when a destination is chosen.
const dialog = document.getElementById("mobile-menu") as HTMLDialogElement | null;
const openButton = document.querySelector<HTMLButtonElement>("[data-menu-open]");

if (dialog && openButton && typeof dialog.showModal === "function") {
  const closeButton = dialog.querySelector<HTMLButtonElement>("[data-menu-close]");
  const firstLink = dialog.querySelector<HTMLAnchorElement>("a[href]");
  let followingLink = false;

  const sync = () => openButton.setAttribute("aria-expanded", dialog.open ? "true" : "false");

  openButton.addEventListener("click", () => {
    dialog.showModal();
    sync();
    firstLink?.focus();
  });

  closeButton?.addEventListener("click", () => dialog.close());

  // Following a link closes the menu; focus then belongs to the destination, not the opener.
  dialog.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("a[href]")) {
      followingLink = true;
      dialog.close();
    }
  });

  dialog.addEventListener("close", () => {
    sync();
    if (!followingLink) openButton.focus();
    followingLink = false;
  });

  sync();
}

// Keeps this file a module so its top-level names never collide with the other scripts.
export {};
