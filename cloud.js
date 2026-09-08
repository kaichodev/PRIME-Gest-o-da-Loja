
(() => {
"use strict";

const DATA_KEY = "prime_gestao_v8";
const URL_KEY = "prime_cloud_webapp_url";
const PIN_KEY = "prime_cloud_pin";
const LAST_REMOTE_KEY = "prime_cloud_last_remote_update";

const cfg = window.PRIME_CLOUD_CONFIG || {};
let webAppUrl = localStorage.getItem(URL_KEY) || cfg.webAppUrl || "";
let pin = sessionStorage.getItem(PIN_KEY) || "";
let lastLocal = localStorage.getItem(DATA_KEY) || "";
let syncing = false;
let initialized = false;

const statusEl = document.getElementById("cloudStatus");
const btnCloud = document.getElementById("btnCloud");
const btnEmail = document.getElementById("btnEmailBackup");

function setStatus(text,type=""){
  if(!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = "cloud-status" + (type ? " "+type : "");
}

function normalizeUrl(url){
  return String(url||"").trim();
}

async function api(action, extra={}){
  if(!webAppUrl) throw new Error("URL da nuvem não configurada");
  if(!pin) throw new Error("PIN da nuvem não informado");

  const body = JSON.stringify({action,pin,...extra});
  const res = await fetch(webAppUrl,{
    method:"POST",
    redirect:"follow",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error("Resposta inválida do Google Apps Script"); }

  if(!data.ok) throw new Error(data.error || "Erro na nuvem");
  return data;
}

function askConfig(){
  const current = webAppUrl && !webAppUrl.includes("COLE") ? webAppUrl : "";
  const url = prompt("Cole a URL do Google Apps Script publicada como Aplicativo da Web (/exec):", current);
  if(url===null) return false;
  const clean = normalizeUrl(url);
  if(!clean){
    localStorage.removeItem(URL_KEY);
    webAppUrl="";
    setStatus("☁️ Nuvem: não configurada");
    return false;
  }

  const newPin = prompt("Digite o PIN da PRIME para acessar os dados na nuvem:", pin || "");
  if(newPin===null || !newPin.trim()) return false;

  webAppUrl = clean;
  pin = newPin.trim();
  localStorage.setItem(URL_KEY,webAppUrl);
  sessionStorage.setItem(PIN_KEY,pin);
  setStatus("☁️ Nuvem: conectando...","sync");
  return true;
}

async function initialSync(){
  if(!webAppUrl){
    setStatus("☁️ Nuvem: não configurada");
    return;
  }
  if(!pin){
    const p = prompt("Digite o PIN da PRIME para conectar à nuvem:");
    if(!p) { setStatus("☁️ Nuvem: PIN necessário","err"); return; }
    pin=p.trim();
    sessionStorage.setItem(PIN_KEY,pin);
  }

  syncing=true;
  setStatus("☁️ Nuvem: sincronizando...","sync");
  try{
    const remote = await api("load");
    const local = localStorage.getItem(DATA_KEY) || "";

    if(remote.data){
      const remoteJson = typeof remote.data==="string" ? remote.data : JSON.stringify(remote.data);
      if(remoteJson !== local){
        localStorage.setItem(DATA_KEY,remoteJson);
        localStorage.setItem(LAST_REMOTE_KEY,remote.updatedAt || "");
        setStatus("☁️ Nuvem: dados recebidos","ok");
        setTimeout(()=>location.reload(),250);
        return;
      }
    }else if(local){
      await api("save",{data:local});
    }

    lastLocal = localStorage.getItem(DATA_KEY) || "";
    localStorage.setItem(LAST_REMOTE_KEY,remote.updatedAt || "");
    initialized=true;
    setStatus("☁️ Nuvem: conectado","ok");
  }catch(err){
    setStatus("☁️ Nuvem: erro","err");
    console.error(err);
    alert("Não foi possível conectar à nuvem: "+err.message);
  }finally{
    syncing=false;
  }
}

async function pushIfChanged(){
  if(!initialized || syncing || !webAppUrl || !pin) return;
  const current = localStorage.getItem(DATA_KEY) || "";
  if(!current || current===lastLocal) return;

  syncing=true;
  setStatus("☁️ Salvando...","sync");
  try{
    const result = await api("save",{data:current});
    lastLocal=current;
    if(result.updatedAt) localStorage.setItem(LAST_REMOTE_KEY,result.updatedAt);
    setStatus("☁️ Nuvem: salvo","ok");
  }catch(err){
    setStatus("☁️ Falha ao salvar","err");
    console.error(err);
  }finally{
    syncing=false;
  }
}

async function pullIfNewer(){
  if(!initialized || syncing || !webAppUrl || !pin) return;
  try{
    const remote=await api("meta");
    const last=localStorage.getItem(LAST_REMOTE_KEY)||"";
    if(remote.updatedAt && remote.updatedAt!==last){
      syncing=true;
      setStatus("☁️ Atualizando dados...","sync");
      const data=await api("load");
      if(data.data){
        const remoteJson=typeof data.data==="string"?data.data:JSON.stringify(data.data);
        const local=localStorage.getItem(DATA_KEY)||"";
        if(remoteJson!==local){
          localStorage.setItem(DATA_KEY,remoteJson);
          localStorage.setItem(LAST_REMOTE_KEY,data.updatedAt||"");
          setTimeout(()=>location.reload(),250);
          return;
        }
      }
      localStorage.setItem(LAST_REMOTE_KEY,data.updatedAt||"");
    }
  }catch(err){
    console.warn("Falha ao consultar nuvem",err);
  }finally{
    syncing=false;
  }
}

btnCloud?.addEventListener("click",async()=>{
  if(askConfig()){
    initialized=false;
    await initialSync();
  }
});

btnEmail?.addEventListener("click",async()=>{
  if(!webAppUrl || !pin){
    if(!askConfig()) return;
  }
  try{
    setStatus("☁️ Enviando backup...","sync");
    await pushIfChanged();
    const r=await api("emailBackup");
    setStatus("☁️ Backup enviado","ok");
    alert("Backup enviado para "+(r.email || "o e-mail configurado da PRIME")+".");
  }catch(err){
    setStatus("☁️ Erro no backup","err");
    alert("Não foi possível enviar o backup: "+err.message);
  }
});

window.addEventListener("online",()=>{ if(webAppUrl) initialSync(); });

setInterval(pushIfChanged,1800);
setInterval(pullIfNewer,12000);

initialSync();
})();
