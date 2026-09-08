/**
 * PRIME Gestão V9 - Backend Google Apps Script
 *
 * Salva o banco JSON no Google Drive da conta PRIME e permite
 * enviar backups por e-mail.
 *
 * CONFIGURAÇÃO:
 * 1. Crie uma pasta no Google Drive para os dados da PRIME.
 * 2. No Apps Script, abra Configurações do projeto > Propriedades do script.
 * 3. Crie:
 *    DATA_FOLDER_ID = ID da pasta do Drive
 *    PRIME_EMAIL = e-mail que receberá os backups
 *    APP_PIN = PIN que a equipe usará para entrar
 * 4. Execute createDailyBackupTrigger() uma vez para autorizar e criar
 *    o backup automático diário.
 * 5. Implante > Nova implantação > Aplicativo da Web:
 *    Executar como: Eu
 *    Quem tem acesso: Qualquer pessoa
 * 6. Copie a URL /exec para cloud-config.js ou configure pelo botão do sistema.
 */

const DATA_FILE_NAME = "prime-dados.json";
const META_FILE_NAME = "prime-meta.json";

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function props_() {
  return PropertiesService.getScriptProperties();
}

function config_() {
  const p = props_();
  return {
    folderId: p.getProperty("DATA_FOLDER_ID"),
    email: p.getProperty("PRIME_EMAIL"),
    pin: p.getProperty("APP_PIN")
  };
}

function requireConfig_() {
  const c = config_();
  if (!c.folderId) throw new Error("DATA_FOLDER_ID não configurado.");
  if (!c.email) throw new Error("PRIME_EMAIL não configurado.");
  if (!c.pin) throw new Error("APP_PIN não configurado.");
  return c;
}

function checkPin_(pin) {
  const c = requireConfig_();
  if (String(pin || "") !== String(c.pin)) {
    throw new Error("PIN inválido.");
  }
  return c;
}

function folder_() {
  const c = requireConfig_();
  return DriveApp.getFolderById(c.folderId);
}

function getOrCreateFile_(name, initialContent) {
  const folder = folder_();
  const files = folder.getFilesByName(name);
  if (files.hasNext()) return files.next();
  return folder.createFile(name, initialContent || "", MimeType.PLAIN_TEXT);
}

function readData_() {
  const file = getOrCreateFile_(DATA_FILE_NAME, "");
  const text = file.getBlob().getDataAsString("UTF-8");
  return text || "";
}

function readMeta_() {
  const file = getOrCreateFile_(META_FILE_NAME, JSON.stringify({updatedAt:""}));
  try {
    return JSON.parse(file.getBlob().getDataAsString("UTF-8") || "{}");
  } catch (e) {
    return {updatedAt:""};
  }
}

function writeData_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const file = getOrCreateFile_(DATA_FILE_NAME, "");
    file.setContent(String(data || ""));

    const meta = {
      updatedAt: new Date().toISOString(),
      size: String(data || "").length
    };
    getOrCreateFile_(META_FILE_NAME, "{}").setContent(JSON.stringify(meta));
    return meta;
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ok:true, service:"PRIME Gestão V9", time:new Date().toISOString()});
}

function doPost(e) {
  try {
    const req = JSON.parse((e.postData && e.postData.contents) || "{}");
    const c = checkPin_(req.pin);
    const action = req.action || "";

    if (action === "load") {
      const meta = readMeta_();
      return json_({ok:true, data:readData_(), updatedAt:meta.updatedAt || ""});
    }

    if (action === "meta") {
      const meta = readMeta_();
      return json_({ok:true, updatedAt:meta.updatedAt || "", size:meta.size || 0});
    }

    if (action === "save") {
      if (typeof req.data !== "string") throw new Error("Dados inválidos.");
      const meta = writeData_(req.data);
      return json_({ok:true, updatedAt:meta.updatedAt});
    }

    if (action === "emailBackup") {
      sendBackupEmail_(c.email);
      return json_({ok:true, email:c.email});
    }

    throw new Error("Ação desconhecida.");
  } catch (err) {
    return json_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}

function sendBackupEmail_(email) {
  const data = readData_();
  if (!data) throw new Error("Ainda não existem dados para backup.");

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm");
  const blob = Utilities.newBlob(data, "application/json", "prime-backup-"+stamp+".json");

  MailApp.sendEmail({
    to: email,
    subject: "Backup PRIME Gestão - " + stamp,
    body: "Backup automático dos dados do sistema PRIME Gestão.\n\nO arquivo JSON está anexado a este e-mail.",
    attachments: [blob]
  });
}

/**
 * Execute uma vez manualmente no editor do Apps Script.
 * Cria um backup diário aproximadamente às 23h.
 */
function createDailyBackupTrigger() {
  requireConfig_();

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "dailyBackup")
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("dailyBackup")
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .create();
}

function dailyBackup() {
  const c = requireConfig_();
  sendBackupEmail_(c.email);
}

/**
 * Teste manual opcional após configurar as propriedades.
 */
function testConfiguration() {
  const c = requireConfig_();
  Logger.log("Pasta: " + DriveApp.getFolderById(c.folderId).getName());
  Logger.log("E-mail: " + c.email);
  Logger.log("Configuração OK.");
}
