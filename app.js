"use strict";

const API = "https://openrouter.ai/api/v1";
const KEY_STORAGE = "cavaliermax-openrouter-api-key-v1";
const labels = { accuracy:"Accuratezza", speed:"Velocità", reliability:"Affidabilità", reasoning:"Ragionamento", code:"Codice", creative:"Creatività", overall:"Totale" };
const benchmarkKeys = ["accuracy", "speed", "reliability", "reasoning", "code", "creative", "overall"];
let models = [];
let selected = [];
let sortKey = "name";
let sortDirection = 1;
let sessionCalls = 0;
let sessionLatencies = [];
let sessionCost = null;
let page = 1;
const sessionLatencyByModel = new Map();

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"}[char]));
const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const pricePerMillion = (value) => { const n = numeric(value); return n === null ? null : n * 1_000_000; };
const priceText = (value) => value === null ? "—" : `$${value < .01 ? value.toFixed(4) : value.toFixed(2)}`;

function browserStorage() { return typeof localStorage === "undefined" ? null : localStorage; }
function updateKeyPersistence() {
  let saved = false;
  try { saved = Boolean(browserStorage()?.getItem(KEY_STORAGE)); } catch (_) { /* storage disabilitato */ }
  $("#keyPersistenceBadge").textContent = saved ? "● chiave salvata nel browser" : "● chiave non salvata";
}
function restoreSavedKey() {
  try {
    const saved = browserStorage()?.getItem(KEY_STORAGE);
    if (saved) { $("#apiKey").value = saved; $("#rememberKey").checked = true; }
  } catch (_) { /* Browser storage non disponibile: la chiave resta solo in memoria. */ }
  updateKeyPersistence();
}
function saveOrForgetKey() {
  try {
    const storage = browserStorage();
    if (!storage) throw new Error("storage non disponibile");
    if ($("#rememberKey").checked && $("#apiKey").value.trim()) storage.setItem(KEY_STORAGE, $("#apiKey").value.trim());
    else storage.removeItem(KEY_STORAGE);
  } catch (_) { alert("Il browser non consente di salvare la chiave in questo profilo."); }
  updateKeyPersistence();
}

function normalize(raw) {
  const pricing = raw.pricing || {};
  const name = raw.name || raw.id, haystack = `${raw.id} ${name} ${raw.description || ""}`.toLowerCase();
  const family = (haystack.match(/llama|qwen|mistral|deepseek|hermes|gemma|gpt|claude|dolphin|nemotron|command|phi/) || ["Altro"])[0];
  const architecture = raw.architecture || {}, supported = raw.supported_parameters || [];
  const capabilities = [...new Set([...(architecture.input_modalities || []), ...(architecture.output_modalities || []), ...(supported.includes("tools") ? ["tool calling"] : []), ...(supported.some(x=>/response_format|json/i.test(x)) ? ["JSON strutturato"] : []), ...(supported.some(x=>/reasoning/i.test(x)) ? ["reasoning"] : [])])];
  const parameterMatch = name.match(/\b(\d+(?:\.\d+)?)\s*([BM])\b/i);
  const parameterBillions=parameterMatch ? Number(parameterMatch[1])*(parameterMatch[2].toUpperCase()==="M"?.001:1) : null;
  return { id:raw.id, name, provider:raw.top_provider?.name || raw.provider?.name || raw.id.split("/")[0], version:raw.id, description:raw.description || "", created:numeric(raw.created), context:numeric(raw.context_length), maxOutput:numeric(raw.top_provider?.max_completion_tokens ?? raw.max_completion_tokens), input:pricePerMillion(pricing.prompt), output:pricePerMillion(pricing.completion), family:family[0].replace(/^./,c=>c.toUpperCase()), capabilities, parameterSize:parameterMatch ? `${parameterMatch[1]}${parameterMatch[2].toUpperCase()}` : null, parameterBillions, free:pricing.prompt === "0" && pricing.completion === "0", uncensored:/uncensored|unfiltered|abliterated|de.?aligned|dolphin|euryale|mythomax|rocinante/.test(haystack), benchmark:null };
}
function filtered() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const provider = $("#providerFilter").value, family=$("#familyFilter").value, size=$("#sizeFilter").value, capability=$("#capabilityFilter").value;
  const priceType=$("#priceTypeFilter").value, newness=Number($("#newnessFilter").value), minContext=Number($("#contextFilter").value), minOutput=Number($("#outputFilter").value), availability=$("#availabilityFilter").value, latency=$("#latencyFilter").value, uncensored=$("#uncensoredFilter").checked;
  const maxRate=Math.max(...models.map(model=>Math.max(model.input||0,model.output||0)),0), ceiling=maxRate*(Number($("#costFilter").value)/100), now=Date.now()/1000;
  return models.filter(model => {
    const rate=Math.max(model.input||0,model.output||0), measured=sessionLatencyByModel.get(model.id);
    const sizeMatches=size === "all" || (size === "known" && model.parameterBillions !== null) || (size === "small" && model.parameterBillions !== null && model.parameterBillions<10) || (size === "medium" && model.parameterBillions !== null && model.parameterBillions>=10 && model.parameterBillions<70) || (size === "large" && model.parameterBillions !== null && model.parameterBillions>=70);
    return (!query || `${model.name} ${model.provider} ${model.id} ${model.description}`.toLowerCase().includes(query)) && (provider === "all" || model.provider === provider) && (family === "all" || model.family === family) && sizeMatches && (capability === "all" || model.capabilities.includes(capability)) && (priceType === "all" || (priceType === "free" && model.free) || (priceType === "paid" && !model.free)) && (!newness || (model.created && now-model.created <= newness*86400)) && (model.context||0)>=minContext && (model.maxOutput||0)>=minOutput && (availability === "all" || (availability === "pinned" && selected.includes(model.id)) || (availability === "unfixed" && !selected.includes(model.id))) && (!uncensored || model.uncensored) && (rate<=ceiling || !maxRate) && (latency === "all" || (latency === "measured" && measured !== undefined) || (latency === "fast" && measured !== undefined && measured<1) || (latency === "medium" && measured !== undefined && measured<3));
  }).sort((a,b) => {
    const field = sortKey === "name" ? "name" : sortKey === "context" ? "context" : sortKey === "input" ? "input" : "output";
    return sortDirection * String(a[field] ?? "").localeCompare(String(b[field] ?? ""), undefined, {numeric:true});
  });
}
function renderProviders() {
  const populate=(id,label,values)=>{const select=$(id),keep=select.value;select.innerHTML=`<option value="all">${label}</option>`;values.sort().forEach(value=>select.insertAdjacentHTML("beforeend",`<option value="${esc(value)}">${esc(value)}</option>`));select.value=[...select.options].some(option=>option.value===keep)?keep:"all";};
  populate("#providerFilter","Tutte le organizzazioni",[...new Set(models.map(model=>model.provider))]);
  populate("#familyFilter","Tutte le famiglie",[...new Set(models.map(model=>model.family))]);
  populate("#capabilityFilter","Tutte le capacità",[...new Set(models.flatMap(model=>model.capabilities))]);
  renderCostFilter();
}
function renderCostFilter(){const max=Math.max(...models.map(model=>Math.max(model.input||0,model.output||0)),0),value=max*(Number($("#costFilter").value)/100),tokens=Math.ceil($("#promptInput").value.trim().length/4),targets=models.filter(model=>selected.includes(model.id));const estimate=targets.length&&tokens?targets.reduce((sum,model)=>sum+(model.input||0)*tokens/1_000_000,0):null;$("#costFilterValue").textContent=models.length?`max ${priceText(value)} / M${estimate!==null?` · prompt ≈ ${priceText(estimate)}`:""}`:"Carica catalogo";}
function renderPodium() {
  $("#podium").innerHTML = `<article class="leader is-first"><span class="leader-rank">Catalogo live</span><h3>${models.length ? `${models.length} modelli disponibili` : "Carica il catalogo OpenRouter"}</h3><p>I leader comparativi appariranno solo dopo benchmark reali e ripetibili.</p></article>`;
}
function sortHead(key, title) { return `<th><button data-sort="${key}">${title} ${sortKey === key ? (sortDirection === 1 ? "↑" : "↓") : "↕"}</button></th>`; }
function renderTable() {
  const current = filtered();
  const size=Number($("#pageSize").value), pages=Math.max(1,Math.ceil(current.length/size)); page=Math.min(page,pages); const slice=current.slice((page-1)*size,page*size);
  $("#modelCount").textContent = String(current.length).padStart(2,"0");
  $("#modelMeta").textContent = current.length ? "catalogo OpenRouter live" : "in attesa di caricamento";
  $("#benchmarkTable thead").innerHTML = `<tr><th>Modello</th>${sortHead("context","Contesto")}${sortHead("input","Input / M")}${sortHead("output","Output / M")}${benchmarkKeys.map(key=>`<th>${labels[key]}</th>`).join("")}</tr>`;
  $("#benchmarkTable tbody").innerHTML = slice.map(model => `<tr><td><div class="model-cell"><button class="pin ${selected.includes(model.id) ? "selected" : ""}" data-pin="${esc(model.id)}" aria-label="Fissa ${esc(model.name)}">${selected.includes(model.id) ? "✓" : "+"}</button><span><span class="model-name">${esc(model.name)}</span><span class="provider">${esc(model.provider)} · ${esc(model.version)}${model.parameterSize?` · ${model.parameterSize}`:""}</span></span></div></td><td class="metric-cell"><span class="metric-value">${model.context ? `${Math.round(model.context / 1000)}k` : "—"}</span></td><td class="metric-cell"><span class="metric-value">${priceText(model.input)}</span></td><td class="metric-cell"><span class="metric-value">${priceText(model.output)}</span></td>${benchmarkKeys.map(()=>`<td class="metric-cell"><span class="metric-value">N/D</span><span class="delta">non misurato</span></td>`).join("")}</tr>`).join("") || `<tr><td colspan="11">Carica il catalogo OpenRouter oppure modifica i filtri.</td></tr>`;
  $("#pagination").innerHTML=`<span>${current.length?`${(page-1)*size+1}–${Math.min(page*size,current.length)} di ${current.length}`:"0 risultati"}</span><button data-page="prev" ${page===1?"disabled":""}>←</button><span>Pagina ${page}/${pages}</span><button data-page="next" ${page===pages?"disabled":""}>→</button>`;
  document.querySelectorAll("[data-pin]").forEach(button => button.addEventListener("click", () => toggle(button.dataset.pin)));
  document.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => { const key = button.dataset.sort; sortDirection = sortKey === key ? -sortDirection : 1; sortKey = key; renderAll(); }));
  document.querySelectorAll("[data-page]").forEach(button=>button.addEventListener("click",()=>{page+=button.dataset.page==="next"?1:-1;renderAll()}));
}
function toggle(id) { if (selected.includes(id)) selected = selected.filter(value => value !== id); else if (selected.length < 4) selected.push(id); else { alert("Puoi fissare al massimo quattro modelli."); return; } renderAll(); }
function renderInsights() { $("#insightList").innerHTML = `<article class="insight"><strong>Catalogo OpenRouter live</strong><span>${models.length} modelli caricati: nomi, provider, contesto e prezzi sono dati reali.</span></article><article class="insight lime"><strong>${selected.length}/4 modelli fissati</strong><span>Pronti per il confronto GODMODE.</span></article><article class="insight cyan"><strong>Benchmark non inventati</strong><span>Qualità, ragionamento e trend restano N/D finché non verranno misurati.</span></article>`; }
function placeholder(id, message) { $(id).innerHTML = `<div class="empty-chart"><strong>Seleziona modelli dal catalogo</strong><span>${esc(message)}</span></div>`; }
function svg(inner, label) { return `<svg viewBox="0 0 320 220" role="img" aria-label="${esc(label)}">${inner}</svg>`; }
function renderCharts() {
  const pinned=models.filter(model=>selected.includes(model.id)); const base=pinned.length?pinned:filtered().slice(0,4);
  const maxContext=Math.max(...base.map(m=>m.context||0),1), maxPrice=Math.max(...base.map(m=>m.output??m.input??0),.01), colors=["#8b7cff","#5bd4e8","#b6e85f","#e8c271"];
  const cx=160,cy=108,r=72,dimensions=["Accuratezza","Velocità","Costo","Affidabilità","Ragionamento","Codice","Creatività"],angles=dimensions.map((_,i)=>-Math.PI/2+(Math.PI*2*i/dimensions.length)); let radar="";
  [.25,.5,.75,1].forEach(level=>{const points=angles.map(angle=>`${cx+Math.cos(angle)*r*level},${cy+Math.sin(angle)*r*level}`).join(" ");radar+=`<polygon class="live-grid" fill="none" points="${points}"/>`;});
  dimensions.forEach((dimension,i)=>{const x=cx+Math.cos(angles[i])*r,y=cy+Math.sin(angles[i])*r,tx=cx+Math.cos(angles[i])*r*1.23,ty=cy+Math.sin(angles[i])*r*1.23+3;radar+=`<line class="live-grid" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text class="live-label" text-anchor="middle" x="${tx}" y="${ty}">${dimension}</text>`;});
  radar+=`<circle cx="${cx}" cy="${cy}" r="18" fill="rgba(139,124,255,.08)" stroke="rgba(139,124,255,.42)"/><text class="live-axis" text-anchor="middle" x="${cx}" y="${cy-2}">BENCH</text><text class="live-axis" text-anchor="middle" x="${cx}" y="${cy+8}">N/D</text>`;
  $("#radarChart").innerHTML=svg(radar,"Griglia radar per i benchmark dei modelli fissati");
  if(!base.length){ placeholder("#scatterChart","Carica il catalogo OpenRouter."); placeholder("#lineChart","Fissa fino a quattro modelli per confrontarli."); return; }
  let dots=`<line class="live-grid" x1="36" y1="18" x2="36" y2="184"/><line class="live-grid" x1="36" y1="184" x2="305" y2="184"/><text class="live-axis" x="4" y="20">Contesto</text><text class="live-axis" x="253" y="207">Costo output →</text>`;base.forEach((m,i)=>{const p=m.output??m.input??maxPrice,x=46+Math.min(p/maxPrice,1)*240,y=174-(m.context||0)/maxContext*140;dots+=`<circle cx="${x}" cy="${y}" r="5" fill="${colors[i]}"><title>${esc(m.name)} · ${Math.round((m.context||0)/1000)}k · ${priceText(p)}/M</title></circle><text class="live-label" x="${x+7}" y="${y-7}">${esc(m.name.split(" ")[0])}</text>`});$("#scatterChart").innerHTML=svg(dots,"Contesto rispetto al costo output");
  let bars="";base.forEach((m,i)=>{const p=m.output??m.input??0,y=25+i*40,width=Math.max(3,230*(1-p/maxPrice));bars+=`<text class="live-label" x="12" y="${y+9}">${esc(m.name.slice(0,15))}</text><rect x="12" y="${y+14}" width="${width}" height="12" rx="4" fill="${colors[i]}" fill-opacity=".8"/><text class="live-label" x="${18+width}" y="${y+24}">${priceText(p)}</text>`});$("#lineChart").innerHTML=svg(bars,"Costo output dei modelli fissati");
}
function renderSessionStats() {
  $("#callCount").textContent = String(sessionCalls).padStart(2,"0");
  $("#callMeta").textContent = sessionCalls ? "risposte nella sessione corrente" : "nessuna richiesta eseguita";
  if (sessionLatencies.length) { const values=[...sessionLatencies].sort((a,b)=>a-b), middle=Math.floor(values.length/2), median=values.length%2?values[middle]:(values[middle-1]+values[middle])/2; $("#latencyValue").innerHTML=`${median.toFixed(2)} <em>s</em>`; $("#latencyMeta").textContent="mediana risposte riuscite"; } else { $("#latencyValue").textContent="N/D"; $("#latencyMeta").textContent="dati dopo la prima chiamata"; }
  if (sessionCost !== null) { $("#costValue").textContent=`$${sessionCost.toFixed(4)}`; $("#costMeta").textContent="costo comunicato nelle risposte"; } else { $("#costValue").textContent="N/D"; $("#costMeta").textContent="solo se restituito da OpenRouter"; }
}
function renderAll() { renderPodium(); renderTable(); renderInsights(); renderCharts(); renderSessionStats(); $("#selectionStatus").textContent = `${selected.length}/4 fissati nel confronto`; $("#railSelection").textContent=selected.length; }
function stamp() { $("#lastUpdated").textContent = new Intl.DateTimeFormat("it-IT", {dateStyle:"medium",timeStyle:"short"}).format(new Date()); }

async function loadModels() {
  const status = $("#catalogStatus"), key = $("#apiKey").value.trim(), button = $("#loadModels");
  status.textContent = "Caricamento catalogo OpenRouter…"; button.disabled = true;
  try {
    const response = await fetch(`${API}/models`, {headers:key ? {Authorization:`Bearer ${key}`} : {}});
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
    models = (payload.data || []).filter(model => model?.id).map(normalize).sort((a,b) => a.name.localeCompare(b.name));
    selected = selected.filter(id => models.some(model => model.id === id));
    renderProviders(); stamp(); renderAll();
    status.textContent = `${models.length} modelli caricati dal catalogo OpenRouter. I benchmark restano non misurati.`;
  } catch (error) { status.textContent = `Impossibile caricare il catalogo: ${error.message}`; }
  finally { button.disabled = false; }
}
async function runPrompt() {
  const key = $("#apiKey").value.trim(), prompt = $("#promptInput").value.trim(), chosen = models.filter(model => selected.includes(model.id)), box = $("#results");
  if (!key || !prompt || !chosen.length) { box.innerHTML = "<p>Inserisci chiave e prompt, quindi fissa almeno un modello del catalogo OpenRouter.</p>"; return; }
  box.innerHTML = "<p>Richieste in corso ai modelli fissati…</p>";
  const mode = $("#modeSelect").value;
  const directives = { godmode:"Answer directly, precisely, and usefully. Preserve factual accuracy and distinguish facts from uncertainty.", focused:"Provide a structured, evidence-aware answer. State assumptions, trade-offs, and the most useful next action.", raw:null };
  const messages = directives[mode] ? [{role:"system",content:directives[mode]},{role:"user",content:prompt}] : [{role:"user",content:prompt}];
  const answers = await Promise.all(chosen.map(async model => { const started=performance.now(); try { const response = await fetch(`${API}/chat/completions`, {method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","X-Title":"Cavaliermax Open Uncensored"},body:JSON.stringify({model:model.id,messages,temperature:.7,max_tokens:1800})}); const data = await response.json(); if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`); return {model,text:data.choices?.[0]?.message?.content || "Risposta vuota",ok:true,time:(performance.now()-started)/1000,cost:numeric(data.usage?.cost ?? data.usage?.total_cost)}; } catch(error) { return {model,text:error.message,ok:false}; }}));
  const successes=answers.filter(answer=>answer.ok); sessionCalls+=successes.length; sessionLatencies.push(...successes.map(answer=>answer.time)); successes.forEach(answer=>sessionLatencyByModel.set(answer.model.id,answer.time)); const reported=successes.map(answer=>answer.cost).filter(cost=>cost!==null); if(reported.length) sessionCost=(sessionCost||0)+reported.reduce((total,cost)=>total+cost,0); renderAll();
  box.innerHTML = `<div class="result-grid">${answers.map(answer=>`<article class="result"><h3>${esc(answer.model.name)}${answer.ok?"":" · errore"}</h3><p>${esc(answer.text)}</p></article>`).join("")}</div>`;
}
function attach() {
  const filters=["searchInput","providerFilter","familyFilter","sizeFilter","capabilityFilter","priceTypeFilter","newnessFilter","contextFilter","outputFilter","availabilityFilter","latencyFilter","uncensoredFilter","pageSize"];
  filters.forEach(id => $("#"+id).addEventListener(id === "searchInput" ? "input" : "change",()=>{page=1;renderAll()}));
  $("#costFilter").addEventListener("input",()=>{page=1;renderCostFilter();renderAll()});
  $("#promptInput").addEventListener("input",renderCostFilter);
  $("#clearFilters").addEventListener("click",()=>{filters.filter(id=>id!=="pageSize").forEach(id=>{const element=$("#"+id);if(element.type==="checkbox")element.checked=false;else element.value="all";});$("#contextFilter").value="0";$("#outputFilter").value="0";$("#costFilter").value=100;page=1;renderCostFilter();renderAll();});
  $("#refreshButton").addEventListener("click",()=>{stamp();renderAll();}); $("#themeButton").addEventListener("click",()=>document.body.classList.toggle("high-contrast")); $("#loadModels").addEventListener("click",loadModels); $("#runPrompt").addEventListener("click",runPrompt); $("#explainButton").addEventListener("click",()=>$("#methodDialog").showModal()); $(".dialog-close").addEventListener("click",()=>$("#methodDialog").close());
  $("#rememberKey").addEventListener("change",saveOrForgetKey);
  $("#apiKey").addEventListener("change",()=>{ if ($("#rememberKey").checked) saveOrForgetKey(); });
  $("#forgetKey").addEventListener("click",()=>{ $("#rememberKey").checked=false; $("#apiKey").value=""; saveOrForgetKey(); });
}
attach(); restoreSavedKey(); stamp(); renderAll();
