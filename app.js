const STORE="topdjs_v11_4_6_boton_gastos";
const OLD_STORES=["topdjs_v11_4_5_gastos_evento","topdjs_v11_4_4_dashboard_real","topdjs_v11_4_3_dashboard_cobranza","topdjs_v11_4_2_cobrar_monto","topdjs_v11_4_1_anticipo_metodo","topdjs_v11_4_cobranza_eventos","topdjs_v11_2_header_logo","topdjs_v11_1_black_neon_ui","topdjs_v11_0_1_bitacora_visible","topdjs_v11_0_auditoria_bitacora","topdjs_v10_9_historial_clientes","topdjs_v10_8_pedido_bodega_pdf","topdjs_v10_7_restore_catalog_edit","topdjs_v10_6_setinput_fix","topdjs_v10_5_edit_delete_fix","topdjs_v10_4_edit_robusto","topdjs_v10_3_edit_from_cloud","topdjs_v10_2_edit_events","topdjs_v10_1_event_files","topdjs_v10_event_files","topdjs_v9_2_delete_fix","topdjs_v9_1_supabase_fix","topdjs_v9_hibrida","topdjs_v8_evento_iconos","topdjs_v7_pax"];
let db=JSON.parse(localStorage.getItem(STORE)||"null");
if(!db){
  db={records:[],contacts:[],eventFiles:[],eventPayments:[]};
  for(const k of OLD_STORES){
    try{
      const old=JSON.parse(localStorage.getItem(k)||"null");
      if(old){db.records=old.records||[];db.contacts=old.contacts||[];db.eventFiles=old.eventFiles||[];db.eventPayments=old.eventPayments||[];break}
    }catch(e){}
  }
}
let records=db.records||[],contacts=db.contacts||[],eventFiles=db.eventFiles||[],eventPayments=db.eventPayments||[],visibleDate=new Date(),currentFileRecordId=null,editingRecordId=null;
const CATALOG=window.TOPDJS_CATALOG||{},BASE=window.SUPABASE_URL,KEY=window.SUPABASE_ANON_KEY,$=id=>document.getElementById(id);
const headers={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json"};
const money=n=>Number(n||0).toLocaleString("es-MX",{style:"currency",currency:"MXN"});
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
const cleanPhone=s=>String(s||"").replace(/\D/g,"");
const wa=(phone,msg="")=>{let p=cleanPhone(phone);if(!p)return"#";if(p.length===10)p="52"+p;return`https://wa.me/${p}${msg?`?text=${encodeURIComponent(msg)}`:""}`};
const tel=p=>cleanPhone(p)?`tel:${cleanPhone(p)}`:"#";
function paymentTotal(local_id){
  return eventPayments.filter(p=>p.record_local_id===local_id).reduce((s,p)=>s+Number(p.amount||0),0);
}
function paidForRecord(r){
  const total=paymentTotal(r.local_id);
  return total>0?total:Number(r.paid||0);
}
const bal=r=>Math.max(Number(r.amount||0)-paidForRecord(r),0);


const STAFF_AUDIO_RATE=1800;
const STAFF_LIGHTING_VIDEO_RATE=1500;
const STAGE_HAND_RATE=1250;
const PREVIOUS_DAY_SETUP_RATE=750;

function getDefaultExpenses(){
  return {
    previousDaySetupPeople:0,
    setupExtras:0,
    staffExtras:0,
    generatorExpense:0,
    djsExpense:0,
    miscExpenses:[]
  };
}
function toMoneyNumber(value){
  const n=Number(String(value??0).replace(/[$, ]/g,""));
  return Number.isFinite(n)?n:0;
}
function normalizeExpenses(expenses){
  if(typeof expenses==="string"){
    try{expenses=JSON.parse(expenses)}catch(e){expenses={}}
  }
  expenses=expenses&&typeof expenses==="object"?expenses:{};
  return {
    ...getDefaultExpenses(),
    ...expenses,
    previousDaySetupPeople:toMoneyNumber(expenses.previousDaySetupPeople),
    setupExtras:toMoneyNumber(expenses.setupExtras),
    staffExtras:toMoneyNumber(expenses.staffExtras),
    generatorExpense:toMoneyNumber(expenses.generatorExpense),
    djsExpense:toMoneyNumber(expenses.djsExpense),
    miscExpenses:Array.isArray(expenses.miscExpenses)?expenses.miscExpenses.map(item=>({
      concept:String(item?.concept||""),
      description:String(item?.description||""),
      amount:toMoneyNumber(item?.amount)
    })) : []
  };
}

const COMMERCIAL_STATUSES=[
  "COTIZADO",
  "CONFIRMADO SIN ANTICIPO",
  "CONFIRMADO CON ANTICIPO",
  "LIQUIDADO",
  "CANCELADO",
  "PERDIDO"
];
function normalizeCommercialStatus(raw){
  const s=String(raw||"").trim().toUpperCase();
  if(!s || s==="EN SEGUIMIENTO")return "COTIZADO";
  if(s==="PAGADO")return "LIQUIDADO";
  if(s==="ANTICIPO RECIBIDO")return "CONFIRMADO CON ANTICIPO";
  if(s==="CONFIRMADO")return "CONFIRMADO SIN ANTICIPO";
  if(s==="COTIZACIÓN" || s==="COTIZACION" || s==="COTIZACIÓN ENVIADA" || s==="COTIZACION ENVIADA")return "COTIZADO";
  if(s==="CONFIRMADO SIN ANTICIPO")return "CONFIRMADO SIN ANTICIPO";
  if(s==="CONFIRMADO CON ANTICIPO")return "CONFIRMADO CON ANTICIPO";
  if(s==="LIQUIDADO")return "LIQUIDADO";
  if(s==="CANCELADO")return "CANCELADO";
  if(s==="PERDIDO")return "PERDIDO";
  return s;
}
function inferCommercialStatus(record){
  const amount=Number(record?.amount||0);
  const paid=paidForRecord ? paidForRecord(record) : Number(record?.paid||0);
  const balance=Math.max(amount-paid,0);
  const current=normalizeCommercialStatus(record?.status);
  if(current==="CANCELADO" || current==="PERDIDO")return current;
  if(amount>0 && balance<=0)return "LIQUIDADO";
  if(paid>0 && ["COTIZADO","EN SEGUIMIENTO","ANTICIPO RECIBIDO","CONFIRMADO CON ANTICIPO"].includes(current))return "CONFIRMADO CON ANTICIPO";
  return current;
}
function isConfirmedStatus(status){
  const s=normalizeCommercialStatus(status);
  return ["CONFIRMADO SIN ANTICIPO","CONFIRMADO CON ANTICIPO","LIQUIDADO"].includes(s);
}
function statusBadgeClass(status){
  const s=normalizeCommercialStatus(status);
  if(s==="COTIZADO")return "statusQuoted";
  if(s==="CONFIRMADO SIN ANTICIPO")return "statusConfirmedNoPay";
  if(s==="CONFIRMADO CON ANTICIPO")return "statusConfirmedPay";
  if(s==="LIQUIDADO")return "statusLiquidated";
  if(s==="CANCELADO")return "statusCanceled";
  if(s==="PERDIDO")return "statusLost";
  return "statusQuoted";
}
function commercialStatusLabel(status){
  return normalizeCommercialStatus(status);
}

function displayCatalogItemName(name){
  const n=normalizeCatalogKey(name);
  if(n==="ING ILUMINACION" || n==="ING ILUMINACION VIDEO")return "ING ILUMINACION/VIDEO";
  return name;
}

function quoteBool(v){
  return v===true || v===1 || String(v||"").toLowerCase()==="true" || String(v||"").toLowerCase()==="si" || String(v||"").toLowerCase()==="sí";
}
function quoteCatalogMeta(qc){
  if(!qc)return {};
  if(typeof qc==="string"){
    try{qc=JSON.parse(qc)}catch(e){return {}}
  }
  if(!qc || typeof qc!=="object")return {};
  return qc.__quote_meta || qc.__meta || qc.quote_meta || {};
}
function recordInvoiceRequested(r){
  const meta=quoteCatalogMeta(r?.quote_catalog);
  return quoteBool(r?.invoice_requested ?? meta.invoice_requested ?? meta.solicita_factura ?? meta.factura);
}
function recordAmountBase(r){
  const meta=quoteCatalogMeta(r?.quote_catalog);
  const fromField=Number(r?.amount_base||0);
  if(fromField>0)return Math.round(fromField);
  const fromMeta=Number(meta.amount_base||meta.subtotal||0);
  if(fromMeta>0)return Math.round(fromMeta);
  const amount=Number(r?.amount||0);
  if(amount>0 && recordInvoiceRequested(r))return Math.round(amount/1.16);
  return Math.round(amount||0);
}
function quoteIvaFromSubtotal(subtotal, invoiceRequested){
  return invoiceRequested?Math.round(Number(subtotal||0)*0.16):0;
}
function quoteAmountFromSubtotal(subtotal, invoiceRequested){
  const base=Math.round(Number(subtotal||0));
  return base + quoteIvaFromSubtotal(base, invoiceRequested);
}
function getStaffQtyFromQuoteCatalog(qc,aliases=[]){
  let qty=0;
  const aliasKeys=aliases.map(normalizeCatalogKey);
  try{
    const sections=getSelectedCatalogSections(parseMaybeJson(qc));
    sections.forEach(sec=>{
      sec.items.forEach(item=>{
        const itemKey=normalizeCatalogKey(item.item);
        if(aliasKeys.some(a=>itemKey===a || itemKey.includes(a) || a.includes(itemKey))){
          qty+=toMoneyNumber(item.qty)||0;
        }
      });
    });
  }catch(e){console.warn("No se pudo calcular staff desde cotizador",e)}
  return qty;
}
function staffQuantitiesFromRecord(record){
  return {
    audioQty:getStaffQtyFromQuoteCatalog(record?.quote_catalog,["ING. AUDIO","ING AUDIO"]),
    lightingVideoQty:getStaffQtyFromQuoteCatalog(record?.quote_catalog,["ING ILUMINACION/VIDEO","ING ILUMINACION VIDEO","ING ILUMINACION","ING. ILUMINACIÓN","ING ILUMINACIÓN"]),
    stageHandsQty:getStaffQtyFromQuoteCatalog(record?.quote_catalog,["STAGE HANDS","STAGE HAND"])
  };
}
function calculateEventExpenses(record,overrideExpenses=null){
  record=normalizeRecord(record||{});
  const expenses=normalizeExpenses(overrideExpenses || record.expenses_jsonb);
  const staff=staffQuantitiesFromRecord(record);
  const staffFromQuote=(staff.audioQty*STAFF_AUDIO_RATE)+(staff.lightingVideoQty*STAFF_LIGHTING_VIDEO_RATE)+(staff.stageHandsQty*STAGE_HAND_RATE);
  const previousDaySetupTotal=toMoneyNumber(expenses.previousDaySetupPeople)*PREVIOUS_DAY_SETUP_RATE;
  const setupExtras=toMoneyNumber(expenses.setupExtras);
  const staffExtras=toMoneyNumber(expenses.staffExtras);
  const generatorExpense=toMoneyNumber(expenses.generatorExpense);
  const djsExpense=toMoneyNumber(expenses.djsExpense);
  const miscTotal=expenses.miscExpenses.reduce((sum,item)=>sum+toMoneyNumber(item.amount),0);
  const totalStaff=staffFromQuote+previousDaySetupTotal+setupExtras+staffExtras;
  const totalExpenses=totalStaff+generatorExpense+djsExpense+miscTotal;
  const totalQuoted=toMoneyNumber(record.amount);
  const totalPaid=paidForRecord(record);
  return {
    expenses,
    ...staff,
    staffFromQuote,
    previousDaySetupTotal,
    setupExtras,
    staffExtras,
    generatorExpense,
    djsExpense,
    miscTotal,
    totalStaff,
    totalExpenses,
    totalQuoted,
    totalPaid,
    realProfit:totalPaid-totalExpenses,
    projectedProfit:totalQuoted-totalExpenses
  };
}

function setInput(id,value){
  const el=$(id);
  if(!el)return;
  el.value=value ?? "";
  try{ el.dispatchEvent(new Event("input",{bubbles:true})); }catch(e){}
  try{ el.dispatchEvent(new Event("change",{bubbles:true})); }catch(e){}
}

function save(){db.records=records;db.contacts=contacts;db.eventFiles=eventFiles;db.eventPayments=eventPayments;localStorage.setItem(STORE,JSON.stringify(db));renderSyncStatus();}
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
  if(r.expensesJsonb&&!r.expenses_jsonb)r.expenses_jsonb=r.expensesJsonb;
  const meta=quoteCatalogMeta(r.quote_catalog);
  if(r.invoice_requested===undefined && meta && Object.prototype.hasOwnProperty.call(meta,"invoice_requested"))r.invoice_requested=quoteBool(meta.invoice_requested);
  if(!r.amount_base && meta && Number(meta.amount_base||0)>0)r.amount_base=Math.round(Number(meta.amount_base));
  r.expenses_jsonb=normalizeExpenses(r.expenses_jsonb);
  r.status=inferCommercialStatus(r);
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
  const amount_base=quoteSubtotalInput();
  const invoice_requested=quoteInvoiceRequested();
  out.__quote_meta={invoice_requested,amount_base,iva:quoteIvaFromSubtotal(amount_base,invoice_requested),amount:quoteAmountFromSubtotal(amount_base,invoice_requested)};
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

function quoteSubtotalInput(){return Number($("quoteTotal")?.value||0)}
function quoteInvoiceRequested(){return !!$("quoteInvoiceRequested")?.checked}
function quoteTotalWithIvaFromSubtotal(subtotal){return Math.round(Number(subtotal||0)*1.16)}
function updateQuoteBalance(){
  const subtotal=quoteSubtotalInput();
  const factura=quoteInvoiceRequested();
  const iva=quoteIvaFromSubtotal(subtotal,factura);
  const total=quoteAmountFromSubtotal(subtotal,factura);
  const paid=Number($("quotePaid")?.value||0);
  if($("quoteTaxSummary"))$("quoteTaxSummary").textContent=factura?`Factura: Sí · IVA 16%: ${money(iva)} · Total dashboard/PDF: ${money(total)}`:`Factura: No · Dashboard/PDF sin IVA: ${money(total)}`;
  if($("quoteBalance"))$("quoteBalance").textContent=money(Math.max(total-paid,0));
}
$("quoteTotal").oninput=updateQuoteBalance;$("quotePaid").oninput=updateQuoteBalance;if($("quoteInvoiceRequested"))$("quoteInvoiceRequested").onchange=updateQuoteBalance;
$("clearQuoteBtn").onclick=()=>{
  if(!confirm("¿LIMPIAR COTIZADOR?"))return;
  ["quoteClient","quoteCompany","quotePhone","quoteEmail","quoteInstagram","quoteProject","quoteDate","quoteVenue","quotePax","quoteServiceHours","quoteSetupHours","quoteSetupTime","quoteStartTime","quoteEndTime","quoteTotal","quoteNotes"].forEach(id=>$(id).value="");
  $("quotePaid").value=0;if($("quotePaidDate"))$("quotePaidDate").value=todayISO();if($("quoteInvoiceRequested"))$("quoteInvoiceRequested").checked=false;if($("quoteStatus"))$("quoteStatus").value="COTIZADO";$("quoteSetupType").value="MISMO DÍA";clearCatalog();updateQuoteBalance()
};

function clearQuoteForm(){
  ["quoteClient","quoteCompany","quotePhone","quoteEmail","quoteInstagram","quoteProject","quoteDate","quoteVenue","quotePax","quoteServiceHours","quoteSetupHours","quoteSetupTime","quoteStartTime","quoteEndTime","quoteTotal","quoteNotes"].forEach(id=>{if($(id))$(id).value=""});
  if($("quotePaid"))$("quotePaid").value=0;
  if($("quotePaidDate"))$("quotePaidDate").value=todayISO();
  if($("quoteInvoiceRequested"))$("quoteInvoiceRequested").checked=false;
  if($("quotePaidMethod"))$("quotePaidMethod").value="";
  if($("quoteStatus"))$("quoteStatus").value="COTIZADO";
  if($("quoteSetupType"))$("quoteSetupType").value="MISMO DÍA";
  editingRecordId=null;
  clearCatalog();
  updateQuoteBalance();
  if($("saveQuoteBtn"))$("saveQuoteBtn").textContent="GUARDAR COMO COTIZACIÓN";
  if($("cancelEditBtn"))$("cancelEditBtn").classList.add("hidden");
  if($("editNotice"))$("editNotice").classList.add("hidden");
  if($("quoteFormTitle"))$("quoteFormTitle").textContent="🧾 COTIZADOR";
}
if($("cancelEditBtn"))$("cancelEditBtn").onclick=()=>clearQuoteForm();

function collectQuoteData(local_id=null){const amount_base=quoteSubtotalInput(),invoice_requested=quoteInvoiceRequested(),amount=quoteAmountFromSubtotal(amount_base,invoice_requested),paid=Number($("quotePaid").value||0);return{local_id:local_id||uid(),type:"COTIZACIÓN ENVIADA",date:$("quoteDate").value,client:$("quoteClient").value,company:$("quoteCompany").value,phone:$("quotePhone").value,email:$("quoteEmail").value,instagram:$("quoteInstagram").value,event_type:$("quoteEventType").value,project:$("quoteProject").value,venue:$("quoteVenue").value,pax:Number($("quotePax").value||0),service_hours:Number($("quoteServiceHours").value||0),setup_type:$("quoteSetupType").value,setup_hours:Number($("quoteSetupHours").value||0),setup_time:$("quoteSetupTime").value,start_time:$("quoteStartTime").value,end_time:$("quoteEndTime").value,amount_base,invoice_requested,amount,paid,paid_method:$("quotePaidMethod")?.value||"",paid_date:$("quotePaidDate")?.value||todayISO(),status:normalizeCommercialStatus($("quoteStatus")?.value || (paid>=amount&&amount>0?"LIQUIDADO":paid>0?"CONFIRMADO CON ANTICIPO":"COTIZADO")),notes:$("quoteNotes").value,quote_catalog:getCatalogSelection(),updated_at:new Date().toISOString(),_dirty:true}}
$("saveQuoteBtn").onclick=async()=>{
  const amount=quoteSubtotalInput();
  if(!$("quoteClient").value||!$("quoteDate").value)return alert("AGREGA CLIENTE Y FECHA.");
  if(!amount)return alert("AGREGA PRODUCCIÓN SIN IVA.");
  const actor=askActor(editingRecordId?"actualizar evento":"crear evento");
  if(!actor)return;
  const oldRecord=editingRecordId?(records.find(r=>r.local_id===editingRecordId)||{}):null;
  if(editingRecordId){
    const i=records.findIndex(r=>r.local_id===editingRecordId);
    if(i>=0){
      const rec={...records[i],...collectQuoteData(editingRecordId),updated_by:actor,updated_at:new Date().toISOString(),_dirty:true};
      records[i]=rec;save();renderAll();
      await syncAll();await createInitialAdvancePaymentIfNeeded(rec,actor);await updateRecordAudit(rec.local_id,actor);
      await insertHistory(rec.local_id,"UPDATE",diffRecords(oldRecord,rec).join("\n\n"),actor);
      await syncAll();
      alert("CAMBIOS GUARDADOS.");
      clearQuoteForm();document.querySelector('[data-tab="records"]').click();return
    }
  }
  const rec={...collectQuoteData(),updated_by:actor,updated_at:new Date().toISOString(),_dirty:true};
  records.push(rec);save();renderAll();
  await syncAll();await createInitialAdvancePaymentIfNeeded(rec,actor);await updateRecordAudit(rec.local_id,actor);
  await insertHistory(rec.local_id,"CREATE","Creó evento",actor);
  await syncAll();
  alert("COTIZACIÓN GUARDADA.");
};
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
  ["id","local_id","type","date","client","company","phone","email","instagram","event_type","project","venue","pax","service_hours","setup_type","setup_hours","setup_time","start_time","end_time","amount_base","invoice_requested","amount","paid","status","notes","quote_catalog","expenses_jsonb","paid_method","paid_date","updated_by","updated_at"].forEach(k=>{
    out[k]=firstValue(remote[k], local[k]);
  });
  out.quote_catalog=parseMaybeJson(firstValue(remote.quote_catalog, local.quote_catalog));
  out.expenses_jsonb=normalizeExpenses(parseMaybeJson(firstValue(remote.expenses_jsonb, local.expenses_jsonb)));
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
  setInput("quoteTotal", recordAmountBase(r)||"");
  if($("quoteInvoiceRequested"))$("quoteInvoiceRequested").checked=recordInvoiceRequested(r);
  setInput("quotePaid",r.paid);setInput("quotePaidMethod",r.paid_method||"");
  const firstPayment=(eventPayments||[]).filter(p=>p.record_local_id===r.local_id).sort((a,b)=>String(a.payment_date||a.created_at).localeCompare(String(b.payment_date||b.created_at)))[0];
  setInput("quotePaidDate", firstPayment?.payment_date || r.paid_date || todayISO());
  setInput("quoteStatus",normalizeCommercialStatus(r.status));
  setInput("quoteNotes",r.notes);
  setCatalogSelection(parseMaybeJson(r.quote_catalog));
  updateQuoteBalance();
  $("saveQuoteBtn").textContent="GUARDAR CAMBIOS";
  $("cancelEditBtn").classList.remove("hidden");
  if($("editNotice"))$("editNotice").classList.remove("hidden");
  if($("quoteFormTitle"))$("quoteFormTitle").textContent="✏️ EDITAR EVENTO";
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


function formatDateEs(dateStr){
  if(!dateStr)return "";
  try{
    const d=new Date(dateStr+"T12:00:00");
    return d.toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"});
  }catch(e){return dateStr}
}
function getSelectedCatalogSections(qc){
  if(!qc)return [];
  if(typeof qc==="string"){try{qc=JSON.parse(qc)}catch(e){return []}}
  const sections=[];
  Object.entries(CATALOG).forEach(([rub])=>{
    const data=getCatalogDataForRubro(qc,rub);
    const selected=normalizeSelectedList(data);
    const items=selected.map(x=>({
      item:String(x.item||x.name||x.equipo||x.label||"").trim(),
      qty:Number(x.qty ?? x.cantidad ?? x.quantity ?? x.cant ?? 1)||1
    })).filter(x=>x.item);
    const notes=(data&&typeof data==="object")?(data.notes||data.observations||data.observaciones||""):"";
    if(items.length||notes)sections.push({rub,items,notes});
  });
  return sections;
}
function generateWarehouseOrderPdf(key){
  const r=normalizeRecord(findLocalRecordFlexible(key)||records.find(x=>x.local_id===key)||{});
  if(!r.local_id && !r.client)return alert("No encontré este evento para generar pedido de bodega.");
  const sections=getSelectedCatalogSections(parseMaybeJson(r.quote_catalog));
  const today=new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"});
  const title=(r.project||r.client||"EVENTO").toUpperCase();
  const rowsHtml=sections.length?sections.map(sec=>`
    <section class="section">
      <h2>${esc(sec.rub)}</h2>
      ${sec.items.length?`<table><thead><tr><th>CANT.</th><th>EQUIPO / SERVICIO</th><th>CHECK</th></tr></thead><tbody>${sec.items.map(i=>`<tr><td class="qty">${esc(i.qty)}</td><td>${esc(displayCatalogItemName(i.item))}</td><td class="check">☐</td></tr>`).join("")}</tbody></table>`:""}
      ${sec.notes?`<div class="notes"><strong>OBSERVACIONES ${esc(sec.rub)}:</strong><br>${esc(sec.notes)}</div>`:""}
    </section>
  `).join(""):`<p class="empty">No hay equipo seleccionado en este evento.</p>`;
  const html=`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Pedido Bodega - ${esc(title)}</title>
<style>
  @page{size:A4;margin:16mm}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#111827;margin:0;background:white}
  .header{border-bottom:3px solid #0f172a;padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;gap:20px}
  .brand h1{margin:0;font-size:28px;letter-spacing:.08em;color:#0f172a}
  .brand p{margin:4px 0 0;color:#475569;font-size:13px}
  .docTitle{text-align:right}
  .docTitle h2{margin:0;font-size:20px;color:#0f172a}
  .docTitle p{margin:4px 0;color:#475569;font-size:12px}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;margin-bottom:18px;border:1px solid #cbd5e1;border-radius:12px;padding:14px;background:#f8fafc}
  .info div{font-size:13px}
  .label{font-weight:800;color:#334155;display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
  .section{page-break-inside:auto;break-inside:auto;margin:18px 0}
  .section h2{background:#0f172a;color:white;font-size:15px;padding:8px 10px;border-radius:8px;margin:0 0 8px;text-transform:uppercase;break-after:avoid;page-break-after:avoid}
  table{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
  thead{display:table-header-group}th{background:#e2e8f0;text-align:left;padding:7px;border:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#334155}
  tr{page-break-inside:avoid;break-inside:avoid}td{padding:8px;border:1px solid #cbd5e1;vertical-align:middle;word-break:break-word;overflow-wrap:anywhere}
  .qty{width:70px;text-align:center;font-weight:800}
  .check{width:70px;text-align:center;font-size:20px}
  .notes{border-left:4px solid #0f172a;background:#f8fafc;padding:10px;margin-top:8px;font-size:12px;white-space:pre-wrap}
  .observations{margin-top:18px;border:1px solid #cbd5e1;border-radius:12px;padding:14px;background:#f8fafc;page-break-inside:avoid}
  .observations h2{margin:0 0 8px;font-size:15px;color:#0f172a}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:40px}
  .sig{border-top:1px solid #111827;text-align:center;padding-top:8px;font-size:12px;color:#334155}
  .footer{margin-top:20px;font-size:10px;color:#64748b;text-align:center}
  .noPrint{position:fixed;top:12px;right:12px}
  .noPrint button{padding:10px 14px;border:0;border-radius:8px;background:#0f172a;color:white;font-weight:800;cursor:pointer}
  @media print{.noPrint{display:none}.section{break-inside:auto;page-break-inside:auto}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}}
</style>
</head>
<body>
<div class="noPrint"><button onclick="window.print()">IMPRIMIR / GUARDAR PDF</button></div>
<div class="header">
  <div class="brand">
    <h1>TOPDJS</h1>
    <p>Audio · Iluminación · Video · DJ</p>
  </div>
  <div class="docTitle">
    <h2>PEDIDO DE BODEGA</h2>
    <p>Generado: ${esc(today)}</p>
  </div>
</div>
<div class="info">
  <div><span class="label">Evento / Proyecto</span>${esc(r.project||r.client||"")}</div>
  <div><span class="label">Cliente</span>${esc(r.client||"")}</div>
  <div><span class="label">Fecha</span>${esc(formatDateEs(r.date))}</div>
  <div><span class="label">Venue</span>${esc(r.venue||"")}</div>
  <div><span class="label">PAX</span>${esc(r.pax||"")}</div>
  <div><span class="label">Horas de servicio</span>${esc(r.service_hours||"")}</div>
  <div><span class="label">Montaje</span>${esc(r.setup_type||"")} ${r.setup_time?("· "+esc(r.setup_time)):""} ${r.setup_hours?("· "+esc(r.setup_hours)+" hrs"):""}</div>
  <div><span class="label">Horario evento</span>${esc(r.start_time||"")} ${r.end_time?(" - "+esc(r.end_time)):""}</div>
</div>
${rowsHtml}
<div class="observations">
  <h2>OBSERVACIONES GENERALES</h2>
  <div>${esc(r.notes||"Sin observaciones.")}</div>
</div>
<div class="signatures">
  <div class="sig">ENTREGA BODEGA / GEORGE</div>
  <div class="sig">RECIBE OPERACIÓN TOPDJS</div>
</div>
<div class="footer">Documento operativo interno. No incluye precios ni costos.</div>
<script>setTimeout(()=>window.print(),500)</script>
</body>
</html>`;
  const w=window.open("","_blank");
  if(!w)return alert("Safari bloqueó la ventana emergente. Permite pop-ups para generar el PDF.");
  w.document.open();
  w.document.write(html);
  w.document.close();
}


/* TOPDJS CRM v11.4.54 - PDF cliente español / inglés desde cotizador */
function quotePdfCleanSectionTitle(rub,lang="es"){
  const key=normalizeCatalogKey(rub);
  let es="Rubro";
  if(key.includes("AUDIO"))es="Audio";
  else if(key.includes("CABINA")||key.includes("DJ"))es="Cabina y DJ";
  else if(key.includes("ILUMINACION"))es="Iluminación";
  else if(key.includes("VIDEO"))es="Video";
  else if(key.includes("ADICIONALES"))es="Adicionales";
  else if(key.includes("STAFF"))es="Staff";
  else if(key.includes("TRANSPORTE"))es="Transporte";
  else es=String(rub||"").replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+\s*/,"").trim()||"Rubro";
  if(lang!=="en")return es;
  const enMap={"Audio":"Audio","Cabina y DJ":"DJ Booth and DJ","Iluminación":"Lighting","Video":"Video","Adicionales":"Add-ons","Staff":"Staff","Transporte":"Transportation","Rubro":"Section"};
  return enMap[es]||es;
}
function quotePdfLabels(lang="es"){
  const en=lang==="en";
  return en?{
    htmlLang:"en",legend:"Audio • Lighting • Video • DJ",print:"PRINT / SAVE PDF",close:"CLOSE",
    folio:"Folio",issued:"Issue date",validity:"Valid for",validityDays:"7 days",
    clientTitle:"CLIENT AND EVENT DETAILS",clientSub:"General information loaded automatically from the quote builder.",
    client:"Client:",event:"Event:",phone:"Phone:",email:"Email:",eventDate:"Event date:",schedule:"Schedule:",venue:"Venue:",executive:"Executive:",
    noItems:"No equipment or services selected in the quote builder.",sectionNotes:"Notes:",
    production:"Production total",vat16:"VAT 16%",vat:"VAT",total:"TOTAL",paid:"Deposit / paid",balance:"Remaining balance",
    generalNotes:"GENERAL NOTES",conditions:"TERMS AND CONDITIONS",
    conditionDeposit:"The date is reserved with the deposit.",
    conditionBalance:"The remaining balance must be paid before the event starts.",
    conditionAvailability:"Proposal subject to date and equipment availability.",
    conditionVatYes:"Prices are expressed in MXN and include 16% VAT.",
    conditionVatNo:"Prices are expressed in MXN. VAT is not included because invoice was not requested.",
    alertClient:"Add the client before generating the PDF.",alertAmount:"Add the production amount before generating the PDF.",
    popupBlocked:"Safari blocked the pop-up window. Allow pop-ups to generate the PDF.",notFound:"I couldn't find this event to generate the client PDF."
  }:{
    htmlLang:"es",legend:"Audio • Iluminación • Video • DJ",print:"IMPRIMIR / GUARDAR PDF",close:"CERRAR",
    folio:"Folio",issued:"Fecha de emisión",validity:"Vigencia",validityDays:"7 días",
    clientTitle:"DATOS DEL CLIENTE Y EVENTO",clientSub:"Información general cargada automáticamente desde el cotizador.",
    client:"Cliente:",event:"Evento:",phone:"Teléfono:",email:"Correo:",eventDate:"Fecha del evento:",schedule:"Horario:",venue:"Lugar:",executive:"Ejecutivo:",
    noItems:"No hay equipo o servicios seleccionados en el cotizador.",sectionNotes:"Observaciones:",
    production:"Producción total",vat16:"IVA 16%",vat:"IVA",total:"TOTAL",paid:"Anticipo / pagado",balance:"Saldo pendiente",
    generalNotes:"OBSERVACIONES GENERALES",conditions:"CONDICIONES",
    conditionDeposit:"La fecha se aparta con el anticipo.",
    conditionBalance:"El saldo se liquida antes del inicio del evento.",
    conditionAvailability:"Propuesta sujeta a disponibilidad de fecha y equipo.",
    conditionVatYes:"Los precios están expresados en MXN e incluyen IVA.",
    conditionVatNo:"Los precios están expresados en MXN. No incluye IVA porque no se solicitó factura.",
    alertClient:"Agrega el cliente antes de generar el PDF.",alertAmount:"Agrega la producción sin IVA antes de generar el PDF.",
    popupBlocked:"Safari bloqueó la ventana emergente. Permite pop-ups para generar el PDF.",notFound:"No encontré este evento para generar PDF de cliente."
  };
}
function quotePdfHtmlEsc(s){return esc(s).replace(/\n/g,"<br>")}
function quotePdfTodayLong(lang="es"){
  const locale=lang==="en"?"en-US":"es-MX";
  const opts=lang==="en"?{month:"long",day:"2-digit",year:"numeric"}:{day:"2-digit",month:"long",year:"numeric"};
  return new Date().toLocaleDateString(locale,opts);
}
function quotePdfDateLong(dateStr,lang="es"){
  if(!dateStr)return "";
  try{
    const d=new Date(dateStr+"T12:00:00");
    if(lang==="en")return d.toLocaleDateString("en-US",{month:"long",day:"2-digit",year:"numeric"});
    return d.toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"});
  }catch(e){return dateStr}
}
function quotePdfFolio(r){
  const base=(r.local_id||r.id||uid()).toString().replace(/[^a-z0-9]/gi,"").slice(-6).toUpperCase()||"000001";
  const y=(new Date()).getFullYear();
  return `TDJ-${y}-${base}`;
}
function quotePdfMoney(n){return money(Math.round(Number(n||0)))}
function quotePdfTotals(r){
  const factura=recordInvoiceRequested(r);
  const subtotal=recordAmountBase(r);
  const iva=quoteIvaFromSubtotal(subtotal,factura);
  const total=quoteAmountFromSubtotal(subtotal,factura);
  const existing=records.some(x=>String(x.local_id||"")===String(r.local_id||""));
  const paid=existing?paidForRecord(r):Number(r.paid||0);
  const balance=Math.max(total-paid,0);
  return {subtotal,iva,total,paid,balance,factura};
}
function quotePdfEventSchedule(r,lang="es"){
  if(r.start_time&&r.end_time)return lang==="en"?`${r.start_time} to ${r.end_time}`:`${r.start_time} a ${r.end_time} hrs`;
  if(r.start_time)return lang==="en"?`${r.start_time}`:`${r.start_time} hrs`;
  if(r.end_time)return lang==="en"?`Ends ${r.end_time}`:`Termina ${r.end_time} hrs`;
  return "";
}
function quotePdfSectionsFromRecord(r,lang="es"){
  return getSelectedCatalogSections(parseMaybeJson(r.quote_catalog))
    .filter(sec=>Array.isArray(sec.items)&&sec.items.length>0)
    .map(sec=>({
      title:quotePdfCleanSectionTitle(sec.rub,lang),
      items:sec.items.map(i=>({qty:Number(i.qty||1)||1,item:displayCatalogItemName(i.item||"")})).filter(i=>i.item),
      notes:String(sec.notes||"").trim()
    }));
}
function quotePdfBuildRecordFromCurrent(){
  return collectQuoteData("preview_"+uid());
}
function quotePdfBuildHtml(r,lang="es"){
  r=normalizeRecord(r||{});
  const L=quotePdfLabels(lang);
  const sections=quotePdfSectionsFromRecord(r,lang);
  const totals=quotePdfTotals(r);
  const folio=quotePdfFolio(r);
  const issued=quotePdfTodayLong(lang);
  const schedule=quotePdfEventSchedule(r,lang);
  const generalNotes=String(r.notes||"").trim();
  const sectionsHtml=sections.length?sections.map(sec=>`
    <section class="quote-section">
      <div class="quote-section-title">${quotePdfHtmlEsc(sec.title)}</div>
      <div class="quote-section-body">
        ${sec.items.map(i=>`<div class="quote-item"><span class="dot">•</span><span><strong>${quotePdfHtmlEsc(i.qty)} ×</strong> ${quotePdfHtmlEsc(i.item)}</span></div>`).join("")}
        ${sec.notes?`<div class="section-notes"><strong>${quotePdfHtmlEsc(L.sectionNotes)}</strong><br>${quotePdfHtmlEsc(sec.notes)}</div>`:""}
      </div>
    </section>`).join(""):`<p class="empty">${quotePdfHtmlEsc(L.noItems)}</p>`;
  const bottomGridClass=generalNotes?"bottom-grid":"bottom-grid only-conditions";
  const vatLabel=totals.factura?L.vat16:L.vat;
  return `<!doctype html>
<html lang="${L.htmlLang}"><head><meta charset="utf-8"><title>TopDJs ${quotePdfHtmlEsc(folio)}</title>
<style>
@page{size:letter;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#162234;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.noPrint{position:fixed;top:12px;right:12px;z-index:50;display:flex;gap:8px}.noPrint button{border:0;border-radius:10px;background:#00a2ff;color:#00111d;font-weight:900;padding:10px 14px;cursor:pointer;box-shadow:0 0 18px rgba(0,162,255,.35)}
.header{background:#000;color:#fff;text-align:center;padding:22px 54px 12px;border-bottom:2px solid #31d4ff;page-break-inside:avoid}.logo{width:150px;height:70px;object-fit:contain;display:block;margin:0 auto 8px}.legend{font-size:12px;letter-spacing:.14em;color:#5fc2ff;font-weight:950;text-transform:uppercase;margin:0 0 18px}.meta{display:flex;justify-content:space-between;gap:18px;font-size:12px;font-weight:800;color:#eef7ff}.meta span{white-space:nowrap}.sheet{min-height:11in;padding-bottom:.62in}.content{padding:26px 54px 72px}.client-card{position:relative;border:1.4px solid #000;border-radius:19px;padding:38px 24px 24px;margin:0 0 28px;page-break-inside:avoid}.client-title{position:absolute;left:50%;top:-14px;transform:translateX(-50%);background:#000;color:#fff;border-radius:999px;padding:7px 42px;font-size:13px;font-weight:950;letter-spacing:.03em;white-space:nowrap}.client-sub{font-size:11.5px;color:#5e7890;margin:0 0 16px}.client-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 34px}.client-col{display:grid;grid-template-columns:max-content 1fr;gap:9px 12px;align-items:baseline}.client-col+.client-col{border-left:1px solid #e6eef6;padding-left:28px}.label{color:#65758b;font-size:13px;font-weight:900;white-space:nowrap}.value{font-size:15px;color:#162234}.quote-section{border:1px solid #d9e4ef;border-radius:17px;margin:20px 0 24px;overflow:visible;page-break-inside:auto;break-inside:auto}.quote-section-title{background:#000;color:#00a2ff;font-size:22px;font-weight:950;padding:11px 22px;break-after:avoid;page-break-after:avoid}.quote-section-body{padding:12px 24px 14px;page-break-inside:auto;break-inside:auto}.quote-item{display:grid;grid-template-columns:18px minmax(0,1fr);gap:6px;font-size:14px;line-height:1.32;padding:6px 0;border-bottom:1px solid #edf2f7;page-break-inside:avoid;break-inside:avoid;overflow-wrap:anywhere;word-break:break-word}.quote-item:last-child{border-bottom:0}.dot{color:#00a2ff;font-weight:950}.section-notes{margin-top:12px;border-left:4px solid #00a2ff;background:#f6f9fc;border-radius:8px;padding:10px 12px;font-size:13px;color:#334155;line-height:1.35}.totals{background:#000;border:1.5px solid #00a2ff;border-radius:18px;margin:24px 0 24px;padding:18px 24px;page-break-inside:avoid;color:#fff}.total-row{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:8px 0;border-bottom:1px solid #2a4666;font-size:15px}.total-row:last-child{border-bottom:0}.total-row strong{font-weight:950}.total-row.highlight{padding:15px 0;color:#31d4ff;font-size:17px}.total-row.highlight .amount{font-size:25px}.amount{font-weight:950}.bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #d9e4ef;border-radius:18px;margin:24px 0 0;overflow:hidden;page-break-inside:avoid}.bottom-box{padding:18px 24px;min-height:145px}.bottom-box:first-child{border-right:1px solid #e6eef6}.bottom-box h2{margin:0 0 11px;color:#00a2ff;font-size:18px;letter-spacing:.03em}.bottom-box p,.bottom-box li{font-size:14px;line-height:1.35;margin:0 0 7px}.bottom-box ul{margin:0;padding-left:18px}.bottom-box li::marker{color:#00a2ff}.only-conditions{grid-template-columns:1fr}.only-conditions .bottom-box:first-child{display:none}.only-conditions .bottom-box{border-right:0}.empty{color:#65758b;font-size:14px}.footer{position:static;background:#000;border-top:2px solid #31d4ff;color:#c9d8e7;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;align-items:center;padding:12px 54px;font-size:11px;margin-top:18px;page-break-inside:avoid}.footer strong{color:#fff}.footer span{text-align:center}.footer span:first-child{text-align:left}.footer span:last-child{text-align:right}@media print{.noPrint{display:none}.client-card,.totals,.bottom-grid{break-inside:avoid;page-break-inside:avoid}.quote-section{break-inside:auto;page-break-inside:auto}.quote-item{break-inside:avoid;page-break-inside:avoid}.content{padding-bottom:30px}}
</style></head>
<body>
<div class="noPrint"><button onclick="window.print()">${quotePdfHtmlEsc(L.print)}</button><button onclick="window.close()">${quotePdfHtmlEsc(L.close)}</button></div>
<div class="sheet">
  <header class="header">
    <img class="logo" src="topdjs-logo.png" alt="TopDJs">
    <div class="legend">${quotePdfHtmlEsc(L.legend)}</div>
    <div class="meta"><span>${quotePdfHtmlEsc(L.folio)}: ${quotePdfHtmlEsc(folio)}</span><span>${quotePdfHtmlEsc(L.issued)}: ${quotePdfHtmlEsc(issued)}</span><span>${quotePdfHtmlEsc(L.validity)}: ${quotePdfHtmlEsc(L.validityDays)}</span></div>
  </header>
  <main class="content">
    <section class="client-card">
      <div class="client-title">${quotePdfHtmlEsc(L.clientTitle)}</div>
      <p class="client-sub">${quotePdfHtmlEsc(L.clientSub)}</p>
      <div class="client-grid">
        <div class="client-col">
          <div class="label">${quotePdfHtmlEsc(L.client)}</div><div class="value">${quotePdfHtmlEsc(r.client||"")}</div>
          <div class="label">${quotePdfHtmlEsc(L.event)}</div><div class="value">${quotePdfHtmlEsc(r.project||r.event_type||"")}</div>
          <div class="label">${quotePdfHtmlEsc(L.phone)}</div><div class="value">${quotePdfHtmlEsc(r.phone||"")}</div>
          <div class="label">${quotePdfHtmlEsc(L.email)}</div><div class="value">${quotePdfHtmlEsc(r.email||"")}</div>
        </div>
        <div class="client-col">
          <div class="label">${quotePdfHtmlEsc(L.eventDate)}</div><div class="value">${quotePdfHtmlEsc(quotePdfDateLong(r.date,lang)||"")}</div>
          <div class="label">${quotePdfHtmlEsc(L.schedule)}</div><div class="value">${quotePdfHtmlEsc(schedule)}</div>
          <div class="label">${quotePdfHtmlEsc(L.venue)}</div><div class="value">${quotePdfHtmlEsc(r.venue||"")}</div>
          <div class="label">${quotePdfHtmlEsc(L.executive)}</div><div class="value">TopDJs</div>
        </div>
      </div>
    </section>
    ${sectionsHtml}
    <section class="totals">
      <div class="total-row"><span>${quotePdfHtmlEsc(L.production)}</span><strong class="amount">${quotePdfMoney(totals.subtotal)}</strong></div>
      <div class="total-row"><span>${quotePdfHtmlEsc(vatLabel)}</span><strong class="amount">${quotePdfMoney(totals.iva)}</strong></div>
      <div class="total-row highlight"><strong>${quotePdfHtmlEsc(L.total)}</strong><strong class="amount">${quotePdfMoney(totals.total)}</strong></div>
      <div class="total-row"><span>${quotePdfHtmlEsc(L.paid)}</span><strong class="amount">${quotePdfMoney(totals.paid)}</strong></div>
      <div class="total-row"><span>${quotePdfHtmlEsc(L.balance)}</span><strong class="amount">${quotePdfMoney(totals.balance)}</strong></div>
    </section>
    <section class="${bottomGridClass}">
      <div class="bottom-box"><h2>${quotePdfHtmlEsc(L.generalNotes)}</h2><p>${generalNotes?quotePdfHtmlEsc(generalNotes):""}</p></div>
      <div class="bottom-box"><h2>${quotePdfHtmlEsc(L.conditions)}</h2><ul><li>${quotePdfHtmlEsc(L.conditionDeposit)}</li><li>${quotePdfHtmlEsc(L.conditionBalance)}</li><li>${quotePdfHtmlEsc(L.conditionAvailability)}</li><li>${quotePdfHtmlEsc(totals.factura?L.conditionVatYes:L.conditionVatNo)}</li></ul></div>
    </section>
  </main>
</div>
<footer class="footer"><span><strong>TopDJs</strong></span><span>@topdjs.mx</span><span>5530260203</span><span>www.topdjs.com.mx</span></footer>
<script>setTimeout(()=>window.print(),650)</script>
</body></html>`;
}

function quotePdfPrepareNoCrmUrlHtml(html){
  // v11.4.54: Safari puede abrir en blanco los documentos data:.
  // Mantenemos el logo con URL absoluta y volvemos a imprimir desde una ventana about:blank.
  // Esto evita romper la carga del PDF cliente y no expone la ruta interna del CRM dentro del contenido del documento.
  const logoUrl=new URL("topdjs-logo.png", window.location.href).href;
  return String(html||"").replace(/src="topdjs-logo\.png"/g, `src="${logoUrl}"`);
}
function openNoCrmUrlPrintWindow(html,popupBlockedMessage){
  const safeHtml=quotePdfPrepareNoCrmUrlHtml(html);
  const w=window.open("","_blank");
  if(!w)return false;
  try{
    w.document.open();
    w.document.write(safeHtml);
    w.document.close();
    setTimeout(()=>{try{w.focus()}catch(e){}},80);
    return true;
  }catch(e){
    try{w.close()}catch(_e){}
    console.error("No se pudo abrir PDF cliente",e);
    alert("No se pudo abrir el PDF del cliente. Revisa permisos de ventanas emergentes y vuelve a intentar.");
    return false;
  }
}

function quotePdfWinAnsiCode(ch){
  const map={
    "€":128,"‚":130,"ƒ":131,"„":132,"…":133,"†":134,"‡":135,"ˆ":136,"‰":137,"Š":138,"‹":139,"Œ":140,"Ž":142,
    "‘":145,"’":146,"“":147,"”":148,"•":149,"–":45,"—":45,"˜":152,"™":153,"š":154,"›":155,"œ":156,"ž":158,"Ÿ":159,
    "¡":161,"¢":162,"£":163,"¤":164,"¥":165,"¦":166,"§":167,"¨":34,"©":169,"ª":170,"«":171,"¬":172,"®":174,"¯":175,
    "°":176,"±":177,"²":178,"³":179,"´":180,"µ":181,"¶":182,"·":183,"¸":184,"¹":185,"º":186,"»":187,"¼":188,"½":189,"¾":190,"¿":191,
    "À":192,"Á":193,"Â":194,"Ã":195,"Ä":196,"Å":197,"Æ":198,"Ç":199,"È":200,"É":201,"Ê":202,"Ë":203,"Ì":204,"Í":205,"Î":206,"Ï":207,
    "Ð":208,"Ñ":209,"Ò":210,"Ó":211,"Ô":212,"Õ":213,"Ö":214,"×":120,"Ø":216,"Ù":217,"Ú":218,"Û":219,"Ü":220,"Ý":221,"Þ":222,"ß":223,
    "à":224,"á":225,"â":226,"ã":227,"ä":228,"å":229,"æ":230,"ç":231,"è":232,"é":233,"ê":234,"ë":235,"ì":236,"í":237,"î":238,"ï":239,
    "ð":240,"ñ":241,"ò":242,"ó":243,"ô":244,"õ":245,"ö":246,"÷":247,"ø":248,"ù":249,"ú":250,"û":251,"ü":252,"ý":253,"þ":254,"ÿ":255
  };
  if(map[ch]!==undefined)return map[ch];
  const code=ch.charCodeAt(0);
  if(code>=32&&code<=126)return code;
  const plain=String(ch).normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if(plain&&plain.charCodeAt(0)>=32&&plain.charCodeAt(0)<=126)return plain.charCodeAt(0);
  return 63;
}
function quotePdfLiteral(s){
  s=String(s??"").replace(/\r?\n/g," ");
  let out="";
  for(const ch of s){
    const code=quotePdfWinAnsiCode(ch);
    if(code===40||code===41||code===92)out+="\\"+String.fromCharCode(code);
    else if(code>=32&&code<=126)out+=String.fromCharCode(code);
    else out+="\\"+code.toString(8).padStart(3,"0");
  }
  return "("+out+")";
}
function quotePdfSafeFilePart(s){
  return String(s||"TopDJs").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/gi,"_").replace(/^_+|_+$/g,"").slice(0,42)||"Cotizacion";
}
function quotePdfFileName(r,lang="es"){
  const name=quotePdfSafeFilePart([r.client,r.project].filter(Boolean).join("_"));
  return `TopDJs_Cotizacion_${name}_${quotePdfFolio(r)}${lang==="en"?"_EN":""}.pdf`;
}
function quotePdfApproxWidth(text,size,bold=false){
  text=String(text??"");
  let w=0;
  for(const ch of text){
    if(ch===" ")w+=size*.28;
    else if("ilI.,:;|'!".includes(ch))w+=size*.24;
    else if("mwMW@#%".includes(ch))w+=size*.78;
    else w+=size*(bold?.56:.50);
  }
  return w;
}
function quotePdfWrapText(text,maxWidth,size=10,bold=false){
  text=String(text??"").replace(/\s+/g," ").trim();
  if(!text)return [""];
  const words=text.split(" ");
  const lines=[];
  let line="";
  const pushLong=(word)=>{
    let part="";
    for(const ch of word){
      const test=part+ch;
      if(part && quotePdfApproxWidth(test,size,bold)>maxWidth){lines.push(part);part=ch}else part=test;
    }
    line=part;
  };
  for(const word of words){
    const test=line?line+" "+word:word;
    if(quotePdfApproxWidth(test,size,bold)<=maxWidth)line=test;
    else{
      if(line)lines.push(line);
      if(quotePdfApproxWidth(word,size,bold)>maxWidth)pushLong(word);else line=word;
    }
  }
  if(line)lines.push(line);
  return lines.length?lines:[""];
}
const QUOTE_PDF_LOGO_JPEG_HEX="ffd8ffe000104a46494600010100000100010000ffdb0043000604040504040605050506060607090e0909080809120d0d0a0e1512161615121414171a211c17181f1914141d271d1f2223252525161c292c28242b21242524ffdb00430106060609080911090911241814182424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424ffc0001108012c012c03012200021101031101ffc4001d000100010501010100000000000000000000070104050608030209ffc40059100001030301040506070710080603000001000203040511060712213113415161710814223281a1425262728291b115235392a2b2c11718243343445463739395a3b3b4d1f0162834376474a4d226458384c2c32575e1ffc4001b01010002030101000000000000000000000005060103040207ffc40037110001030202060903040105000000000000010203041105210612314151f0132261718191a1c1d11432b12334e1f1241533425272ffda000c03010002110311003f00e5444440111100444401111004444011110044440111100444401111004444011110044440111100444401111004444011110044440111100444401111004455405111100455c26101445f41a55770f62cd8c5cf845e8233d8beba23d8b3aaa63590f24c2f5e88f62a18cf626aa8d643c917a1610be4b4ac58cdcf9455c22c19288aaa880222200888802222008888022220088880222200888802222008888022ae154372b2882e530aa1abda281d21c00b66d35a02f7a9a76456ea09a62e38c86f05ba381cfd88689276312ee53566c44ab982df34eedd646e73bb0053ad976176ab4b44baa2e6de9471f34a4f4dfe04f21ed3ec5b5d24564b0b5acb25928e98b794f3344d2f8e5c303d80298a5c1269b3b590ae56e945342baaceb2f67c904d97653aaef8d0fa3b354ba2fc2bdbb918fa4703deb65a3d84d7819b95eecf45dac6c8e9de3d91823dea4eadb9d5dc1c0d4d4cd31ea0f7138f00ac2aaae0a16efd5d4414aded9e46c7f9c429b8f47a1625e67fb1012e93d64cb685a89eabcf81abd3ec6b4c53e3ceefd73aa3d7e6f48c8c7d6e713ee57add97e858fd68afb378d546dfb232beaa35d698a524497ca571ec85af97f35a47bd58c9b4ed2cdf56aab65f99487f490b67d26151e4e7279fc1e126c665cd35bcadf05e9d9ae843fbc6f4def15ec3ff00d6ade7d93e8a947deea750531eddf86503d9bad56dfaa869b279dc80ed34a3fef5ed16d234b4a706e3345fcad2bc7d994e83097648a9e6a7abe32cff00bfaa98dabd89db64ff0060d541a4f26d6d0b9bf5b98e77d8b055fb12d57035cea28a82eec6ff0000aa6bdf8f98edd77b96ff004baa2c55ae0da6bcd048e3c9a65dc3f53f0b2be9ee87969ddea70e23ebe4bcbb03a2992f0bfc9514cb71ec469d6d2a79a5be0e77ba58ee166a834d72a1a9a29c7ee75113a33ef1c5583a22de61750fdd6a87d31a4a9e8eb694f382ae313478f07671ecc2d6aefb37d1d7e1bd0d3cf60aa3fba52132d393df138e40f9aef628aa9d1c9d99c7d64f5266934ae27653b757b5334e7cc800854216f3aa7651a834e432570823b95b187fdba84992368f963d667d203c56972445a78855f9607c6baae4b2968a7aa8a76ebc4eba1e28be88545a2c7414444401111004444011110044440111100444401111005501005e8c8cb8f05e912e6156c518c2e2b2f67b0d65dea594f494f24d23ce035adc92b39a1767d74d61718e9a8a0739b91befc70685d1162b258b67349d0da991d5dc88c4b54e00861f93dbe3cbb3b54bd0e1af9953220316c6e1a36e6b9f0de6a3a3f61d6cb1d34771d5b31e91cd0e65147eb1f1ff0038f15b954df5b494de6368a78add481bbbb908c39c3e53b99f0e5dcb1971b9ba632d5554e035a0be49657e034759713cbdaa34d49b558e31241606325dde0eafa81889bf31a78b8f79fa8ab3f454b40cd69973e1fc7ba947d7c431993558966fa78afb7a1be5cae94d414e6aabeae1a5847ee933f741f0eb27b86568976dac52c41ccb450c957838f38a93d145ec1ccfb485185d2fd3dc6a9d53533cd5d5279cd50738ee6b7901eeee58c96792776647b9c7ab279287abd2495fd5853553d4b4d068953c488b3aeb2f927cf3b0dbeebb44bdd7ef364bbc90b1dc0c340ce89be05dc09facad664af0f797f421ee3cdf338bdc7ec5668abf2d5cb2addeeb967869628535626a2276258b9371a8f8258cf9ac68fd0be4d7d51fdf337b1e42b7555a55cbc4df643d856d50fdf337e395f6db9d637f7c48ef9c77bed56a8b1751642f3ee8bdc31245049e3181f6615e5baff35ba4dfa3a9ada0773cd34c71ed1c32b0eaabdb667b56e8a79746d7259c991235ab69f768c86d50a4bab3c3a19bdc307ea2b73b3eb8b25e1c226d49a3a93c3cdeaf11927b03bd53f583dca06cab98abe4680c943678f96ec9c71e0798533498fd4c39397593b79b90559a39493dd5a9aabd9f1b3f074a53d6d4d04fd2412c904a060969c123b0f68ee2b0da874469cd621d2c914765b991c2a69e3fd8f29fe3231ea9f94cf6b4a8bf4deb8b8daf761a798d5d30fde554ec91fc9bf98f01f51525d83535bf51348a391cca960cc9492f09598e647c61de3da02b247554589b75244b3bd7c179ee2ab3d056e16fe9635cb8a7ba729da44dab7435db48d5086be9cee3c6f47330ef47237e335c3811de3db83c16b6e690ba6e1ab89d4afa1ada78eba865397d3ca7867e334f363be50f6e4705196bed961b7c325eac2e7555b33e9b08c494c4f26bc0e5dce1e8bbab07d155dc4f05929baedcdbc7877966c271f654da39727fa2917aa2f47b0b4e08e2be30a0552c58d14a2222c1908888022220088880222200888802ae117d34656510c2a9f4c664addb67ba02bb585d63a7a788f460e6479e01adeb393c397d4b15a474c55ea5bb4141490be492570680d193fe7fcf2cae90a1a4a1d19666d92d458e7903ceea1bc7a577c569f880fe31e3d804d61787ba77a645771cc61b471d93372ec42f6136dd2769166b0b5ad60189aa40c3a63d6075eefbcf5f501a9ea3d4f41a7690d5dc2577a4488a2671926776347da4f01ee56baaf5652e9ba3134a0cf57365b4f4ad3e94aeed3d8d0799f60e3ca10beea0abb8d749575151d3d6bf83a41ea423a9918e400ed1eced361aeaf8b0e6745166fe79b152c27059b1397ea6a57abf9ec4e09cedb993d59ad2b6fd31f3e76e42d398adf1388633b0bcf373bdff00356a93d4c950ede91dcb835a060347601d4bc89caa2a54f50f99cae7add4fa4d3d34703123892c885551116837844440111100444401111005554440572b2347767c7246659246ba320b2a2338963239107afedef58d555e9af56add0f2e6a392ca4c1a5f5e36b3a2a4bc4b1b647f086b8708e63d8ff008aeefe03b71ccef74959350ce4b319c1648c7b439af69e6d734f02d23982b9b296adf4e4b701f13bd78cf277f81ef52468cd6cca68e1b7dc272fa13e84154ff5a9cf5324f93d87abc380b86138da3d3a0a9f3f92978c601a979e953bd3e3e3cb817db48d9c53cb4d2ea1d3b016d3b706aa9012e75313c3393c4c64f00ee6393ba89891ec2d2410410ba5e92ae6a0a8df66ee402d735e039af69182d70e4e691c08e4415196d4741c5418bfd96277dcca876ebe204b8d2c98cee13d63009693cc020f169cf1e3584740bd345f6afa7f0756038d74b6a79d7adb978ff3f9232545f4e185455a542d851111600444401111004444011154202a02bba2a57d4ccc8d8dcb9c7002b763724297362da3e0aaa99b50dce10fa0a0c3831fca694fa8cf024127e4b4f6aeba581d2bd1ad4cd4e2aeab65344e95eb921bee86d311681d3ac9a403eec5c62cb891c69e170e5dce70fa9b8f8c559ea3d454fa7edb25c2abd3c1dd8a2070e99e79347da4f50f62ca5d2e6eaa9a7adab9c0f5a59647f00d038927b8282759eac96fb7035837990b331d1447f736678c87e538ff009e015d2a6666174a8c6fdebcdfe0f9ed052498c562cd37da9b7bb72218dd437eabb8d74f535526fd6cdc1ee1eac2dea8d83a801c3dddb9c165094544965748e5739733e97146d8da8c6a5910a2222d66c088880222200888802222008888022220088880aaf7a3ac7d2484b40731c30f61e4e1fe7ad5baaaca2aa2dd0c2a5c96740eaa13b21b3d5ca5ed7fa343338f1cfe05ddff0017eae442dfa9a788326a5ab87a7a2a9618aa20271becee3d4e07041ea202e73a0abf377ee3c9113c8dec7369ea70ef0a6ad277e75fedcee9ddbd5f4bbada83f8569f5651e3c8f7f1f84aed826229511fd34d9f3b0a363f867d3bfeaa1c9176f62f1e77f791a6bfd212693bd3e9c3c4d4b2812d34e1b812c6793b1d5c8823a8870ea5aa95d117fb0b358e9e9ad2581d5d06f4f407acbf197c5f4c0c8f94d1da573e5442e825731e30e69c155dc56816926566e5d9dc58b06c47eb20bbbee4c97e7c4f1455545144c0444401111004444017d00a817db064aca2185532364b6cd73af86960639f24af0d6b5a32493d8ba56a28a0d356aa3d3947bbbb46dcd416f292a081be7d980d1dcdef51cec2ec2d6d6d5ea69dbf7bb5303e2c8e0e9ddc231ec3977d05b95c6e1152415170aa71e86063a590e789038e3c49e1e255cb47a951a8ea97ec4e54a1693d5ba595b48cef5efdc868fb4ed42218596489e5bd2344f58e69e223f811f8b8f1fc5513544eea895d23f193d43901d41646ff00739ee5592d4543b33d4bccf2e3a89f55be002c52af6295ab553abf76e2d784d0368e9db1a6ddfdfcfa1444451a4984444011110044440111100444401111004444011110044440542da3476a196d15b0cedcb8c190f8f3fb7407d767b398ff00f8b565eb4f33a9e664acf598723bfb96ea799d13d1eddc699e16cd1ac6f4c94e8e8266b4c5534d312c706cb0cade0483c5ae1eef6a8db6c9a7d94f7686fd4910652dd017b9ad1c239c1fbeb7b864870ee78ec59fd01766d7db1f401d934a04d0e4f130bcf11f45e71f496c57db4b752694b9da3777aa030d652f0e3d2c6097347ce66f8f10d578c4236d7d0a4adda99fc9f3fa195d86d7f46fd97b2f76e539d48c2a2f495858f734f3070bcd50950fa2a0444583211110044440542b8a68cbde001924e02f00b3fa3ed525e6ff0041411025f513b226f8b9c00f790b6c4975354ae46b55549db4fdbc69ed0568a0680d9ab01af9fbf7bd18c1fa209fa6b4bda75d453db29edad771aa719a6c7e0a3e38f6bbf3548ba92789f759d94e079bc0441081f118035bee68505ed22e42b35056861cb212da36783065ff00944abbd7bbe8f0d48d36ae5eebf07cfb078d6b711599fbaebf1f3e069d2486591cf77371c95f0aab78d9f6c7755ed3292b2ab4f53d24b151c8d8a533d4b62c39c0918cf3e015114fa31a32299479286d2ff80daffa4635f5fad3f695fc0ed5fd231ac02184533feb4fda5ff02b57f48c69fad3f697fc0ad5fd211a021845331f24fda5ff0002b57f4846be25f254da4431ba47d25a9ac634b9c7ee847c00e68087117dcd13a095f13c61cc716b8761070a8c63a4706b412e270001cd01f28b7bb0ec92f572a515f5e196da1070e9aa1ed606f71738800fc9e2ef92b26fd39a02d4d2c96e55d7299a78f9a5292dfc795d183f88808c95149263d9fbf2d75bafd183c9dfb1df8fa20b7f397849a3b4b5dceeda2fcc8263c0435cc34ae27b017b9d193ffaad4047a8b357fd2376d373be3aea49630cc125cd208079120f207a8f23d44ac2a008aa0127014bb6ef25cda35cadf4b5d0d15b445550b268c3ebd8d76eb9a08c8ea3828088514cdfad43695fc0ad5fd231a7eb50da50fde56afe918d010d2a298e4f254da631a5cdb75b6423a99718b3ef2169daa3643ae74742ea8bde99b852d333d6a86b04b10f17b0968f694069aaa154b4854406e1b3bbd0b5dda1964762263ba397f9193d177d4482a64a79e5b6d73251832d3ca1d8ea25a7ec385cf1689fa1ae8c38e1926627783b87db83ec53bdb2add5f69b7d6bce5f2c01b21fe319e83bdedcfb55d346aa3598e85c5234a29b56464e9bf2f74f7226da65899a7f585c29606e299efe9a9fbe2780f67e4b80f62d50a95f6cd422a2df64bbb5be90649452bbbe376f37f26403e8a8a0f3558c420e82a1f1f052cf85d474f4ac7aedb7e3228888b8890088880222203e9bcd49bb0aa36cbad22ac70cb6df04b57ed631c5bf95baa336f35306c3e0e8a9351d6e38b689b0b4f7be560fb1ae5218747d24ec6715422f1893a3a491c9c3f391b94b336273a690fa3183238f734171fb173cdd677cf2b1f21cbe406577ce7924fe85376a9a934da6eed2e78f9abda3c5d86fff002505dc0e6ae41d4d21bf50c7e853fa532f5991f8f3e440e89c366c9276a2797f65baeb0f23776ee96d4bff003d4ffd939727a94f649b6daad9759ee34147434933eb6a193ba4a9df230d616ee80dc76e725540b91dc7d26382af48b94bf5dede9bcad16777b26ff15b56cb7ca26f3b44d716ed392db6d94b0d4895f24b1890b83591b9f81938c9ddc67ab280e84e953a4565d2f05a6ed735f576cf346497fb7d2d355cb154471be29f7b74b1d9048c1072382037e322b5b8bc3adf5409e06178fc92b96bf5dfdf4f1fb8b671ddf7eff15f32795d5ea4058eb2da5d1b86eb9a3a507079e0e781c20205ae8df3dd6a23898e7b9f3b9ad6b464925c7000ed53268fd2368d9cd9e3d43a929e1adbb54c7bf4544e7706b788df711c437208c8e2e20e086825dac6ca6c54773bc5c3535d9ae16ab635f552b41c178c80180f539ce7b180f56f13f055a6abd5757a8eeb515d52e1bf33b3868c35800c35ad1d4d680001d400080bdd4dacae1a8aa1b254ce5cd8c6ec51b406c7137e2b1838347700b5b95d21cb9c0f15e96d027ab635dea93c54f9ad364766b940cfb8623b754b2267de9e498a53ba3e1712d27bf23c148d2d02cec572290b896350503d8d9b2476f39d5d21caf8331e5959ad4ba5ae3a72b1d4b5f4b24120e20387ac3b41e44778e0b5f782d3c5724b03a35b3909382a193351ec5ba29b358f5849474ecb65ce275c6d1c40a673807d3e79ba079cee1ed69cb1dc9cd3cc63b58e958ad7d15c6d930aab6d534c90ccc6968737383e8924b4b490d730925a48e25ae693870f216d9a1ae0cab964d3758e61a6b93b14e64f561abdddd63bb9af07a27f7381e6d0b49bcd161fdb1b9ed5fa3fa51e3fd13b19073ffe3a9bfb26afceab8511b7dc6480b5ed0d764078f480cf23de3883de0afd0dd2b27fe13b0f7db694ff0054d40673a454e915b07977a21dba4f007b1727577953eb6b6d754d14d1da9efa799f1170a4f5b75c467d6ee4075c97f05f25c5a0ee9c023040e4477f6ae50b6795cea18ea58eafb7db6a20cfa51b62744e23b9c09f7ae92d29aa68b58e9da1bfdbf7852d63379ad77369070e69ef04108087b6efe4f96ebd5baab53690a18e8ee74ec74d55414eddd8ead8065ce634706c8064e070771e00f3e4c70c15fa54242d21cd3820e478ae13dbb698a7d27b50bdd0d14422a29656d5d3b00c06b25687ee8ee04b87b101a0b4907239f529bf42d4f9de96978f186a9b20ee6cd1e7f3a33f5a83c2977651319ad57085c7f7a3241dfd1cf8fb2453ba3f2ea55227120b4862d7a455e19998d774be7fb3eb8b719751d44352dee0ede8ddef733ea50595d09708fceb4e5fe9f19dfb74ae03bd85b27ff05cf6f18711d870b6e9247ab55adc510d1a3125e995abb94f944455d2c8111100444407db39a9af63ad0cd19a824c7174f48ccf76663fa1428ce6a6bd90383b44dfd99e2daaa4763f9f1fa54be0bfbb8fbc84c7ff0064ff000fca1e9ad8ff00e14ae1f19d0b3eb95bfe0a13aa3bd5329ed7b8fbd4d7acc6f698acee9203fd6b7fc542751c27907ca3f6aefd275ff21bdc71e8b27f8ceffd7b21e4888ab259c295bc98ff00df159cf64357fdde4514a953c99ce36bf683d90559ff00a79101d95d3e3ad467e51c7a5d93dcbe4cb09f795bc0a9ef51ef9404dd26ca6ec01f870fe72038e102a2aa0258a893fd1dd925b68e36ee4f7aac74b2fca8a060c0fe7277fe28ec51fbe5249395bbed0252ed1fa21cce1179a56b3e90aa39f716ad037d0c194b5c98a86f1c715d5b78ab0c7c25a79c111fc86ae48a1937640574fdd6a72298e7f7b43fd9b55b7479baeaa87ceb4dd9acb137b57d3fb3eab4515e290d15d6921ada53ca3947161ed6b87169ef0a30d5fb1c90b5f55a6247d74632e7524840a860f93d520f0c1ee2b7bf39ef492bd94103eaea6a22a6a78f8ba795fbac6fb7b7b87153b5986432b555f976959c3abaaa85c9d03b2e1b5179ec39b2aa9a4a695f1c8c731cc3bae6b86083d847515e2d7b8381638b5c0e5ae1d47a8adff69bae6d3a9dcd8686ded9248dde95ca56ee4b201f0434712def7f1ec0147a0f10be7f571323915ac75d389f5dc36a259e0492666a397773ef65365da33a3abb943748c006e10c758fc7c69581cffeb3a4fad76e6979f1a4ec1c7ff2aa33fd4b170bea773bee5d8d8f1c450b3eade791ee2bb5f4f4fbba5b4f8cff00e5345fd831729de6cb14c1d23067e10fb57e7aeae18d55781ff1d51fda3977a32b371e0e791054555de4e3a0ae159515b515da90cd512ba690b67840de7124e0747c064a0392dad24f2caeccf26ba6abb7ec968df541cd654d6d44f035df83c31b91dc5cd77bd62edbe4e5b36a0a86d44b1df2e1ba7220a9ac6b6377cee8d8d711ed0a4d6d4c71c3153c31450410b0451451343591b00c06b40e402032de73c39ae3ef2a0aa654ed4a60d2098a8a9e3763b4027f485d4770bcd35aa867aeac99b1c1030bdee71eaecf12703dab87b5d6a47eadd5973bcbf9554c5cd19e4d1c07b82030414a7b1c71779f3398347563c30227fe8516295762edcfdd03f168eb0fe4463f4a94c1ff0074c23716fdabfb8dd61c49157467887d0d534ff30f5cf137ed8ef12ba0e270632adc4f06d25493fcc3d73e4dfb63bc4a95d28ff759ddee4368b7d9277a7b9e6888aac5ac22220088880fa6f352f6c5e70eb46a4a6278f4304c3e8ca07ff628842933621539bfd6d0647ecca09e303b5c1bd20f7c6148e1726a54c6e5e2845634cd7a3911387e16e6cfaad866d357368e6d84483e8bdaefd054277066e575437b2477daa7aa9a715b04f480645444f871f39a40f790a08b9b5c2a03cf37b1ae3e38c1f782a6f4a23ebb1fd9621f45a4ea3e3edbf9ff00459a222a996d0a51f26c3bbb5bb59eca6ac3ff004d228b949de4e271b55b79eca4ad3ff4d2203a905677ad1f6e538936597819f850fe7ace79e600e3d4b51db0d474db32bc8cf230fe7a0395d11101224f27dddd94c0f69dea8b15797bf3cc4150c6b09f012c23f1c2d1b7966b455f62b556c94f5ac32d055c6ea7a98c1f5a270f4b1de301c3bdaad2ff006696c5717d2bde2689c04904ed1e8cf11f55e3c7ac7510475202de9e4dd713dc574d5774931a5630171f368797f26d5cbad7119e385b5ea4da4deb5253b696591b4b4823646ea7a7cb449bad032f3cddcb91e1dca7707c49947ace725d77156c7f079abe58ba354444bdd57b6dbb7f39920ea3da1daec5bd05118ee95ade0431ff00b1e33f29e3d63dcdfad45da83555cf51d409ae354e9b73f6b8c0dd8e21d8c60e03c79f7ac2ba527995f04ad15d8b4d54bd65cb86e3b70dc0a9e8facd4bbb8aedf0e1e1e373e9ce2e3c57a5353cb5751153c0d2e965788e368eb713803eb2bc8712b3f6668b351beef37a33bdae65083f1b8874be0d1903e567e2a8a55b9368962df5955c335d0c14eede8699ada761ed6b1a1a0fb704aeccb44fd1e9cb0b73cad143fddd8b85e590cb2179caed3a7aae8ecf6460eab4d0ff007762c19337e7409e057cfdd085bce7878ff18dff00158ba4ab2eaa840238c8d1c7c42e3bd432cb477fb9d3c6ec322ab998d1d40079080ed492e70b464d44000ed95a3f4ac15e368fa6ecd13dd5177a67cac19e869dc2590fb1a703da42e39fba153f84f705f12d54f38c492b9c3b09e1f52024cda9ed96af58c66d7400d35bc1e2d0ec979ed27acf8701d59c9262d444054297f63f188acb779fb289c33df24f1b7ec63944039a9cb42d11b6e849e5700d353514f00ef0c8dd2bbf2a567d4a6b018f5aa917810f8e49a94aeed2e2b67e82cd78989c6ed04e078b9bb83f3940cf39793da54c7ac6b3cd3495c08e73ba2807e36f9f746a1beb5d3a4b25ea1ade087268d47681cee2bec5d3ed3708ededb8be8aa1b46f76eb6a0c64309ec0ee4ad148b5f76d46fd9ac225d393476d7b194e2e241e8dcc69f44eee387118dee59ef51e35ae7b835a09738e00038955686457defb96db6e5baae18a356744ed6ba22ae56b2f0edef3e57b51d1d4dc2a194d4904b513c870d8e369739de002c85fb4adf34c3a06de6d755406a1bbf1f4ccddde1d7ed19191cc2c86cf6aee949a961169b6c972a8998e88d3c7eb39a464907ab18ce4f0c73597489a8af6e7e3ee6b8626ba56b255d54554badb6781af54d2cf453be9ea619219a338747234b5cd3de0af25b06bbaab8556a6aa374b7bedd54cdd8dd4ef1e93001c327af238e56bebd46ed66a39779e676319239b1add1156cbb2fe0542d9f67979161d616ab83ce2386a1864ef667d21f8bbcb585eb049d1bdaeec2b7c6ed5722a1cb346923158bb152c744dca99d6eb8cf037d78252d69eddd3c0fb828675edb7cc6ef50d68c31b338b7e649f7c6fe711ec52fc770fbb563b4de37b79f534cd8e63fc6c5e83beb01aefa4b48da25b7ce29a1ab68c97b0d3bbe7b72f8feb1bedf62bc630dfaaa1499bd8a517039169eb3a27efba78a72a45ea8aa42a2a197f0a4cf276cfeaa347ba093e655dcbfe564519ab9a0b8555b2a3ce28ea24825dd2c2e8dc5a4b48c11c3a884075b9328c0e8e4271f10ad636a4e79d9bdf03d8f6e3a0c6f348fdd173e7fa53791cae3523c2577f8af3a8d4776aaa7929e6afa87c520c3d8e9090e19cf1e3da02031a88880a825a410482388216cd6cbed357500b4de18f9299a4ba1919fb65338f32ccf307ada781eee046b0aa387240676e5a72ae8a3355016d6d09e22a69f2e681f2c7361f1e1d84ac4f1c6472ed5716ebe575b266cb4d51246f1f098ec159476aa82ac135d69b7543cf390c3d1bcf896609f694060b895e914124f2b628d8e7c8e386b1a32e71ee03895986df2cb1e4b6c14ae27e3cb2903d9bea926b2ab8e33150c74f40c230452c4d8cb877b80c9f6e50c1ed0d920b381517afdb0716d035df7c77f2847a83bbd6f9bcd622f17696e9505ef230006b5ad186b1a3935a3a805693d54b50497b89cfbd78a192abb1a5e9196fb406c7211f72683886923fd9a35c70b2a754de9c06f5ceadd801a332bb90181d7d800407595099c56d30e8a4e3333e01f8c1727eaf18d57791ff001d51fda397c8d537a04385caab23f8d77f8ac6cd349512be699ee92491c5cf7b8e4b8939249ed407c22220088880a83820e33dcb7ab4ed1ab591c7473742fa3648f91b4ae023dc73f1bc58f1d677470767905a2852e6d5763d68d05a034b6a2a1afafa8aabcb6374d1cfb9b8cde81b21ddc00799c713c9745355494eed68d6c73d4534750dd4912e86bdaeb53d25d6d1494d42666b448f92664acdd731c400d07a8f00ee23b568817dba691f1b6373dc58de409e017c0e6b35954ea995657ed31494aca6892266c4b930dcef7ae5fb18a786a34f411599d0c7079f878323a00e1b84c79c804868dfc71f6e569555a1b56e8f8ed17ea9b5c90b679a37d29f45e7a4c8731ae683904e0100f35b7dcaab5f9d90c10544d6e3666c31e58c07ce853646e071e5bbeaf2f4b18cf5ab8d7155b49974d5899759a81f1b6a20dc14a31389f1f7ae949e19f9bc33cd5569df244ed5623111cf75f35d9f3c776c2464ada692d7915551111366d4dde05a6dbeefac6b69ed306a6b053da20f4e58fa1944a2490801c0b813ba40c7a3dfd6b5ad91d7dfedface9dfa76dd1dc6aa48a48df4f23b71ae888f48977c10300e7edce16d9b4da0da0ea7aeb0daef4fb54fe7123a383cc4eec625c0df3213d600ce470c03858ed31a4359688d7d494f699ade6b25a77ca267b8ba9df0f27ef700ee040e18ce7185ea9d58da0e85752ea8ec9157577efdbde79931081d5092a4974db7caf96decc8d776a55d7cafd695b26a0a065056b0323f3761de6b181be8e1df0811c73d79f62d496d7b4e9aff003eb0ab9351be9df5c5acc1a7188ba3ddf4773af18ede3cf2b5452d4696818964d89b366cdc789256cae591ab745cefc42fa07057caaaea43c12d6c9aee2bacd71b0c8ecc90fecea607e48dd900f166ebbff4cacfd7d01ba505450821b24ad06271f832b4e587ebe1e0e2a1fd277d9b4e5fe8ae70e0ba09038b0f278e45a7b88241ee254d75be6ee91b5144f2fa3a86366a779e66377119ef1c8f782aeb80d424f4eea67eefc2945c7699d4f5493b3fe59f8a737f3208bb52f9b55bb0d2d6bfd36b4fc1ed6fb0e47b158a91f68962333c5c6060dda92e79007ab381f7c6fd21878efde0a392aab5d4aea7996352dd4354da985b2377944445c6760444401111004444011110044440111100444401111004444011110150ba6bca47fdccecf3e643fdd18b9942e9af291ff733b3df9b0ff7462039956ed6cd98555cb45c9a91971818e11c933298b0fa4c6121d976700fa27031ed195a42be8af77282dd25b62afa96514872fa76c8431c7bc725aa56c8a89d1adb3f434ccd91513a25b2dfd090ae564d4d1ecb29ea65d471c943d0c731a011e0884b86e8e9399c641dde5dfc17beb1b06ae8ec1658ebf51c75404f044210de8cc52387dec9939bf1cb27973e3cd46afbcdc64b7b6dafaea975130ef360321dc07c17d55deae75f4d052d5d7d54f053f08a39242e6b3ab805ca94af4722dd36aaece272369654722ddbb55766ef9250d5561d60cd47a7592ea88ea677d43a3827117442094005cedd1eb6475f338c606556b6c5ab7f545a1c6a78dd50fa47cb1d608034322190e6745c8e4f57239ce78708baaafd75ad9a09ea6e35734b4f8e85ef95c5d1e3b0f52fa9350dda5b8b6e4fb955bab1830d9cca77da3b01ece7c3bd786d1c8888976ec54d89bfd8f0da3991a88aadd8a9f6f1f6329b43a3b9516aaaa8ee9706dc6a1c18ff00386b77439a5a377d1f8381c30b5a5ed5757515f50fa9aa9a49e690e5d248e2e738f795e2bbe26ab588d5dc4842c56311aeda8811117b361f414a9b36d402e96b7d82a1ff00b229b7a6a4279b9bce48fddbe3bc3fb5452aeedd709ed9590d5d348e8a685e1ec7b79b4839047b576d055ba9a64953c7b8e0c46892ae058976ee5e0bcfa1374f4d0dc6966a1a9718e19c0fbe81930bc1cb641f34fd6091d6a22d4f629ecd5f2b268846e6bcb24637935fcf876b5c3d269eb07b94b36fbbd3ea1b6c776a66b19be776a21672865c6481f25dcdbdd91cc2f0bf589ba9e8446c8cbebe166e46c1cea62e7d1e7e3b4f161f16f5856dc568d95b024f0e6b6f42a984d73a8e65865c91573ec5e79b1092a2bcb8d03e826dc277d8ee2c900c078fd07a88ea2ad1519cd56ad94bca2a2a5d0a2222c190888802222008888022220088880222200888802a819e4a8a71f27ad905bb534753acf553186c56e739b1d3cc7763a991a379ee79fc1306323e1138e40a023bd27b29d69ade2f38b0e9facaba60706a4811c3fce3c869f615b4d4f931ed2e9e032b6d14739033d1c35f0b9fec1bc32b69da279535dea2b1f6ed0ac8ad76c807451d4ba169924038658d237636f60033e1c947f4db79da4d2d48a86eadb848e0725b2eebd87c5a46101a9def4e5df4cd73e82f56dabb75534718aa622c763b46798ef1c1742f9473f7f63da031d4d87fba317d68dda5d9f6fb40743ebca2a78aeb231c686b606ee83201cd99f524ebc0f45e01185e9e54149f73366ba42da5ed91d473b69dd23793cb29c3723c719407310192029c352ecb34bdb7c9eed3ad29a96a1b7ba914e6494d438b0efc8f69c3390e0d0a106fac3c574d6b577faa5d81bf2293fb59101ceba7ac559a9af74365b747d256574cc8226f56f38e327b00e64f602a73db7e8fd99eccb4b525a2db67655ea7aa89ac654bea6525ac6f07d439bbdbb9710434631c4fc550558eff0073d357165cad15b2d156c61cd64f11c3d808c1c1eac8247b57a5daf775d577635f77af9ebaba6dd619e776f38e006b467b00c202ff0048ecfb546bba9920d3b66a9af31fed923006c71fce7b886b7da56d771f270da4dbe99d38b0b2ab7465d1d255c53483e88764fb32a63daeeada9d85e85b0697d23147493ca1f19acdc0e2d2c6b7a493078191ee767273803c310ad9bca0b68b69b836aa4d45517066f664a7ad0248e41d98c6478821011e5453cd493c94f511490cd1b8b1f1c8d2d731c39820f10579a94b6e9aeb49ebfb85aeeb62a2a88ae6ea669b84ce01ad792d0430f5b9cc391bfd63038e145a80222200aaa8880d8747ea8934ddc37cb4cb4b30e8e78738123339e7d441e20f51ee254b0d9629a28aaa926e9a9a61bf14a38123bc75381e04751f6281c15b4e8fd612d8e534b53bd3504a417c60f169e41edcf270fa88e07a889fc1b15fa6774527d8be857f19c27ea13a6893ae9ebfcff5c2dbf6a7d2b16a6a796ae9a22eafc17cf0307a539038cb18fc263d66fc31c471510d750cb45286bf0e6b86f31ede2d78ed1fe7829be9e7639915552ce2489fe9c5346480707abac10798e60ab7d41a629357b1f244d8a1b9bcef3d8488e3ac77c607947377faafebc1e264f15c21264e9a0e79e7b2370ac6161fd0a8d9c78762907aa2cade6c157679e58e68a56889e63789185af89df15ed3c5a7dc7a962f0a9ef62b56ce2e0d72392e851111793d044440111100444401111004444011557ad2d24f5d511d3534324d34877591c6d2e738f600105ec790e6ba8769129d1fe4c960b7501e8bcfe9e8e098b0e33d2b5d3c9f8c781ee5cc3244f825747331cc7b096b9ae182d23982174cd6534bb53f272a1650033d75b208fef4de2e74b4c0b1ccc76988ef01d79080e63272551548c154405d5b6bea2d75f4f5f492ba2a8a691b344f6f36b9a720fd61749f952550add09a6eac7015157d301d9bf00763deb9fb45e95add69a9682c540c2e96ae50c73b1c228f9bde7b035b927c17407954f42cd1d628a06eec71d7398c1d8c6c386fb804073237d61e2ba5b5abbfd552c4dfe2a90ff5b22e696fac1748eb577faaed8dbfc4d1ff006b22039b5541c1c854440749d8369ba136b5a4e9f4ded0de28ee9086b5954f7f46d7bc0dd12b24c10c7118de6b86e9fab1ae6a8f260bc410babb4a5d29af34aef4a38652d86670eadd767a37fb08f05089639b82e69008c8c8e616c9a43689a9b4554b24b35d268a20ecba96425f049dce61e1ed183de80c25d2d75d65af9adf72a49e8eae076e4b04cc2c7b0f61055a2e8cdb6d2d16b9d96da35e8a7653d7b6385e71c5dd1484b5d193d61af196e790cf6ae74405111100444401541544406c5a6357d5582531b874f48f23a485e700f783f05c3a9dec391c149f6fb8d2dd297cee866e961e01c0f07c64f53c7578f23d4541eafad379acb35536a28e6746f6f0e1d63ac1078107b0f053786e30fa5ea3f36fe3b884c4b06654fea4793fd17bfe7f24e158da1bf53b69ef11bcbd8de8e2ad88033c4df8a73c2467c877b0851feaad9a54db2275752ba2968c9c0a98726027a83b3e942ef92fe1d8565ac7ada82eec6c752e6515572393885e7b89f50f71e1dfd4b6aa5aeaab6ce5f0c8f864ddc11d4e69ea20f0734f61c82ac52d252e22cd78d73e7695e86aeab0e7f46f4cb82fb103d5524f49298a789d1bc753873efef0bc70a75afb1e9cbec65b3530b5cee392e823e9299c7b4c24e587be323c169f79d90dd208df536f60ada71c7a5a171a86347ca681d233e934f8aad55e0d3c2b744ba165a5c669e6c957557b48e95164aa2c55d017621e99adf59d09dfc7881c47b4058f2d20e08c1ec512e639ab67212ad722e687ca2ae1305793d14455c261014455c15ed4d455158fdca682599dd91b4b8fb9651154c2ad8f14c2db74fecd2f97f9fa28213bc3d6646d32bc0ef0de0dfa442902cfb34b169c225bc5547354b7f7288b6a2507fb267e590a469b0aa89d726d93b79b91d558ad3d3a759d75e09991969cd1375d473c2c8209191cc70c79617193b98d1c5e7c387690a5fb1691b2e84809a96b2aee2416be9dafc9f09a469e03f8b8cfce72bb9f507431494f6b81b6f81e375e58e2e9a51f2e53e911dc30dee5afdc2e54d6f844f5950d85ae1968e6e7fcd6f5f8f2ef0ad14784c1489d248b9a6f5e72fcf6958acc5a7ab5e8e34b22ee4daa61759e8d86e311b8d03cbb7400e92439747d41929ecea6cbcb935d8382acb65db4fb96cb6ef5149550cd2db2a1e055d28387c6f1ca46679380f63870ec230ba8f5b4f722e82883a9a9b1ba435de9483e511cc7c91c3c56aee739ee2e71249eb2aad89be9dd32ac05a70d6d4361449f6fa9d2176d97680dadbdf79d277c8adf5b28df9a38581ec73cf32f8321d1bbb77781eceb587a5f253afe937ab35550b20078ba1a395efc783b740f69504472c90bc3e37b98f6f2734e08f6abb9af774a98ba19ae5592c7f11f3bdcdfa8951c481d0753a9741ec22cd5345a5dedbb6a59dbb924af736479eb1d239be8b180e0f46de2e2064f58b4f286adf3cd9e6987c952da8a874b1be5787025cf34cd2e240e5924ae7a4c9401beb05d19ad1ffeacb646ff00c3d1ff006af5ce6df582e88d6bbccf26db2b5c319a6a33c7f9479fb101cecbda8ea9d45570d53191bdd0c8d91ad9181cd241ce083c08e1c475af1440749d75268ef286b551d5c5708ac9a8292211181ad69731bcf73a3c8df8c124b4b788ce08ea587b7f92e4b154b64bbea781946d3970a5a593a4737c64dd6b7c4938ec2a066b9cc7073496b81c820e085733ddae1551f45515d553463e049339c3ea2501316dc768163365a3d0da59d1494349d1b667c4fdf631b18c3220ff0086724b9ce1c33ed509a2a20088880222200888802aaa2203e9ae2d396920f685b0d8f5adc6d01b0b9c2a2987ee32f168f0eb6fb0fb0ad7116e86792176b46b6534cd0473375244ba12d5af5859ee6d04ce68a5eb64e7d0cf73c70fc60d59e8aa6a295ec9e191f11e6c963763ea70fd05410d7169cb4907b42c95b750dcad2ecd2554b103cdad380ef11c8fb42b0d3691b9329db7ed42bd53a3ad5ce075bb17e7fb2719ef2db8e3eebd050dd0818e92aa11d2ff003adc3fdeac6a6c3a42e4dc4b4972a277f172b2a583e8caddefcb51f516d22a1b815b474f30eb730189deec8fc959aa6d79669ff6c15701ef6b641ee20fb94936bb0fa8fbac9df97f0472d0d7d3fda8b6ec5bfa6df432b36cc34cd464d3dee9d84f55451cd111f88e78f72b6fd47286525ccbeda777fe72461fca857a45a96cd2805b7381b9ea91af67dadc2b96de2defe2dba501ff00dcb07da567e830f7e68a9e6812bf1067dd7f142cbf518a5072ebd5b00fff00620fd90af68f647638706a2fd6d03b1b24f2fe6c6dfb55c9ba51019371a11ffba8ff00ee5e0fbe5ad9ebdd687d92877e6e5130da06e6aa9e683fd46b9d925fc8bda7d0ba2687065a9a9aa23aa9e8dad07e94af71fc95938ea2c342d0da1b0c4fdde4eae99d3e3e80dd67e495a9546b0b2c39fd9724b8ea8e177daedd0b1555b45a58c114d42f90f519a4e1f537fee5eba7c3a9f3454f0fe0f3d062151b51cbdf97e6c4855ba86e35d10a792a5cd80706c11011c63c18d007b961abee7496e6e6baa6380f30c71cbcf83071f728e2bb5dddeac16c7379b30fc181bb99f68f4bdeb032d44b3125ef272727bd70d469131a9ab037cfe0eda7d1d7ae733addc6f178da235bbd15b20c7574d300e77b1bc5a3dbbcb4badb8d55c267cd5333e47bfd6739c493e24ab6455daaaf9aa56f23bc37161a5a186993f4db9f1de555111719d8111100444404b9b3bd33b2ab8e99a4acd4f7b743766cd23a6a7f3de81bb81d863482c39e009cb4e78af5db6ed42d1a8e828f4ce9add36da4730ba48d8591e18ddc8e38c1e3bad19e2799c78987f255100444401111004444011110044440111100444401111004444011110150e2de448f05f5d34bf847fd657c22cdc58fbe9a4fc23beb432bcf37b8f895f089753162aa888b0642222008888022220088880222200888802222008888022220088880222200888802222008888022220088880222200888802222008888022220088880222200888802222008888022220088880fffd9";
const QUOTE_PDF_LOGO_W=300;
const QUOTE_PDF_LOGO_H=300;
function quotePdfHasLogo(){return typeof QUOTE_PDF_LOGO_JPEG_HEX==="string" && QUOTE_PDF_LOGO_JPEG_HEX.length>40}
function quotePdfBuildDocument(pageStreams){
  const n=pageStreams.length;
  const hasLogo=quotePdfHasLogo();
  const objects=[];
  const logoObj=hasLogo?5:null;
  const firstPageObj=hasLogo?6:5;
  const pageObjNums=[];
  const contentObjNums=[];
  for(let i=0;i<n;i++){pageObjNums.push(firstPageObj+i*2);contentObjNums.push(firstPageObj+1+i*2)}
  objects[1]="<< /Type /Catalog /Pages 2 0 R >>";
  objects[2]="<< /Type /Pages /Kids ["+pageObjNums.map(x=>x+" 0 R").join(" ")+"] /Count "+n+" >>";
  objects[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  if(hasLogo){
    const logoLen=QUOTE_PDF_LOGO_JPEG_HEX.length+2;
    objects[logoObj]=`<< /Type /XObject /Subtype /Image /Width ${QUOTE_PDF_LOGO_W} /Height ${QUOTE_PDF_LOGO_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${logoLen} >>\nstream\n${QUOTE_PDF_LOGO_JPEG_HEX}>\nendstream`;
  }
  for(let i=0;i<n;i++){
    const stream=pageStreams[i];
    const xobj=hasLogo?` /XObject << /ImLogo ${logoObj} 0 R >>`:"";
    objects[pageObjNums[i]]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>"+xobj+" >> /Contents "+contentObjNums[i]+" 0 R >>";
    objects[contentObjNums[i]]="<< /Length "+stream.length+" >>\nstream\n"+stream+"endstream";
  }
  let body="%PDF-1.4\n%TopDJs CRM generated PDF\n";
  const offsets=[0];
  for(let i=1;i<objects.length;i++){
    offsets[i]=body.length;
    body+=i+" 0 obj\n"+objects[i]+"\nendobj\n";
  }
  const xref=body.length;
  body+="xref\n0 "+objects.length+"\n0000000000 65535 f \n";
  for(let i=1;i<objects.length;i++)body+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
  body+="trailer\n<< /Size "+objects.length+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";
  return body;
}
function quotePdfBuildBinary(r,lang="es"){
  r=normalizeRecord(r||{});
  const L=quotePdfLabels(lang);
  const sections=quotePdfSectionsFromRecord(r,lang);
  const totals=quotePdfTotals(r);
  const folio=quotePdfFolio(r);
  const issued=quotePdfTodayLong(lang);
  const schedule=quotePdfEventSchedule(r,lang);
  const pageW=612,pageH=792,margin=44,usable=pageW-margin*2;
  const pages=[];
  let y=0,cmds=[];
  function n(v){return Number(v||0).toFixed(2)}
  function pdfY(topY){return pageH-topY}
  function c(s){cmds.push(s)}
  function rgb(r,g,b,stroke=false){c(`${n(r)} ${n(g)} ${n(b)} ${stroke?"RG":"rg"}`)}
  function rect(x,top,w,h,fill=[1,1,1],stroke=null){
    if(fill){rgb(fill[0],fill[1],fill[2],false);c(`${n(x)} ${n(pageH-top-h)} ${n(w)} ${n(h)} re f`)}
    if(stroke){rgb(stroke[0],stroke[1],stroke[2],true);c(`${n(x)} ${n(pageH-top-h)} ${n(w)} ${n(h)} re S`)}
  }
  function line(x1,top1,x2,top2,color=[.84,.88,.93]){rgb(color[0],color[1],color[2],true);c(`${n(x1)} ${n(pdfY(top1))} m ${n(x2)} ${n(pdfY(top2))} l S`)}
  function text(s,x,top,size=10,bold=false,color=[0,0,0]){rgb(color[0],color[1],color[2],false);c(`BT /${bold?"F2":"F1"} ${n(size)} Tf 1 0 0 1 ${n(x)} ${n(pdfY(top))} Tm ${quotePdfLiteral(s)} Tj ET`)}
  function centerText(s,cx,top,size=10,bold=false,color=[0,0,0]){text(s,cx-quotePdfApproxWidth(s,size,bold)/2,top,size,bold,color)}
  function image(name,x,top,w,h){if(quotePdfHasLogo())c(`q ${n(w)} 0 0 ${n(h)} ${n(x)} ${n(pageH-top-h)} cm /${name} Do Q`)}
  function addPage(){if(cmds.length)pages.push(cmds.join("\n")+"\n");cmds=[];y=34;drawHeader()}
  function ensure(h){if(y+h>742)addPage()}
  function drawHeader(){
    rect(0,0,pageW,108,[0,0,0]);
    rgb(.15,.82,1,true);c(`0 ${n(pageH-108)} m ${pageW} ${n(pageH-108)} l S`);
    if(quotePdfHasLogo())image("ImLogo",(pageW-78)/2,9,78,78);
    else centerText("TOPDJS",pageW/2,45,23,true,[1,1,1]);
    centerText(L.legend,pageW/2,99,9,true,[.25,.78,1]);
    text(folio,pageW-margin-150,35,10,true,[1,1,1]);
    text(`${L.issued}: ${issued}`,pageW-margin-150,52,8,false,[.86,.94,1]);
    text(`${L.validity}: ${L.validityDays}`,pageW-margin-150,66,8,false,[.86,.94,1]);
    y=134;
  }
  function drawLabelValue(label,value,x,top,w){
    text(label,x,top,8.5,true,[.38,.46,.55]);
    const lines=quotePdfWrapText(value||"-",w,10,false).slice(0,3);
    lines.forEach((ln,i)=>text(ln,x,top+13+i*12,10,false,[.08,.13,.20]));
    return 15+lines.length*12;
  }
  function drawClientCard(){
    const leftX=margin+18,rightX=margin+usable/2+16,colW=usable/2-34;
    const rows=[
      [{label:L.client,value:r.client||""},{label:L.event,value:r.project||r.event_type||""}],
      [{label:L.phone,value:r.phone||""},{label:L.email,value:r.email||""}],
      [{label:L.eventDate,value:quotePdfDateLong(r.date,lang)||""},{label:L.schedule,value:schedule||""}],
      [{label:L.venue,value:r.venue||""},{label:L.executive,value:"TopDJs"}]
    ];
    const rowHeights=rows.map(pair=>Math.max(...pair.map(p=>13+quotePdfWrapText(p.value||"-",colW,10,false).slice(0,3).length*12),28));
    const h=42+rowHeights.reduce((a,b)=>a+b,0)+12;
    ensure(h+10);
    const start=y;
    rect(margin,start,usable,h,[1,1,1],[0,0,0]);
    rect(margin+120,start-11,usable-240,22,[0,0,0]);
    text(L.clientTitle,margin+142,start+3,10,true,[1,1,1]);
    text(L.clientSub,margin+18,start+24,8.2,false,[.38,.46,.55]);
    let yy=start+45;
    rows.forEach((pair,idx)=>{
      drawLabelValue(pair[0].label,pair[0].value,leftX,yy,colW);
      drawLabelValue(pair[1].label,pair[1].value,rightX,yy,colW);
      yy+=rowHeights[idx];
    });
    y=start+h+22;
  }
  function drawSection(sec){
    ensure(44);
    rect(margin,y,usable,28,[0,0,0]);
    text(sec.title,margin+14,y+19,15,true,[0,.64,1]);
    y+=36;
    if(!sec.items.length){text(L.noItems,margin+10,y+12,10,false,[.42,.48,.56]);y+=26;return}
    sec.items.forEach(item=>{
      const prefix=`${item.qty} x `;
      const lines=quotePdfWrapText(prefix+item.item,usable-34,10.5,false);
      const h=Math.max(22,lines.length*12+10);
      ensure(h+8);
      rect(margin,y,usable,h,[1,1,1],[.86,.90,.94]);
      text("-",margin+12,y+15,10,true,[0,.64,1]);
      lines.forEach((ln,i)=>text(ln,margin+28,y+15+i*12,10.5,false,[.08,.13,.20]));
      y+=h+3;
    });
    if(sec.notes){
      const lines=quotePdfWrapText(`${L.sectionNotes} ${sec.notes}`,usable-30,9.5,false);
      const h=lines.length*11+16;
      ensure(h+6);
      rect(margin,y,usable,h,[.96,.98,1],[.80,.90,1]);
      lines.forEach((ln,i)=>text(ln,margin+13,y+14+i*11,9.5,false,[.20,.28,.36]));
      y+=h+5;
    }
    y+=13;
  }
  function drawEmptySections(){
    ensure(34);
    text(L.noItems,margin,y+15,10,false,[.42,.48,.56]);
    y+=34;
  }
  function drawTotals(){
    const vatLabel=totals.factura?L.vat16:L.vat;
    const rows=[
      [L.production,quotePdfMoney(totals.subtotal),false],
      [vatLabel,quotePdfMoney(totals.iva),false],
      [L.total,quotePdfMoney(totals.total),true],
      [L.paid,quotePdfMoney(totals.paid),false],
      [L.balance,quotePdfMoney(totals.balance),true]
    ];
    const h=146;
    ensure(h+18);
    rect(margin,y,usable,h,[0,0,0],[0,.64,1]);
    let yy=y+22;
    rows.forEach((row,idx)=>{
      text(row[0],margin+18,yy,row[2]?12:10.5,true,row[2]?[.19,.83,1]:[1,1,1]);
      text(row[1],pageW-margin-142,yy,row[2]?15:11,true,row[2]?[.19,.83,1]:[1,1,1]);
      if(idx<rows.length-1)line(margin+16,yy+11,pageW-margin-16,yy+11,[.16,.27,.40]);
      yy+=26;
    });
    y+=h+22;
  }
  function drawBottom(){
    const notes=String(r.notes||"").trim();
    const cond=[L.conditionDeposit,L.conditionBalance,L.conditionAvailability,totals.factura?L.conditionVatYes:L.conditionVatNo];
    const notesLines=quotePdfWrapText(notes||"-",usable/2-34,9.5,false).slice(0,8);
    const condLines=cond.flatMap(x=>quotePdfWrapText("- "+x,usable/2-34,9.5,false)).slice(0,10);
    const h=Math.max(notesLines.length,condLines.length)*12+48;
    ensure(h+12);
    rect(margin,y,usable,h,[1,1,1],[.86,.90,.94]);
    const mid=margin+usable/2;
    line(mid,y,mid,y+h,[.86,.90,.94]);
    text(L.generalNotes,margin+16,y+21,12,true,[0,.64,1]);
    notesLines.forEach((ln,i)=>text(ln,margin+16,y+39+i*12,9.5,false,[.08,.13,.20]));
    text(L.conditions,mid+16,y+21,12,true,[0,.64,1]);
    condLines.forEach((ln,i)=>text(ln,mid+16,y+39+i*12,9.5,false,[.08,.13,.20]));
    y+=h+12;
  }
  addPage();
  drawClientCard();
  if(sections.length)sections.forEach(drawSection);else drawEmptySections();
  drawTotals();
  drawBottom();
  pages.push(cmds.join("\n")+"\n");
  const totalPages=pages.length;
  const stamped=pages.map((stream,i)=>{
    const footer=[];
    function fc(s){footer.push(s)}
    function ft(s,x,top,size=8,bold=false,color=[.38,.46,.55]){fc(`${Number(color[0]).toFixed(2)} ${Number(color[1]).toFixed(2)} ${Number(color[2]).toFixed(2)} rg`);fc(`BT /${bold?"F2":"F1"} ${Number(size).toFixed(2)} Tf 1 0 0 1 ${Number(x).toFixed(2)} ${Number(pageH-top).toFixed(2)} Tm ${quotePdfLiteral(s)} Tj ET`)}
    fc(`0.84 0.88 0.93 RG ${margin} 34 m ${pageW-margin} 34 l S`);
    ft("TopDJs - Audio Iluminacion Video DJ",margin,769,8,false,[.38,.46,.55]);
    ft(`${i+1} / ${totalPages}`,pageW-margin-28,769,8,true,[.38,.46,.55]);
    return stream+footer.join("\n")+"\n";
  });
  return quotePdfBuildDocument(stamped);
}
function downloadClientQuotePdfFile(r,lang="es"){
  const pdf=quotePdfBuildBinary(r,lang);
  const blob=new Blob([pdf],{type:"application/pdf"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=quotePdfFileName(r,lang);
  a.rel="noopener";
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{try{URL.revokeObjectURL(url);a.remove()}catch(e){}},1500);
}

function openClientQuotePdfWindow(r,lang="es"){
  const L=quotePdfLabels(lang);
  if(!r || (!r.local_id && !r.client && !r.project))return alert(L.notFound);
  try{
    downloadClientQuotePdfFile(r,lang);
  }catch(e){
    console.error("No se pudo descargar PDF cliente",e);
    alert(lang==="en"?"The PDF could not be generated. Try again.":"No se pudo generar el PDF descargable. Intenta de nuevo.");
  }
}
function generateClientQuotePdfFromCurrent(lang="es"){
  const L=quotePdfLabels(lang);
  const amount=quoteSubtotalInput();
  if(!$('quoteClient')?.value)return alert(L.alertClient);
  if(!amount)return alert(L.alertAmount);
  openClientQuotePdfWindow(quotePdfBuildRecordFromCurrent(),lang);
}
function generateClientQuotePdf(key,lang="es"){
  const L=quotePdfLabels(lang);
  const r=normalizeRecord(findLocalRecordFlexible(key)||records.find(x=>x.local_id===key)||{});
  if(!r.local_id && !r.client)return alert(L.notFound);
  openClientQuotePdfWindow(r,lang);
}
function generateClientQuotePdfEnglish(key){return generateClientQuotePdf(key,"en")}
if($('clientQuotePdfBtn'))$('clientQuotePdfBtn').onclick=()=>generateClientQuotePdfFromCurrent("es");
if($('clientQuotePdfEnBtn'))$('clientQuotePdfEnBtn').onclick=()=>generateClientQuotePdfFromCurrent("en");


function askActor(action="guardar"){
  const who=prompt(`¿Quién realiza esta acción?\n\n1 = Carlos\n2 = Vane\n\nAcción: ${action}`);
  if(who===null)return null;
  const clean=String(who).trim().toLowerCase();
  if(clean==="1"||clean==="carlos"||clean==="charly")return "Carlos";
  if(clean==="2"||clean==="vane"||clean==="vanessa")return "Vane";
  alert("Debes seleccionar Carlos o Vane.");
  return askActor(action);
}
function fmtAuditDate(dt){
  if(!dt)return "";
  try{const d=new Date(dt);return d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}catch(e){return dt}
}
function catalogFlat(qc){
  const out={};
  try{
    const sections=getSelectedCatalogSections(parseMaybeJson(qc));
    sections.forEach(sec=>sec.items.forEach(i=>{out[normalizeCatalogKey(sec.rub+" "+i.item)]=`${i.qty} ${i.item}`}));
  }catch(e){}
  return out;
}
function diffRecords(oldR,newR){
  oldR=normalizeRecord(oldR||{});newR=normalizeRecord(newR||{});
  const labels={client:"cliente",company:"empresa",phone:"teléfono",email:"email",instagram:"Instagram",event_type:"tipo de evento",project:"proyecto",date:"fecha",venue:"venue",pax:"PAX",service_hours:"horas de servicio",setup_type:"montaje",setup_hours:"horas de montaje",setup_time:"hora de montaje",start_time:"hora inicio",end_time:"hora término",amount_base:"producción sin IVA",invoice_requested:"solicita factura",amount:"total dashboard/PDF",paid:"anticipo",paid_date:"fecha de anticipo",paid_method:"método de anticipo",status:"estatus",notes:"observaciones"};
  const changes=[];
  Object.entries(labels).forEach(([k,label])=>{
    const a=String(oldR[k]??"").trim(),b=String(newR[k]??"").trim();
    if(a!==b){const isMoney=["amount_base","amount","paid"].includes(k);changes.push(`Cambió ${label}:\n${isMoney?money(a||0):a||"—"} → ${isMoney?money(b||0):b||"—"}`)}
  });
  const oldCat=catalogFlat(oldR.quote_catalog),newCat=catalogFlat(newR.quote_catalog);
  Object.keys(newCat).forEach(k=>{if(!oldCat[k])changes.push(`Agregó:\n${newCat[k]}`);else if(oldCat[k]!==newCat[k])changes.push(`Cambió equipo:\n${oldCat[k]} → ${newCat[k]}`)});
  Object.keys(oldCat).forEach(k=>{if(!newCat[k])changes.push(`Eliminó:\n${oldCat[k]}`)});
  return changes.length?changes:["Actualizó evento"];
}
async function insertHistory(record_local_id,action,details,updated_by){
  try{
    if(!navigator.onLine)return;
    await api("event_history",{method:"POST",headers:{"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({record_local_id,action,details,updated_by})});
  }catch(e){console.warn("No se pudo registrar bitácora",e)}
}
async function fetchHistory(record_local_id){
  try{
    if(!navigator.onLine)return [];
    const arr=await api(`event_history?select=*&record_local_id=eq.${encodeURIComponent(record_local_id)}&order=created_at.desc`,{method:"GET"});
    return Array.isArray(arr)?arr:[];
  }catch(e){console.warn("No se pudo cargar bitácora",e);return []}
}
async function updateRecordAudit(local_id,updated_by){
  try{
    if(!navigator.onLine)return;
    await api(`topdjs_records?local_id=eq.${encodeURIComponent(local_id)}`,{method:"PATCH",headers:{"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({updated_by,updated_at:new Date().toISOString()})});
  }catch(e){console.warn("No se pudo actualizar auditoría",e)}
}
function auditHtml(r){
  return `<div class="auditBox"><h3>🕒 ÚLTIMA ACTUALIZACIÓN</h3><p><strong>👤 ${esc(r.updated_by||"Sin registro")}</strong></p><p>📅 ${esc(fmtAuditDate(r.updated_at||""))}</p><button onclick="loadHistoryIntoModal('${r.local_id}')">📋 VER BITÁCORA</button><div id="historyBox"></div></div>`;
}
async function loadHistoryIntoModal(local_id){
  const box=$("historyBox");if(!box)return;
  box.innerHTML="<p class='hint'>Cargando bitácora...</p>";
  const hist=await fetchHistory(local_id);
  box.innerHTML=hist.length?hist.map(h=>`<div class="historyItem"><strong>${esc(fmtAuditDate(h.created_at))}</strong><br><span>👤 ${esc(h.updated_by||"")}</span><br><b>${esc(h.action||"")}</b><pre>${esc(h.details||"")}</pre></div>`).join(""):"<p class='hint'>Sin bitácora registrada todavía.</p>";
}


function todayISO(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function formatDateDMY(dateStr){
  if(!dateStr)return "";
  const s=String(dateStr).slice(0,10);
  const parts=s.split("-");
  if(parts.length===3)return `${parts[2]}/${parts[1]}/${parts[0]}`;
  try{
    const d=new Date(dateStr);
    const day=String(d.getDate()).padStart(2,"0");
    const m=String(d.getMonth()+1).padStart(2,"0");
    const y=d.getFullYear();
    return `${day}/${m}/${y}`;
  }catch(e){return dateStr}
}
function isPastEvent(r){
  if(!r.date)return false;
  return String(r.date) < todayISO();
}
function isLiquidated(r){
  return bal(r)<=0 || String(r.status||"").toUpperCase()==="PAGADO";
}
function operationalEventStatus(r){
  r=normalizeRecord(r);
  const s=normalizeCommercialStatus(r.status);
  if(s==="COTIZADO")return {label:"🧾 COTIZADO", cls:"eventQuoted"};
  if(s==="CONFIRMADO SIN ANTICIPO" && isPastEvent(r) && !isLiquidated(r))return {label:"🔴 VENCIDO", cls:"eventPastDue"};
  if(s==="CONFIRMADO SIN ANTICIPO")return {label:"⚠️ CONFIRMADO SIN ANTICIPO", cls:"eventConfirmedNoPay"};
  if(s==="CONFIRMADO CON ANTICIPO" && isPastEvent(r) && !isLiquidated(r))return {label:`🔴 COBRAR ${money(bal(r))}`, cls:"eventPastDue"};
  if(s==="CONFIRMADO CON ANTICIPO")return {label:"✅ CONFIRMADO CON ANTICIPO", cls:"eventConfirmedPay"};
  if(s==="LIQUIDADO" && !isPastEvent(r))return {label:"✅ PRÓXIMO / LIQUIDADO", cls:"eventUpcomingPaid"};
  if(s==="LIQUIDADO")return {label:"ARCHIVADO", cls:"eventArchived"};
  if(s==="CANCELADO")return {label:"🚫 CANCELADO", cls:"eventCanceled"};
  if(s==="PERDIDO")return {label:"❌ PERDIDO", cls:"eventLost"};
  return {label:"🔜 PRÓXIMO", cls:"eventUpcoming"};
}
function operationalBadgeHtml(r,op){
  const s=normalizeCommercialStatus(r.status);
  // Evita duplicar el estado comercial en la fila.
  // Solo muestra una segunda etiqueta cuando realmente agrega información operativa.
  if(op && op.cls==="eventPastDue")return `<span class="eventBadge ${op.cls}">${op.label}</span>`;
  return "";
}
function visibleOperationalRecords(){
  return records.filter(r=>!r._deleted).map(normalizeRecord).filter(r=>!["CANCELADO","PERDIDO"].includes(normalizeCommercialStatus(r.status))).filter(r=>!(isPastEvent(r)&&isLiquidated(r)));
}
const PAYMENT_METHODS=["Efectivo","NU","BBVA","Manuel"];
function paymentMethodFromInput(v){
  const clean=String(v||"").trim().toLowerCase();
  if(clean==="1"||clean==="efectivo")return "Efectivo";
  if(clean==="2"||clean==="nu")return "NU";
  if(clean==="3"||clean==="bbva")return "BBVA";
  if(clean==="4"||clean==="manuel")return "Manuel";
  return null;
}
function paymentsHtml(local_id){
  const r=normalizeRecord(records.find(x=>x.local_id===local_id)||{});
  const list=eventPayments.filter(p=>p.record_local_id===local_id).sort((a,b)=>String(b.payment_date||b.created_at).localeCompare(String(a.payment_date||a.created_at)));
  const rows=list.length?list.map(p=>`<tr><td>${esc(p.payment_date||"")}</td><td>${money(p.amount)}</td><td>${esc(p.method||"")}</td><td>${esc(p.note||"")}</td><td><button class="delete smallBtn" onclick="deletePayment('${p.id}','${local_id}')">ELIMINAR</button></td></tr>`).join(""):`<tr><td colspan="5">Aún no hay movimientos de pago.</td></tr>`;
  return `<div class="paymentsBox">
    <h3>💳 MOVIMIENTOS DE PAGO</h3>
    <div class="paymentSummary">
      <div class="payBoxSold"><span>Total vendido</span><strong>${money(r.amount)}</strong></div>
      <div class="payBoxReceived"><span>Total recibido</span><strong>${money(paidForRecord(r))}</strong></div>
      <div class="payBoxBalance"><span>Saldo pendiente</span><strong>${money(bal(r))}</strong></div>
    </div>
    <button class="fileBtn" onclick="addPayment('${local_id}')">+ AGREGAR PAGO</button>
    <table><thead><tr><th>FECHA</th><th>MONTO</th><th>MÉTODO</th><th>NOTA</th><th>ACCIÓN</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
}
async function loadEventPayments(){
  try{
    const pp=await api("event_payments?select=*&order=created_at.desc",{method:"GET"});
    if(Array.isArray(pp))eventPayments=pp;
  }catch(e){
    console.warn("event_payments",e);
  }
}
async function updateRecordPaidFromPayments(local_id,actor,detail){
  const r=records.find(x=>x.local_id===local_id);
  if(!r)return;
  const total=paymentTotal(local_id);
  r.paid=total;
  r.status=bal(r)<=0&&Number(r.amount||0)>0?"PAGADO":total>0?"ANTICIPO RECIBIDO":"EN SEGUIMIENTO";
  r.updated_by=actor;
  r.updated_at=new Date().toISOString();
  markDirty(r);
  save();
  await syncAll();
  await updateRecordAudit(local_id,actor);
  await insertHistory(local_id,"PAYMENT",detail,actor);
  await syncAll();
  renderAll();
}
async function addPayment(local_id){
  const r=records.find(x=>x.local_id===local_id);
  if(!r)return alert("No encontré este evento.");

  const amountRaw=prompt("Monto del pago:");
  if(amountRaw===null)return alert("Registro de pago cancelado. No se guardó nada.");
  const amount=Number(String(amountRaw).replace(/[$, ]/g,""));
  if(!amount||amount<=0)return alert("Monto inválido. No se guardó el pago.");

  const methodRaw=prompt(`Método de pago:
1 = Efectivo
2 = NU
3 = BBVA
4 = Manuel`);
  if(methodRaw===null)return alert("Registro de pago cancelado. No se guardó nada.");
  const method=paymentMethodFromInput(methodRaw);
  if(!method)return alert("Método inválido. No se guardó el pago.");

  const date=prompt("Fecha del pago (YYYY-MM-DD):",todayISO());
  if(date===null)return alert("Registro de pago cancelado. No se guardó nada.");

  const defaultNote=paidForRecord(r)>0?"Pago adicional":"Anticipo";
  const noteRaw=prompt("Nota del pago:", defaultNote);
  if(noteRaw===null)return alert("Registro de pago cancelado. No se guardó nada.");
  const note=noteRaw || defaultNote;

  const actor=askActor("registrar pago");
  if(!actor)return alert("Registro de pago cancelado. No se guardó nada.");

  try{
    if(!navigator.onLine)return alert("Necesitas internet para registrar pagos.");
    await api("event_payments",{method:"POST",headers:{"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({record_local_id:local_id,payment_date:date,amount,method,note})});
    await loadEventPayments();
    await updateRecordPaidFromPayments(local_id,actor,`Registró pago:
${money(amount)}
Método: ${method}
Fecha: ${date}
Nota: ${note}`);
    showRecord(local_id);
  }catch(e){
    showError("ERROR AL REGISTRAR PAGO:\n"+e.message);
  }
}
async function deletePayment(id,local_id){
  const actor=askActor("eliminar pago");
  if(!actor)return;
  if(!confirm("¿Eliminar este movimiento de pago?"))return;
  const p=eventPayments.find(x=>String(x.id)===String(id));
  try{
    await api(`event_payments?id=eq.${encodeURIComponent(id)}`,{method:"DELETE",headers:{"Prefer":"return=minimal"}});
    eventPayments=eventPayments.filter(x=>String(x.id)!==String(id));
    await updateRecordPaidFromPayments(local_id,actor,`Eliminó pago:\n${p?money(p.amount):""}\nMétodo: ${p?(p.method||""):""}`);
    showRecord(local_id);
  }catch(e){
    showError("ERROR AL ELIMINAR PAGO:\n"+e.message);
  }
}


async function createInitialAdvancePaymentIfNeeded(rec,actor){
  const amount=Number(rec.paid||0);
  const method=rec.paid_method||"";
  if(!amount || amount<=0 || !method)return;
  const existing=eventPayments.some(p=>p.record_local_id===rec.local_id);
  if(existing)return;
  try{
    if(!navigator.onLine)return;
    await api("event_payments",{
      method:"POST",
      headers:{"Content-Type":"application/json","Prefer":"return=minimal"},
      body:JSON.stringify({
        record_local_id:rec.local_id,
        payment_date:rec.paid_date||todayISO(),
        amount,
        method,
        note:"Anticipo inicial"
      })
    });
    await loadEventPayments();
    await insertHistory(rec.local_id,"PAYMENT",`Registró anticipo inicial:\n${money(amount)}\nMétodo: ${method}`,actor);
  }catch(e){
    console.warn("No se pudo crear anticipo inicial",e);
  }
}

function renderRecords(){
  const tb=$("recordsTable");
  tb.innerHTML="";
  const visible=visibleOperationalRecords().map(normalizeRecord).sort((a,b)=>{
    const ap=isPastEvent(a)?0:1, bp=isPastEvent(b)?0:1;
    if(ap!==bp)return ap-bp;
    return String(a.date).localeCompare(String(b.date));
  });
  visible.forEach(r=>{
    const fileCount=eventFiles.filter(f=>f.record_local_id===r.local_id).length;
    const op=operationalEventStatus(r);
    const paid=paidForRecord(r);
    let tr=document.createElement("tr");
    tr.className=`operRow ${op.cls}`;
    tr.innerHTML=`<td><div class="evtDateCell"><strong>${esc(formatDateDMY(r.date))}</strong></div></td><td><div class="evtClientBlock"><strong class="evtClientName">${esc(r.client)}</strong><small class="evtClientCompany">${esc(r.company)}</small><span class="commercialBadge ${statusBadgeClass(r.status)}">${esc(commercialStatusLabel(r.status))}</span>${operationalBadgeHtml(r,op)}</div></td><td><div class="evtTextBlock"><strong>${esc(r.project)}</strong></div></td><td><div class="evtMiniData">${esc(r.pax||"")}</div></td><td><div class="evtMiniData">${esc(r.service_hours||"")}</div></td><td><div class="evtTextBlock">${esc(r.setup_type||"")}</div></td><td><div class="recordMoneyBox recordMoneyAmount"><strong>${money(r.amount)}</strong><small>Recibido</small><small class="moneySubValue">${money(paid)}</small></div></td><td><div class="recordMoneyBox recordMoneyBalance"><strong>${money(bal(r))}</strong></div></td><td><div class="evtSyncBlock"><span class="evtSyncBadge ${r._dirty?"syncPending":"syncOk"}">${r._dirty?"PENDIENTE":"OK"}</span>${fileCount?`<small class="evtFileCount">📎 ${fileCount} archivo${fileCount===1?"":"s"}</small>`:""}<small class="evtUpdatedBy">${esc(r.updated_by||"—")}</small><small class="evtUpdatedAt">${esc(fmtAuditDate(r.updated_at||""))}</small></div></td><td><div class="recordActions"><button class="actionBtn actionViewBtn" onclick="showRecord('${r.local_id}')">👁️ VER</button><button class="actionBtn expensesBtn" onclick="showExpensesOnly('${r.local_id}')">💸 GASTOS</button><button class="actionBtn uploadFileBtn" onclick="openFilePicker('${r.local_id}')">📎 ARCHIVO</button><button class="actionBtn editBtn" onclick="editRecord('${r.local_id}')">✏️ EDITAR</button><button class="actionBtn warehouseBtn" onclick="generateWarehouseOrderPdf('${r.local_id}')">📦 PEDIDO BODEGA</button><button class="actionBtn quotePdfBtn" onclick="generateClientQuotePdf('${r.local_id}')">🧾 PDF CLIENTE</button><button class="actionBtn quotePdfBtn" onclick="generateClientQuotePdf('${r.local_id}','en')">🇺🇸 PDF INGLÉS</button><button class="actionBtn payBtn" onclick="addPayment('${r.local_id}')">💳 REGISTRAR PAGO</button><button class="actionBtn delete" onclick="delRecord('${r.local_id}')">🗑️ BORRAR</button></div></td>`;
    tb.appendChild(tr);
  });
  const quotedOpen=visible.filter(r=>normalizeCommercialStatus(r.status)==="COTIZADO");
  const confirmedNoPay=visible.filter(r=>normalizeCommercialStatus(r.status)==="CONFIRMADO SIN ANTICIPO");
  const confirmedWithPay=visible.filter(r=>normalizeCommercialStatus(r.status)==="CONFIRMADO CON ANTICIPO");
  const confirmed=visible.filter(r=>isConfirmedStatus(r.status));
  $("sumQuoted").textContent=money(visible.reduce((s,r)=>s+Number(r.amount||0),0));
  $("sumPaid").textContent=money(visible.reduce((s,r)=>s+paidForRecord(r),0));
  $("sumBalance").textContent=money(quotedOpen.reduce((s,r)=>s+bal(r),0));
  if($("pendingCount"))$("pendingCount").textContent=`${quotedOpen.length} evento${quotedOpen.length===1?"":"s"}`;
  if($("sumConfirmedNoPay"))$("sumConfirmedNoPay").textContent=money(confirmedNoPay.reduce((s,r)=>s+Number(r.amount||0),0));
  if($("confirmedNoPayCount"))$("confirmedNoPayCount").textContent=`${confirmedNoPay.length} evento${confirmedNoPay.length===1?"":"s"}`;
  if($("sumConfirmedWithPay"))$("sumConfirmedWithPay").textContent=money(confirmedWithPay.reduce((s,r)=>s+Number(r.amount||0),0));
  if($("confirmedWithPayCount"))$("confirmedWithPayCount").textContent=`${confirmedWithPay.length} evento${confirmedWithPay.length===1?"":"s"}`;
  const overdue=confirmed.filter(r=>isPastEvent(r)&&!isLiquidated(r));
  if($("sumOverdue"))$("sumOverdue").textContent=money(overdue.reduce((s,r)=>s+bal(r),0));
  if($("overdueCount"))$("overdueCount").textContent=`${overdue.length} evento${overdue.length===1?"":"s"}`;
  renderSyncStatus();
}
async function delRecord(key){
  const r=findLocalRecordFlexible(key)||{local_id:key,id:key};
  const local_id=r.local_id||key;
  if(!confirm("¿BORRAR ESTE EVENTO Y TODOS SUS ARCHIVOS?"))return;
  const actor=askActor("eliminar evento");
  if(!actor)return;
  await insertHistory(local_id,"DELETE","Eliminó evento",actor);
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
      (d.selected||[]).forEach(x=>html+=`<li>${esc(displayCatalogItemName(x.item))}: <strong>${esc(x.qty)}</strong></li>`);
      html+="</ul>";
      if(d.notes)html+=`<p><strong>OBSERVACIONES ${esc(rub)}:</strong><br>${esc(d.notes)}</p>`
    }
  });
  return html
}

function renderMiscExpenseRows(miscExpenses=[]){
  const rows=(miscExpenses&&miscExpenses.length)?miscExpenses:[{concept:"",description:"",amount:""}];
  return rows.map(item=>`
    <div class="expenseMiscRow">
      <input class="expenseMiscConcept" placeholder="Concepto" value="${esc(item.concept||"")}" oninput="updateEventExpensesPreview(currentFileRecordId)">
      <input class="expenseMiscDescription" placeholder="Descripción / notas" value="${esc(item.description||"")}" oninput="updateEventExpensesPreview(currentFileRecordId)">
      <input class="expenseMiscAmount" type="number" min="0" step="0.01" placeholder="Monto" value="${esc(item.amount||"")}" oninput="updateEventExpensesPreview(currentFileRecordId)">
      <button class="delete smallBtn expenseRemoveBtn" onclick="removeMiscExpenseRow(this,currentFileRecordId)">×</button>
    </div>
  `).join("");
}
function collectExpensesFromModal(){
  const miscExpenses=Array.from(document.querySelectorAll(".expenseMiscRow")).map(row=>({
    concept:row.querySelector(".expenseMiscConcept")?.value||"",
    description:row.querySelector(".expenseMiscDescription")?.value||"",
    amount:toMoneyNumber(row.querySelector(".expenseMiscAmount")?.value)
  })).filter(item=>item.concept||item.description||item.amount>0);
  return normalizeExpenses({
    previousDaySetupPeople:toMoneyNumber($("expensePreviousDaySetupPeople")?.value),
    setupExtras:toMoneyNumber($("expenseSetupExtras")?.value),
    staffExtras:toMoneyNumber($("expenseStaffExtras")?.value),
    generatorExpense:toMoneyNumber($("expenseGenerator")?.value),
    djsExpense:toMoneyNumber($("expenseDjs")?.value),
    miscExpenses
  });
}
function updateExpensePreviewTexts(calc){
  const set=(id,value)=>{const el=$(id);if(el)el.textContent=value};
  set("expensePreviousDaySetupTotal",money(calc.previousDaySetupTotal));
  set("expenseStaffTotal",money(calc.totalStaff));
  set("expenseStaffTotalDetail",money(calc.totalStaff));
  set("expenseGeneratorTotal",money(calc.generatorExpense));
  set("expenseDjsTotal",money(calc.djsExpense));
  set("expenseMiscTotal",money(calc.miscTotal));
  set("expenseTotal",money(calc.totalExpenses));
  set("expenseRealProfit",money(calc.realProfit));
  set("expenseProjectedProfit",money(calc.projectedProfit));
}
function updateEventExpensesPreview(local_id){
  const r=normalizeRecord(findLocalRecordFlexible(local_id)||{});
  if(!r.local_id)return;
  const calc=calculateEventExpenses(r,collectExpensesFromModal());
  updateExpensePreviewTexts(calc);
}
function addMiscExpenseRow(local_id){
  const container=$("expenseMiscRows");
  if(!container)return;
  const row=document.createElement("div");
  row.className="expenseMiscRow";
  row.innerHTML=`
    <input class="expenseMiscConcept" placeholder="Concepto" oninput="updateEventExpensesPreview('${esc(local_id||"")}')">
    <input class="expenseMiscDescription" placeholder="Descripción / notas" oninput="updateEventExpensesPreview('${esc(local_id||"")}')">
    <input class="expenseMiscAmount" type="number" min="0" step="0.01" placeholder="Monto" oninput="updateEventExpensesPreview('${esc(local_id||"")}')">
    <button class="delete smallBtn expenseRemoveBtn" onclick="removeMiscExpenseRow(this,'${esc(local_id||"")}')">×</button>
  `;
  container.appendChild(row);
  updateEventExpensesPreview(local_id);
}
function removeMiscExpenseRow(btn,local_id){
  const row=btn.closest(".expenseMiscRow");
  if(row)row.remove();
  const container=$("expenseMiscRows");
  if(container && !container.querySelector(".expenseMiscRow"))addMiscExpenseRow(local_id);
  updateEventExpensesPreview(local_id);
}
async function saveEventExpenses(local_id){
  const r=findLocalRecordFlexible(local_id);
  if(!r)return alert("No encontré este evento.");
  const actor=askActor("guardar gastos del evento");
  if(!actor)return;
  const expensesJsonb=collectExpensesFromModal();
  r.expenses_jsonb=expensesJsonb;
  r.updated_by=actor;
  r.updated_at=new Date().toISOString();
  markDirty(r);
  save();
  renderAll();
  try{
    if(navigator.onLine){
      await syncAll();
      await updateRecordAudit(r.local_id,actor);
      await insertHistory(r.local_id,"EXPENSES","Gastos del evento actualizados",actor);
      await syncAll();
    }else{
      showError("Gastos guardados localmente. Se sincronizarán cuando tengas internet.");
    }
    alert("Gastos del evento actualizados.");
    showRecord(r.local_id);
  }catch(e){
    showError("ERROR AL GUARDAR GASTOS:\n"+e.message);
  }
}
function expensesHtml(local_id){
  const r=normalizeRecord(findLocalRecordFlexible(local_id)||{});
  const calc=calculateEventExpenses(r);
  return `<div class="expensesBox">
    <h3>💸 GASTOS DEL EVENTO</h3>
    <p class="hint">Los costos de staff salen del cotizador. Los demás campos se capturan manualmente por evento.</p>

    <div class="expenseSummaryGrid">
      <div class="expenseSummaryCard expenseBlue"><span>Total gastos staff</span><strong id="expenseStaffTotal">${money(calc.totalStaff)}</strong></div>
      <div class="expenseSummaryCard expenseBlue"><span>Planta de luz</span><strong id="expenseGeneratorTotal">${money(calc.generatorExpense)}</strong></div>
      <div class="expenseSummaryCard expenseBlue"><span>DJs</span><strong id="expenseDjsTotal">${money(calc.djsExpense)}</strong></div>
      <div class="expenseSummaryCard expenseBlue"><span>Varios</span><strong id="expenseMiscTotal">${money(calc.miscTotal)}</strong></div>
      <div class="expenseSummaryCard expenseYellow"><span>Total gastos</span><strong id="expenseTotal">${money(calc.totalExpenses)}</strong></div>
      <div class="expenseSummaryCard expenseGreen"><span>Utilidad real</span><strong id="expenseRealProfit">${money(calc.realProfit)}</strong></div>
      <div class="expenseSummaryCard expenseGreen"><span>Utilidad proyectada</span><strong id="expenseProjectedProfit">${money(calc.projectedProfit)}</strong></div>
    </div>

    <div class="expenseSubBox">
      <h4>👷 Staff automático desde cotizador</h4>
      <div class="expenseLines">
        <div><span>Ing. audio</span><strong>${esc(calc.audioQty)} x ${money(STAFF_AUDIO_RATE)} = ${money(calc.audioQty*STAFF_AUDIO_RATE)}</strong></div>
        <div><span>Ing. iluminación/video</span><strong>${esc(calc.lightingVideoQty)} x ${money(STAFF_LIGHTING_VIDEO_RATE)} = ${money(calc.lightingVideoQty*STAFF_LIGHTING_VIDEO_RATE)}</strong></div>
        <div><span>Stage hands</span><strong>${esc(calc.stageHandsQty)} x ${money(STAGE_HAND_RATE)} = ${money(calc.stageHandsQty*STAGE_HAND_RATE)}</strong></div>
      </div>
    </div>

    <div class="expenseFormGrid">
      <div>
        <label>Staff montaje/desmontaje</label>
        <input id="expensePreviousDaySetupPeople" type="number" min="0" step="1" value="${esc(calc.expenses.previousDaySetupPeople)}" oninput="updateEventExpensesPreview('${esc(local_id)}')">
        <small>Subtotal montaje/desmontaje: <strong id="expensePreviousDaySetupTotal">${money(calc.previousDaySetupTotal)}</strong></small>
      </div>
      <div>
        <label>Extras montaje y desmontaje</label>
        <input id="expenseSetupExtras" type="number" min="0" step="0.01" value="${esc(calc.expenses.setupExtras)}" oninput="updateEventExpensesPreview('${esc(local_id)}')">
      </div>
      <div>
        <label>Extras staff</label>
        <input id="expenseStaffExtras" type="number" min="0" step="0.01" value="${esc(calc.expenses.staffExtras)}" oninput="updateEventExpensesPreview('${esc(local_id)}')">
      </div>
      <div>
        <label>Planta de luz</label>
        <input id="expenseGenerator" type="number" min="0" step="0.01" value="${esc(calc.expenses.generatorExpense)}" oninput="updateEventExpensesPreview('${esc(local_id)}')">
      </div>
      <div>
        <label>DJs</label>
        <input id="expenseDjs" type="number" min="0" step="0.01" value="${esc(calc.expenses.djsExpense)}" oninput="updateEventExpensesPreview('${esc(local_id)}')">
      </div>
    </div>

    <div class="expenseStaffTotalBox">
      <span>Total gastos staff</span>
      <strong id="expenseStaffTotalDetail">${money(calc.totalStaff)}</strong>
      <small>Staff cotizador + staff montaje/desmontaje + extras montaje y desmontaje + extras staff</small>
    </div>

    <div class="expenseSubBox">
      <h4>🧾 Varios / Otros gastos</h4>
      <div class="expenseMiscHeader"><span>Concepto</span><span>Descripción</span><span>Monto</span><span></span></div>
      <div id="expenseMiscRows">${renderMiscExpenseRows(calc.expenses.miscExpenses)}</div>
      <button class="fileBtn" onclick="addMiscExpenseRow('${esc(local_id)}')">+ AGREGAR GASTO VARIOS</button>
    </div>

    <button class="fileBtn" onclick="saveEventExpenses('${esc(local_id)}')">💾 GUARDAR GASTOS</button>
  </div>`;
}

function showExpensesOnly(local_id){
  const r=normalizeRecord(findLocalRecordFlexible(local_id));
  if(!r)return alert("No encontré este evento.");
  currentFileRecordId=local_id;
  $("modalTitle").textContent=`💸 Gastos · ${r.client||"Evento"}`;
  $("modalBody").innerHTML=`
    <div class="expensesOnlyHeader">
      <p><strong>📅 FECHA:</strong> ${esc(r.date||"")} · <strong>🎉 PROYECTO:</strong> ${esc(r.project||"")}</p>
      <p><strong>💰 COTIZADO:</strong> ${money(r.amount)} · <strong>💳 COBRADO:</strong> ${money(paidForRecord(r))} · <strong>💸 SALDO:</strong> ${money(bal(r))}</p>
      <button class="secondary" onclick="showRecord('${esc(local_id)}')">VER EVENTO COMPLETO</button>
    </div>
    ${expensesHtml(local_id)}
  `;
  $("modal").classList.remove("hidden");
}

function showRecord(local_id){
  const r=normalizeRecord(records.find(x=>x.local_id===local_id));if(!r)return;
  currentFileRecordId=local_id;
  $("modalTitle").textContent=r.client;
  $("modalBody").innerHTML=`<h3>📋 INFORMACIÓN DEL EVENTO</h3><p><strong>📅 FECHA:</strong> ${esc(r.date)}</p><p><strong>🎉 PROYECTO:</strong> ${esc(r.project)}</p><p><strong>🎯 TIPO:</strong> ${esc(r.event_type)}</p><p><strong>📍 LUGAR:</strong> ${esc(r.venue)}</p><p><strong>👥 PAX:</strong> ${esc(r.pax||"")}</p><p><strong>⏰ HORAS DE SERVICIO:</strong> ${esc(r.service_hours||"")}</p><p><strong>🔧 MONTAJE:</strong> ${esc(r.setup_type||"")} · ${esc(r.setup_hours||"")} HRS · ${esc(r.setup_time||"")}</p><p><strong>🎬 INICIO:</strong> ${esc(r.start_time||"")} · <strong>🏁 TÉRMINO:</strong> ${esc(r.end_time||"")}</p><p><strong>📌 ESTADO:</strong> ${esc(commercialStatusLabel(r.status))}</p><p><strong>💰 MONTO:</strong> ${money(r.amount)} | <strong>💳 RECIBIDO:</strong> ${money(paidForRecord(r))} | <strong>💸 SALDO:</strong> ${money(bal(r))}</p><p>${r.phone?`<a class="button whatsapp" href="${wa(r.phone,"Hola, te contacto de TopDJs sobre "+(r.project||"tu evento"))}" target="_blank">WHATSAPP</a> <a class="button call" href="${tel(r.phone)}">LLAMAR</a>`:""} <button class="editBtn" onclick="$('modal').classList.add('hidden');document.body.classList.remove('modal-open');editRecord('${r.local_id}')">EDITAR EVENTO</button> <button class="fileBtn" onclick="generateWarehouseOrderPdf('${r.local_id}')">PEDIDO BODEGA PDF</button> <button class="quotePdfBtn" onclick="generateClientQuotePdf('${r.local_id}')">PDF CLIENTE</button> <button class="quotePdfBtn" onclick="generateClientQuotePdf('${r.local_id}','en')">PDF INGLÉS</button></p>${paymentsHtml(local_id)}${auditHtml(r)}${catalogHtml(r.quote_catalog)}<h3>📝 OBSERVACIONES GENERALES</h3><p>${esc(r.notes)}</p>${filesHtml(local_id)}`;
  $("modal").classList.remove("hidden");setTimeout(()=>loadHistoryIntoModal(r.local_id),300)
}
$("closeModal").onclick=()=>$("modal").classList.add("hidden");

const CALENDAR_MONTH_NAMES=["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
let calendarViewMode="month";

function initCalendarControls(){
  const monthSelect=$("calendarMonthSelect");
  if(monthSelect && !monthSelect.options.length){
    CALENDAR_MONTH_NAMES.forEach((name,idx)=>{
      const opt=document.createElement("option");
      opt.value=String(idx);
      opt.textContent=name;
      monthSelect.appendChild(opt);
    });
  }
}

function updateCalendarControls(){
  const y=visibleDate.getFullYear(),m=visibleDate.getMonth();
  if($("calendarMonthSelect"))$("calendarMonthSelect").value=String(m);
  if($("calendarYearInput"))$("calendarYearInput").value=String(y);
}

function setCalendarDateFromControls(){
  const month=Number($("calendarMonthSelect")?.value ?? visibleDate.getMonth());
  const year=Number($("calendarYearInput")?.value ?? visibleDate.getFullYear());
  if(!Number.isFinite(year)||year<1900||year>2200)return alert("Año inválido");
  visibleDate=new Date(year, month, 1);
  renderCalendar();
}

function eventsForMonth(year, month){
  return records.filter(r=>{
    if(r._deleted||!r.date)return false;
    const d=new Date(String(r.date)+"T00:00:00");
    return d.getFullYear()===year && d.getMonth()===month;
  });
}

function renderYearOverview(){
  initCalendarControls();
  calendarViewMode="year";
  const grid=$("calendarGrid");grid.innerHTML="";
  const y=visibleDate.getFullYear();
  $("monthTitle").textContent=`AÑO ${y}`;
  updateCalendarControls();
  grid.className="calendar yearOverview";

  CALENDAR_MONTH_NAMES.forEach((name, m)=>{
    const monthEvents=eventsForMonth(y,m).map(normalizeRecord).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const card=document.createElement("button");
    card.type="button";
    card.className="yearMonthCard";
    const total=monthEvents.reduce((s,r)=>s+Number(r.amount||0),0);
    const pending=monthEvents.reduce((s,r)=>s+bal(r),0);
    const eventsPreview=monthEvents.slice(0,3).map(r=>`<div class="yearEventMini"><strong>${esc(String(r.date).slice(8,10))}</strong> ${esc(r.client||"Evento")} · ${esc(r.project||"")}</div>`).join("");
    card.innerHTML=`
      <div class="yearMonthName">${name}</div>
      <div class="yearMonthStats">
        <span>${monthEvents.length} evento${monthEvents.length===1?"":"s"}</span>
        <span>${money(total)} cotizado</span>
        <span>${money(pending)} pendiente</span>
      </div>
      <div class="yearMonthEvents">${eventsPreview || '<em>Sin eventos</em>'}${monthEvents.length>3?`<small>+ ${monthEvents.length-3} más</small>`:""}</div>
    `;
    card.onclick=()=>{
      visibleDate=new Date(y,m,1);
      calendarViewMode="month";
      renderCalendar();
    };
    grid.appendChild(card);
  });
}

function renderCalendar(){
  initCalendarControls();
  calendarViewMode="month";
  const grid=$("calendarGrid");grid.innerHTML="";
  grid.className="calendar monthGrid";
  const y=visibleDate.getFullYear(),m=visibleDate.getMonth();
  $("monthTitle").textContent=`${CALENDAR_MONTH_NAMES[m]} ${y}`;
  updateCalendarControls();
  ["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"].forEach(d=>{let e=document.createElement("div");e.className="dayHeader";e.textContent=d;grid.appendChild(e)});
  const first=new Date(y,m,1),off=(first.getDay()+6)%7,start=new Date(y,m,1-off);
  const today=todayISO();
  for(let i=0;i<42;i++){
    let d=new Date(start);d.setDate(start.getDate()+i);let ds=d.toISOString().slice(0,10);
    const isToday=ds===today;
    let cell=document.createElement("div");cell.className="day"+(d.getMonth()!=m?" outside":"")+(isToday?" dayToday":"");cell.innerHTML=`<strong>${d.getDate()}</strong>${isToday?'<span class="todayLabel">HOY</span>':''}`;
    records.filter(r=>!r._deleted&&r.date===ds).forEach(r=>{
      r=normalizeRecord(r);
      let b=document.createElement("button");b.className="pill";
      b.textContent=`${r.client} · ${r.pax||0} PAX · ${r.service_hours||0} HRS · ${money(bal(r))} saldo`;
      b.onclick=()=>showRecord(r.local_id);cell.appendChild(b)
    });
    grid.appendChild(cell)
  }
}
if($("prevMonth"))$("prevMonth").onclick=()=>{visibleDate.setMonth(visibleDate.getMonth()-1);renderCalendar()};
if($("nextMonth"))$("nextMonth").onclick=()=>{visibleDate.setMonth(visibleDate.getMonth()+1);renderCalendar()};
if($("prevYear"))$("prevYear").onclick=()=>{visibleDate.setFullYear(visibleDate.getFullYear()-1);calendarViewMode==="year"?renderYearOverview():renderCalendar()};
if($("nextYear"))$("nextYear").onclick=()=>{visibleDate.setFullYear(visibleDate.getFullYear()+1);calendarViewMode==="year"?renderYearOverview():renderCalendar()};
if($("goCalendarDate"))$("goCalendarDate").onclick=()=>setCalendarDateFromControls();
$("todayCalendar").onclick=()=>{visibleDate=new Date();renderCalendar()};
if($("yearViewBtn"))$("yearViewBtn").onclick=()=>renderYearOverview();
if($("calendarMonthSelect"))$("calendarMonthSelect").onchange=()=>setCalendarDateFromControls();
if($("calendarYearInput"))$("calendarYearInput").onkeydown=e=>{if(e.key==="Enter")setCalendarDateFromControls()};

if($("georgeCalendarBtn"))$("georgeCalendarBtn").onclick=()=>openGeorgeCalendarModal();
if($("georgePrintBtn"))$("georgePrintBtn").onclick=()=>openGeorgeCalendarPrint();



// TOPDJS CRM v11.4.54 - Calendario George simple: solo confirmados y pendientes
function isGeorgeCalendarEvent(record){
  const r=normalizeRecord(record||{});
  if(r._deleted||!r.date)return false;
  const s=normalizeCommercialStatus(r.status);
  return ["COTIZADO","CONFIRMADO SIN ANTICIPO","CONFIRMADO CON ANTICIPO","LIQUIDADO"].includes(s);
}
function georgeStatusLabel(status){
  const s=normalizeCommercialStatus(status);
  if(s==="COTIZADO")return "PENDIENTE";
  if(["CONFIRMADO SIN ANTICIPO","CONFIRMADO CON ANTICIPO","LIQUIDADO"].includes(s))return "CONFIRMADO";
  return s;
}
function georgeDateLabel(dateStr){
  if(!dateStr)return "SIN FECHA";
  try{
    const d=new Date(String(dateStr)+"T12:00:00");
    return d.toLocaleDateString("es-MX",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).replace(/\./g,"");
  }catch(e){return dateStr}
}
function georgePeriodLabel(){
  const y=visibleDate.getFullYear(), m=visibleDate.getMonth();
  return calendarViewMode==="year" ? `AÑO ${y}` : `${CALENDAR_MONTH_NAMES[m]} ${y}`;
}
function georgeEventName(r){
  return [r.client||"",r.project||r.event_type||""].filter(Boolean).join(" · ") || "Evento TopDJs";
}
function georgeEventsForCurrentCalendar(){
  const y=visibleDate.getFullYear(), m=visibleDate.getMonth();
  return records.map(x=>normalizeRecord(x)).filter(isGeorgeCalendarEvent).filter(r=>{
    const d=new Date(String(r.date)+"T00:00:00");
    if(calendarViewMode==="year")return d.getFullYear()===y;
    return d.getFullYear()===y && d.getMonth()===m;
  }).sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")) || String(a.start_time||"").localeCompare(String(b.start_time||"")) || georgeEventName(a).localeCompare(georgeEventName(b)));
}
function buildGeorgeCalendarText(){
  const events=georgeEventsForCurrentCalendar();
  const confirmed=events.filter(r=>georgeStatusLabel(r.status)==="CONFIRMADO").length;
  const pending=events.filter(r=>georgeStatusLabel(r.status)==="PENDIENTE").length;
  const lines=[
    `CALENDARIO TOPDJS · ${georgePeriodLabel()}`,
    `Eventos: ${events.length} · Confirmados: ${confirmed} · Pendientes: ${pending}`,
    ``
  ];
  if(!events.length){
    lines.push("Sin eventos confirmados o pendientes en este periodo.");
    return lines.join("\n");
  }
  events.forEach((r,idx)=>{
    lines.push(`${idx+1}. ${georgeDateLabel(r.date)} · ${georgeStatusLabel(r.status)} · ${georgeEventName(r)}`);
  });
  return lines.join("\n");
}
function georgeEventsHtml(){
  const events=georgeEventsForCurrentCalendar();
  if(!events.length)return `<p class="hint">Sin eventos confirmados o pendientes en este periodo.</p>`;
  return events.map(r=>{
    const status=georgeStatusLabel(r.status);
    return `<article class="georgeEventCard georgeEventSimple">
      <div class="georgeEventTop"><strong>${esc(georgeDateLabel(r.date))}</strong><span class="georgeStatus georgeStatus${status}">${esc(status)}</span></div>
      <h3>${esc(georgeEventName(r))}</h3>
    </article>`;
  }).join("");
}
function openGeorgeCalendarModal(){
  const text=buildGeorgeCalendarText();
  const share=`https://wa.me/?text=${encodeURIComponent(text)}`;
  const modalTitle=$("modalTitle"), modalBody=$("modalBody");
  if(!modalTitle||!modalBody)return alert(text);
  modalTitle.textContent=`📲 Calendario George · ${georgePeriodLabel()}`;
  modalBody.innerHTML=`
    <div class="georgeModalIntro">
      <p>Calendario simple para George: únicamente eventos confirmados y pendientes.</p>
      <div class="georgeActions">
        <a class="button whatsapp" href="${share}" target="_blank">ENVIAR POR WHATSAPP</a>
        <button class="fileBtn" onclick="copyGeorgeCalendarText()">COPIAR TEXTO</button>
        <button class="secondary" onclick="openGeorgeCalendarPrint()">IMPRIMIR / PDF</button>
        <a class="button secondary" href="george.html" target="_blank">ABRIR CALENDARIO GEORGE</a>
      </div>
    </div>
    <textarea class="georgeTextarea" id="georgeCalendarText" rows="10">${esc(text)}</textarea>
    <h3>Vista previa</h3>
    <div class="georgeEventsPreview">${georgeEventsHtml()}</div>
  `;
  $("modal").classList.remove("hidden");
}
async function copyGeorgeCalendarText(){
  const text=$("georgeCalendarText")?.value || buildGeorgeCalendarText();
  try{
    await navigator.clipboard.writeText(text);
    alert("Calendario George copiado.");
  }catch(e){
    prompt("Copia el calendario George:", text);
  }
}
function openGeorgeCalendarPrint(){
  const eventsHtml=georgeEventsHtml();
  const w=window.open("","_blank");
  if(!w)return alert("Activa ventanas emergentes para imprimir el calendario.");
  w.document.open();
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Calendario George TopDJs</title><style>
    @page{size:letter;margin:14mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#172033;margin:0;background:#fff}.top{border-bottom:3px solid #00a2ff;padding:0 0 14px;margin-bottom:18px;display:flex;justify-content:space-between;gap:16px;align-items:flex-end}.top h1{margin:0;font-size:24px}.top p{margin:4px 0 0;color:#566579}.georgeEventCard{border:1px solid #d8e4ef;border-radius:14px;margin:10px 0;padding:12px;page-break-inside:avoid}.georgeEventTop{display:flex;justify-content:space-between;border-bottom:1px solid #e6eef6;padding-bottom:8px;margin-bottom:8px}.georgeStatus{font-size:12px;font-weight:900;border-radius:999px;padding:4px 9px;background:#f2f9ff;color:#006db8;border:1px solid #9cd4ff}.georgeStatusPENDIENTE{background:#fff8dc;color:#856600;border-color:#f1cd56}.georgeStatusCONFIRMADO{background:#e9fff3;color:#087a44;border-color:#7ee2ac}h3{margin:6px 0 4px;font-size:18px}.footer{position:fixed;bottom:0;left:0;right:0;border-top:1px solid #d8e4ef;padding-top:6px;color:#718096;font-size:10px;background:#fff}@media print{button{display:none}}
  </style></head><body><div class="top"><div><h1>Calendario TopDJs</h1><p>${esc(georgePeriodLabel())} · George / Bodega / Operación</p></div></div>${eventsHtml}<div class="footer">TopDJs · Calendario generado desde CRM</div><script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
  w.document.close();
}

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

function dbRecord(r){
  r=normalizeRecord(r);
  return {
    local_id:r.local_id,
    type:r.type||null,
    date:r.date||null,
    client:r.client||null,
    company:r.company||null,
    phone:r.phone||null,
    email:r.email||null,
    instagram:r.instagram||null,
    event_type:r.event_type||null,
    project:r.project||null,
    venue:r.venue||null,
    pax:r.pax||0,
    service_hours:r.service_hours||0,
    setup_type:r.setup_type||null,
    setup_hours:r.setup_hours||0,
    setup_time:r.setup_time||null,
    start_time:r.start_time||null,
    end_time:r.end_time||null,
    amount:r.amount||0,
    paid:r.paid||0,
    status:r.status||null,
    notes:r.notes||null,
    quote_catalog:r.quote_catalog||null,
    expenses_jsonb:normalizeExpenses(r.expenses_jsonb),
    updated_by:r.updated_by||null,
    updated_at:r.updated_at||new Date().toISOString()
  }
}
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
    await loadEventPayments();
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
  let html=`<div class="filesBox"><h3>📎 ARCHIVOS DEL EVENTO</h3><p class="hint">Contratos, comprobantes, layouts, riders, PDFs o imágenes.</p>`;
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

function clientKey(r){
  return normalizeCatalogKey(r.client || r.company || r.phone || r.instagram || "SIN NOMBRE");
}
function clientDisplayName(r){
  return r.client || r.company || r.instagram || r.phone || "SIN NOMBRE";
}
function clientMatches(r,q){
  q=normalizeCatalogKey(q);
  if(!q)return true;
  const hay=[r.client,r.company,r.phone,r.email,r.instagram,r.project,r.venue,r.event_type].map(normalizeCatalogKey).join(" ");
  return hay.includes(q);
}
function groupClientRecords(list){
  const groups={};
  list.filter(r=>!r._deleted).forEach(r=>{
    r=normalizeRecord(r);
    const key=clientKey(r);
    if(!groups[key])groups[key]={key,name:clientDisplayName(r),company:r.company||"",phone:r.phone||"",email:r.email||"",instagram:r.instagram||"",records:[],total:0,paid:0,balance:0,lastDate:""};
    groups[key].records.push(r);
    groups[key].total+=Number(r.amount||0);
    groups[key].paid+=Number(r.paid||0);
    groups[key].balance+=bal(r);
    if(String(r.date||"")>String(groups[key].lastDate||""))groups[key].lastDate=r.date;
    if(!groups[key].company&&r.company)groups[key].company=r.company;
    if(!groups[key].phone&&r.phone)groups[key].phone=r.phone;
    if(!groups[key].email&&r.email)groups[key].email=r.email;
    if(!groups[key].instagram&&r.instagram)groups[key].instagram=r.instagram;
  });
  Object.values(groups).forEach(g=>g.records.sort((a,b)=>String(b.date).localeCompare(String(a.date))));
  return Object.values(groups).sort((a,b)=>String(b.lastDate).localeCompare(String(a.lastDate)));
}
function recurrentBadge(g){
  return (g.records.length>=2 || g.total>=50000) ? '<span class="clientBadge">⭐ CLIENTE RECURRENTE</span>' : '<span class="clientBadge normal">CLIENTE NORMAL</span>';
}
function renderClientHistory(){
  const q=$("clientSearch")?.value||"";
  const filtered=records.filter(r=>!r._deleted&&clientMatches(r,q));
  const groups=groupClientRecords(filtered);
  const recurring=groupClientRecords(records).filter(g=>g.records.length>=2 || g.total>=50000);
  const recRoot=$("recurringClients");
  if(recRoot){
    recRoot.innerHTML=recurring.length?recurring.map(g=>`
      <div class="clientMini" onclick="setClientSearch('${esc(g.name).replace(/'/g,"\\'")}')">
        <strong>${esc(g.name)}</strong><br>
        <small>${g.records.length} evento(s) · ${money(g.total)} · Último: ${esc(g.lastDate||"")}</small>
      </div>
    `).join(""):'<p class="hint">Aún no hay clientes recurrentes.</p>';
  }
  const root=$("clientHistory");
  if(!root)return;
  if(!groups.length){
    root.innerHTML='<p class="hint">No encontré eventos para esa búsqueda.</p>';
    return;
  }
  root.innerHTML=groups.map(g=>{
    const events=g.records.map(r=>`
      <tr>
        <td>${esc(r.date||"")}</td>
        <td>${esc(r.project||r.event_type||"")}</td>
        <td>${esc(r.venue||"")}</td>
        <td>${esc(r.status||"")}</td>
        <td>${money(r.amount)}</td>
        <td>${money(r.paid)}</td>
        <td>${money(bal(r))}</td>
        <td><div class="clientActions"><button class="clientActionBtn actionViewBtn" onclick="showRecord('${r.local_id}')">👁️ VER</button><button class="clientActionBtn editBtn" onclick="editRecord('${r.local_id}')">✏️ EDITAR</button></div></td>
      </tr>
    `).join("");
    return `
      <div class="clientCard">
        <div class="clientHeader">
          <div>
            <h3>${esc(g.name)}</h3>
            ${recurrentBadge(g)}
            <p>${g.phone?`📱 ${esc(g.phone)} `:""} ${g.email?` · 📧 ${esc(g.email)} `:""} ${g.instagram?` · 📸 ${esc(g.instagram)}`:""}</p>
            <button class="clientQuoteBtn" onclick='quoteFromClientKey(${JSON.stringify(g.key)})'>🧾 COTIZAR A ESTE CLIENTE</button>
          </div>
          <div class="clientStats">
            <strong>${g.records.length}</strong><span>EVENTO(S)</span>
            <strong>${money(g.total)}</strong><span>TOTAL HISTÓRICO</span>
            <strong>${money(g.balance)}</strong><span>SALDO PENDIENTE</span>
          </div>
        </div>
        <div class="clientEventsWrap"><table class="clientHistoryTable">
          <thead><tr><th>FECHA</th><th>EVENTO</th><th>VENUE</th><th>ESTATUS</th><th>TOTAL</th><th>PAGADO</th><th>SALDO</th><th>ACCIÓN</th></tr></thead>
          <tbody>${events}</tbody>
        </table></div>
      </div>
    `;
  }).join("");
}
function setClientSearch(name){
  const el=$("clientSearch");
  if(el){el.value=name;renderClientHistory();}
  document.querySelector('[data-tab="clients"]').click();
}

function quoteFromClientKey(key){
  const groups=groupClientRecords(records);
  const g=groups.find(x=>x.key===key);
  if(!g || !g.records.length){
    alert("No encontré datos guardados de este cliente.");
    return;
  }
  const r=normalizeRecord(g.records[0]||{});
  clearQuoteForm();
  setInput("quoteClient",r.client||g.name||"");
  setInput("quoteCompany",r.company||g.company||"");
  setInput("quotePhone",r.phone||g.phone||"");
  setInput("quoteEmail",r.email||g.email||"");
  setInput("quoteInstagram",r.instagram||g.instagram||"");
  if($("quoteStatus"))setInput("quoteStatus","COTIZADO");
  if($("quotePaid"))setInput("quotePaid",0);
  if($("quotePaidMethod"))setInput("quotePaidMethod","");
  if($("quotePaidDate"))setInput("quotePaidDate",todayISO());
  updateQuoteBalance();
  if($("quoteFormTitle"))$("quoteFormTitle").textContent="🧾 COTIZADOR · CLIENTE EXISTENTE";
  document.querySelector('[data-tab="quote"]').click();
  window.scrollTo({top:0,behavior:"smooth"});
}

function renderAll(){renderRecords();renderCalendar();renderContacts();renderClientHistory();updateQuoteBalance()}

if($("clientSearch"))$("clientSearch").oninput=()=>renderClientHistory();
if($("clearClientSearch"))$("clearClientSearch").onclick=()=>{$("clientSearch").value="";renderClientHistory()};

renderCatalog();save();renderAll();syncAll();setInterval(syncAll,30000);
if("serviceWorker" in navigator){navigator.serviceWorker.register("sw.js").catch(()=>{})}


// TOPDJS CRM v11.4.54 - Fecha de anticipo
if($("quotePaidDate") && !$("quotePaidDate").value){$("quotePaidDate").value=todayISO()}
