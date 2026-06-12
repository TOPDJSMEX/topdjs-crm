const STORE="topdjs_v10_7_restore_catalog_edit";
const OLD_STORES=["topdjs_v10_6_setinput_fix","topdjs_v10_5_edit_delete_fix","topdjs_v10_4_edit_robusto","topdjs_v10_3_edit_from_cloud","topdjs_v10_2_edit_events","topdjs_v10_1_event_files","topdjs_v10_event_files","topdjs_v9_2_delete_fix","topdjs_v9_1_supabase_fix","topdjs_v9_hibrida","topdjs_v8_evento_iconos","topdjs_v7_pax"];
let db=JSON.parse(localStorage.getItem(STORE)||"null");
if(!db){
  db={records:[],contacts:[],eventFiles:[]};
  for(const k of OLD_STORES){
    try{
      const old=JSON.parse(localStorage.getItem(k)||"null");
      if(old){db.records=old.records||[];db.contacts=old.contacts||[];db.eventFiles=old.eventFiles||[];break}
    }catch(e){}
  }
}
let records=db.records||[],contacts=db.contacts||[],eventFiles=db.eventFiles||[],visibleDate=new Date(),currentFileRecordId=null,editingRecordId=null;
const CATALOG=window.TOPDJS_CATALOG||{},BASE=window.SUPABASE_URL,KEY=window.SUPABASE_ANON_KEY,$=id=>document.getElementById(id);
const headers={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json"};
const money=n=>Number(n||0).toLocaleString("es-MX",{style:"currency",currency:"MXN"});
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
const cleanPhone=s=>String(s||"").replace(/\D/g,"");
const wa=(phone,msg="")=>{let p=cleanPhone(phone);if(!p)return"#";if(p.length===10)p="52"+p;return`https://wa.me/${p}${msg?`?text=${encodeURIComponent(msg)}`:""}`};
const tel=p=>cleanPhone(p)?`tel:${cleanPhone(p)}`:"#";
const bal=r=>Math.max(Number(r.amount||0)-Number(r.paid||0),0);

function setInput(id,value){
  const el=$(id);
  if(!el)return;
  el.value=value ?? "";
  try{ el.dispatchEvent(new Event("input",{bubbles:true})); }catch(e){}
  try{ el.dispatchEvent(new Event("change",{bubbles:true})); }catch(e){}
}

function save(){db.records=records;db.contacts=contacts;db.eventFiles=eventFiles;localStorage.setItem(STORE,JSON.stringify(db));renderSyncStatus();}
function showError(msg){const e=$("errorBox");if(!msg){e.classList.add("hidden");e.textContent="";return}e.textContent=msg;e.classList.remove("hidden");}
function markDirty(obj){obj._dirty=true;obj.updated_at=new Date().toISOString();}
function normalizeRecord(r){
  if(!r.local_id)r.local_id=r.id||uid();
  if(r.eventType&&!r.event_type)r.event_type=r.eventType;
  if(r.serviceHours&&!r.service_hours)r.service_hours=r.serviceHours;
  if(r.setupType&&!r.setup_type)r.setup_type=r.setupType;
  if(r.setupHours&&!r.setup_hours)r.setup_hours=r.setupHours;
  if(r.setupTime&&!r.setup_time)r.setup_time=r.setupTime;
  if(r.startTime&&!r.start_time)r.start_time=r.startTime;
  if(r.endTime&&!r.end_time)r.end_time=r.endTime;
  if(r.quoteCatalog&&!r.quote_catalog)r.quote_catalog=r.quoteCatalog;
  if(!r.status)r.status="EN SEGUIMIENTO";
  return r;
}
records=records.map(normalizeRecord).filter(r=>!r._deleted);
contacts=contacts.filter(c=>!c._deleted);

function renderSyncStatus(){
  const el=$("syncStatus");
  const dirty=records.filter(r=>r._dirty).length+contacts.filter(c=>c._dirty).length;
  if(navigator.onLine){el.textContent=dirty?`ONLINE · ${dirty} PENDIENTE(S)`:"ONLINE · SINCRONIZADO";el.className="status online"}
  else{el.textContent=`OFFLINE · ${dirty} PENDIENTE(S)`;el.className="status offline"}
}
window.addEventListener("online",()=>syncAll());
window.addEventListener("offline",renderSyncStatus);
$("syncBtn").onclick=()=>syncAll();

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");$(b.dataset.tab).classList.add("active");renderAll();
});

function safeId(s){return btoa(unescape(encodeURIComponent(s))).replace(/=/g,"")}
function renderCatalog(){
  const root=$("catalog");root.innerHTML="";
  Object.entries(CATALOG).forEach(([rub,items])=>{
    const wrap=document.createElement("div");wrap.className="rubro";wrap.innerHTML=`<div class="rubroTitle">${esc(rub)}</div>`;
    items.forEach(item=>{
      const id=safeId(rub+"__"+item),chk="chk_"+id,qty="qty_"+id,row=document.createElement("div");
      row.className="item";
      row.innerHTML=`<input type="checkbox" id="${chk}"><div>${esc(item)}</div><input class="qty" id="${qty}" type="number" min="0" step="1" placeholder="CANT." disabled>`;
      wrap.appendChild(row);
      setTimeout(()=>{$(chk).onchange=()=>{const q=$(qty);q.disabled=!$(chk).checked;if($(chk).checked&&!q.value)q.value=1;if(!$(chk).checked)q.value=""}},0)
    });
    const notes=document.createElement("div");notes.className="notes";
    notes.innerHTML=`<label>📝 OBSERVACIONES ${esc(rub)}</label><textarea id="notes_${safeId(rub)}"></textarea>`;
    wrap.appendChild(notes);root.appendChild(wrap)
  })
}
function getCatalogSelection(){
  let out={};
  Object.entries(CATALOG).forEach(([rub,items])=>{
    const selected=[];
    items.forEach(item=>{
      const id=safeId(rub+"__"+item),chk=$("chk_"+id),qty=$("qty_"+id);
      if(chk?.checked)selected.push({item,qty:Number(qty.value||1)})
    });
    out[rub]={selected,notes:$("notes_"+safeId(rub))?.value||""}
  });
  return out
}
function clearCatalog(){
  Object.entries(CATALOG).forEach(([rub,items])=>{
    items.forEach(item=>{
      const id=safeId(rub+"__"+item),chk=$("chk_"+id),qty=$("qty_"+id);
      if(chk)chk.checked=false;if(qty){qty.value="";qty.disabled=true}
    });
    const n=$("notes_"+safeId(rub));if(n)n.value=""
  })
}

function normalizeCatalogKey(s){
  return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w\s]/g,"").replace(/\s+/g," ").trim().toUpperCase();
}
function getCatalogDataForRubro(qc,rub){
  if(!qc)return null;
  if(typeof qc==="string"){try{qc=JSON.parse(qc)}catch(e){return null}}
  if(!qc || typeof qc!=="object")return null;
  if(qc[rub])return qc[rub];
  const target=normalizeCatalogKey(rub);
  const foundKey=Object.keys(qc).find(k=>{
    const nk=normalizeCatalogKey(k);
    return nk===target || nk.includes(target) || target.includes(nk);
  });
  return foundKey?qc[foundKey]:null;
}
function normalizeSelectedList(data){
  if(!data)return [];
  if(Array.isArray(data))return data;
  if(Array.isArray(data.selected))return data.selected;
  if(Array.isArray(data.items))return data.items;
  if(Array.isArray(data.equipment))return data.equipment;
  if(typeof data==="object"){
    return Object.entries(data).filter(([k,v])=>!["notes","observations","observaciones"].includes(k)&&v).map(([k,v])=>{
      if(typeof v==="object")return {item:v.item||v.name||v.equipo||k,qty:v.qty||v.cantidad||v.quantity||v.cant||1};
      return {item:k,qty:v===true?1:v};
    });
  }
  return [];
}
function setCatalogSelection(qc){
  clearCatalog();
  if(!qc)return;
  if(typeof qc==="string"){try{qc=JSON.parse(qc)}catch(e){console.warn("quote_catalog no es JSON válido",e);return}}
  Object.entries(CATALOG).forEach(([rub,items])=>{
    const data=getCatalogDataForRubro(qc,rub);
    const selected=normalizeSelectedList(data);
    selected.forEach(x=>{
      const savedName=normalizeCatalogKey(x.item||x.name||x.equipo||x.label||"");
      if(!savedName)return;
      const catalogItem=items.find(item=>{
        const a=normalizeCatalogKey(item);
        return a===savedName || a.includes(savedName) || savedName.includes(a);
      });
      if(!catalogItem)return;
      const id=safeId(rub+"__"+catalogItem);
      const chk=$("chk_"+id), qty=$("qty_"+id);
      if(chk&&qty){
        chk.checked=true;
        qty.disabled=false;
        qty.value=Number(x.qty ?? x.cantidad ?? x.quantity ?? x.cant ?? 1)||1;
      }
    });
    const n=$("notes_"+safeId(rub));
    if(n&&data&&typeof data==="object")n.value=data.notes||data.observations||data.observaciones||"";
  });
}

function updateQuoteBalance(){$("quoteBalance").textContent=money(Math.max(Number($("quoteTotal").value||0)-Number($("quotePaid").value||0),0))}
$("quoteTotal").oninput=updateQuoteBalance;$("quotePaid").oninput=updateQuoteBalance;
$("clearQuoteBtn").onclick=()=>{
  if(!confirm("¿LIMPIAR COTIZADOR?"))return;
  ["quoteClient","quoteCompany","quotePhone","quoteEmail","quoteInstagram","quoteProject","quoteDate","quoteVenue","quotePax","quoteServiceHours","quoteSetupHours","quoteSetupTime","quoteStartTime","quoteEndTime","quoteTotal","quoteNotes"].forEach(id=>$(id).value="");
  $("quotePaid").value=0;$("quoteSetupType").value="MISMO DÍA";clearCatalog();updateQuoteBalance()
};
function collectQuoteData(local_id=null){const amount=Number($("quoteTotal").value||0),paid=Number($("quotePaid").value||0);return{local_id:local_id||uid(),type:"COTIZACIÓN ENVIADA",date:$("quoteDate").value,client:$("quoteClient").value,company:$("quoteCompany").value,phone:$("quotePhone").value,email:$("quoteEmail").value,instagram:$("quoteInstagram").value,event_type:$("quoteEventType").value,project:$("quoteProject").value,venue:$("quoteVenue").value,pax:Number($("quotePax").value||0),service_hours:Number($("quoteServiceHours").value||0),setup_type:$("quoteSetupType").value,setup_hours:Number($("quoteSetupHours").value||0),setup_time:$("quoteSetupTime").value,start_time:$("quoteStartTime").value,end_time:$("quoteEndTime").value,amount,paid,status:paid>=amount&&amount>0?"PAGADO":paid>0?"ANTICIPO RECIBIDO":"EN SEGUIMIENTO",notes:$("quoteNotes").value,quote_catalog:getCatalogSelection(),updated_at:new Date().toISOString(),_dirty:true}}
$("saveQuoteBtn").onclick=()=>{const amount=Number($("quoteTotal").value||0);if(!$("quoteClient").value||!$("quoteDate").value)return alert("AGREGA CLIENTE Y FECHA.");if(!amount)return alert("AGREGA TOTAL COTIZADO.");if(editingRecordId){const i=records.findIndex(r=>r.local_id===editingRecordId);if(i>=0){records[i]={...records[i],...collectQuoteData(editingRecordId)};save();renderAll();syncAll();alert("CAMBIOS GUARDADOS.");clearQuoteForm();document.querySelector('[data-tab="records"]').click();return}}const rec=collectQuoteData();records.push(rec);save();renderAll();syncAll();alert("COTIZACIÓN GUARDADA.")};
function firstValue(...vals){
  for(const v of vals){
    if(v!==undefined && v!==null && String(v)!=="") return v;
  }
  return "";
}
function parseMaybeJson(v){
  if(!v) return v;
  if(typeof v==="object") return v;
  try{return JSON.parse(v)}catch(e){return v}
}
function isUuidLike(v){
  return typeof v==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function findLocalRecordFlexible(key){
  return records.find(r=>r.local_id===key || r.id===key) || null;
}
function mergeRecordForEdit(local, remote){
  local=normalizeRecord(local||{});
  remote=normalizeRecord(remote||{});
  const out={...local};
  ["id","local_id","type","date","client","company","phone","email","instagram","event_type","project","venue","pax","service_hours","setup_type","setup_hours","setup_time","start_time","end_time","amount","paid","status","notes","quote_catalog","updated_at"].forEach(k=>{
    out[k]=firstValue(remote[k], local[k]);
  });
  out.quote_catalog=parseMaybeJson(firstValue(remote.quote_catalog, local.quote_catalog));
  return normalizeRecord(out);
}
async function getRemoteRecordFlexible(record){
  try{
    if(!navigator.onLine)return null;
    const tries=[];
    if(record?.local_id) tries.push(["local_id",record.local_id]);
    if(record?.id) tries.push(["id",record.id]);
    if(isUuidLike(record?.local_id)) tries.push(["id",record.local_id]);
    for(const [field,value] of tries){
      const arr=await api(`topdjs_records?select=*&${field}=eq.${encodeURIComponent(value)}&limit=1`,{method:"GET"});
      if(Array.isArray(arr)&&arr.length)return arr[0];
    }
    return null;
  }catch(e){
    console.warn("No se pudo cargar evento desde Supabase",e);
    showError("AVISO: No pude cargar Supabase. Usaré copia local.\n"+e.message);
    return null;
  }
}
function fillEditForm(r){
  r=normalizeRecord(r);
  if(!r.client && !r.date && !r.amount && !r.project){
    showError("NO SE ENCONTRARON DATOS PARA EDITAR ESTE EVENTO.\nPresiona SINCRONIZAR y vuelve a intentar.");
    return false;
  }
  setInput("quoteClient",r.client);
  setInput("quoteCompany",r.company);
  setInput("quotePhone",r.phone);
  setInput("quoteEmail",r.email);
  setInput("quoteInstagram",r.instagram);
  setInput("quoteEventType",r.event_type||"OTRO");
  setInput("quoteProject",r.project);
  setInput("quoteDate",r.date);
  setInput("quoteVenue",r.venue);
  setInput("quotePax",r.pax);
  setInput("quoteServiceHours",r.service_hours);
  setInput("quoteSetupType",r.setup_type||"MISMO DÍA");
  setInput("quoteSetupHours",r.setup_hours);
  setInput("quoteSetupTime",r.setup_time);
  setInput("quoteStartTime",r.start_time);
  setInput("quoteEndTime",r.end_time);
  setInput("quoteTotal",r.amount);
  setInput("quotePaid",r.paid);
  setInput("quoteStatus",r.status||"EN SEGUIMIENTO");
  setInput("quoteNotes",r.notes);
  setCatalogSelection(parseMaybeJson(r.quote_catalog));
  updateQuoteBalance();
  $("saveQuoteBtn").textContent="GUARDAR CAMBIOS";
  $("cancelEditBtn").classList.remove("hidden");
  $("editNotice").classList.remove("hidden");
  $("quoteFormTitle").textContent="✏️ EDITAR EVENTO";
  return true;
}
async function editRecord(key){
  showError("");
  const local=findLocalRecordFlexible(key)||{local_id:key,id:key};
  const remote=await getRemoteRecordFlexible(local);
  const r=mergeRecordForEdit(local, remote);
  const stableKey=r.local_id || local.local_id || key;
  const i=records.findIndex(x=>x.local_id===stableKey || x.id===r.id || x.local_id===key || x.id===key);
  if(i>=0)records[i]={...records[i],...r,local_id:stableKey,_dirty:false};
  else records.push({...r,local_id:stableKey,_dirty:false});
  save();
  editingRecordId=stableKey;
  document.querySelector('[data-tab="quote"]').click();
  const ok=fillEditForm(r);
  if(ok)window.scrollTo({top:0,behavior:"smooth"});
}

function renderRecords(){
  const tb=$("recordsTable");tb.innerHTML="";
  records.filter(r=>!r._deleted).sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(r=>{
    r=normalizeRecord(r);
    const fileCount=eventFiles.filter(f=>f.record_local_id===r.local_id).length;
    let tr=document.createElement("tr");
    tr.innerHTML=`<td>${esc(r.date)}</td><td>${esc(r.client)}<br><small>${esc(r.company)}</small></td><td>${esc(r.project)}</td><td>${esc(r.pax||"")}</td><td>${esc(r.service_hours||"")}</td><td>${esc(r.setup_type||"")}</td><td>${money(r.amount)}</td><td>${money(bal(r))}</td><td>${r._dirty?"PENDIENTE":"OK"}${fileCount?`<br>📎 ${fileCount}`:""}</td><td><button onclick="showRecord('${r.local_id}')">VER</button> <button class="editBtn" onclick="editRecord('${r.local_id}')">EDITAR</button> <button onclick="markPaid('${r.local_id}')">PAGADO</button> <button class="delete" onclick="delRecord('${r.local_id}')">BORRAR</button></td>`;
    tb.appendChild(tr)
  });
  $("sumQuoted").textContent=money(records.filter(r=>!r._deleted).reduce((s,r)=>s+Number(r.amount||0),0));
  $("sumPaid").textContent=money(records.filter(r=>!r._deleted).reduce((s,r)=>s+Number(r.paid||0),0));
  $("sumBalance").textContent=money(records.filter(r=>!r._deleted).reduce((s,r)=>s+bal(r),0));
  renderSyncStatus()
}
async function delRecord(key){
  const r=findLocalRecordFlexible(key)||{local_id:key,id:key};
  const local_id=r.local_id||key;
  if(!confirm("¿BORRAR ESTE EVENTO Y TODOS SUS ARCHIVOS?"))return;
  showError("");
  const backup=[...records],backupFiles=[...eventFiles];
  try{
    if(!navigator.onLine){showError("Estás offline. Para borrar globalmente evento y archivos necesitas internet.");return}
    await deleteEventFilesByRecord(local_id);
    await deleteRemote("topdjs_records",local_id);
    if(r.id){try{await api(`topdjs_records?id=eq.${encodeURIComponent(r.id)}`,{method:"DELETE",headers:{"Prefer":"return=minimal"}})}catch(e){}}
    records=records.filter(x=>x.local_id!==local_id && x.id!==r.id && x.local_id!==key && x.id!==key);
    eventFiles=eventFiles.filter(f=>f.record_local_id!==local_id && f.record_local_id!==key);
    save();
    await syncAll();
    renderAll();
  }catch(e){
    records=backup;eventFiles=backupFiles;save();renderAll();
    showError("ERROR AL BORRAR EVENTO Y ARCHIVOS:\n"+e.message);
  }
}
async function markPaid(local_id){const r=records.find(x=>x.local_id===local_id);if(r){r.paid=r.amount;r.status="PAGADO";markDirty(r);save();renderAll();syncAll()}}
function catalogHtml(qc){
  if(!qc)return"";
  let html="<h3>📦 EQUIPO SELECCIONADO</h3>";
  Object.entries(qc).forEach(([rub,d])=>{
    if((d.selected||[]).length||d.notes){
      html+=`<h4>${esc(rub)}</h4><ul>`;
      (d.selected||[]).forEach(x=>html+=`<li>${esc(x.item)}: <strong>${esc(x.qty)}</strong></li>`);
      html+="</ul>";
      if(d.notes)html+=`<p><strong>OBSERVACIONES ${esc(rub)}:</strong><br>${esc(d.notes)}</p>`
    }
  });
  return html
}
function showRecord(local_id){
  const r=normalizeRecord(records.find(x=>x.local_id===local_id));if(!r)return;
  currentFileRecordId=local_id;
  $("modalTitle").textContent=r.client;
  $("modalBody").innerHTML=`<h3>📋 INFORMACIÓN DEL EVENTO</h3><p><strong>📅 FECHA:</strong> ${esc(r.date)}</p><p><strong>🎉 PROYECTO:</strong> ${esc(r.project)}</p><p><strong>🎯 TIPO:</strong> ${esc(r.event_type)}</p><p><strong>📍 LUGAR:</strong> ${esc(r.venue)}</p><p><strong>👥 PAX:</strong> ${esc(r.pax||"")}</p><p><strong>⏰ HORAS DE SERVICIO:</strong> ${esc(r.service_hours||"")}</p><p><strong>🔧 MONTAJE:</strong> ${esc(r.setup_type||"")} · ${esc(r.setup_hours||"")} HRS · ${esc(r.setup_time||"")}</p><p><strong>🎬 INICIO:</strong> ${esc(r.start_time||"")} · <strong>🏁 TÉRMINO:</strong> ${esc(r.end_time||"")}</p><p><strong>💰 MONTO:</strong> ${money(r.amount)} | <strong>💸 SALDO:</strong> ${money(bal(r))}</p><p>${r.phone?`<a class="button whatsapp" href="${wa(r.phone,"Hola, te contacto de TopDJs sobre "+(r.project||"tu evento"))}" target="_blank">WHATSAPP</a> <a class="button call" href="${tel(r.phone)}">LLAMAR</a>`:""} <button class="editBtn" onclick="$('modal').classList.add('hidden');editRecord('${r.local_id}')">EDITAR EVENTO</button></p>${catalogHtml(r.quote_catalog)}<h3>📝 OBSERVACIONES GENERALES</h3><p>${esc(r.notes)}</p>${filesHtml(local_id)}`;
  $("modal").classList.remove("hidden")
}
$("closeModal").onclick=()=>$("modal").classList.add("hidden");

function renderCalendar(){
  const grid=$("calendarGrid");grid.innerHTML="";
  const y=visibleDate.getFullYear(),m=visibleDate.getMonth(),names=["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
  $("monthTitle").textContent=`${names[m]} ${y}`;
  ["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"].forEach(d=>{let e=document.createElement("div");e.className="dayHeader";e.textContent=d;grid.appendChild(e)});
  const first=new Date(y,m,1),off=(first.getDay()+6)%7,start=new Date(y,m,1-off);
  for(let i=0;i<42;i++){
    let d=new Date(start);d.setDate(start.getDate()+i);let ds=d.toISOString().slice(0,10);
    let cell=document.createElement("div");cell.className="day"+(d.getMonth()!=m?" outside":"");cell.innerHTML=`<strong>${d.getDate()}</strong>`;
    records.filter(r=>!r._deleted&&r.date===ds).forEach(r=>{
      r=normalizeRecord(r);
      let b=document.createElement("button");b.className="pill";
      b.textContent=`${r.client} · ${r.pax||0} PAX · ${r.service_hours||0} HRS · ${money(bal(r))} saldo`;
      b.onclick=()=>showRecord(r.local_id);cell.appendChild(b)
    });
    grid.appendChild(cell)
  }
}
$("prevMonth").onclick=()=>{visibleDate.setMonth(visibleDate.getMonth()-1);renderCalendar()};
$("nextMonth").onclick=()=>{visibleDate.setMonth(visibleDate.getMonth()+1);renderCalendar()};

$("addContactBtn").onclick=()=>{
  const c={local_id:uid(),ig:$("igUser").value,name:$("contactName").value,phone:$("contactPhone").value,email:$("contactEmail").value,segment:$("contactSegment").value,notes:$("contactNotes").value,updated_at:new Date().toISOString(),_dirty:true};
  contacts.push(c);["igUser","contactName","contactPhone","contactEmail","contactNotes"].forEach(id=>$(id).value="");
  save();renderContacts();syncAll()
};
function renderContacts(){
  const tb=$("contactsTable");tb.innerHTML="";
  contacts.filter(c=>!c._deleted).forEach(c=>{
    let tr=document.createElement("tr");
    tr.innerHTML=`<td>${esc(c.ig)}</td><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.segment)}</td><td>${c._dirty?"PENDIENTE":"OK"}</td><td>${c.phone?`<a class="button whatsapp" href="${wa(c.phone)}" target="_blank">WA</a>`:""} <button class="delete" onclick="delContact('${c.local_id}')">BORRAR</button></td>`;
    tb.appendChild(tr)
  });
  renderSyncStatus()
}
async function delContact(local_id){
  if(!confirm("¿BORRAR ESTE CONTACTO EN TODOS LOS DISPOSITIVOS?"))return;
  showError("");const backup=[...contacts];contacts=contacts.filter(x=>x.local_id!==local_id);save();renderContacts();
  try{if(navigator.onLine){await deleteRemote("topdjs_contacts",local_id);await syncAll()}else{showError("Estás offline. Para borrar en todos los dispositivos necesitas internet.")}}
  catch(e){contacts=backup;save();renderContacts();showError("ERROR AL BORRAR CONTACTO:\n"+e.message)}
}

function dbRecord(r){r=normalizeRecord(r);return{local_id:r.local_id,type:r.type||null,date:r.date||null,client:r.client||null,company:r.company||null,phone:r.phone||null,email:r.email||null,instagram:r.instagram||null,event_type:r.event_type||null,project:r.project||null,venue:r.venue||null,pax:r.pax||0,service_hours:r.service_hours||0,setup_type:r.setup_type||null,setup_hours:r.setup_hours||0,setup_time:r.setup_time||null,start_time:r.start_time||null,end_time:r.end_time||null,amount:r.amount||0,paid:r.paid||0,status:r.status||null,notes:r.notes||null,quote_catalog:r.quote_catalog||null,updated_at:r.updated_at||new Date().toISOString()}}
function dbContact(c){return{local_id:c.local_id,ig:c.ig||null,name:c.name||null,phone:c.phone||null,email:c.email||null,segment:c.segment||null,notes:c.notes||null,updated_at:c.updated_at||new Date().toISOString()}}
async function api(path,opts={}){
  const res=await fetch(BASE+"/rest/v1/"+path,{...opts,headers:{...headers,...(opts.headers||{})}});
  const txt=await res.text();
  if(!res.ok){throw new Error(`${res.status} ${res.statusText}\n${txt}`)}
  try{return txt?JSON.parse(txt):null}catch{return txt}
}
async function storageUpload(path,file){
  const res=await fetch(BASE+"/storage/v1/object/event-files/"+path,{method:"POST",headers:{"apikey":KEY,"Authorization":"Bearer "+KEY,"x-upsert":"true","Content-Type":file.type||"application/octet-stream"},body:file});
  const txt=await res.text();
  if(!res.ok){throw new Error(`${res.status} ${res.statusText}\n${txt}`)}
  return txt
}
function publicFileUrl(path){return BASE+"/storage/v1/object/public/event-files/"+encodeURIComponent(path).replaceAll("%2F","/")}
async function deleteStorageObject(path){
  const res=await fetch(BASE+"/storage/v1/object/event-files/"+path,{method:"DELETE",headers:{"apikey":KEY,"Authorization":"Bearer "+KEY}});
  const txt=await res.text();
  if(!res.ok){throw new Error(`${res.status} ${res.statusText}\n${txt}`)}
  return txt
}
async function deleteRemote(table,local_id){return await api(`${table}?local_id=eq.${encodeURIComponent(local_id)}`,{method:"DELETE",headers:{"Prefer":"return=minimal"}})}

async function syncAll(){
  showError("");
  if(!navigator.onLine){renderSyncStatus();return}
  try{
    for(const r of records){if(r._dirty){await api("topdjs_records?on_conflict=local_id",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(dbRecord(r))});r._dirty=false}}
    for(const c of contacts){if(c._dirty){await api("topdjs_contacts?on_conflict=local_id",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(dbContact(c))});c._dirty=false}}
    const rr=await api("topdjs_records?select=*",{method:"GET"});
    if(Array.isArray(rr)){
      const dirtySet=new Set(records.filter(r=>r._dirty).map(r=>r.local_id));
      const remoteIds=new Set(rr.map(x=>x.local_id));
      records=records.filter(r=>r._dirty || remoteIds.has(r.local_id));
      rr.forEach(x=>{if(!dirtySet.has(x.local_id)){const i=records.findIndex(r=>r.local_id===x.local_id);const obj={...x,_dirty:false};if(i>=0)records[i]=obj;else records.push(obj)}})
    }
    const cc=await api("topdjs_contacts?select=*",{method:"GET"});
    if(Array.isArray(cc)){
      const dirtySet=new Set(contacts.filter(c=>c._dirty).map(c=>c.local_id));
      const remoteIds=new Set(cc.map(x=>x.local_id));
      contacts=contacts.filter(c=>c._dirty || remoteIds.has(c.local_id));
      cc.forEach(x=>{if(!dirtySet.has(x.local_id)){const i=contacts.findIndex(c=>c.local_id===x.local_id);const obj={...x,_dirty:false};if(i>=0)contacts[i]=obj;else contacts.push(obj)}})
    }
    await loadEventFiles();
    save();renderAll()
  }catch(e){console.error(e);showError("ERROR DE SINCRONIZACIÓN:\n"+e.message);renderSyncStatus()}
}

async function loadEventFiles(){
  try{
    const ff=await api("event_files?select=*&order=created_at.desc",{method:"GET"});
    if(Array.isArray(ff))eventFiles=ff
  }catch(e){console.error("event files",e);showError("ERROR AL CARGAR ARCHIVOS:\n"+e.message)}
}
function filesHtml(local_id){
  const list=eventFiles.filter(f=>f.record_local_id===local_id);
  let html=`<div class="filesBox"><h3>📎 ARCHIVOS DEL EVENTO</h3><p class="hint">Contratos, comprobantes, layouts, riders, PDFs o imágenes.</p><button class="fileBtn" onclick="openFilePicker('${local_id}')">+ AGREGAR ARCHIVO</button>`;
  if(!list.length){html+=`<p class="hint">Aún no hay archivos adjuntos.</p>`}
  else{
    list.forEach(f=>{
      html+=`<div class="fileRow"><div class="fileName">📄 ${esc(f.file_name)}</div><div class="fileActions"><a class="button smallBtn" href="${esc(f.file_url)}" target="_blank">VER / DESCARGAR</a><button class="delete smallBtn" onclick="deleteEventFile(${f.id}, '${encodeURIComponent(f.file_url)}')">ELIMINAR</button></div></div>`
    })
  }
  html+=`</div>`;
  return html
}
function openFilePicker(local_id){currentFileRecordId=local_id;$("eventFileInput").value="";$("eventFileInput").click()}
$("eventFileInput").onchange=async()=>{
  const file=$("eventFileInput").files[0];
  if(!file||!currentFileRecordId)return;
  showError("");
  try{
    const safeName=file.name.replace(/[^\w.\-áéíóúÁÉÍÓÚñÑ ]/g,"_");
    const path=`${currentFileRecordId}/${Date.now()}_${safeName}`;
    await storageUpload(path,file);
    const url=publicFileUrl(path);
    await api("event_files",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({record_local_id:currentFileRecordId,file_name:file.name,file_url:url})});
    await loadEventFiles();
    save();
    showRecord(currentFileRecordId)
  }catch(e){console.error(e);showError("ERROR AL SUBIR ARCHIVO:\n"+e.message)}
}
async function deleteEventFile(id,encodedFileUrl){
  if(!confirm("¿ELIMINAR ESTE ARCHIVO DEL EVENTO?"))return;
  showError("");
  try{
    const fileUrl=decodeURIComponent(encodedFileUrl);
    await api(`event_files?id=eq.${id}`,{method:"DELETE",headers:{"Prefer":"return=minimal"}});
    eventFiles=eventFiles.filter(f=>String(f.id)!==String(id));
    const marker="/event-files/";
    const idx=fileUrl.indexOf(marker);
    if(idx>=0){
      const path=decodeURIComponent(fileUrl.slice(idx+marker.length));
      try{await deleteStorageObject(path)}catch(e){console.warn("storage delete failed",e)}
    }
    save();
    if(currentFileRecordId)showRecord(currentFileRecordId)
  }catch(e){showError("ERROR AL ELIMINAR ARCHIVO:\n"+e.message)}
}
async function deleteEventFilesByRecord(local_id){
  try{
    let list=[];
    try{
      const remote=await api(`event_files?select=*&record_local_id=eq.${encodeURIComponent(local_id)}`,{method:"GET"});
      if(Array.isArray(remote))list=remote;
    }catch(e){
      list=eventFiles.filter(f=>f.record_local_id===local_id);
    }
    for(const f of list){
      const marker="/event-files/";
      const idx=(f.file_url||"").indexOf(marker);
      if(idx>=0){
        const path=decodeURIComponent(f.file_url.slice(idx+marker.length));
        try{await deleteStorageObject(path)}catch(e){console.warn("storage delete failed",e)}
      }
      try{await api(`event_files?id=eq.${f.id}`,{method:"DELETE",headers:{"Prefer":"return=minimal"}})}catch(e){console.warn("event_files delete failed",e)}
    }
    try{await api(`event_files?record_local_id=eq.${encodeURIComponent(local_id)}`,{method:"DELETE",headers:{"Prefer":"return=minimal"}})}catch(e){}
    eventFiles=eventFiles.filter(f=>f.record_local_id!==local_id);
  }catch(e){console.warn("delete event files",e);throw e}
}

$("exportBtn").onclick=()=>{
  save();let blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  let url=URL.createObjectURL(blob);let a=document.createElement("a");a.href=url;a.download="topdjs_respaldo.json";a.click();URL.revokeObjectURL(url)
};
$("importFile").onchange=()=>{
  let f=$("importFile").files[0];if(!f)return;
  let rd=new FileReader();
  rd.onload=()=>{try{db=JSON.parse(rd.result);records=(db.records||[]).map(normalizeRecord);contacts=db.contacts||[];eventFiles=db.eventFiles||[];records.forEach(markDirty);contacts.forEach(markDirty);save();renderAll();syncAll();alert("RESPALDO IMPORTADO")}catch(e){alert("ERROR AL IMPORTAR")}};
  rd.readAsText(f)
};
function renderAll(){renderRecords();renderCalendar();renderContacts();updateQuoteBalance()}
renderCatalog();save();renderAll();syncAll();setInterval(syncAll,30000);
if("serviceWorker" in navigator){navigator.serviceWorker.register("sw.js").catch(()=>{})}
