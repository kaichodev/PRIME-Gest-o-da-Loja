
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
  }catch(err){
    alert("O navegador ficou sem espaço. Reduza o tamanho das imagens/comprovantes e exporte um backup.");
  }
  render();
}

function imageToData(file){
  return new Promise((resolve)=>{
    if(!file) return resolve("");
    if(file.size > 1500000){
      alert("Use imagens de até 1,5 MB.");
      return resolve("");
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => resolve("");
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
  const diff = Math.round((parseDate(date)-parseDate(today()))/86400000);
  return diff < 0 ? "late" : diff === 0 ? "today" : diff <= 2 ? "soon" : "ok";
}
function deadlineText(date){
  const diff = Math.round((parseDate(date)-parseDate(today()))/86400000);
  if(diff < 0) return `${-diff}d atrasado`;
  if(diff === 0) return "Hoje";
  if(diff === 1) return "Amanhã";
  return `${diff} dias`;
}

function activateTab(tabId){
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active", x.dataset.tab===tabId));
  document.querySelectorAll(".screen").forEach(x=>x.classList.toggle("active", x.id===tabId));
}

/* PEDIDOS */
function openOrder(order=null){
  if(!db.models.length){
    alert("Cadastre pelo menos um modelo antes de criar um pedido.");
    activateTab("modelos");
    return;
  }

  const due = new Date();
  due.setDate(due.getDate()+3);
  const selectedModel = order?.modelId && getModel(order.modelId) ? order.modelId : db.models[0].id;

  showModal(order ? "Editar pedido" : "Novo pedido", `
    <div class="formgrid">
      <input type="hidden" name="editId" value="${esc(order?.id || "")}">
      <div class="field"><label>Pedido</label><input name="number" value="${esc(order?.number || "#"+String(db.orders.length+1).padStart(4,"0"))}" required></div>
      <div class="field"><label>Data</label><input name="date" type="date" value="${esc(order?.date || today())}" required></div>
      <div class="field"><label>Prazo</label><input name="deadline" type="date" value="${esc(order?.deadline || localISO(due))}" required></div>
      <div class="field"><label>Cliente</label><input name="client" value="${esc(order?.client || "")}" required></div>

      <div class="field"><label>Contato / WhatsApp</label><input name="phone" value="${esc(order?.phone || "")}" placeholder="Opcional"></div>
      <div class="field span2"><label>Endereço</label><input name="address" value="${esc(order?.address || "")}" placeholder="Opcional"></div>
      <div class="field"><label>Número</label><input name="addressNumber" value="${esc(order?.addressNumber || "")}" placeholder="Opcional"></div>
      <div class="field span2"><label>Complemento / referência</label><input name="addressExtra" value="${esc(order?.addressExtra || "")}" placeholder="Opcional"></div>
      <div class="field span2"><label>Necessidades complementares</label><input name="needs" value="${esc(order?.needs || "")}" placeholder="Embalagem, acabamento, urgência..."></div>

      <div class="field span4">
        <label>Modelo</label>
        <div class="modelgrid">
          ${db.models.map(m=>`
            <label class="modelcard ${m.id===selectedModel ? "selected":""}">
              <input type="radio" name="modelId" value="${esc(m.id)}" ${m.id===selectedModel ? "checked":""} hidden>
              ${m.photo ? `<img src="${esc(m.photo)}" alt="${esc(m.name)}">` : `<div class="noimg">Modelo</div>`}
              <b>${esc(m.name)}</b>
              <div>${money(m.price)}</div>
            </label>
          `).join("")}
        </div>
      </div>

      <div class="field span4"><div id="modelSpecs" class="panel"></div></div>
      <div class="field"><label>Quantidade</label><input name="qty" type="number" min="1" value="${Number(order?.qty || 1)}" required></div>
      <div class="field"><label>Valor unitário</label><input id="orderPrice" name="unitPrice" type="number" step=".01" min="0" value="${order?.unitPrice ?? ""}" required></div>
      <div class="field"><label>Desconto</label><input name="discount" type="number" step=".01" min="0" value="${Number(order?.discount || 0)}"></div>
      <div class="field"><label>Pagamento</label><select name="payment">
        ${["Pix","Dinheiro","Cartão","Pendente","Patrocínio"].map(x=>`<option ${x===(order?.payment || "Pix") ? "selected":""}>${x}</option>`).join("")}
      </select></div>

      <div class="field span2"><label>Cores disponíveis</label><div id="orderColors" class="colors"></div></div>
      <div class="field"><label>Produção</label><select name="status">
        ${["Recebido","Em produção","Pronto","Aguardando retirada","Finalizado"].map(x=>`<option ${x===(order?.status || "Recebido") ? "selected":""}>${x}</option>`).join("")}
      </select></div>
      <div class="field"><label>Entrega</label><select name="delivery">
        ${["N/ENTREGUE","ENTREGUE","Retirada","Entrega local"].map(x=>`<option ${x===(order?.delivery || "N/ENTREGUE") ? "selected":""}>${x}</option>`).join("")}
      </select></div>

      <div class="field span4"><label>Personalização / instruções de fabricação</label><textarea name="notes">${esc(order?.notes || "")}</textarea></div>
      ${actionFooter()}
    </div>
  `, saveOrderForm);

  requestAnimationFrame(()=>applyOrderModel(selectedModel, order?.colors || [], !!order));
}

function applyOrderModel(modelId, selectedColors=[], editing=false){
  const model = getModel(modelId);
  if(!model) return;

  document.querySelectorAll("#form .modelcard").forEach(card=>{
    const input = card.querySelector('input[name="modelId"]');
    card.classList.toggle("selected", input && input.value===modelId);
  });

  const price = $("orderPrice");
  if(price && (!editing || !price.value)) price.value = Number(model.price || 0);

  const allowed = (model.colors || []).filter(id=>db.colors.some(c=>c.id===id));
  $("modelSpecs").innerHTML = `
    <b>${esc(model.name)}</b> • Preço padrão <b>${money(model.price)}</b> • Custo estimado <b>${money(model.unitCost || 0)}</b><br>
    <span class="muted">${esc(model.specs || "Sem especificações adicionais.")}</span>
  `;

  $("orderColors").innerHTML = allowed.length
    ? allowed.map(id=>{
        const c = getColor(id);
        return `<label class="chip"><input type="checkbox" name="colors" value="${esc(c.id)}" ${selectedColors.includes(c.id)?"checked":""}><i class="dot" style="background:${esc(c.hex)}"></i>${esc(c.name)}</label>`;
      }).join("")
    : `<span class="muted">Nenhuma cor liberada neste modelo.</span>`;
}

function saveOrderForm(e){
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const f = Object.fromEntries(fd.entries());
  const data = {
    number:f.number,date:f.date,deadline:f.deadline,client:f.client,
    phone:f.phone,address:f.address,addressNumber:f.addressNumber,addressExtra:f.addressExtra,needs:f.needs,
    modelId:f.modelId,qty:Number(f.qty),unitPrice:Number(f.unitPrice),discount:Number(f.discount||0),
    total:Math.max(0,Number(f.qty)*Number(f.unitPrice)-Number(f.discount||0)),
    colors:fd.getAll("colors"),payment:f.payment,status:f.status,delivery:f.delivery,notes:f.notes
  };

  if(f.editId){
    const order = db.orders.find(x=>x.id===f.editId);
    if(!order) return;
    Object.assign(order,data);
    if(data.status==="Finalizado" && !order.completedAt) order.completedAt = new Date().toISOString();
    if(data.status!=="Finalizado") order.completedAt = null;
  }else{
    db.orders.push({id:uid(),...data,completedAt:data.status==="Finalizado" ? new Date().toISOString() : null});
  }
  closeModal();
  save();
}

function updateOrder(id,key,value){
  const o = db.orders.find(x=>x.id===id);
  if(!o) return;
  o[key] = value;
  save();
}
function finishOrder(id){
  const o = db.orders.find(x=>x.id===id);
  if(o && confirm("Finalizar este pedido e mover para Finalizados?")){
    o.status = "Finalizado";
    o.completedAt = new Date().toISOString();
    save();
  }
}
function reopenOrder(id){
  const o = db.orders.find(x=>x.id===id);
  if(o){
    o.status = "Em produção";
    o.completedAt = null;
    save();
  }
}
function deleteOrder(id){
  if(confirm("Apagar este pedido permanentemente?")){
    db.orders = db.orders.filter(x=>x.id!==id);
    save();
  }
}

function showOrderDetails(id){
  const o = db.orders.find(x=>x.id===id);
  if(!o) return;
  const m = getModel(o.modelId);
  $("detailContent").innerHTML = `
    <div class="detailgrid">
      <div class="detail"><small>Pedido</small><b>${esc(o.number)}</b></div>
      <div class="detail"><small>Cliente</small><b>${esc(o.client)}</b></div>
      <div class="detail"><small>Contato</small>${esc(o.phone || "-")}</div>
      <div class="detail"><small>Prazo</small>${fmt(o.deadline)}</div>
      <div class="detail"><small>Modelo</small>${esc(m?.name || "-")}</div>
      <div class="detail"><small>Quantidade</small>${Number(o.qty || 0)}</div>
      <div class="detail"><small>Cores</small>${colorHtml(o.colors)}</div>
      <div class="detail"><small>Pagamento</small>${esc(o.payment || "-")}</div>
      <div class="detail"><small>Total</small><b>${money(o.total)}</b></div>
      <div class="detail"><small>Endereço</small>${esc(`${o.address || "-"} ${o.addressNumber || ""}`)}</div>
      <div class="detail"><small>Complemento</small>${esc(o.addressExtra || "-")}</div>
      <div class="detail"><small>Entrega</small>${esc(o.delivery || "-")}</div>
    </div>
    <br>
    <div class="note"><b>Fabricação / personalização</b><br>${esc(o.notes || "-")}${o.needs ? `<br><br><b>Necessidades:</b> ${esc(o.needs)}`:""}</div>
    <br>
    <div class="actions">
      <button class="primary" data-action="print-order" data-id="${esc(o.id)}">🧾 Gerar nota / imprimir</button>
      <button class="secondary" data-action="edit-order" data-id="${esc(o.id)}">✎ Editar</button>
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

function renderOrders(){
  const q = ($("busca")?.value || "").toLowerCase();
  const active = db.orders
    .filter(o=>!o.completedAt)
    .filter(o=>[
      o.number,o.client,getModel(o.modelId)?.name,o.notes,
      ...(o.colors||[]).map(id=>getColor(id)?.name)
    ].join(" ").toLowerCase().includes(q))
    .sort((a,b)=>(a.deadline||"").localeCompare(b.deadline||""));

  $("ordersBody").innerHTML = active.length ? active.map(o=>`
    <tr>
      <td><b>${esc(o.number)}</b></td>
      <td><span class="pill ${deadlineClass(o.deadline)}">${fmt(o.deadline)} • ${deadlineText(o.deadline)}</span></td>
      <td><b>${esc(getModel(o.modelId)?.name || "-")}</b></td>
      <td>${Number(o.qty || 0)}</td>
      <td>${colorHtml(o.colors)}</td>
      <td>${esc(o.notes || o.needs || "-")}</td>
      <td>
        <select data-action="change-order" data-key="status" data-id="${esc(o.id)}">
          ${["Recebido","Em produção","Pronto","Aguardando retirada"].map(x=>`<option ${x===o.status?"selected":""}>${x}</option>`).join("")}
        </select>
      </td>
      <td>
        <select data-action="change-order" data-key="delivery" data-id="${esc(o.id)}">
          ${["N/ENTREGUE","ENTREGUE","Retirada","Entrega local"].map(x=>`<option ${x===o.delivery?"selected":""}>${x}</option>`).join("")}
        </select>
      </td>
      <td><div class="actions">
        <button class="secondary" data-action="details-order" data-id="${esc(o.id)}">Detalhes</button>
        <button class="secondary" data-action="edit-order" data-id="${esc(o.id)}">Editar</button>
        <button class="primary" data-action="finish-order" data-id="${esc(o.id)}">Finalizar</button>
        <button class="danger" data-action="delete-order" data-id="${esc(o.id)}">Apagar</button>
      </div></td>
    </tr>
  `).join("") : `<tr><td colspan="9" class="empty">Nenhum pedido em produção.</td></tr>`;

  const critical = active.filter(o=>parseDate(o.deadline)<=parseDate(today()));
  $("alerts").innerHTML = critical.length ? critical.map(o=>`
    <div class="alertrow">
      <b>${esc(o.number)} • ${esc(getModel(o.modelId)?.name || "")} • ${Number(o.qty || 0)} un.</b>
      <span class="pill ${deadlineClass(o.deadline)}">${deadlineText(o.deadline)}</span>
    </div>
  `).join("") : `<div class="muted">Nenhuma prioridade crítica.</div>`;
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
  showModal(stockItem ? "Editar item" : "Cadastrar item", `
    <div class="formgrid">
      <div class="field"><label>SKU</label><input name="sku" value="${esc(stockItem?.sku||"")}" required></div>
      <div class="field span2"><label>Nome</label><input name="name" value="${esc(stockItem?.name||"")}" required></div>
      <div class="field"><label>Categoria</label><input name="category" value="${esc(stockItem?.category||"")}"></div>
      <div class="field"><label>Unidade</label><select name="unit">${["un","kg","g","m","rolo","caixa"].map(x=>`<option ${x===(stockItem?.unit||"un")?"selected":""}>${x}</option>`).join("")}</select></div>
      <div class="field"><label>Estoque atual</label><input name="stock" type="number" step=".001" min="0" value="${Number(stockItem?.stock||0)}"></div>
      <div class="field"><label>Estoque mínimo</label><input name="min" type="number" step=".001" min="0" value="${Number(stockItem?.min||0)}"></div>
      <div class="field"><label>Custo unitário</label><input name="cost" type="number" step=".01" min="0" value="${Number(stockItem?.cost||0)}"></div>
      ${actionFooter()}
    </div>
  `, e=>{
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const data = {sku:f.sku,name:f.name,category:f.category,unit:f.unit,stock:Number(f.stock),min:Number(f.min),cost:Number(f.cost)};
    if(stockItem) Object.assign(stockItem,data); else db.items.push({id:uid(),...data});
    closeModal();save();
  });
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

    if(purchase){
      const oldItem = getItem(purchase.itemId);
      if(oldItem) oldItem.stock = Number(oldItem.stock||0) - Number(purchase.qty||0);
      if(newItem) newItem.stock = Number(newItem.stock||0) + q;
      Object.assign(purchase,{date:fd.get("date"),supplier:fd.get("supplier"),itemId:fd.get("itemId"),qty:q,cost:c,total:q*c,payment:fd.get("payment"),note:fd.get("note")});
      if(proof) purchase.proof = proof;
    }else{
      if(newItem) newItem.stock = Number(newItem.stock||0) + q;
      db.purchases.push({id:uid(),date:fd.get("date"),supplier:fd.get("supplier"),itemId:fd.get("itemId"),qty:q,cost:c,total:q*c,payment:fd.get("payment"),note:fd.get("note"),proof,status:"Aberta"});
    }
    if(newItem) newItem.cost = c;
    closeModal();save();
  });
}

function deleteStockItem(id){
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
  if(p){p.status="Finalizada";save();}
}
function deletePurchase(id){
  const p = db.purchases.find(x=>x.id===id);
  if(!p) return;
  if(confirm("Apagar esta compra e retirar a quantidade recebida do estoque?")){
    const i = getItem(p.itemId);
    if(i) i.stock = Math.max(0, Number(i.stock||0)-Number(p.qty||0));
    db.purchases = db.purchases.filter(x=>x.id!==id);
    save();
  }
}

function renderStock(){
  $("stockBody").innerHTML = db.items.length ? db.items.map(i=>`
    <tr><td>${esc(i.sku)}</td><td><b>${esc(i.name)}</b></td><td>${esc(i.category||"-")}</td><td>${esc(i.unit)}</td>
    <td class="${Number(i.stock)<=Number(i.min)?"stocklow":""}">${Number(i.stock||0)}</td><td>${Number(i.min||0)}</td><td>${money(i.cost)}</td><td>${money(Number(i.stock||0)*Number(i.cost||0))}</td>
    <td><div class="actions"><button class="secondary" data-action="edit-stock" data-id="${esc(i.id)}">Editar</button><button class="danger" data-action="delete-stock" data-id="${esc(i.id)}">Apagar</button></div></td></tr>
  `).join("") : `<tr><td colspan="9" class="empty">Nenhum item.</td></tr>`;

  const purchases = db.purchases.slice().reverse();
  $("purchaseBody").innerHTML = purchases.length ? purchases.map(p=>`
    <tr><td>${fmt(p.date)}</td><td>${esc(p.supplier)}</td><td>${esc(getItem(p.itemId)?.name||"-")}</td><td>${Number(p.qty||0)}</td><td>${money(p.cost)}</td><td><b>${money(p.total)}</b></td>
    <td>${esc(p.payment||"-")}</td><td>${receiptHtml(p.proof)}</td><td><span class="pill ${p.status==="Finalizada"?"ok":"today"}">${esc(p.status||"Aberta")}</span></td>
    <td><div class="actions"><button class="secondary" data-action="edit-purchase" data-id="${esc(p.id)}">Editar</button>${p.status!=="Finalizada"?`<button class="primary" data-action="finish-purchase" data-id="${esc(p.id)}">Finalizar</button>`:""}<button class="danger" data-action="delete-purchase" data-id="${esc(p.id)}">Apagar</button></div></td></tr>
  `).join("") : `<tr><td colspan="10" class="empty">Nenhuma compra.</td></tr>`;
}

/* GASTOS */
function openExpense(expense=null){
  showModal(expense ? "Editar saída" : "Registrar saída", `
    <div class="formgrid">
      <div class="field"><label>Data</label><input name="date" type="date" value="${esc(expense?.date||today())}" required></div>
      <div class="field"><label>Categoria</label><select name="category">${["Material / Insumo","Frete","Energia","Embalagem","Manutenção","Equipamento","Publicidade","Pró-labore / retirada","Outro"].map(v=>`<option ${v===(expense?.category||"Material / Insumo")?"selected":""}>${v}</option>`).join("")}</select></div>
      <div class="field span2"><label>Descrição</label><input name="description" value="${esc(expense?.description||"")}" required></div>
      <div class="field"><label>Valor</label><input name="value" type="number" step=".01" min="0" value="${expense?.value??""}" required></div>
      <div class="field"><label>Pagamento</label><select name="payment">${["Pix","Dinheiro","Cartão","Boleto"].map(v=>`<option ${v===(expense?.payment||"Pix")?"selected":""}>${v}</option>`).join("")}</select></div>
      <div class="field span2"><label>Comprovante</label><input name="proof" type="file" accept="image/*"></div>
      ${actionFooter()}
    </div>
  `, async e=>{
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const proof = await imageToData(e.currentTarget.elements.proof.files[0]);
    const data = {date:fd.get("date"),category:fd.get("category"),description:fd.get("description"),value:Number(fd.get("value")),payment:fd.get("payment")};
    if(expense){Object.assign(expense,data);if(proof)expense.proof=proof;}
    else db.expenses.push({id:uid(),...data,proof,status:"Aberto"});
    closeModal();save();
  });
}
function finishExpense(id){const x=db.expenses.find(v=>v.id===id);if(x){x.status="Finalizado";save();}}
function deleteExpense(id){if(confirm("Apagar esta saída?")){db.expenses=db.expenses.filter(x=>x.id!==id);save();}}
function renderExpenses(){
  const expenses = db.expenses.slice().reverse();
  $("expenseBody").innerHTML = expenses.length ? expenses.map(x=>`
    <tr><td>${fmt(x.date)}</td><td>${esc(x.category)}</td><td>${esc(x.description)}</td><td><b>${money(x.value)}</b></td><td>${esc(x.payment||"-")}</td><td>${receiptHtml(x.proof)}</td>
    <td><span class="pill ${x.status==="Finalizado"?"ok":"today"}">${esc(x.status||"Aberto")}</span></td>
    <td><div class="actions"><button class="secondary" data-action="edit-expense" data-id="${esc(x.id)}">Editar</button>${x.status!=="Finalizado"?`<button class="primary" data-action="finish-expense" data-id="${esc(x.id)}">Finalizar</button>`:""}<button class="danger" data-action="delete-expense" data-id="${esc(x.id)}">Apagar</button></div></td></tr>
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
    else db.models.push({id:uid(),...data,photo});
    closeModal();save();
  });
}
function deleteModel(id){
  if(db.orders.some(o=>o.modelId===id)){alert("Este modelo está vinculado a pedidos.");return;}
  if(confirm("Apagar este modelo?")){db.models=db.models.filter(x=>x.id!==id);save();}
}
function renderModels(){
  $("modelsCards").innerHTML = db.models.length ? db.models.map(m=>`
    <article class="modelcard">
      ${m.photo?`<img src="${esc(m.photo)}" alt="${esc(m.name)}" data-image="${esc(m.photo)}">`:`<div class="noimg">Modelo</div>`}
      <h3>${esc(m.name)}</h3><b>${money(m.price)}</b>
      <div class="muted">Custo estimado: ${money(m.unitCost||0)} • Margem unitária: ${money(Number(m.price||0)-Number(m.unitCost||0))}</div>
      <div class="muted">${esc(m.specs||"")}</div>
      <div class="colors" style="margin-top:8px">${colorHtml(m.colors)}</div>
      <div class="actions" style="margin-top:10px"><button class="secondary" data-action="edit-model" data-id="${esc(m.id)}">Editar</button><button class="danger" data-action="delete-model" data-id="${esc(m.id)}">Apagar</button></div>
    </article>
  `).join("") : `<div class="empty">Nenhum modelo cadastrado.</div>`;
}

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

function renderFinance(){
  const p = $("finPeriod").value;
  const sales = filterPeriod(p,db.orders.filter(o=>o.completedAt),"completedAt");
  const expenses = filterPeriod(p,db.expenses,"date");
  const purchases = filterPeriod(p,db.purchases,"date");

  const revenue = sales.reduce((s,o)=>s+Number(o.total||0),0);
  const direct = sales.reduce((s,o)=>s+Number(getModel(o.modelId)?.unitCost||0)*Number(o.qty||0),0);
  const gross = revenue-direct;
  const expenseTotal = expenses.reduce((s,x)=>s+Number(x.value||0),0);
  const purchaseOut = purchases.reduce((s,x)=>s+Number(x.total||0),0);
  const net = gross-expenseTotal;

  const opening = Number(db.settings.openingBalance||0);
  const cash = opening+revenue-expenseTotal-purchaseOut;
  const reinvestPct = db.settings.reinvestPct ?? 30;
  const reinvest = Math.max(0,net*reinvestPct/100);
  const dailyReserve = Number(db.settings.dailyReserve||0);
  const days = p==="today"?1:p==="7"?7:p==="15"?15:p==="month"?new Date().getDate():1;
  const reserve = dailyReserve*days;
  const available = net-reinvest-reserve;

  $("openingBalance").value = opening;
  $("reinvestPct").value = reinvestPct;
  $("dailyReserve").value = dailyReserve;

  $("finRevenue").textContent=money(revenue);
  $("finDirect").textContent=money(direct);
  $("finGross").textContent=money(gross);
  $("finExpenses").textContent=money(expenseTotal);
  $("finNet").textContent=money(net);
  $("finCash").textContent=money(cash);
  $("finReinvest").textContent=money(reinvest);
  $("finAvailable").textContent=money(available);

  $("finNet").className = net>=0 ? "positive" : "negative";
  $("finCash").className = cash>=0 ? "positive" : "negative";

  const margin = revenue ? gross/revenue*100 : 0;
  $("financeAdvice").innerHTML = `
    <b>Leitura do período:</b> margem bruta estimada de <b>${margin.toFixed(1)}%</b>.
    As compras de estoque consumiram <b>${money(purchaseOut)}</b> do caixa.
    ${net>0
      ? `Com a regra atual, separe <b>${money(reinvest)}</b> para reinvestimento e <b>${money(reserve)}</b> como reserva. Restariam <b>${money(available)}</b> antes de impostos e retiradas pessoais.`
      : `O período não apresenta lucro líquido positivo. Antes de retirar dinheiro, revise preços, custos diretos e despesas.`}
    <br><span class="muted">Para melhorar a precisão, inclua no custo unitário de cada modelo: filamento, argola/acessórios, embalagem, energia, perdas médias e outros custos diretamente ligados à fabricação.</span>
  `;

  $("profitBody").innerHTML = db.models.length ? db.models.map(m=>{
    const ms = sales.filter(o=>o.modelId===m.id);
    const qty = ms.reduce((s,o)=>s+Number(o.qty||0),0);
    const rev = ms.reduce((s,o)=>s+Number(o.total||0),0);
    const cost = qty*Number(m.unitCost||0);
    const gp = rev-cost;
    const mg = rev ? gp/rev*100 : 0;
    return `<tr><td><b>${esc(m.name)}</b></td><td>${qty}</td><td>${money(rev)}</td><td>${money(cost)}</td><td>${money(gp)}</td><td>${mg.toFixed(1)}%</td><td>${money(Math.max(0,gp*reinvestPct/100))}</td></tr>`;
  }).join("") : `<tr><td colspan="7" class="empty">Cadastre modelos e custos.</td></tr>`;
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
  a.download = "prime-backup-v8.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function render(){
  renderOrders();
  renderDone();
  renderStock();
  renderExpenses();
  renderModels();
  renderColors();
  renderFinance();
  renderKpis();
}

/* EVENTOS */
$("tabs").addEventListener("click",e=>{
  const btn = e.target.closest("[data-tab]");
  if(btn) activateTab(btn.dataset.tab);
});
$("busca").addEventListener("input",renderOrders);
$("btnNovoPedido").addEventListener("click",()=>openOrder());
$("btnNovoItem").addEventListener("click",()=>openStockItem());
$("btnNovaCompra").addEventListener("click",()=>openPurchase());
$("btnNovaSaida").addEventListener("click",()=>openExpense());
$("btnNovoModelo").addEventListener("click",()=>openModel());
$("btnBackup").addEventListener("click",backup);
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
      applyOrderModel(radio.value,[],false);
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
    case "edit-stock": openStockItem(getItem(id)); break;
    case "delete-stock": deleteStockItem(id); break;
    case "edit-purchase": openPurchase(db.purchases.find(x=>x.id===id)); break;
    case "finish-purchase": finishPurchase(id); break;
    case "delete-purchase": deletePurchase(id); break;
    case "edit-expense": openExpense(db.expenses.find(x=>x.id===id)); break;
    case "finish-expense": finishExpense(id); break;
    case "delete-expense": deleteExpense(id); break;
    case "edit-model": openModel(getModel(id)); break;
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
})();
