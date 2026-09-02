// The mobile menu is a native <dialog>: showModal() gives the focus trap, Escape handling and
// the inert page for free. This script wires the open button, returns focus on close, and
// closes when a link inside is followed.
const dialog = document.getElementById("mobile-menu") as HTMLDialogElement | null;
const openButton = document.querySelector<HTMLButtonElement>("[data-menu-open]");

if (dialog && openButton && typeof dialog.showModal === "function") {
  const closeButton = dialog.querySelector<HTMLButtonElement>("[data-menu-close]");
  const firstLink = dialog.querySelector<HTMLAnchorElement>("a[href]");

  const sync = () => openButton.setAttribute("aria-expanded", dialog.open ? "true" : "false");

  openButton.addEventListener("click", () => {
    dialog.showModal();
    sync();
    firstLink?.focus();
  });

  closeButton?.addEventListener("click", () => dialog.close());

  dialog.addEventListener("close", () => {
    sync();
    openButton.focus();
  });

  // Following a link inside the menu closes it; the browser then scrolls to the target.
  dialog.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("a[href]")) dialog.close();
  });

  openButton.hidden = false;
  sync();
}
