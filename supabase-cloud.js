(() => {
"use strict";
const DATA_KEY="prime_gestao_v8";
const cfg=window.PRIME_SUPABASE_CONFIG||{};
const gate=document.getElementById("cloudGate"), gateText=document.getElementById("cloudGateText"), gateActions=document.getElementById("cloudGateActions"), statusEl=document.getElementById("cloudStatus"), btnSync=document.getElementById("btnSyncNow"), btnEmail=document.getElementById("btnEmailBackup");
let client=null, user=null, initialized=false, syncing=false, lastRemoteStamp="", saveTimer=null;
const setStatus=(t,c="")=>{if(statusEl){statusEl.textContent=t;statusEl.className="cloud-status"+(c?" "+c:"")}};
const openApp=()=>gate?.classList.remove("active");
const gateMsg=(html,actions="")=>{if(gateText)gateText.innerHTML=html;if(gateActions)gateActions.innerHTML=actions;gate?.classList.add("active")};
function loginForm(message="Entre com o usuário que você criou no Supabase."){
  gateMsg(`<b>PRIME — Acesso ao sistema</b><br><br>${message}`,`<form id="primeLoginForm" style="display:grid;gap:10px;margin-top:14px"><input id="primeEmail" type="email" placeholder="E-mail" required style="padding:12px;border-radius:10px;border:1px solid #ccc"><input id="primePassword" type="password" placeholder="Senha" required style="padding:12px;border-radius:10px;border:1px solid #ccc"><button class="primary" type="submit">Entrar</button></form>`);
  document.getElementById("primeLoginForm")?.addEventListener("submit",async e=>{e.preventDefault();const email=document.getElementById("primeEmail").value.trim(),password=document.getElementById("primePassword").value;setStatus("☁️ Entrando...","sync");const {data,error}=await client.auth.signInWithPassword({email,password});if(error){loginForm("Não foi possível entrar: "+error.message);setStatus("☁️ Login necessário","err");return}user=data.user;await initialSync();});
}
async function loadRemote(){const {data,error}=await client.from("prime_app_state").select("dados,atualizado_em").eq("id",1).single();if(error)throw error;return data;}
async function saveRemote(raw){let parsed;try{parsed=JSON.parse(raw)}catch{return}const {data,error}=await client.from("prime_app_state").upsert({id:1,dados:parsed,atualizado_em:new Date().toISOString(),atualizado_por:user.id},{onConflict:"id"}).select("atualizado_em").single();if(error)throw error;lastRemoteStamp=data?.atualizado_em||"";}
async function initialSync(){
  if(!user){loginForm();return}
  setStatus("☁️ Carregando dados...","sync");gateMsg("Carregando o banco compartilhado da PRIME...");syncing=true;
  try{const remote=await loadRemote(), remoteData=remote?.dados||{}, remoteHasData=remoteData&&Object.keys(remoteData).length>0, local=localStorage.getItem(DATA_KEY)||"";lastRemoteStamp=remote?.atualizado_em||"";
    if(remoteHasData){const r=JSON.stringify(remoteData);if(r!==local){localStorage.setItem(DATA_KEY,r);setStatus("☁️ Dados recebidos","ok");setTimeout(()=>location.reload(),120);return}}
    else if(local){await saveRemote(local)}
    initialized=true;setStatus("☁️ Supabase • sincronizado","ok");openApp();
  }catch(err){console.error(err);setStatus("☁️ Erro no banco","err");gateMsg(`<b>Não foi possível acessar o banco.</b><br><br>${err.message}<br><br>Confirme se você executou o arquivo <code>supabase-setup.sql</code> no SQL Editor.`)}finally{syncing=false}
}
async function pushNow(){if(!initialized||syncing||!user)return;const raw=localStorage.getItem(DATA_KEY)||"";if(!raw)return;syncing=true;setStatus("☁️ Salvando...","sync");try{await saveRemote(raw);setStatus("☁️ Salvo no Supabase","ok")}catch(err){console.error(err);setStatus("☁️ Falha ao salvar","err");alert("A alteração ficou neste navegador, mas não foi enviada ao Supabase. "+err.message)}finally{syncing=false}}
async function pullNow(force=false){if(!initialized||syncing||!user)return;syncing=true;if(force)setStatus("☁️ Sincronizando...","sync");try{const remote=await loadRemote();if(remote?.atualizado_em&&remote.atualizado_em!==lastRemoteStamp){lastRemoteStamp=remote.atualizado_em;const r=JSON.stringify(remote.dados||{}),local=localStorage.getItem(DATA_KEY)||"";if(r!==local){localStorage.setItem(DATA_KEY,r);setStatus("☁️ Atualização recebida","ok");setTimeout(()=>location.reload(),120);return}}if(force)setStatus("☁️ Já está atualizado","ok")}catch(err){console.warn(err);if(force)setStatus("☁️ Erro ao sincronizar","err")}finally{syncing=false}}
window.addEventListener("prime:data-changed",()=>{clearTimeout(saveTimer);saveTimer=setTimeout(pushNow,250)});
btnSync?.addEventListener("click",()=>pullNow(true));
if(btnEmail){btnEmail.textContent="Sair da conta";btnEmail.addEventListener("click",async()=>{await client.auth.signOut();location.reload()})}
async function boot(){if(!window.supabase?.createClient){gateMsg("Não foi possível carregar a biblioteca do Supabase. Verifique a internet.");return}client=window.supabase.createClient(cfg.url,cfg.publishableKey);const {data}=await client.auth.getSession();user=data.session?.user||null;if(!user){loginForm();setStatus("☁️ Login necessário","err");return}await initialSync();client.channel("prime-state-live").on("postgres_changes",{event:"UPDATE",schema:"public",table:"prime_app_state",filter:"id=eq.1"},payload=>{if(payload.new?.atualizado_por!==user?.id)pullNow(false)}).subscribe();setInterval(()=>pullNow(false),10000)}
boot();
})();
