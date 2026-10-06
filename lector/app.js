"use strict";

const ui = {
  contents: document.getElementById("contents"),
  topChapter: document.getElementById("topChapter"),
  sectionType: document.getElementById("sectionType"),
  sectionTitle: document.getElementById("sectionTitle"),
  sectionSubtitle: document.getElementById("sectionSubtitle"),
  versionSelect: document.getElementById("versionSelect"),
  versionNote: document.getElementById("versionNote"),
  errorNote: document.getElementById("errorNote"),
  book: document.getElementById("book"),
  image: document.getElementById("sheetImage"),
  imageLoading: document.getElementById("imageLoading"),
  sheetLabel: document.getElementById("sheetLabel"),
  sectionPosition: document.getElementById("sectionPosition"),
  overallPosition: document.getElementById("overallPosition"),
  progressFill: document.getElementById("progressFill"),
  previous: document.getElementById("previousPage"),
  next: document.getElementById("nextPage"),
  resetVersions: document.getElementById("resetVersions"),
  fullscreen: document.getElementById("fullscreenButton"),
  sidebar: document.getElementById("sidebar"),
  sidebarScrim: document.getElementById("sidebarScrim"),
  openSidebar: document.getElementById("openSidebar"),
  closeSidebar: document.getElementById("closeSidebar"),
  openZoom: document.getElementById("openZoom"),
  zoomDialog: document.getElementById("zoomDialog"),
  zoomTitle: document.getElementById("zoomTitle"),
  zoomImage: document.getElementById("zoomImage"),
  zoomLevel: document.getElementById("zoomLevel"),
  zoomIn: document.getElementById("zoomIn"),
  zoomOut: document.getElementById("zoomOut"),
  closeZoom: document.getElementById("closeZoom")
};

let catalog;
let readingPages = [];
let currentIndex = 0;
let selectedVersions = {};
let imageRequest = 0;
let zoomScale = 1;
let zoomBaseWidth = 900;
let swipeStart = null;

function selectedVersion(section) {
  const id = selectedVersions[section.id] || section.currentVersion;
  return section.versions.find((version) => version.id === id);
}

function rebuildReadingPages() {
  readingPages = [];
  for (const chapter of catalog.chapters) {
    for (const section of chapter.sections) {
      const version = selectedVersion(section);
      version.pages.forEach((page, pageIndex) => {
        readingPages.push({ chapter, section, version, page, pageIndex });
      });
    }
  }
}

function findSectionPage(chapterId, sectionId, pageIndex = 0) {
  const matches = readingPages
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.chapter.id === chapterId && entry.section.id === sectionId);
  if (!matches.length) return 0;
  return matches[Math.min(pageIndex, matches.length - 1)].index;
}

function chapterTitle(chapter) {
  return `Capítulo ${chapter.number} · ${chapter.title}`;
}

function renderContents() {
  ui.contents.replaceChildren();
  const active = readingPages[currentIndex];

  for (const chapter of catalog.chapters) {
    const group = document.createElement("div");
    group.className = "chapter-group";

    const number = document.createElement("p");
    number.className = "chapter-heading";
    number.textContent = `Capítulo ${chapter.number}`;
    group.append(number);

    const title = document.createElement("p");
    title.className = "chapter-name";
    title.textContent = chapter.title;
    group.append(title);

    chapter.sections.forEach((section, position) => {
      const version = selectedVersion(section);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toc-section";
      button.setAttribute("aria-current", String(active?.section.id === section.id));

      const order = document.createElement("span");
      order.className = "toc-number";
      order.textContent = String(position + 1).padStart(2, "0");
      const text = document.createElement("span");
      text.className = "toc-text";
      text.textContent = section.title;
      const count = document.createElement("span");
      count.className = "toc-count";
      count.textContent = String(version.pages.length);

      button.append(order, text, count);
      button.addEventListener("click", () => {
        showPage(findSectionPage(chapter.id, section.id));
        setSidebarOpen(false);
      });
      group.append(button);
    });

    ui.contents.append(group);
  }
}

function renderVersionSelector(entry) {
  const { section, version } = entry;
  ui.versionSelect.replaceChildren();

  for (const optionVersion of section.versions) {
    const option = document.createElement("option");
    option.value = optionVersion.id;
    const suffix = optionVersion.id === section.currentVersion ? " · Actual" : "";
    option.textContent = `${optionVersion.id}${optionVersion.label ? ` · ${optionVersion.label}` : ""}${suffix}`;
    ui.versionSelect.append(option);
  }

  ui.versionSelect.value = version.id;
  ui.versionSelect.disabled = section.versions.length < 2;
  ui.versionNote.hidden = version.id === section.currentVersion;
  if (!ui.versionNote.hidden) {
    ui.versionNote.textContent = version.note
      ? `Versión anterior. ${version.note}`
      : "Estás viendo una versión anterior de esta secuencia.";
  }
  ui.resetVersions.disabled = Object.keys(selectedVersions).length === 0;
}

function showError(message) {
  ui.errorNote.textContent = message;
  ui.errorNote.hidden = false;
}

function showPage(index, animate = true) {
  if (!readingPages.length) return;
  currentIndex = Math.max(0, Math.min(index, readingPages.length - 1));
  const entry = readingPages[currentIndex];
  const { chapter, section, version, page, pageIndex } = entry;

  ui.errorNote.hidden = true;
  ui.topChapter.textContent = chapterTitle(chapter);
  ui.sectionType.textContent = section.kind === "transition" ? "Transición" : "Secuencia";
  ui.sectionTitle.textContent = section.title;
  ui.sectionSubtitle.textContent = `${chapterTitle(chapter)} · ${version.pages.length} ${version.pages.length === 1 ? "lámina" : "láminas"}`;
  ui.sheetLabel.textContent = `${page.label} · ${version.id}`;
  ui.sectionPosition.textContent = `Lámina ${pageIndex + 1} de ${version.pages.length}`;
  ui.overallPosition.textContent = `Página ${currentIndex + 1} de ${readingPages.length}`;
  ui.progressFill.style.width = `${((currentIndex + 1) / readingPages.length) * 100}%`;
  ui.previous.disabled = currentIndex === 0;
  ui.next.disabled = currentIndex === readingPages.length - 1;
  renderVersionSelector(entry);
  renderContents();

  if (ui.zoomDialog.open) ui.zoomDialog.close();
  const request = ++imageRequest;
  ui.imageLoading.hidden = false;
  ui.image.style.visibility = "hidden";
  ui.image.alt = `${chapterTitle(chapter)}, ${section.title}, ${page.label}, versión ${version.id}`;
  ui.image.onload = () => {
    if (request !== imageRequest) return;
    ui.imageLoading.hidden = true;
    ui.image.style.visibility = "visible";
  };
  ui.image.onerror = () => {
    if (request !== imageRequest) return;
    ui.imageLoading.hidden = true;
    showError(`No se pudo abrir ${page.label}. Comprueba la ruta de la imagen en el catálogo.`);
  };
  ui.image.src = new URL(page.image, document.baseURI).href;

  if (animate) {
    ui.book.classList.remove("page-turn");
    void ui.book.offsetWidth;
    ui.book.classList.add("page-turn");
  }
}

function changeVersion(versionId) {
  const entry = readingPages[currentIndex];
  if (!entry) return;
  if (versionId === entry.section.currentVersion) {
    delete selectedVersions[entry.section.id];
  } else {
    selectedVersions[entry.section.id] = versionId;
  }
  rebuildReadingPages();
  showPage(findSectionPage(entry.chapter.id, entry.section.id, entry.pageIndex));
}

function resetVersions() {
  const entry = readingPages[currentIndex];
  selectedVersions = {};
  rebuildReadingPages();
  showPage(findSectionPage(entry.chapter.id, entry.section.id, entry.pageIndex));
}

function setSidebarOpen(open) {
  ui.sidebar.classList.toggle("is-open", open);
  ui.sidebarScrim.hidden = !open;
  ui.openSidebar.setAttribute("aria-expanded", String(open));
}

function updateZoom() {
  ui.zoomImage.style.width = `${Math.round(zoomBaseWidth * zoomScale)}px`;
  ui.zoomLevel.textContent = `${Math.round(zoomScale * 100)} %`;
  ui.zoomOut.disabled = zoomScale <= 0.75;
  ui.zoomIn.disabled = zoomScale >= 3;
}

function openZoom() {
  if (!ui.image.complete || !ui.image.naturalWidth) return;
  const entry = readingPages[currentIndex];
  zoomScale = 1;
  ui.zoomTitle.textContent = `${entry.section.title} · ${entry.page.label} · ${entry.version.id}`;
  ui.zoomImage.src = ui.image.src;
  ui.zoomImage.alt = ui.image.alt;
  const availableWidth = Math.max(300, window.innerWidth * 0.96 - 65);
  const availableHeight = Math.max(220, window.innerHeight * 0.96 - 105);
  zoomBaseWidth = Math.min(ui.image.naturalWidth, availableWidth, availableHeight * ui.image.naturalWidth / ui.image.naturalHeight);
  updateZoom();
  ui.zoomDialog.showModal();
}

async function loadCatalog() {
  try {
    const response = await fetch("./catalogo.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`El catálogo devolvió ${response.status}.`);
    catalog = await response.json();
    if (!Array.isArray(catalog.chapters) || !catalog.chapters.length) {
      throw new Error("El catálogo no contiene capítulos.");
    }
    rebuildReadingPages();
    if (!readingPages.length) throw new Error("El catálogo no contiene láminas.");
    showPage(0, false);
  } catch (error) {
    ui.sectionTitle.textContent = "No se pudo abrir el lector";
    ui.imageLoading.hidden = true;
    showError(`${error.message} Abre el archivo Abrir_Lector_Royal.cmd desde la carpeta del proyecto.`);
  }
}

ui.previous.addEventListener("click", () => showPage(currentIndex - 1));
ui.next.addEventListener("click", () => showPage(currentIndex + 1));
ui.versionSelect.addEventListener("change", (event) => changeVersion(event.target.value));
ui.resetVersions.addEventListener("click", resetVersions);
ui.openSidebar.addEventListener("click", () => setSidebarOpen(true));
ui.closeSidebar.addEventListener("click", () => setSidebarOpen(false));
ui.sidebarScrim.addEventListener("click", () => setSidebarOpen(false));
ui.openZoom.addEventListener("click", openZoom);
ui.closeZoom.addEventListener("click", () => ui.zoomDialog.close());
ui.zoomDialog.addEventListener("click", (event) => {
  if (event.target === ui.zoomDialog) ui.zoomDialog.close();
});
ui.zoomIn.addEventListener("click", () => { zoomScale = Math.min(3, Math.round((zoomScale + 0.25) * 100) / 100); updateZoom(); });
ui.zoomOut.addEventListener("click", () => { zoomScale = Math.max(0.75, Math.round((zoomScale - 0.25) * 100) / 100); updateZoom(); });
ui.fullscreen.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    showError("Este navegador no permite activar la pantalla completa aquí.");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setSidebarOpen(false);
  if (ui.zoomDialog.open || !catalog || event.target instanceof HTMLSelectElement) return;
  if (event.key === "ArrowRight") { event.preventDefault(); showPage(currentIndex + 1); }
  if (event.key === "ArrowLeft") { event.preventDefault(); showPage(currentIndex - 1); }
  if (event.key === "Home") { event.preventDefault(); showPage(0); }
  if (event.key === "End") { event.preventDefault(); showPage(readingPages.length - 1); }
});

ui.book.addEventListener("touchstart", (event) => {
  const touch = event.changedTouches[0];
  swipeStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
ui.book.addEventListener("touchend", (event) => {
  if (!swipeStart || !catalog) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - swipeStart.x;
  const dy = touch.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  showPage(currentIndex + (dx < 0 ? 1 : -1));
}, { passive: true });

loadCatalog();
