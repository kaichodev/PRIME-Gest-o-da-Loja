
(() => {
"use strict";

const STORAGE_KEY = "prime_gestao_v8";
const LEGACY_KEYS = ["prime_gestao_v7","prime_gestao_v4","prime_gestao_v3"];

const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const money = (n) => Number(n || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const today = () => localISO(new Date());
const parseDate = (s) => {
  if(!s) return new Date(0);
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y,m-1,d);
};
const fmt = (s) => s ? parseDate(s).toLocaleDateString("pt-BR") : "-";
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg,undo){let box=$("toasts");if(!box){box=document.createElement("div");box.id="toasts";box.setAttribute("role","status");document.body.appendChild(box);}const t=document.createElement("div");t.className="toast";t.textContent=msg;if(undo){const b=document.createElement("button");b.textContent="Desfazer";b.onclick=()=>{undo();t.remove();};t.appendChild(b);}box.appendChild(t);setTimeout(()=>t.remove(),undo?7000:3500);}
let prodFilter="all";
function orderFilter(o){if(prodFilter==="today")return o.deadline===today();if(prodFilter==="late")return urgencyClass(o)==="order-late";if(prodFilter==="unpaid")return o.paymentStatus!=="Pago";if(prodFilter==="ready")return["Pronto","Aguardando retirada"].includes(o.status);return true}
function waLink(o){const d=String(o.phone||"").replace(/\D/g,"");if(d.length<10)return"";const n=d.startsWith("55")?d:"55"+d,nm=o.custom?.name||o.client,st=o.completedAt?"está pronto":"está em produção";const msg=o.paymentStatus!=="Pago"?`Olá, ${o.client}! Seu pedido (${nm}) ${st}. O pagamento de ${money(o.total)} ainda está pendente.`:`Olá, ${o.client}! Seu pedido (${nm}) ${st}.`;return `<a class="secondary btnlink" target="_blank" rel="noopener" href="https://wa.me/${n}?text=${encodeURIComponent(msg)}">WhatsApp</a>`}
function loadDb(){
  const direct = localStorage.getItem(STORAGE_KEY);
  if(direct){
    try { return JSON.parse(direct); } catch {}
  }
  for(const key of LEGACY_KEYS){
    const raw = localStorage.getItem(key);
    if(raw){
      try { return JSON.parse(raw); } catch {}
    }
  }
  return {colors:[],models:[],orders:[],items:[],purchases:[],expenses:[],settings:{}};
}

let db = loadDb();
db.colors = Array.isArray(db.colors) ? db.colors : [];
db.models = Array.isArray(db.models) ? db.models : [];
db.orders = Array.isArray(db.orders) ? db.orders : [];
db.items = Array.isArray(db.items) ? db.items : [];
db.purchases = Array.isArray(db.purchases) ? db.purchases : [];
db.expenses = Array.isArray(db.expenses) ? db.expenses : [];
db.settings = db.settings || {};
db.recoveryLog = Array.isArray(db.recoveryLog) ? db.recoveryLog : [];
db.models.forEach(m=>{m.recipe=Array.isArray(m.recipe)?m.recipe:[]});
db.items.forEach(i=>{i.recovered=Number(i.recovered||0);i.recoveryTarget=Number(i.recoveryTarget||0);i.packageQty=Number(i.packageQty||0)});

if(!db.colors.length){
  db.colors = [
    ["Vermelho","#ef4444"],["Azul Bebê","#7dd3fc"],["Azul Escuro","#155eaa"],["Marrom","#6b4f1d"],
    ["Rosa","#f9a8d4"],["Verde","#16804f"],["Branco","#ffffff"],["Preto","#111111"]
  ].map((x,i)=>({id:"c"+i,name:x[0],hex:x[1],material:"PLA"}));
}

const getColor = (id) => db.colors.find(x=>x.id===id);
const getModel = (id) => db.models.find(x=>x.id===id);
const getItem = (id) => db.items.find(x=>x.id===id);

function save(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    window.dispatchEvent(new CustomEvent("prime:data-changed"));
  }catch(err){
    alert("O navegador ficou sem espaço. Reduza o tamanho das imagens/comprovantes e exporte um backup.");
  }
  render();
}

function imageToData(file){
  return new Promise((resolve)=>{
    if(!file) return resolve("");
    if(!file.type.startsWith("image/")){toast("Envie um arquivo de imagem.");return resolve("");}
    const reader=new FileReader();
    reader.onerror=()=>resolve("");
    reader.onload=()=>{const img=new Image();img.onerror=()=>resolve("");img.onload=()=>{const k=Math.min(1,1000/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.78));};img.src=reader.result;};
    reader.readAsDataURL(file);
  });
}

function colorHtml(ids){
  if(!Array.isArray(ids) || !ids.length) return "-";
  return ids.map(id=>{
    const c = getColor(id);
    return c ? `<span class="pill" style="background:${esc(c.hex)}22"><i class="dot" style="background:${esc(c.hex)}"></i>${esc(c.name)}</span>` : "";
  }).join(" ") || "-";
}

function openImage(src){
  if(!src) return;
  $("bigImg").src = src;
  $("imgModal").classList.add("active");
}

function receiptHtml(src){
  return src ? `<img class="receipt" data-image="${esc(src)}" src="${esc(src)}" alt="Comprovante">` : "-";
}

function showModal(title, html, onSubmit){
  $("modalTitle").textContent = title;
  $("form").innerHTML = html;
  $("form").onsubmit = onSubmit;
  $("modal").classList.add("active");
}

function closeModal(){
  $("modal").classList.remove("active");
  $("form").onsubmit = null;
}

function actionFooter(){
  return `<div class="field span4 actions" style="justify-content:flex-end">
    <button type="button" class="secondary" data-action="close-modal">Cancelar</button>
    <button type="submit" class="primary">Salvar</button>
  </div>`;
}

function deadlineClass(date){
  const now=new Date(); const due=date?new Date(date+"T23:59:59"):now;
  if(now>due) return "late";
  const left=due-now; return left<=12*3600000?"warning":"ok";
}
function deadlineText(date){
  const now=new Date(), due=date?new Date(date+"T23:59:59"):now, h=Math.ceil((due-now)/3600000);
  if(h<0) return `${Math.abs(h)}h atrasado`; if(h<=12) return `${h}h restantes`; return fmt(date);
}

function activateTab(tabId){
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active", x.dataset.tab===tabId));
  document.querySelectorAll(".screen").forEach(x=>x.classList.toggle("active", x.id===tabId));
  const names={producao:"Produção",finalizados:"Finalizados",estoque:"Estoque",gastos:"Saídas",modelos:"Produtos",receitas:"Receitas",cores:"Cores",financeiro:"Financeiro"};
  if($("pageTitle")) $("pageTitle").textContent=names[tabId]||"PRIME";
  if($("btnNovoPedido")) $("btnNovoPedido").style.display=tabId==="producao"?"":"none";
  const kp=document.querySelector(".dashboard-grid");if(kp)kp.style.display=tabId==="producao"?"":"none";
  if($("busca"))$("busca").style.display=tabId==="producao"?"":"none";
}

/* PEDIDOS */
function defaultDeadline(){const d=new Date();d.setDate(d.getDate()+1);return localISO(d)}
function orderSpecificFields(model,order={}){
  if(!model) return "";
  const two=/2\s*cores|duas\s*cores/i.test(model.name);
  const name=esc(order.custom?.name||order.notes||"");
  if(two) return `<div class="specific-box span4"><div class="specific-title">Personalização</div><div class="formgrid compact"><div class="field span2"><label>Nome do chaveiro</label><input name="customName" value="${name}" placeholder="Ex.: Rodrigo" required></div><div class="field"><label>Base (B)</label><select name="baseColor">${(model.colors||[]).map(id=>{const c=getColor(id);return c?`<option value="${esc(id)}" ${id===order.custom?.baseColor?"selected":""}>${esc(c.name)}</option>`:""}).join("")}</select></div><div class="field"><label>Letra (L)</label><select name="letterColor">${(model.colors||[]).map(id=>{const c=getColor(id);return c?`<option value="${esc(id)}" ${id===order.custom?.letterColor?"selected":""}>${esc(c.name)}</option>`:""}).join("")}</select></div></div></div>`;
  return `<div class="specific-box span4"><div class="specific-title">Personalização</div><div class="field"><label>Nome / texto / instrução principal</label><input name="customName" value="${name}" placeholder="O que precisa ser personalizado?"></div></div>`;
}
function updateOrderTotal(){const f=$("form"),el=$("orderTotal");if(!el||!f)return;const g=n=>Number(f.elements[n]?.value||0);el.textContent=money(Math.max(0,g("qty")*g("unitPrice")-g("discount")))}
function seg(name,opts,val){return `<div class="seg-group">${opts.map(o=>`<label class="seg"><input type="radio" name="${name}" value="${o}" ${o===val?"checked":""}><span>${o}</span></label>`).join("")}</div>`}
function openOrder(order=null){
  if(!db.models.length){toast("Cadastre pelo menos um produto antes de criar um pedido.");activateTab("modelos");return;}
  const selectedModel=order?.modelId&&getModel(order.modelId)?order.modelId:db.models[0].id;
  const m=getModel(selectedModel),qty=Number(order?.qty||1),price=Number(order?.unitPrice??m?.price??0),disc=Number(order?.discount||0);
  const clients=[...new Set(db.orders.map(o=>o.client).filter(Boolean))];
  showModal(order?"Editar pedido":"Novo pedido",`<input type="hidden" name="editId" value="${esc(order?.id||"")}"><input type="hidden" name="number" value="${esc(order?.number||"#"+String(db.orders.length+1).padStart(4,"0"))}">
  <div class="order-layout">
    <div class="order-main">
      <section class="order-section"><h3>Cliente e prazo</h3><div class="formgrid compact">
        <div class="field"><label>Cliente</label><input name="client" list="clientList" autocomplete="off" value="${esc(order?.client||"")}" required autofocus><datalist id="clientList">${clients.map(c=>`<option value="${esc(c)}">`).join("")}</datalist></div>
        <div class="field"><label>WhatsApp (opcional)</label><input name="phone" inputmode="tel" value="${esc(order?.phone||"")}"></div>
        <div class="field span2"><label>Prazo de entrega</label><div class="deadline-row"><input name="deadline" type="date" value="${esc(order?.deadline||defaultDeadline())}" required><div class="quick">${[["Hoje",0],["Amanhã",1],["+3d",3],["+7d",7]].map(([t,d])=>`<button type="button" class="chipbtn" data-action="set-deadline" data-days="${d}">${t}</button>`).join("")}</div></div></div>
      </div></section>
      <section class="order-section"><h3>Produto</h3><div class="modelgrid compact-models">${db.models.map(x=>`<label class="modelcard ${x.id===selectedModel?"selected":""}"><input type="radio" name="modelId" value="${esc(x.id)}" ${x.id===selectedModel?"checked":""} hidden>${x.photo?`<img src="${esc(x.photo)}" alt="">`:`<div class="noimg">${esc((x.name||"?").slice(0,1).toUpperCase())}</div>`}<b>${esc(x.name)}</b><span>${money(x.price)}</span></label>`).join("")}</div><div id="specificFields">${orderSpecificFields(m,order||{})}</div></section>
      <details class="optional-details"><summary>Entrega e observações (opcional)</summary><div class="formgrid compact" style="margin-top:10px"><div class="field span2"><label>Endereço</label><input name="address" value="${esc(order?.address||"")}"></div><div class="field"><label>Número</label><input name="addressNumber" value="${esc(order?.addressNumber||"")}"></div><div class="field"><label>Entrega</label><select name="delivery">${["N/ENTREGUE","ENTREGUE","Retirada","Entrega local"].map(x=>`<option ${x===(order?.delivery||"N/ENTREGUE")?"selected":""}>${x}</option>`).join("")}</select></div><div class="field span4"><label>Observação</label><textarea name="extraNotes">${esc(order?.extraNotes||"")}</textarea></div></div></details>
    </div>
    <div class="order-side">
      <section class="order-section"><h3>Valores</h3><div class="formgrid compact">
        <div class="field span4"><label>Quantidade</label><div class="stepper"><button type="button" data-action="qty-step" data-step="-1" aria-label="Diminuir">−</button><input name="qty" type="number" min="1" value="${qty}" required><button type="button" data-action="qty-step" data-step="1" aria-label="Aumentar">+</button></div></div>
        <div class="field span2"><label>Valor unitário</label><input id="orderPrice" name="unitPrice" type="number" step=".01" min="0" value="${price}" required></div>
        <div class="field span2"><label>Desconto</label><input name="discount" type="number" step=".01" min="0" value="${disc}"></div>
      </div></section>
      <section class="order-section"><h3>Pagamento</h3>
        <div class="field"><label>Forma</label>${seg("payment",["Pix","Dinheiro","Cartão"],order?.payment||"Pix")}</div>
        <div class="field" style="margin-top:10px"><label>Situação</label>${seg("paymentStatus",["Pendente","Pago"],order?.paymentStatus==="Pago"?"Pago":"Pendente")}</div>
        <div class="field" style="margin-top:10px"><label>Comprovante (opcional)</label><input name="paymentProof" type="file" accept="image/*"></div>
      </section>
    </div>
  </div>
  <div class="sticky-bar"><div class="sum"><small>Total do pedido</small><b id="orderTotal">${money(Math.max(0,qty*price-disc))}</b></div><div class="actions"><button type="button" class="secondary" data-action="close-modal">Cancelar</button><button type="submit" class="primary big">${order?"Salvar alterações":"Salvar pedido"}</button></div></div>`,saveOrderForm);
}

function applyOrderModel(modelId,selectedColors=[],editing=false){
 const model=getModel(modelId);if(!model)return;
 document.querySelectorAll("#form .modelcard").forEach(card=>{const input=card.querySelector('input[name="modelId"]');card.classList.toggle("selected",input&&input.value===modelId)});
 const price=$("orderPrice");if(price&&!editing)price.value=Number(model.price||0);
 const target=$("specificFields");if(target)target.innerHTML=orderSpecificFields(model,{custom:{name:document.querySelector('#form [name="customName"]')?.value||""}});
}

async function saveOrderForm(e){
 e.preventDefault();const fd=new FormData(e.currentTarget),f=Object.fromEntries(fd.entries());
 const old=f.editId?db.orders.find(x=>x.id===f.editId):null;
 const proof=await imageToData(e.currentTarget.elements.paymentProof?.files?.[0]);
 const custom={name:f.customName||"",baseColor:f.baseColor||"",letterColor:f.letterColor||""};
 const colors=[custom.baseColor,custom.letterColor].filter(Boolean);
 const data={number:f.number,date:old?.date||today(),createdAt:old?.createdAt||new Date().toISOString(),deadline:f.deadline,client:f.client,phone:f.phone,address:f.address,addressNumber:f.addressNumber,modelId:f.modelId,qty:Number(f.qty),unitPrice:Number(f.unitPrice),discount:Number(f.discount||0),total:Math.max(0,Number(f.qty)*Number(f.unitPrice)-Number(f.discount||0)),colors,custom,notes:custom.name,payment:f.payment,paymentStatus:f.paymentStatus||"Pendente",status:old?.status||"Recebido",delivery:f.delivery||old?.delivery||"N/ENTREGUE",extraNotes:f.extraNotes||""};
 if(proof)data.paymentProof=proof;else if(old?.paymentProof)data.paymentProof=old.paymentProof;
 data.paidAt=data.paymentStatus==="Pago"?(old?.paidAt||today()):null;if(old){const was=old.recipeApplied;if(was)restoreOrder(old);Object.assign(old,data);if(was)consumeOrder(old)}else db.orders.push({id:uid(),...data,completedAt:null});closeModal();save();
}

function updateOrder(id,key,value){
  const o = db.orders.find(x=>x.id===id);
  if(!o) return;
  o[key] = value;
  save();
}
function recipeLines(o){const m=getModel(o.modelId);return (m?.recipe||[]).map(r=>({itemId:r.itemId,qty:Number(r.qty||0)*Number(o.qty||0)})).filter(r=>getItem(r.itemId)&&r.qty>0)}
function consumeOrder(o){const missing=[];o.consumption=recipeLines(o).map(l=>{const i=getItem(l.itemId),value=l.qty*Number(i.cost||0);i.stock=Number(i.stock||0)-l.qty;i.recovered=Number(i.recovered||0)+value;if(i.stock<0)missing.push(i.name);db.recoveryLog.push({id:uid(),orderId:o.id,itemId:i.id,qty:l.qty,value,date:new Date().toISOString()});return {...l,value}});o.costTotal=o.consumption.length?o.consumption.reduce((s,c)=>s+c.value,0):null;o.recipeApplied=true;return missing}
function restoreOrder(o){const lines=o.consumption||(o.recipeApplied?recipeLines(o).map(l=>({...l,value:l.qty*Number(getItem(l.itemId).cost||0)})):[]);lines.forEach(c=>{const i=getItem(c.itemId);if(i){i.stock=Number(i.stock||0)+c.qty;i.recovered=Math.max(0,Number(i.recovered||0)-c.value)}});db.recoveryLog=db.recoveryLog.filter(x=>x.orderId!==o.id);o.consumption=null;o.costTotal=null;o.recipeApplied=false}
function finishOrder(id){const o=db.orders.find(x=>x.id===id);if(!o||o.completedAt)return;const missing=o.recipeApplied?[]:consumeOrder(o);o.status="Finalizado";o.completedAt=new Date().toISOString();save();toast(missing.length?"Finalizado. Estoque insuficiente: "+missing.join(", "):"Pedido finalizado",()=>reopenOrder(id))}
function reopenOrder(id){const o=db.orders.find(x=>x.id===id);if(!o)return;if(o.recipeApplied)restoreOrder(o);o.status="Em produção";o.completedAt=null;save()}
function deleteOrder(id){const o=db.orders.find(x=>x.id===id);if(o&&confirm("Apagar este pedido permanentemente?")){if(o.recipeApplied)restoreOrder(o);db.orders=db.orders.filter(x=>x.id!==id);save()}}
function togglePaid(id){const o=db.orders.find(x=>x.id===id);if(!o)return;const paid=o.paymentStatus==="Pago";o.paymentStatus=paid?"Pendente":"Pago";o.paidAt=paid?null:today();save();toast(paid?"Pagamento marcado como pendente":"Pagamento confirmado")}

function showOrderDetails(id){
  const o = db.orders.find(x=>x.id===id);
  if(!o) return;
  const m = getModel(o.modelId);
  $("detailContent").innerHTML = `
    <div class="detailgrid">
      <div class="detail"><small>Pedido</small><b>${esc(o.number)}</b></div><div class="detail"><small>Registrado em</small>${o.createdAt?new Date(o.createdAt).toLocaleString("pt-BR"):fmt(o.date)}</div>
      <div class="detail"><small>Cliente</small><b>${esc(o.client)}</b></div>
      <div class="detail"><small>Contato</small>${esc(o.phone || "-")}</div>
      <div class="detail"><small>Prazo</small>${fmt(o.deadline)}</div>
      <div class="detail"><small>Modelo</small>${esc(m?.name || "-")}</div>
      <div class="detail"><small>Quantidade</small>${Number(o.qty || 0)}</div>
      <div class="detail"><small>Cores</small>${colorHtml(o.colors)}</div>
      <div class="detail"><small>Pagamento</small>${esc(o.payment || "-")} • <b>${esc(o.paymentStatus||"Pendente")}</b></div>${o.paymentProof?`<div class="detail"><small>Comprovante</small>${receiptHtml(o.paymentProof)}</div>`:""}
      <div class="detail"><small>Total</small><b>${money(o.total)}</b></div>
      <div class="detail"><small>Endereço</small>${esc(`${o.address || "-"} ${o.addressNumber || ""}`)}</div>
      <div class="detail"><small>Complemento</small>${esc(o.addressExtra || "-")}</div>
      <div class="detail"><small>Entrega</small>${esc(o.delivery || "-")}</div>
    </div>
    <br>
    <div class="note"><b>Fabricação / personalização</b><br>${esc(o.custom?.name || o.notes || "-")}${o.extraNotes ? `<br><br><b>Observação:</b> ${esc(o.extraNotes)}`:""}</div>
    <br>
    <div class="actions">
      <button class="primary" data-action="print-order" data-id="${esc(o.id)}">🧾 Gerar nota / imprimir</button>
      <button class="secondary" data-action="edit-order" data-id="${esc(o.id)}">✎ Editar</button>${waLink(o)}
    </div>
  `;
  $("detailModal").classList.add("active");
}

function printOrder(id){
  const o = db.orders.find(x=>x.id===id);
  if(!o) return;
  const m = getModel(o.modelId);
  const w = window.open("","_blank");
  if(!w){
    alert("O navegador bloqueou a janela de impressão. Permita pop-ups para este site.");
    return;
  }

  const doc = [
    "<!doctype html><html><head><meta charset='utf-8'><title>",
    esc(o.number),
    "</title><style>",
    "body{font-family:Arial,sans-serif;padding:30px;color:#222}.head{border-bottom:2px solid #174d39;padding-bottom:12px;margin-bottom:20px}",
    "table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #ddd}.total{font-size:22px;font-weight:bold;text-align:right;margin-top:20px}",
    ".box{padding:12px;background:#f4f4f4;margin-top:15px}",
    "</style></head><body>",
    "<div class='head'><h2>PRIME STUDIO</h2><b>Nota do Pedido ",esc(o.number),"</b><br>Data: ",fmt(o.date)," • Prazo: ",fmt(o.deadline),"</div>",
    "<table>",
    "<tr><td>Cliente</td><td>",esc(o.client),"</td></tr>",
    "<tr><td>Contato</td><td>",esc(o.phone || "-"),"</td></tr>",
    "<tr><td>Endereço</td><td>",esc(`${o.address || "-"} ${o.addressNumber || ""} ${o.addressExtra || ""}`),"</td></tr>",
    "<tr><td>Produto</td><td>",esc(m?.name || "-"),"</td></tr>",
    "<tr><td>Quantidade</td><td>",String(o.qty || 0),"</td></tr>",
    "<tr><td>Valor unitário</td><td>",money(o.unitPrice),"</td></tr>",
    "<tr><td>Desconto</td><td>",money(o.discount),"</td></tr>",
    "<tr><td>Pagamento</td><td>",esc(o.payment || "-"),"</td></tr>",
    "<tr><td>Entrega</td><td>",esc(o.delivery || "-"),"</td></tr>",
    "</table>",
    "<div class='box'><b>Personalização / observações:</b><br>",esc(o.notes || "-"),
    o.needs ? `<br>${esc(o.needs)}` : "",
    "</div><div class='total'>TOTAL: ",money(o.total),"</div>",
    "</body></html>"
  ].join("");

  w.document.open();
  w.document.write(doc);
  w.document.close();
  setTimeout(()=>w.print(),250);
}

function urgencyClass(o){const now=new Date(),due=new Date((o.deadline||today())+"T23:59:59");if(now>due)return "order-late";if(due-now<=12*3600000)return "order-warning";return ""}
function compactColors(o){const ids=[o.custom?.baseColor,o.custom?.letterColor].filter(Boolean);if(ids.length>=2){return ids.slice(0,2).map((id,n)=>{const c=getColor(id);return c?`<span class="color-mini" title="${esc(c.name)}"><i style="background:${esc(c.hex)}"></i>${n?"L":"B"}</span>`:""}).join("")}return (o.colors||[]).slice(0,2).map((id,n)=>{const c=getColor(id);return c?`<span class="color-mini" title="${esc(c.name)}"><i style="background:${esc(c.hex)}"></i>${n?"L":"B"}</span>`:""}).join("")||"-"}
function renderOrders(){
 const q=($("busca")?.value||"").toLowerCase();const active=db.orders.filter(o=>!o.completedAt).filter(o=>[o.client,o.phone,o.number,o.custom?.name,getModel(o.modelId)?.name,o.notes].join(" ").toLowerCase().includes(q)).filter(orderFilter).sort((a,b)=>(a.deadline||"").localeCompare(b.deadline||""));
 $("ordersBody").innerHTML=active.length?active.map(o=>`<tr class="${urgencyClass(o)}"><td><b>${esc(o.custom?.name||o.client)}</b>${o.custom?.name&&o.client!==o.custom.name?`<small class="row-sub">${esc(o.client)}</small>`:""}</td><td><b>${esc(getModel(o.modelId)?.name||"-")}</b></td><td>${Number(o.qty||0)} un.</td><td><div class="compact-colors">${compactColors(o)}</div></td><td><b>${fmt(o.deadline).slice(0,5)}</b>${urgencyClass(o)?`<small class="row-sub">${deadlineText(o.deadline)}</small>`:""}</td><td><b>${money(o.total)}</b></td><td><button type="button" class="pay-status ${o.paymentStatus==="Pago"?"paid":"pending"}" data-action="toggle-paid" data-id="${esc(o.id)}" title="Clique para alternar">${o.paymentStatus==="Pago"?"✓ Pago":"Pendente"}</button></td><td><select class="compact-select" data-action="change-order" data-key="status" data-id="${esc(o.id)}">${["Recebido","Em produção","Pronto","Aguardando retirada"].map(x=>`<option ${x===o.status?"selected":""}>${x}</option>`).join("")}</select></td><td><div class="actions compact-actions"><button class="secondary" data-action="details-order" data-id="${esc(o.id)}">Ver</button><button class="secondary" data-action="edit-order" data-id="${esc(o.id)}">Editar</button><button class="primary" data-action="finish-order" data-id="${esc(o.id)}">Finalizar</button><button class="danger" data-action="delete-order" data-id="${esc(o.id)}" title="Excluir" aria-label="Excluir">×</button></div></td></tr>`).join(""):`<tr><td colspan="9" class="empty">Nenhum pedido em produção. Clique em “Novo pedido” (ou tecle N) para começar.</td></tr>`;
 const critical=active.filter(o=>urgencyClass(o));$("alerts").parentElement.style.display=critical.length?"":"none";$("alerts").innerHTML=critical.length?critical.map(o=>`<div class="alertrow"><b>${esc(o.custom?.name||o.client)} • ${esc(getModel(o.modelId)?.name||"")}</b><span class="pill ${deadlineClass(o.deadline)}">${deadlineText(o.deadline)}</span></div>`).join(""):`<div class="muted">Nenhuma prioridade crítica.</div>`;
}

function renderDone(){
  const done = db.orders.filter(o=>o.completedAt).sort((a,b)=>(b.completedAt||"").localeCompare(a.completedAt||""));
  $("doneBody").innerHTML = done.length ? done.map(o=>`
    <tr>
      <td>${esc(o.number)}</td><td>${new Date(o.completedAt).toLocaleString("pt-BR")}</td><td>${esc(o.client)}</td>
      <td>${esc(getModel(o.modelId)?.name || "-")}</td><td>${Number(o.qty || 0)}</td><td><b>${money(o.total)}</b></td><td>${esc(o.delivery || "-")}</td>
      <td><div class="actions">
        <button class="secondary" data-action="details-order" data-id="${esc(o.id)}">Detalhes / Nota</button>
        <button class="secondary" data-action="edit-order" data-id="${esc(o.id)}">Editar</button>
        <button class="secondary" data-action="reopen-order" data-id="${esc(o.id)}">Reabrir</button>
        <button class="danger" data-action="delete-order" data-id="${esc(o.id)}">Apagar</button>
      </div></td>
    </tr>
  `).join("") : `<tr><td colspan="8" class="empty">Nenhum finalizado.</td></tr>`;
}

/* ESTOQUE */
function openStockItem(stockItem=null){
 showModal(stockItem?"Editar item":"Cadastrar item",`<div class="item-form"><div class="item-section"><div class="item-section-title">Identificação</div><div class="formgrid compact"><div class="field"><label>SKU</label><input name="sku" value="${esc(stockItem?.sku||"")}" required></div><div class="field span2"><label>Nome</label><input name="name" value="${esc(stockItem?.name||"")}" required></div><div class="field"><label>Categoria</label><input name="category" value="${esc(stockItem?.category||"")}"></div></div></div><div class="item-section"><div class="item-section-title">Estoque</div><div class="formgrid compact"><div class="field"><label>Unidade de uso</label><select name="unit">${["un","g","kg","m","rolo","caixa"].map(x=>`<option ${x===(stockItem?.unit||"g")?"selected":""}>${x}</option>`).join("")}</select></div><div class="field"><label>Estoque atual</label><input name="stock" type="number" step=".001" min="0" value="${Number(stockItem?.stock||0)}"></div><div class="field"><label>Estoque mínimo</label><input name="min" type="number" step=".001" min="0" value="${Number(stockItem?.min||0)}"></div><div class="field"><label>Qtd. do pacote</label><input id="packageQty" name="packageQty" type="number" step=".001" min="0" value="${Number(stockItem?.packageQty||0)}" placeholder="Ex.: 1000"></div></div></div><div class="item-section"><div class="item-section-title">Compra e custo real</div><div class="formgrid compact"><div class="field"><label>Valor do produto R$</label><input id="purchasePrice" name="purchasePrice" type="number" step=".01" min="0" value="${Number(stockItem?.purchasePrice||stockItem?.recoveryTarget||0)}"></div><div class="field"><label>Frete R$</label><input id="freight" name="freight" type="number" step=".01" min="0" value="${Number(stockItem?.freight||0)}"></div><div class="field"><label>Investimento real</label><input id="realCost" readonly></div><div class="field"><label>Custo por ${esc(stockItem?.unit||"un")}</label><input id="unitUsedCost" readonly></div></div><div id="costSummary" class="cost-summary"></div></div>${actionFooter()}</div>`,e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));const purchasePrice=Number(f.purchasePrice||0),freight=Number(f.freight||0),packageQty=Number(f.packageQty||0),real=purchasePrice+freight,cost=packageQty?real/packageQty:real;const data={sku:f.sku,name:f.name,category:f.category,unit:f.unit,stock:Number(f.stock),min:Number(f.min),cost,packageQty,purchasePrice,freight,recoveryTarget:real,recovered:Number(stockItem?.recovered||0)};if(stockItem)Object.assign(stockItem,data);else{const it={id:uid(),...data};db.items.push(it);if(it.stock>0&&real>0)db.purchases.push({id:uid(),date:today(),supplier:"Cadastro inicial",itemId:it.id,qty:it.stock,cost:purchasePrice/it.stock,freight,total:real,payment:"Pix",note:"Estoque inicial",proof:"",status:"Pago",noCash:true,tracked:true})}closeModal();save();});
 requestAnimationFrame(()=>{const calc=()=>{const p=Number($("purchasePrice")?.value||0),fr=Number($("freight")?.value||0),q=Number($("packageQty")?.value||0),real=p+fr,unit=q?real/q:real;if($("realCost"))$("realCost").value=money(real);if($("unitUsedCost"))$("unitUsedCost").value=money(unit);if($("costSummary"))$("costSummary").innerHTML=`<b>${money(p)}</b> produto + <b>${money(fr)}</b> frete = <b>${money(real)}</b> investimento • ${q||0} unidades de referência → <b>${money(unit)}</b> por unidade usada`;};["purchasePrice","freight","packageQty"].forEach(id=>$(id)?.addEventListener("input",calc));calc();});
}

function openPurchase(purchase=null){
  if(!db.items.length){
    alert("Cadastre um item do estoque primeiro.");
    return;
  }
  showModal(purchase ? "Editar compra" : "Registrar compra", `
    <div class="formgrid">
      <div class="field"><label>Data</label><input name="date" type="date" value="${esc(purchase?.date||today())}" required></div>
      <div class="field"><label>Fornecedor</label><input name="supplier" value="${esc(purchase?.supplier||"")}" required></div>
      <div class="field span2"><label>Item</label><select name="itemId">${db.items.map(i=>`<option value="${esc(i.id)}" ${i.id===purchase?.itemId?"selected":""}>${esc(i.sku)} — ${esc(i.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Quantidade</label><input name="qty" type="number" step=".001" min=".001" value="${purchase?.qty??""}" required></div>
      <div class="field"><label>Custo unitário</label><input name="cost" type="number" step=".01" min="0" value="${purchase?.cost??""}" required></div>
      <div class="field"><label>Pagamento</label><select name="payment">${["Pix","Dinheiro","Cartão","Boleto"].map(v=>`<option ${v===(purchase?.payment||"Pix")?"selected":""}>${v}</option>`).join("")}</select></div>
      <div class="field"><label>Nota / referência</label><input name="note" value="${esc(purchase?.note||"")}"></div>
      <div class="field"><label>Frete R$</label><input name="freight" type="number" step=".01" min="0" value="${purchase?.freight??0}"></div><div class="field"><label>Situação</label><select name="status">${["Pago","Pendente"].map(v=>`<option ${v===(purchase?.status==="Pendente"?"Pendente":"Pago")?"selected":""}>${v}</option>`).join("")}</select></div>
      <div class="field span2"><label>Comprovante</label><input name="proof" type="file" accept="image/*"></div>
      ${actionFooter()}
    </div>
  `, async e=>{
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const proof = await imageToData(e.currentTarget.elements.proof.files[0]);
    const newItem = getItem(fd.get("itemId"));
    const q = Number(fd.get("qty"));
    const c = Number(fd.get("cost"));

    const fr=Number(fd.get("freight")||0),total=q*c+fr;
    if(purchase) revertPurchase(purchase);
    const data={date:fd.get("date"),supplier:fd.get("supplier"),itemId:fd.get("itemId"),qty:q,cost:c,freight:fr,total,payment:fd.get("payment"),note:fd.get("note"),status:fd.get("status")};
    let rec=purchase;
    if(purchase){Object.assign(purchase,data);if(proof)purchase.proof=proof;}else{rec={id:uid(),...data,proof};db.purchases.push(rec);}
    applyPurchase(rec);
    closeModal();save();
  });
}

function applyPurchase(p){const i=getItem(p.itemId);if(!i)return;i.stock=Number(i.stock||0)+Number(p.qty||0);i.recoveryTarget=Number(i.recoveryTarget||0)+Number(p.total||0);if(Number(p.qty)>0)i.cost=Number(p.total||0)/Number(p.qty);p.tracked=true}
function revertPurchase(p){const i=getItem(p.itemId);if(!i)return;i.stock=Number(i.stock||0)-Number(p.qty||0);if(p.tracked)i.recoveryTarget=Math.max(0,Number(i.recoveryTarget||0)-Number(p.total||0));p.tracked=false}
function renderNeeds(){const need={};db.orders.filter(o=>!o.completedAt).forEach(o=>recipeLines(o).forEach(l=>need[l.itemId]=(need[l.itemId]||0)+l.qty));const n2=v=>Number(Number(v).toFixed(2));const rows=Object.entries(need).map(([id,q])=>({i:getItem(id),q})).filter(r=>r.i);const low=db.items.filter(i=>Number(i.stock)<=Number(i.min)&&!need[i.id]);$("needsBox").innerHTML="<b>Materiais para a fila de produção</b><div class=\"recipe-list\">"+(rows.length?rows.map(({i,q})=>{const miss=q-Number(i.stock||0);return `<div class="recipe-line"><span>${esc(i.name)}</span><span>precisa ${n2(q)} ${esc(i.unit)} • tem ${n2(i.stock)} ${miss>0?`<b class="stocklow">• faltam ${n2(miss)} (≈ ${money(miss*Number(i.cost||0))})</b>`:"<b class=\"positive\">✓</b>"}</span></div>`}).join(""):"<div class=\"muted\">Nenhum pedido em aberto consome materiais.</div>")+"</div>"+(low.length?`<div class="muted">Abaixo do mínimo: ${low.map(i=>`<b>${esc(i.name)}</b> (${n2(i.stock)}/${n2(i.min)} ${esc(i.unit)})`).join(", ")}</div>`:"")}
function deleteStockItem(id){
  if(db.models.some(m=>(m.recipe||[]).some(r=>r.itemId===id))){alert("Este item faz parte de uma receita. Remova-o da receita antes de apagar.");return;}
  if(db.purchases.some(x=>x.itemId===id)){
    alert("Este item possui compras vinculadas. Apague ou altere as compras primeiro.");
    return;
  }
  if(confirm("Apagar este item do estoque?")){
    db.items = db.items.filter(x=>x.id!==id);save();
  }
}
function finishPurchase(id){
  const p = db.purchases.find(x=>x.id===id);
  if(p){p.status="Pago";save();}
}
function deletePurchase(id){
  const p = db.purchases.find(x=>x.id===id);
  if(!p) return;
  if(confirm("Apagar esta compra e retirar a quantidade recebida do estoque?")){
    revertPurchase(p);
    db.purchases = db.purchases.filter(x=>x.id!==id);
    save();
  }
}

function recoveryPct(i){const target=Number(i.recoveryTarget||0);return target?Math.min(100,Number(i.recovered||0)/target*100):0;}
function recoveryHtml(i){const pct=recoveryPct(i),target=Number(i.recoveryTarget||0);return `<div class="recovery-cell"><div class="progress-meta"><b>${pct.toFixed(0)}%</b><span>${money(i.recovered||0)} / ${money(target)}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>${pct>=100?`<small class="positive">✓ Reposição garantida</small>`:`<small class="muted">Faltam ${money(Math.max(0,target-Number(i.recovered||0)))}</small>`}</div>`;}
function renderStock(){
  $("stockBody").innerHTML = db.items.length ? db.items.map(i=>`<tr><td><b>${esc(i.name)}</b><br><small class="muted">${esc(i.sku)}</small></td><td>${esc(i.category||"-")}</td><td class="${Number(i.stock)<=Number(i.min)?"stocklow":""}">${Number(i.stock||0)} ${esc(i.unit)}</td><td>${money(i.cost)} / ${esc(i.unit)}</td><td>${recoveryHtml(i)}</td><td>${money(Number(i.stock||0)*Number(i.cost||0))}</td><td><div class="actions"><button class="secondary" data-action="edit-stock" data-id="${esc(i.id)}">Editar</button><button class="danger" data-action="delete-stock" data-id="${esc(i.id)}">Apagar</button></div></td></tr>`).join("") : `<tr><td colspan="7" class="empty">Nenhum item.</td></tr>`;
  const purchases = db.purchases.slice().reverse();
  $("purchaseBody").innerHTML = purchases.length ? purchases.map(p=>`
    <tr><td>${fmt(p.date)}</td><td>${esc(p.supplier)}</td><td>${esc(getItem(p.itemId)?.name||"-")}</td><td>${Number(p.qty||0)}</td><td>${money(p.cost)}</td><td><b>${money(p.total)}</b></td>
    <td>${esc(p.payment||"-")}</td><td>${receiptHtml(p.proof)}</td><td><span class="pill ${p.status==="Pendente"?"today":"ok"}">${p.status==="Pendente"?"A pagar":"Pago"}</span></td>
    <td><div class="actions"><button class="secondary" data-action="edit-purchase" data-id="${esc(p.id)}">Editar</button>${p.status==="Pendente"?`<button class="primary" data-action="finish-purchase" data-id="${esc(p.id)}">Marcar pago</button>`:""}<button class="danger" data-action="delete-purchase" data-id="${esc(p.id)}">Apagar</button></div></td></tr>
  `).join("") : `<tr><td colspan="10" class="empty">Nenhuma compra.</td></tr>`;renderNeeds();
}

/* GASTOS */
function openExpense(expense=null){
  showModal(expense ? "Editar saída" : "Registrar saída", `
    <div class="formgrid">
      <div class="field"><label>Data</label><input name="date" type="date" value="${esc(expense?.date||today())}" required></div>
      <div class="field"><label>Categoria</label><select name="category">${[...(expense?.category==="Material / Insumo"?["Material / Insumo"]:[]),"Frete","Energia","Embalagem","Manutenção","Equipamento","Publicidade","Pró-labore / retirada","Outro"].map(v=>`<option ${v===(expense?.category||"Embalagem")?"selected":""}>${v}</option>`).join("")}</select></div>
      <div class="field span2"><label>Descrição</label><input name="description" value="${esc(expense?.description||"")}" required></div>
      <div class="field"><label>Valor</label><input name="value" type="number" step=".01" min="0" value="${expense?.value??""}" required></div>
      <div class="field"><label>Pagamento</label><select name="payment">${["Pix","Dinheiro","Cartão","Boleto"].map(v=>`<option ${v===(expense?.payment||"Pix")?"selected":""}>${v}</option>`).join("")}</select></div>
      <div class="field"><label>Situação</label><select name="status">${["Pago","Pendente"].map(v=>`<option ${v===(expense?.status==="Pendente"?"Pendente":"Pago")?"selected":""}>${v}</option>`).join("")}</select></div>
      <div class="field span2"><label>Comprovante</label><input name="proof" type="file" accept="image/*"></div>
      ${actionFooter()}
    </div>
  `, async e=>{
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const proof = await imageToData(e.currentTarget.elements.proof.files[0]);
    const data = {date:fd.get("date"),category:fd.get("category"),description:fd.get("description"),value:Number(fd.get("value")),payment:fd.get("payment"),status:fd.get("status")};
    if(expense){Object.assign(expense,data);if(proof)expense.proof=proof;}
    else db.expenses.push({id:uid(),...data,proof});
    closeModal();save();
  });
}
function finishExpense(id){const x=db.expenses.find(v=>v.id===id);if(x){x.status="Pago";save();}}
function deleteExpense(id){if(confirm("Apagar esta saída?")){db.expenses=db.expenses.filter(x=>x.id!==id);save();}}
function renderExpenses(){
  const expenses = db.expenses.slice().reverse();
  $("expenseBody").innerHTML = expenses.length ? expenses.map(x=>`
    <tr><td>${fmt(x.date)}</td><td>${esc(x.category)}</td><td>${esc(x.description)}</td><td><b>${money(x.value)}</b></td><td>${esc(x.payment||"-")}</td><td>${receiptHtml(x.proof)}</td>
    <td><span class="pill ${x.status==="Pendente"?"today":"ok"}">${x.status==="Pendente"?"A pagar":"Pago"}</span></td>
    <td><div class="actions"><button class="secondary" data-action="edit-expense" data-id="${esc(x.id)}">Editar</button>${x.status==="Pendente"?`<button class="primary" data-action="finish-expense" data-id="${esc(x.id)}">Marcar pago</button>`:""}<button class="danger" data-action="delete-expense" data-id="${esc(x.id)}">Apagar</button></div></td></tr>
  `).join("") : `<tr><td colspan="8" class="empty">Nenhuma saída.</td></tr>`;
}

/* MODELOS E CORES */
function openModel(model=null){
  showModal(model ? "Editar modelo" : "Cadastrar modelo", `
    <div class="formgrid">
      <div class="field span2"><label>Nome do modelo</label><input name="name" value="${esc(model?.name||"")}" required></div>
      <div class="field"><label>Preço padrão</label><input name="price" type="number" step=".01" min="0" value="${model?.price??""}" required></div>
      <div class="field"><label>Custo unitário estimado</label><input name="unitCost" type="number" step=".01" min="0" value="${model?.unitCost??0}" required></div>
      <div class="field span2"><label>Especificações padrão</label><textarea name="specs">${esc(model?.specs||"")}</textarea></div>
      <div class="field"><label>Foto opcional</label><input name="photo" type="file" accept="image/*"></div>
      <div class="field span4"><label>Cores disponíveis</label><div class="colors">${db.colors.map(c=>`<label class="chip"><input type="checkbox" name="colors" value="${esc(c.id)}" ${(model?.colors||[]).includes(c.id)?"checked":""}><i class="dot" style="background:${esc(c.hex)}"></i>${esc(c.name)}</label>`).join("")}</div></div>
      ${actionFooter()}
    </div>
  `, async e=>{
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const photo = await imageToData(e.currentTarget.elements.photo.files[0]);
    const data = {name:fd.get("name"),price:Number(fd.get("price")),unitCost:Number(fd.get("unitCost")),specs:fd.get("specs"),colors:fd.getAll("colors")};
    if(model){Object.assign(model,data);if(photo)model.photo=photo;}
    else db.models.push({id:uid(),...data,photo,recipe:[]});
    closeModal();save();
  });
}
function deleteModel(id){
  if(db.orders.some(o=>o.modelId===id)){alert("Este modelo está vinculado a pedidos.");return;}
  if(confirm("Apagar este modelo?")){db.models=db.models.filter(x=>x.id!==id);save();}
}
function renderModels(){$("modelsCards").innerHTML=db.models.length?db.models.map(m=>{const rc=recipeCost(m),price=Number(m.price||0),mg=price-rc,pct=price?mg/price*100:0,ok=(m.recipe||[]).length;const dots=(m.colors||[]).map(id=>getColor(id)).filter(Boolean).map(c=>`<i class="dot big" title="${esc(c.name)}" style="background:${esc(c.hex)}"></i>`).join("");return `<article class="modelcard pcard">${m.photo?`<img src="${esc(m.photo)}" alt="${esc(m.name)}" data-image="${esc(m.photo)}">`:`<div class="noimg">${esc((m.name||"?").slice(0,1).toUpperCase())}</div>`}<div class="phead"><h3>${esc(m.name)}</h3><span class="pill ${ok?"ok":"today"}">${ok?"Receita pronta":"Sem receita"}</span></div><div class="pstats"><div><small>Preço</small><b>${money(price)}</b></div><div><small>Custo</small><b>${money(rc)}</b></div><div><small>Margem</small><b class="${mg>=0?"positive":"negative"}">${pct.toFixed(0)}%</b></div></div>${dots?`<div class="dots">${dots}</div>`:""}${m.specs?`<p class="muted pspecs">${esc(m.specs)}</p>`:""}<div class="actions"><button class="primary" data-action="edit-recipe" data-id="${esc(m.id)}">Receita</button><button class="secondary" data-action="edit-model" data-id="${esc(m.id)}">Editar</button><button class="danger" data-action="delete-model" data-id="${esc(m.id)}">Apagar</button></div></article>`}).join(""):`<div class="empty">Nenhum produto cadastrado.</div>`;}
function editColor(id){
  const c = getColor(id);
  if(!c) return;
  showModal("Editar cor", `
    <div class="formgrid">
      <div class="field"><label>Nome</label><input name="name" value="${esc(c.name)}" required></div>
      <div class="field"><label>Cor</label><input name="hex" type="color" value="${esc(c.hex)}"></div>
      <div class="field"><label>Material</label><select name="material">${["PLA","PETG","ABS","TPU","Outro"].map(v=>`<option ${v===c.material?"selected":""}>${v}</option>`).join("")}</select></div>
      ${actionFooter()}
    </div>
  `, e=>{
    e.preventDefault();
    Object.assign(c,Object.fromEntries(new FormData(e.currentTarget)));
    closeModal();save();
  });
}
function deleteColor(id){
  if(db.models.some(m=>(m.colors||[]).includes(id)) || db.orders.some(o=>(o.colors||[]).includes(id))){
    alert("Essa cor está vinculada a modelos ou pedidos.");
    return;
  }
  if(confirm("Apagar esta cor?")){db.colors=db.colors.filter(x=>x.id!==id);save();}
}
function renderColors(){
  $("colorList").innerHTML = db.colors.map(c=>`
    <span class="chip"><i class="dot" style="background:${esc(c.hex)}"></i><b>${esc(c.name)}</b><span class="muted">${esc(c.material)}</span>
      <button class="secondary" data-action="edit-color" data-id="${esc(c.id)}">Editar</button>
      <button class="danger" data-action="delete-color" data-id="${esc(c.id)}">Apagar</button>
    </span>
  `).join("");
}

/* RECEITAS */
function recipeCost(m){return (m.recipe||[]).reduce((sum,r)=>sum+Number(r.qty||0)*Number(getItem(r.itemId)?.cost||0),0);}
function openRecipe(model){if(!model)return;if(!db.items.length){alert("Cadastre os insumos no Estoque antes de montar uma receita.");activateTab("estoque");return;}showModal("Receita • "+model.name,`<div class="panel"><b>Receita para 1 unidade</b><p class="muted">Quanto de cada insumo é usado para fabricar uma unidade.</p></div>${db.items.map(i=>{const r=(model.recipe||[]).find(x=>x.itemId===i.id);return `<div class="toolbar" style="border-bottom:1px solid #eee;padding:8px 0"><label style="flex:1"><b>${esc(i.name)}</b><br><small class="muted">${money(i.cost)} por ${esc(i.unit)}</small></label><input style="max-width:140px" type="number" step=".001" min="0" name="recipe_${esc(i.id)}" value="${Number(r?.qty||0)}"><span>${esc(i.unit)} / un.</span></div>`}).join("")}${actionFooter()}`,e=>{e.preventDefault();const fd=new FormData(e.currentTarget);model.recipe=db.items.map(i=>({itemId:i.id,qty:Number(fd.get("recipe_"+i.id)||0)})).filter(r=>r.qty>0);model.unitCost=recipeCost(model);closeModal();save();});}
function renderRecipes(){const el=$("recipeCards");if(!el)return;el.innerHTML=db.models.length?db.models.map(m=>{const cost=recipeCost(m),margin=Number(m.price||0)-cost;return `<article class="recipe-card"><h3>${esc(m.name)}</h3><div class="muted">Preço ${money(m.price)} • Custo <b>${money(cost)}</b> • Margem ${money(margin)}</div><div class="recipe-list">${(m.recipe||[]).length?(m.recipe||[]).map(r=>{const i=getItem(r.itemId);return i?`<div class="recipe-line"><span>${esc(i.name)}</span><b>${Number(r.qty)} ${esc(i.unit)}</b></div>`:""}).join(""):`<div class="empty">Receita ainda não configurada.</div>`}</div><button class="primary" data-action="edit-recipe" data-id="${esc(m.id)}">${(m.recipe||[]).length?"Editar receita":"Criar receita"}</button></article>`}).join(""):`<div class="empty">Cadastre produtos primeiro.</div>`;}

/* FINANCEIRO */
function filterPeriod(type, source, dateKey){
  const end = new Date();
  let start = new Date(0);
  if(type==="today") start=parseDate(today());
  else if(type==="7"){start=parseDate(today());start.setDate(start.getDate()-6);}
  else if(type==="15"){start=parseDate(today());start.setDate(start.getDate()-14);}
  else if(type==="month") start=new Date(end.getFullYear(),end.getMonth(),1);

  return source.filter(x=>{
    if(!x[dateKey]) return false;
    const d = dateKey==="completedAt" ? new Date(x[dateKey]) : parseDate(x[dateKey]);
    return d>=start && d<=end;
  });
}

function orderCost(o){if(o.costTotal!=null)return Number(o.costTotal);const m=getModel(o.modelId);return Number((m?.recipe||[]).length?recipeCost(m):m?.unitCost||0)*Number(o.qty||0)}
const isPaid=x=>x.status!=="Pendente";
function renderFinance(){
  const p=$("finPeriod").value,sum=(a,f)=>a.reduce((t,x)=>t+Number(f(x)||0),0);
  const sales=filterPeriod(p,db.orders.filter(o=>o.completedAt),"completedAt");
  const exps=filterPeriod(p,db.expenses,"date").filter(isPaid);
  const draws=exps.filter(x=>x.category==="Pró-labore / retirada"),opexList=exps.filter(x=>!["Pró-labore / retirada","Material / Insumo"].includes(x.category));
  const revenue=sum(sales,o=>o.total),direct=sum(sales,orderCost),gross=revenue-direct,opex=sum(opexList,x=>x.value),drawTotal=sum(draws,x=>x.value),net=gross-opex;
  const purchaseOut=sum(filterPeriod(p,db.purchases,"date").filter(x=>isPaid(x)&&!x.noCash),x=>x.total);
  const cashIn=sum(db.orders.filter(o=>o.paymentStatus==="Pago"),o=>o.total);
  const cashOut=sum(db.expenses.filter(isPaid),x=>x.value)+sum(db.purchases.filter(x=>isPaid(x)&&!x.noCash),x=>x.total);
  const opening=Number(db.settings.openingBalance||0),cash=opening+cashIn-cashOut;
  const receivable=db.orders.filter(o=>o.paymentStatus!=="Pago"),toPay=db.expenses.filter(x=>!isPaid(x)).map(x=>Number(x.value||0)).concat(db.purchases.filter(x=>!isPaid(x)).map(x=>Number(x.total||0)));
  const reinvestPct=db.settings.reinvestPct??30,reinvest=Math.max(0,net*reinvestPct/100),dailyReserve=Number(db.settings.dailyReserve||0);
  const days=p==="today"?1:p==="7"?7:p==="15"?15:p==="month"?new Date().getDate():1,reserve=dailyReserve*days,available=net-reinvest-reserve;
  $("openingBalance").value=opening;$("reinvestPct").value=reinvestPct;$("dailyReserve").value=dailyReserve;
  [["finRevenue",revenue],["finDirect",direct],["finGross",gross],["finExpenses",opex],["finNet",net],["finCash",cash],["finReinvest",reinvest],["finAvailable",available],["finReceivable",sum(receivable,o=>o.total)],["finPayable",toPay.reduce((a,b)=>a+b,0)],["finDraws",drawTotal],["finPurchases",purchaseOut],["finTicket",sales.length?revenue/sales.length:0]].forEach(([id,v])=>$(id).textContent=money(v));
  $("finNet").className=net>=0?"positive":"negative";$("finCash").className=cash>=0?"positive":"negative";
  const margin=revenue?gross/revenue*100:0;
  $("financeAdvice").innerHTML=`<b>Leitura do período:</b> margem bruta de <b>${margin.toFixed(1)}%</b>. Compras de estoque (${money(purchaseOut)}) saem do caixa, mas só entram no custo quando o material é consumido ao finalizar o pedido, então nada é contado duas vezes. ${net>0?`Separe <b>${money(reinvest)}</b> para reinvestir e <b>${money(reserve)}</b> de reserva; sobram <b>${money(available)}</b>.`:"Sem lucro líquido positivo no período: revise preços, custos e despesas antes de retirar dinheiro."}${receivable.length?` Há <b>${money(sum(receivable,o=>o.total))}</b> a receber.`:""}`;
  $("profitBody").innerHTML=db.models.length?db.models.map(m=>{const ms=sales.filter(o=>o.modelId===m.id),qty=sum(ms,o=>o.qty),rev=sum(ms,o=>o.total),cost=sum(ms,orderCost);return {m,qty,rev,cost,gp:rev-cost}}).sort((a,b)=>b.gp-a.gp).map(r=>`<tr><td><b>${esc(r.m.name)}</b></td><td>${r.qty}</td><td>${money(r.rev)}</td><td>${money(r.cost)}</td><td>${money(r.gp)}</td><td>${(r.rev?r.gp/r.rev*100:0).toFixed(1)}%</td><td>${money(Math.max(0,r.gp*reinvestPct/100))}</td></tr>`).join(""):`<tr><td colspan="7" class="empty">Cadastre modelos e custos.</td></tr>`;
}

function renderKpis(){
  const active = db.orders.filter(o=>!o.completedAt);
  const t = parseDate(today()).getTime();
  $("kProduzir").textContent = active.length;
  $("kHojePrazo").textContent = active.filter(o=>parseDate(o.deadline).getTime()===t).length;
  $("kAtrasados").textContent = active.filter(o=>parseDate(o.deadline).getTime()<t).length;
  $("kPecas").textContent = active.reduce((s,o)=>s+Number(o.qty||0),0);
  $("kProntos").textContent = active.filter(o=>["Pronto","Aguardando retirada"].includes(o.status)).length;
}

function backup(){
  const blob = new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "prime-backup-"+today()+".json";db.settings.lastBackup=today();localStorage.setItem(STORAGE_KEY,JSON.stringify(db));toast("Backup exportado");
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function importBackupFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!data||!Array.isArray(data.orders))throw new Error();if(!confirm("Importar este backup e substituir os dados atuais deste protótipo?"))return;db=data;db.colors=db.colors||[];db.models=db.models||[];db.orders=db.orders||[];db.items=db.items||[];db.purchases=db.purchases||[];db.expenses=db.expenses||[];db.settings=db.settings||{};db.recoveryLog=db.recoveryLog||[];save();alert("Backup restaurado com sucesso.");}catch{alert("Arquivo de backup inválido.")}};reader.readAsText(file)}

function render(){
  renderOrders();
  renderDone();
  renderStock();
  renderExpenses();
  renderModels();
  renderRecipes();
  renderColors();
  renderFinance();
  renderKpis();
}

/* EVENTOS */
$("tabs").addEventListener("click",e=>{
  const btn = e.target.closest("[data-tab]");
  if(btn) activateTab(btn.dataset.tab);
});
document.addEventListener("click",e=>{const f=e.target.closest("[data-filter]");if(!f)return;prodFilter=f.dataset.filter;document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("active",b===f));renderOrders()});
$("form").addEventListener("input",e=>{updateOrderTotal();if(e.target.name==="client"){const ph=$("form").elements.phone,o=db.orders.slice().reverse().find(x=>x.client===e.target.value&&x.phone);if(o&&ph&&!ph.value)ph.value=o.phone}});
$("busca").addEventListener("input",renderOrders);
$("btnNovoPedido").addEventListener("click",()=>openOrder());
$("btnNovoItem").addEventListener("click",()=>openStockItem());
$("btnNovaCompra").addEventListener("click",()=>openPurchase());
$("btnNovaSaida").addEventListener("click",()=>openExpense());
$("btnNovoModelo").addEventListener("click",()=>openModel());
$("btnBackup").addEventListener("click",backup);
$("btnImportBackup")?.addEventListener("click",()=>$("backupFile")?.click());
$("backupFile")?.addEventListener("change",e=>importBackupFile(e.target.files[0]));
$("btnCloseModal").addEventListener("click",closeModal);
$("btnCloseDetail").addEventListener("click",()=>$("detailModal").classList.remove("active"));
$("imgModal").addEventListener("click",()=>$("imgModal").classList.remove("active"));
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal();});

$("colorForm").addEventListener("submit",e=>{
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.currentTarget));
  db.colors.push({id:uid(),...f});
  e.currentTarget.reset();
  save();
});

$("finPeriod").addEventListener("change",renderFinance);
$("openingBalance").addEventListener("change",e=>{db.settings.openingBalance=Number(e.target.value||0);save();});
$("reinvestPct").addEventListener("change",e=>{db.settings.reinvestPct=Math.max(0,Math.min(100,Number(e.target.value||0)));save();});
$("dailyReserve").addEventListener("change",e=>{db.settings.dailyReserve=Number(e.target.value||0);save();});

document.addEventListener("click",e=>{
  const img = e.target.closest("[data-image]");
  if(img){openImage(img.dataset.image);return;}

  const card = e.target.closest("#form .modelcard");
  if(card){
    const radio = card.querySelector('input[name="modelId"]');
    if(radio){
      radio.checked=true;
      applyOrderModel(radio.value,[],false);updateOrderTotal();
    }
    return;
  }

  const btn = e.target.closest("[data-action]");
  if(!btn) return;
  const id = btn.dataset.id;
  switch(btn.dataset.action){
    case "close-modal": closeModal(); break;
    case "details-order": showOrderDetails(id); break;
    case "edit-order": $("detailModal").classList.remove("active"); openOrder(db.orders.find(x=>x.id===id)); break;
    case "finish-order": finishOrder(id); break;
    case "reopen-order": reopenOrder(id); break;
    case "delete-order": deleteOrder(id); break;
    case "print-order": printOrder(id); break;
    case "toggle-paid": togglePaid(id); break;
    case "set-deadline": {const d=new Date();d.setDate(d.getDate()+Number(btn.dataset.days));const el=document.querySelector('#form [name="deadline"]');if(el)el.value=localISO(d);break;}
    case "qty-step": {const el=document.querySelector('#form [name="qty"]');if(el){el.value=Math.max(1,Number(el.value||1)+Number(btn.dataset.step));updateOrderTotal();}break;}
    case "edit-stock": openStockItem(getItem(id)); break;
    case "delete-stock": deleteStockItem(id); break;
    case "edit-purchase": openPurchase(db.purchases.find(x=>x.id===id)); break;
    case "finish-purchase": finishPurchase(id); break;
    case "delete-purchase": deletePurchase(id); break;
    case "edit-expense": openExpense(db.expenses.find(x=>x.id===id)); break;
    case "finish-expense": finishExpense(id); break;
    case "delete-expense": deleteExpense(id); break;
    case "edit-model": openModel(getModel(id)); break;
    case "edit-recipe": openRecipe(getModel(id)); break;
    case "delete-model": deleteModel(id); break;
    case "edit-color": editColor(id); break;
    case "delete-color": deleteColor(id); break;
  }
});

document.addEventListener("change",e=>{
  const el = e.target.closest('[data-action="change-order"]');
  if(el) updateOrder(el.dataset.id,el.dataset.key,el.value);
});

save();
{const lb=db.settings.lastBackup;if(db.orders.length&&(!lb||(Date.now()-parseDate(lb))/864e5>7))setTimeout(()=>toast("Faça um backup: seus dados ficam só neste navegador."),1500);}
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();$("detailModal").classList.remove("active");$("imgModal").classList.remove("active");return}if(e.target.closest("input,select,textarea")||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==="/"){e.preventDefault();$("busca").focus()}else if(e.key.toLowerCase()==="n"&&!document.querySelector(".modal.active")&&$("producao").classList.contains("active")){e.preventDefault();openOrder()}});
})();
