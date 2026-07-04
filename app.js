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
  .section{page-break-inside:avoid;margin:18px 0}
  .section h2{background:#0f172a;color:white;font-size:15px;padding:8px 10px;border-radius:8px;margin:0 0 8px;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#e2e8f0;text-align:left;padding:7px;border:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#334155}
  td{padding:8px;border:1px solid #cbd5e1;vertical-align:middle}
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
  @media print{.noPrint{display:none}.section{break-inside:avoid}}
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


/* TOPDJS CRM v11.4.42 - PDF cliente español / inglés desde cotizador */
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
.header{background:#000;color:#fff;text-align:center;padding:22px 54px 12px;border-bottom:2px solid #31d4ff;page-break-inside:avoid}.logo{width:150px;height:70px;object-fit:contain;display:block;margin:0 auto 8px}.legend{font-size:12px;letter-spacing:.14em;color:#5fc2ff;font-weight:950;text-transform:uppercase;margin:0 0 18px}.meta{display:flex;justify-content:space-between;gap:18px;font-size:12px;font-weight:800;color:#eef7ff}.meta span{white-space:nowrap}.sheet{min-height:11in;padding-bottom:.62in}.content{padding:26px 54px 72px}.client-card{position:relative;border:1.4px solid #000;border-radius:19px;padding:38px 24px 24px;margin:0 0 28px;page-break-inside:avoid}.client-title{position:absolute;left:50%;top:-14px;transform:translateX(-50%);background:#000;color:#fff;border-radius:999px;padding:7px 42px;font-size:13px;font-weight:950;letter-spacing:.03em;white-space:nowrap}.client-sub{font-size:11.5px;color:#5e7890;margin:0 0 16px}.client-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 34px}.client-col{display:grid;grid-template-columns:max-content 1fr;gap:9px 12px;align-items:baseline}.client-col+.client-col{border-left:1px solid #e6eef6;padding-left:28px}.label{color:#65758b;font-size:13px;font-weight:900;white-space:nowrap}.value{font-size:15px;color:#162234}.quote-section{border:1px solid #d9e4ef;border-radius:17px;margin:20px 0 24px;overflow:hidden;page-break-inside:avoid}.quote-section-title{background:#000;color:#00a2ff;font-size:24px;font-weight:950;padding:12px 22px}.quote-section-body{padding:15px 24px 18px}.quote-item{display:grid;grid-template-columns:18px 1fr;gap:6px;font-size:15px;padding:7px 0;border-bottom:1px solid #edf2f7}.quote-item:last-child{border-bottom:0}.dot{color:#00a2ff;font-weight:950}.section-notes{margin-top:12px;border-left:4px solid #00a2ff;background:#f6f9fc;border-radius:8px;padding:10px 12px;font-size:13px;color:#334155;line-height:1.35}.totals{background:#000;border:1.5px solid #00a2ff;border-radius:18px;margin:24px 0 24px;padding:18px 24px;page-break-inside:avoid;color:#fff}.total-row{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:8px 0;border-bottom:1px solid #2a4666;font-size:15px}.total-row:last-child{border-bottom:0}.total-row strong{font-weight:950}.total-row.highlight{padding:15px 0;color:#31d4ff;font-size:17px}.total-row.highlight .amount{font-size:25px}.amount{font-weight:950}.bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #d9e4ef;border-radius:18px;margin:24px 0 0;overflow:hidden;page-break-inside:avoid}.bottom-box{padding:18px 24px;min-height:145px}.bottom-box:first-child{border-right:1px solid #e6eef6}.bottom-box h2{margin:0 0 11px;color:#00a2ff;font-size:18px;letter-spacing:.03em}.bottom-box p,.bottom-box li{font-size:14px;line-height:1.35;margin:0 0 7px}.bottom-box ul{margin:0;padding-left:18px}.bottom-box li::marker{color:#00a2ff}.only-conditions{grid-template-columns:1fr}.only-conditions .bottom-box:first-child{display:none}.only-conditions .bottom-box{border-right:0}.empty{color:#65758b;font-size:14px}.footer{position:fixed;left:0;right:0;bottom:0;height:.48in;background:#000;border-top:2px solid #31d4ff;color:#c9d8e7;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;align-items:center;padding:0 54px;font-size:11px}.footer strong{color:#fff}.footer span{text-align:center}.footer span:first-child{text-align:left}.footer span:last-child{text-align:right}@media print{.noPrint{display:none}.quote-section,.client-card,.totals,.bottom-grid{break-inside:avoid;page-break-inside:avoid}.content{padding-bottom:82px}}
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
function openClientQuotePdfWindow(r,lang="es"){
  const L=quotePdfLabels(lang);
  if(!r || (!r.local_id && !r.client && !r.project))return alert(L.notFound);
  const w=window.open("","_blank");
  if(!w)return alert(L.popupBlocked);
  w.document.open();
  w.document.write(quotePdfBuildHtml(r,lang));
  w.document.close();
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


// TOPDJS CRM v11.4.42 - Fecha de anticipo
if($("quotePaidDate") && !$("quotePaidDate").value){$("quotePaidDate").value=todayISO()}
