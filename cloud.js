/* PRIME Gestão 1.0 — camada de dados compartilhados. Não altera o layout nem as regras de negócio. */
(() => {
  'use strict';
  const URL = 'https://txcxzufxonzdsgnxfwvq.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_ZGBX7SJX8wSiGqwBghTM7w_kJ_MATE5';
  const DATA_ID = 'prime_shared_v1';
  let client, version = 0, ready = false, saving = false, pending = null, blocked = false, lastSynced = '';
  window.primeCloudReady = false;
  const $ = id => document.getElementById(id);
  function status(message) { const el = $('cloudStatus'); if(el) el.textContent = '☁️ ' + message; }
  function message(text) { $('primeLoginMessage').textContent = text; }
  function downloadEmergency(data) {
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = 'prime-alteracoes-nao-salvas-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),3000);
  }
  async function readRemote() {
    const {data,error} = await client.from('prime_data').select('dados,version').eq('id',DATA_ID).maybeSingle();
    if(error) throw error;
    return data;
  }
  function showLogin(text) {
    ready=false;window.primeCloudReady=false;$('primeLogin').hidden=false;
    message(text||'');status('Aguardando login');
  }
  async function loadRemote() {
    status('Carregando banco...');
    const row=await readRemote();
    version=Number(row?.version||0);
    if(row?.dados && Object.keys(row.dados).length) {
      const value=row.dados;
      if(!Array.isArray(value.orders)||!Array.isArray(value.items)||!Array.isArray(value.models)) throw Error('Dados remotos em formato inesperado.');
      // A aplicação principal mantém o estado em variável privada. Sincronizamos via evento.
      window.dispatchEvent(new CustomEvent('prime:cloud-load',{detail:value}));
    }
    ready=true;window.primeCloudReady=true;blocked=false;lastSynced=JSON.stringify(row?.dados||{});
    $('primeLogin').hidden=true;status('Online • dados compartilhados');
  }
  async function flush() {
    if(saving||blocked||!ready||!pending)return;
    saving=true;
    let activeSnapshot=null;
    try {
      while(pending && !blocked) {
        const snapshot=pending;activeSnapshot=snapshot;pending=null;
        const {data,error}=await client.rpc('prime_save_snapshot',{p_id:DATA_ID,p_expected_version:version,p_dados:snapshot});
        if(error) throw error;
        if(Number(data)<0){
          blocked=true;pending=snapshot;
          downloadEmergency(snapshot);
          status('Conflito • backup baixado');
          alert('Outro funcionário atualizou o banco antes de você. Suas alterações foram baixadas em JSON para não perdê-las. Atualize a página para carregar os dados atuais e revise antes de importar.');
          break;
        }
        version=Number(data);lastSynced=JSON.stringify(snapshot);status('Online • salvo');
      }
    } catch(err) {
      blocked=true;
      if(!pending) pending=activeSnapshot;
      if(pending) downloadEmergency(pending);
      status('Falha ao salvar • atenção');
      alert('Não foi possível confirmar o salvamento na nuvem: '+err.message+'\nNão feche a página antes de exportar um backup.');
    } finally {saving=false;}
  }
  window.primeCloudQueueSave = snapshot => {
    if(!ready||blocked) {alert('Banco não está pronto ou há um conflito. Nenhuma alteração foi enviada.');return;}
    pending=snapshot;status('Salvando...');void flush();
  };
  async function refresh() {
    if(!ready||saving||pending||blocked)return;
    try {
      const row=await readRemote();
      if(Number(row?.version||0)!==version) {
        version=Number(row.version);lastSynced=JSON.stringify(row.dados);
        window.dispatchEvent(new CustomEvent('prime:cloud-load',{detail:row.dados}));
        status('Online • atualizado');
      }
    } catch(e) {status('Sem conexão • tente novamente');}
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    const form=$('primeLoginForm');
    if(!window.supabase?.createClient){showLogin('Biblioteca Supabase não carregou. Verifique a internet.');return;}
    client=window.supabase.createClient(URL,PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
    form.addEventListener('submit',async e=>{
      e.preventDefault();message('Entrando...');
      const {error}=await client.auth.signInWithPassword({email:$('primeEmail').value.trim(),password:$('primePassword').value});
      $('primePassword').value='';
      if(error){message('Falha no login: '+error.message);return;}
      try{await loadRemote()}catch(err){showLogin('Falha ao carregar banco: '+err.message)}
    });
    const {data:{session}}=await client.auth.getSession();
    if(session){try{await loadRemote()}catch(err){showLogin('Falha ao carregar banco: '+err.message)}}else showLogin('');
    setInterval(refresh,6000);
    client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')showLogin('Sessão encerrada.');});
    const tools=document.createElement('div');tools.className='prime-cloud-tools';tools.innerHTML='<button type="button" id="primeSync">Atualizar nuvem</button><button type="button" id="primeLogout">Sair</button>';
    $('cloudStatus')?.after(tools);
    $('primeSync').onclick=refresh;
    $('primeLogout').onclick=async()=>{if(pending||saving){alert('Aguarde o salvamento antes de sair.');return;}await client.auth.signOut()};
  });
})();
