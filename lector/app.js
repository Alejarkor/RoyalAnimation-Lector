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
  closeZoom: document.getElementById("closeZoom"),
  sheetPins: document.getElementById("sheetPins"),
  zoomPins: document.getElementById("zoomPins"),
  zoomCanvas: document.getElementById("zoomCanvas"),
  addNote: document.getElementById("addNote"),
  viewAllNotes: document.getElementById("viewAllNotes"),
  notesHelp: document.getElementById("notesHelp"),
  notesStatus: document.getElementById("notesStatus"),
  noteCount: document.getElementById("noteCount"),
  noteList: document.getElementById("noteList"),
  noteDialog: document.getElementById("noteDialog"),
  noteForm: document.getElementById("noteForm"),
  noteAuthor: document.getElementById("noteAuthor"),
  noteBody: document.getElementById("noteBody"),
  noteWebsite: document.getElementById("noteWebsite"),
  noteFormStatus: document.getElementById("noteFormStatus"),
  saveNote: document.getElementById("saveNote"),
  cancelNote: document.getElementById("cancelNote"),
  cancelNoteBottom: document.getElementById("cancelNoteBottom"),
  allNotesDialog: document.getElementById("allNotesDialog"),
  allNotesList: document.getElementById("allNotesList"),
  closeAllNotes: document.getElementById("closeAllNotes")
};

const notesApi = "https://royal-notas-storyboard.alejarkor.chatgpt.site/api/notes";
let notes = [];
let noteMode = false;
let notePosition = null;

function imageKey(entry) {
  return entry.page.image.replace(/^\.\.\//, "");
}

function noteDate(note) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(note.created_at);
}

function imageArea(image) {
  const rect = image.getBoundingClientRect();
  const ratio = image.naturalWidth / image.naturalHeight;
  const width = Math.min(rect.width, rect.height * ratio);
  const height = width / ratio;
  return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height };
}

function pointOnImage(event, image) {
  const area = imageArea(image);
  const x = (event.clientX - area.left) / area.width;
  const y = (event.clientY - area.top) / area.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: Math.round(x * 10000), y: Math.round(y * 10000) };
}

function renderPins() {
  ui.sheetPins.replaceChildren();
  ui.zoomPins.replaceChildren();
  const entry = readingPages[currentIndex];
  if (!entry || !ui.image.naturalWidth) return;
  const pageNotes = notes.filter((note) => note.image === imageKey(entry));
  const area = imageArea(ui.image);
  const parent = ui.openZoom.getBoundingClientRect();
  ui.sheetPins.style.left = `${area.left - parent.left}px`;
  ui.sheetPins.style.top = `${area.top - parent.top}px`;
  ui.sheetPins.style.width = `${area.width}px`;
  ui.sheetPins.style.height = `${area.height}px`;
  for (const [index, note] of pageNotes.entries()) {
    for (const layer of [ui.sheetPins, ui.zoomPins]) {
      const pin = document.createElement("span");
      pin.className = "note-pin";
      pin.style.left = `${note.x / 100}%`;
      pin.style.top = `${note.y / 100}%`;
      pin.textContent = String(index + 1);
      pin.title = `${note.author}: ${note.body}`;
      layer.append(pin);
    }
  }
}

function renderNotes() {
  const entry = readingPages[currentIndex];
  if (!entry) return;
  const pageNotes = notes.filter((note) => note.image === imageKey(entry));
  ui.noteCount.textContent = String(pageNotes.length);
  ui.noteList.replaceChildren();
  if (!pageNotes.length) {
    const empty = document.createElement("p");
    empty.className = "notes-empty";
    empty.textContent = "Todavía no hay notas en esta lámina.";
    ui.noteList.append(empty);
  }
  for (const [index, note] of pageNotes.entries()) {
    const card = document.createElement("article");
    card.className = "note-card";
    const marker = document.createElement("span");
    marker.className = "note-card-marker";
    marker.textContent = String(index + 1);
    const content = document.createElement("div");
    const meta = document.createElement("strong");
    meta.textContent = `${note.author} · ${noteDate(note)}`;
    const body = document.createElement("p");
    body.textContent = note.body;
    content.append(meta, body);
    card.append(marker, content);
    ui.noteList.append(card);
  }
  renderPins();
}

async function loadNotes() {
  ui.notesStatus.textContent = "Cargando notas…";
  try {
    const loaded = [];
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(`${notesApi}?offset=${loaded.length}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!Array.isArray(data.notes)) throw new Error();
      loaded.push(...data.notes);
      hasMore = data.hasMore === true && data.notes.length > 0;
    }
    notes = loaded;
    ui.notesStatus.textContent = "";
    renderNotes();
  } catch {
    ui.notesStatus.textContent = "No se pudieron cargar las notas. Pulsa «Ver todas» para reintentarlo.";
  }
}

function setNoteMode(enabled) {
  noteMode = enabled;
  ui.addNote.classList.toggle("is-active", enabled);
  ui.addNote.textContent = enabled ? "Cancelar nota" : "Añadir nota";
  ui.openZoom.classList.toggle("is-note-mode", enabled);
  ui.notesHelp.textContent = enabled
    ? "Toca la imagen en el punto que quieras comentar."
    : "Pulsa «Añadir nota» y después toca el punto de la imagen que quieras comentar. No hace falta registrarse.";
}

function startNote(event, image) {
  if (!noteMode) return false;
  const point = pointOnImage(event, image);
  if (!point) return true;
  notePosition = point;
  ui.noteFormStatus.textContent = "";
  if (ui.zoomDialog.open) ui.zoomDialog.close();
  ui.noteDialog.showModal();
  ui.noteBody.focus();
  return true;
}

function navigateToNote(note) {
  for (const chapter of catalog.chapters) {
    for (const section of chapter.sections) {
      for (const version of section.versions) {
        const pageIndex = version.pages.findIndex((page) => page.image.replace(/^\.\.\//, "") === note.image);
        if (pageIndex < 0) continue;
        if (version.id === section.currentVersion) delete selectedVersions[section.id];
        else selectedVersions[section.id] = version.id;
        rebuildReadingPages();
        showPage(findSectionPage(chapter.id, section.id, pageIndex));
        ui.allNotesDialog.close();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
  }
}

function renderAllNotes() {
  ui.allNotesList.replaceChildren();
  if (!notes.length) {
    const empty = document.createElement("p");
    empty.className = "notes-empty";
    empty.textContent = "Todavía no hay notas.";
    ui.allNotesList.append(empty);
  }
  for (const note of notes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "all-note";
    const name = document.createElement("strong");
    name.textContent = `${note.image.split("/").pop()} · ${note.author}`;
    const body = document.createElement("span");
    body.textContent = note.body;
    const date = document.createElement("small");
    date.textContent = noteDate(note);
    button.append(name, body, date);
    button.addEventListener("click", () => navigateToNote(note));
    ui.allNotesList.append(button);
  }
}

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
    renderPins();
  };
  ui.image.onerror = () => {
    if (request !== imageRequest) return;
    ui.imageLoading.hidden = true;
    showError(`No se pudo abrir ${page.label}. Comprueba la ruta de la imagen en el catálogo.`);
  };
  ui.image.src = new URL(page.image, document.baseURI).href;
  ui.sheetPins.replaceChildren();
  renderNotes();
  setNoteMode(false);

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
  ui.zoomCanvas.style.width = ui.zoomImage.style.width;
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
  renderPins();
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
    loadNotes();
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
ui.openZoom.addEventListener("click", (event) => {
  if (startNote(event, ui.image)) return;
  openZoom();
});
ui.zoomCanvas.addEventListener("click", (event) => startNote(event, ui.zoomImage));
ui.addNote.addEventListener("click", () => setNoteMode(!noteMode));
ui.viewAllNotes.addEventListener("click", async () => {
  await loadNotes();
  renderAllNotes();
  ui.allNotesDialog.showModal();
});
ui.closeAllNotes.addEventListener("click", () => ui.allNotesDialog.close());
ui.cancelNote.addEventListener("click", () => ui.noteDialog.close());
ui.cancelNoteBottom.addEventListener("click", () => ui.noteDialog.close());
ui.noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const entry = readingPages[currentIndex];
  if (!entry || !notePosition) return;
  ui.saveNote.disabled = true;
  ui.noteFormStatus.textContent = "Guardando…";
  try {
    const response = await fetch(notesApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageKey(entry), ...notePosition, author: ui.noteAuthor.value, body: ui.noteBody.value, website: ui.noteWebsite.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo guardar la nota.");
    notes.unshift(data.note);
    ui.noteBody.value = "";
    ui.noteDialog.close();
    ui.notesStatus.textContent = "Nota guardada. Ya se puede ver desde otros dispositivos.";
    setNoteMode(false);
    renderNotes();
  } catch (error) {
    ui.noteFormStatus.textContent = error.message || "No se pudo guardar. Vuelve a intentarlo.";
  } finally {
    ui.saveNote.disabled = false;
  }
});
window.addEventListener("resize", () => renderPins());
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
  if (ui.zoomDialog.open || ui.noteDialog.open || ui.allNotesDialog.open || !catalog ||
      event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement) return;
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
