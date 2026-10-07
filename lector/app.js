"use strict";

const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries(["sidebar","scrim","contents","resetVersions","toggleSidebar","closeSidebar","chapterTitle","sectionTitle","versionSelect","panelCount","themeToggle","openNotes","noteCount","fullscreen","versionNote","errorNote","readingArea","panelGrid","previousPage","nextPage","pagePosition","zoomDialog","zoomTitle","sourceLink","zoomOut","zoomLevel","zoomIn","closeZoom","zoomScroll","zoomCanvas","zoomImage","zoomPins","notesDialog","closeNotes","notesTitle","addNote","allNotes","notesStatus","notesList","noteDialog","noteTitle","noteForm","noteAuthor","noteBody","noteWebsite","noteFormStatus","cancelNote","cancelNoteBottom","saveNote"].map((id) => [id,$(id)]));
const notesApi = "https://royal-notas-storyboard.alejarkor.chatgpt.site/api/notes";
const asset = (path) => new URL(`../${path}`, document.baseURI).href;
const storedCount = Number(localStorage.getItem("royal.panelCount"));
let panelCount = Number.isInteger(storedCount) && storedCount >= 1 && storedCount <= 24 ? storedCount : 2;
let catalog, pages = [], currentPage = 0, notes = [], entries = [], selectedVersions = {}, noteMode = false, noteTarget = null, zoomPanel = null, zoomScale = 1;

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  ui.themeToggle.textContent = theme === "dark" ? "☀" : "☾";
  ui.themeToggle.setAttribute("aria-label", theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#151820" : "#f5f1e9";
  localStorage.setItem("royal.theme", theme);
}
setTheme(localStorage.getItem("royal.theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
ui.panelCount.value = String(panelCount);

function selectedVersion(section) { return section.versions.find((version) => version.id === (selectedVersions[section.id] || section.currentVersion)); }
function rebuildPages() {
  pages = [];
  for (const chapter of catalog.chapters) for (const section of chapter.sections) {
    const version = selectedVersion(section);
    for (let start = 0; start < version.panels.length; start += panelCount) {
      pages.push({chapter,section,version,start,panels:version.panels.slice(start,start + panelCount)});
    }
  }
}
function findPage(sectionId,panelIndex=0) {
  const index = pages.findIndex((page) => page.section.id === sectionId && panelIndex >= page.start && panelIndex < page.start + page.panels.length);
  return index < 0 ? 0 : index;
}
function setSidebar(open) {
  document.querySelector(".app").classList.toggle("sidebar-hidden",!open);
  ui.toggleSidebar.setAttribute("aria-expanded",String(open));
  ui.scrim.hidden = !open || innerWidth > 900;
  localStorage.setItem("royal.sidebar",open ? "open" : "closed");
}
setSidebar(localStorage.getItem("royal.sidebar") !== "closed" && innerWidth > 900);

function renderContents() {
  ui.contents.replaceChildren();
  for (const chapter of catalog.chapters) {
    const label = document.createElement("p"); label.className="chapter-label"; label.textContent=`Capítulo ${chapter.number} · ${chapter.title}`; ui.contents.append(label);
    chapter.sections.forEach((section,i) => {
      const button=document.createElement("button"); button.type="button"; button.className=`toc${pages[currentPage]?.section.id===section.id ? " active" : ""}`;
      const number=document.createElement("span"); number.textContent=String(i+1).padStart(2,"0");
      const title=document.createElement("span"); title.textContent=section.title;
      const count=document.createElement("small"); count.textContent=String(selectedVersion(section).panels.length);
      button.append(number,title,count); button.addEventListener("click",()=>{showPage(findPage(section.id));if(innerWidth<=900)setSidebar(false);}); ui.contents.append(button);
    });
  }
  ui.resetVersions.disabled=Object.keys(selectedVersions).length===0;
}
function renderVersion(page) {
  ui.versionSelect.replaceChildren();
  for(const version of page.section.versions){const option=document.createElement("option");option.value=version.id;option.textContent=`${version.id}${version.id===page.section.currentVersion ? " · Actual" : version.label ? ` · ${version.label}` : ""}`;ui.versionSelect.append(option);}
  ui.versionSelect.value=page.version.id;ui.versionSelect.disabled=page.section.versions.length<2;
  ui.versionNote.hidden=page.version.id===page.section.currentVersion;
  ui.versionNote.textContent=page.version.note || "Estás viendo una versión anterior de esta secuencia.";
}
function mappedNote(note) {
  const direct=entries.find((entry)=>entry.panel.id===note.image);
  if(direct)return {...direct,note,x:note.x,y:note.y};
  for(const entry of entries){const source=entry.panel.source;if(!source||source.sheet!==note.image)continue;
    const [left,top,width,height]=source.rect,[sheetWidth,sheetHeight]=source.size;
    const px=note.x*sheetWidth/10000,py=note.y*sheetHeight/10000;
    if(px>=left&&px<=left+width&&py>=top&&py<=top+height)return {...entry,note,x:Math.round((px-left)/width*10000),y:Math.round((py-top)/height*10000)};
  }
  return null;
}
function notesFor(panel) {return notes.map(mappedNote).filter((mapped)=>mapped?.panel.id===panel.id);}
function imageArea(image){const rect=image.getBoundingClientRect();const ratio=image.naturalWidth/image.naturalHeight;if(!ratio)return null;const width=Math.min(rect.width,rect.height*ratio),height=width/ratio;return {left:rect.left+(rect.width-width)/2,top:rect.top+(rect.height-height)/2,width,height};}
function pointOnImage(event,image){const area=imageArea(image);if(!area)return null;const x=(event.clientX-area.left)/area.width,y=(event.clientY-area.top)/area.height;return x<0||x>1||y<0||y>1?null:{x:Math.round(x*10000),y:Math.round(y*10000)};}
function drawPins(container,image,panel){container.replaceChildren();const area=imageArea(image);if(!area)return;const parent=container.getBoundingClientRect();for(const [index,mapped] of notesFor(panel).entries()){const pin=document.createElement("button");pin.type="button";pin.className="pin";pin.textContent=String(index+1);pin.title=`${mapped.note.author}: ${mapped.note.body}`;pin.style.left=`${area.left-parent.left+mapped.x/10000*area.width}px`;pin.style.top=`${area.top-parent.top+mapped.y/10000*area.height}px`;pin.addEventListener("click",(event)=>{event.stopPropagation();ui.allNotes.checked=false;renderNotes(panel.id);ui.notesDialog.showModal();});container.append(pin);}}
function renderVisiblePins(){for(const art of ui.panelGrid.querySelectorAll(".panel-art")){const panel=entries.find((entry)=>entry.panel.id===art.dataset.panelId)?.panel;if(panel)drawPins(art.querySelector(".pin-layer"),art.querySelector("img"),panel);}if(ui.zoomDialog.open&&zoomPanel)drawPins(ui.zoomPins,ui.zoomImage,zoomPanel);}
function renderPanels(page){ui.panelGrid.replaceChildren();ui.panelGrid.dataset.count=String(panelCount);ui.panelGrid.style.setProperty("--columns",String(panelCount===1?1:panelCount<=4?2:panelCount<=12?3:4));
  for(const panel of page.panels){const figure=document.createElement("figure");figure.className="panel";const art=document.createElement("div");art.className=`panel-art${noteMode?" note-mode":""}`;art.dataset.panelId=panel.id;
    const image=document.createElement("img");image.src=asset(panel.image);image.alt=`${panel.shotId}: ${panel.title}`;image.loading="eager";image.decoding="async";image.addEventListener("load",renderVisiblePins);image.addEventListener("error",()=>{ui.errorNote.hidden=false;ui.errorNote.textContent=`No se pudo abrir ${panel.shotId}.`;});
    const pins=document.createElement("div");pins.className="pin-layer";art.append(image,pins);
    art.addEventListener("click",(event)=>{if(noteMode){const point=pointOnImage(event,image);if(point)beginNote(panel,point);}else openZoom(panel,image);});
    const caption=document.createElement("figcaption");caption.className="panel-meta";
    const heading=document.createElement("div");heading.className="panel-heading";const id=document.createElement("strong");id.textContent=panel.shotId;const title=document.createElement("span");title.textContent=panel.title;heading.append(id,title);caption.append(heading);
    const description=document.createElement("p");description.className="panel-description";description.textContent=panel.description||"Descripción pendiente de transcripción.";caption.append(description);
    if(panel.context){const context=document.createElement("p");context.className="panel-context";const label=document.createElement("strong");label.textContent=`${panel.contextLabel||"Función"}: `;context.append(label,document.createTextNode(panel.context));caption.append(context);}
    figure.append(art,caption);ui.panelGrid.append(figure);
  }
}
function showPage(index){if(!pages.length)return;currentPage=Math.max(0,Math.min(index,pages.length-1));const page=pages[currentPage];ui.chapterTitle.textContent=`Capítulo ${page.chapter.number} · ${page.chapter.title}`;ui.sectionTitle.textContent=page.section.title;ui.pagePosition.textContent=`Página ${currentPage+1} de ${pages.length} · ${page.start+1}–${page.start+page.panels.length} de ${page.version.panels.length}`;ui.previousPage.disabled=currentPage===0;ui.nextPage.disabled=currentPage===pages.length-1;renderVersion(page);renderContents();renderPanels(page);ui.noteCount.textContent=String(page.panels.reduce((sum,panel)=>sum+notesFor(panel).length,0));window.scrollTo({top:0});}
function setNoteMode(enabled){noteMode=enabled;ui.addNote.classList.toggle("active",enabled);ui.addNote.textContent=enabled?"Cancelar nota":"Añadir nota";for(const art of ui.panelGrid.querySelectorAll(".panel-art"))art.classList.toggle("note-mode",enabled);}
function beginNote(panel,point){noteTarget={panel,point};ui.noteTitle.textContent=`Nueva nota · ${panel.shotId}`;ui.noteFormStatus.textContent="";if(ui.zoomDialog.open)ui.zoomDialog.close();if(ui.notesDialog.open)ui.notesDialog.close();ui.noteDialog.showModal();ui.noteBody.focus();}
function openZoom(panel,image){zoomPanel=panel;zoomScale=1;ui.zoomTitle.textContent=`${panel.shotId} · ${panel.title}`;ui.zoomImage.src=image.src;ui.zoomImage.alt=image.alt;ui.sourceLink.href=asset(panel.source.sheet);ui.sourceLink.hidden=!panel.source;ui.zoomDialog.showModal();ui.zoomImage.onload=()=>{updateZoom();renderVisiblePins();};if(ui.zoomImage.complete)updateZoom();}
function updateZoom(){if(!zoomPanel)return;const width=zoomPanel.source?.rect[2]||ui.zoomImage.naturalWidth||800;ui.zoomCanvas.style.width=`${Math.max(200,Math.min(width,innerWidth*.88))*zoomScale}px`;ui.zoomLevel.textContent=`${Math.round(zoomScale*100)} %`;ui.zoomOut.disabled=zoomScale<=.75;ui.zoomIn.disabled=zoomScale>=3;requestAnimationFrame(renderVisiblePins);}
function noteDate(note){return new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short"}).format(note.created_at);}
function navigateToNote(mapped){if(!mapped)return;selectedVersions[mapped.section.id]=mapped.version.id===mapped.section.currentVersion?undefined:mapped.version.id;if(!selectedVersions[mapped.section.id])delete selectedVersions[mapped.section.id];rebuildPages();showPage(findPage(mapped.section.id,mapped.index));ui.notesDialog.close();}
function renderNotes(panelId=null){ui.notesList.replaceChildren();const visibleIds=new Set(pages[currentPage]?.panels.map((panel)=>panel.id)||[]);const mapped=notes.map(mappedNote).filter((item)=>item&&(ui.allNotes.checked||(panelId?item.panel.id===panelId:visibleIds.has(item.panel.id))));ui.notesTitle.textContent=ui.allNotes.checked?`Todas las notas (${mapped.length})`:panelId?`Notas de ${entries.find((entry)=>entry.panel.id===panelId)?.panel.shotId||"viñeta"}`:`Notas de esta página`;
  if(!mapped.length){const empty=document.createElement("p");empty.className="status";empty.textContent="Todavía no hay notas aquí.";ui.notesList.append(empty);return;}
  for(const item of mapped){const button=document.createElement("button");button.className="note-item";button.type="button";const head=document.createElement("strong");head.textContent=`${item.panel.shotId} · ${item.note.author}`;const body=document.createElement("p");body.textContent=item.note.body;const date=document.createElement("small");date.textContent=noteDate(item.note);button.append(head,body,date);button.addEventListener("click",()=>navigateToNote(item));ui.notesList.append(button);}
}
async function loadNotes(){ui.notesStatus.textContent="Cargando notas…";try{const loaded=[];let more=true;while(more){const response=await fetch(`${notesApi}?offset=${loaded.length}`,{cache:"no-store"});if(!response.ok)throw Error();const data=await response.json();loaded.push(...data.notes);more=data.hasMore===true&&data.notes.length>0;}notes=loaded;ui.notesStatus.textContent="";renderVisiblePins();if(pages.length)showPage(currentPage);if(ui.notesDialog.open)renderNotes();}catch{ui.notesStatus.textContent="No se pudieron cargar las notas. Inténtalo de nuevo.";}}
async function loadCatalog(){try{const response=await fetch("./catalogo.json",{cache:"no-store"});if(!response.ok)throw Error(`Catálogo: ${response.status}`);catalog=await response.json();if(catalog.schemaVersion!==2)throw Error("Versión de catálogo incompatible.");
    for(const chapter of catalog.chapters)for(const section of chapter.sections)for(const version of section.versions){const file=await fetch(asset(version.manifest),{cache:"no-store"});if(!file.ok)throw Error(`Falta ${version.manifest}`);const manifest=await file.json();version.panels=manifest.panels;version.panels.forEach((panel,index)=>entries.push({chapter,section,version,panel,index}));}
    rebuildPages();showPage(0);loadNotes();
  }catch(error){ui.sectionTitle.textContent="No se pudo abrir el lector";ui.errorNote.hidden=false;ui.errorNote.textContent=`${error.message} Abre Abrir_Lector_Royal.cmd desde la carpeta del proyecto.`;}}

ui.toggleSidebar.addEventListener("click",()=>setSidebar(document.querySelector(".app").classList.contains("sidebar-hidden")));ui.closeSidebar.addEventListener("click",()=>setSidebar(false));ui.scrim.addEventListener("click",()=>setSidebar(false));
ui.previousPage.addEventListener("click",()=>showPage(currentPage-1));ui.nextPage.addEventListener("click",()=>showPage(currentPage+1));
function updatePanelCount(normalize=false){
  if(ui.panelCount.value===""){if(normalize)ui.panelCount.value=String(panelCount);return;}
  const requested=Number(ui.panelCount.value);
  if(!Number.isFinite(requested)){if(normalize)ui.panelCount.value=String(panelCount);return;}
  const next=Math.max(1,Math.min(24,Math.round(requested)));
  if(normalize)ui.panelCount.value=String(next);
  if(next===panelCount)return;
  const page=pages[currentPage];panelCount=next;localStorage.setItem("royal.panelCount",String(panelCount));rebuildPages();showPage(findPage(page.section.id,page.start));
}
ui.panelCount.addEventListener("input",()=>updatePanelCount());
ui.panelCount.addEventListener("change",()=>updatePanelCount(true));
ui.versionSelect.addEventListener("change",()=>{const page=pages[currentPage];selectedVersions[page.section.id]=ui.versionSelect.value===page.section.currentVersion?undefined:ui.versionSelect.value;if(!selectedVersions[page.section.id])delete selectedVersions[page.section.id];rebuildPages();showPage(findPage(page.section.id,Math.min(page.start,selectedVersion(page.section).panels.length-1)));});
ui.resetVersions.addEventListener("click",()=>{const page=pages[currentPage];selectedVersions={};rebuildPages();showPage(findPage(page.section.id,Math.min(page.start,selectedVersion(page.section).panels.length-1)));});
ui.themeToggle.addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
ui.fullscreen.addEventListener("click",async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{ui.errorNote.hidden=false;ui.errorNote.textContent="No se pudo activar la pantalla completa.";}});
ui.openNotes.addEventListener("click",()=>{ui.allNotes.checked=false;renderNotes();ui.notesDialog.showModal();loadNotes();});ui.closeNotes.addEventListener("click",()=>ui.notesDialog.close());ui.allNotes.addEventListener("change",()=>renderNotes());
ui.addNote.addEventListener("click",()=>{setNoteMode(!noteMode);ui.notesDialog.close();});
ui.closeZoom.addEventListener("click",()=>ui.zoomDialog.close());ui.zoomDialog.addEventListener("click",(event)=>{if(event.target===ui.zoomDialog)ui.zoomDialog.close();});
ui.zoomIn.addEventListener("click",()=>{zoomScale=Math.min(3,zoomScale+.25);updateZoom();});ui.zoomOut.addEventListener("click",()=>{zoomScale=Math.max(.75,zoomScale-.25);updateZoom();});
ui.zoomCanvas.addEventListener("click",(event)=>{if(!noteMode||!zoomPanel)return;const point=pointOnImage(event,ui.zoomImage);if(point)beginNote(zoomPanel,point);});
ui.cancelNote.addEventListener("click",()=>ui.noteDialog.close());ui.cancelNoteBottom.addEventListener("click",()=>ui.noteDialog.close());
ui.noteForm.addEventListener("submit",async(event)=>{event.preventDefault();if(!noteTarget)return;ui.saveNote.disabled=true;ui.noteFormStatus.textContent="Guardando…";try{const response=await fetch(notesApi,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:noteTarget.panel.id,...noteTarget.point,author:ui.noteAuthor.value,body:ui.noteBody.value,website:ui.noteWebsite.value})});const data=await response.json();if(!response.ok)throw Error(data.error||"No se pudo guardar.");notes.unshift(data.note);ui.noteBody.value="";ui.noteDialog.close();setNoteMode(false);showPage(currentPage);}catch(error){ui.noteFormStatus.textContent=error.message;}finally{ui.saveNote.disabled=false;}});
window.addEventListener("resize",()=>{if(innerWidth<=900&&!document.querySelector(".app").classList.contains("sidebar-hidden"))setSidebar(false);if(innerWidth>900)ui.scrim.hidden=true;renderVisiblePins();});
document.addEventListener("keydown",(event)=>{if(event.key==="Escape")setSidebar(false);if(!catalog||ui.zoomDialog.open||ui.notesDialog.open||ui.noteDialog.open||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;if(event.key==="ArrowRight"){event.preventDefault();showPage(currentPage+1);}if(event.key==="ArrowLeft"){event.preventDefault();showPage(currentPage-1);}});
let swipe=null;ui.readingArea.addEventListener("touchstart",(event)=>{const touch=event.changedTouches[0];swipe={x:touch.clientX,y:touch.clientY};},{passive:true});ui.readingArea.addEventListener("touchend",(event)=>{if(!swipe)return;const touch=event.changedTouches[0],dx=touch.clientX-swipe.x,dy=touch.clientY-swipe.y;swipe=null;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.5)showPage(currentPage+(dx<0?1:-1));},{passive:true});
loadCatalog();
