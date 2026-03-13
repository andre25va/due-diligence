// ROA KC Due Diligence - Google Apps Script Backend
// Paste this entire file into your Google Apps Script editor
// Deploy as Web App: Execute as Me, Anyone can access

const SPREADSHEET_ID = '10wQfPmnsdH5FwhUjH51eV72H5lgxhFYyqq4vyUmXf2I';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// All requests come through doGet (JSONP bypasses CORS)
function doGet(e) {
  const callback = e.parameter.callback;
  const action = e.parameter.action;
  let result;
  try {
    const ss = getSpreadsheet();
    if (action === 'getAgents')       result = getAgents(ss);
    else if (action === 'getChecklist')    result = getChecklist(ss);
    else if (action === 'getDeals')        result = getDeals(ss, e.parameter.legalName);
    else if (action === 'getProgress')     result = getProgress(ss, e.parameter.dealId);
    else if (action === 'createDeal')      result = createDeal(ss, e.parameter);
    else if (action === 'updateProgress')  result = updateProgress(ss, e.parameter);
    else if (action === 'updateDealStatus') result = updateDealStatus(ss, e.parameter);
    else if (action === 'addAgent')        result = addAgent(ss, e.parameter);
    else result = { error: 'Unknown action: ' + action };
  } catch(err) {
    result = { error: err.toString() };
  }

  const json = JSON.stringify(result);
  const output = callback
    ? ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  return output;
}

// Returns all active agents
function getAgents(ss) {
  const sheet = ss.getSheetByName('Agents');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  return rows
    .filter(r => r[0])
    .map(r => ({
      displayName: r[0],
      email: r[1],
      active: r[2],
      legalName: r[3] || r[0]
    }));
}

function getChecklist(ss) {
  const sheet = ss.getSheetByName('Checklist');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  return rows
    .filter(r => r[0])
    .map(r => ({ order: r[0], category: r[1], item: r[2], required: r[3] }));
}

function getDeals(ss, legalName) {
  if (!legalName) return [];
  const sheet = ss.getSheetByName('Deals');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  return rows
    .filter(r => r[0] && r[1] === legalName)
    .map(r => ({
      dealId: r[0], legalName: r[1], address: r[2],
      representation: r[3], notes: r[4], status: r[5], createdAt: r[6]
    }));
}

function getProgress(ss, dealId) {
  if (!dealId) return [];
  const sheet = ss.getSheetByName('Progress');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  return rows
    .filter(r => r[0] && r[1] === dealId)
    .map(r => ({
      progressId: r[0], dealId: r[1], itemOrder: r[2],
      completed: r[3], notes: r[4], updatedAt: r[5]
    }));
}

function createDeal(ss, params) {
  if (!params.legalName) return { error: 'legalName is required' };
  const sheet = ss.getSheetByName('Deals');
  const dealId = 'DEAL-' + Date.now();
  const now = new Date().toISOString();
  sheet.appendRow([dealId, params.legalName, params.address, params.representation, params.notes || '', 'Active', now]);
  return { success: true, dealId };
}

function updateProgress(ss, params) {
  const sheet = ss.getSheetByName('Progress');
  const lastRow = sheet.getLastRow();
  const now = new Date().toISOString();
  const completed = params.completed === 'true' || params.completed === true;
  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === params.dealId && String(rows[i][2]) === String(params.itemOrder)) {
        sheet.getRange(i + 2, 4).setValue(completed);
        sheet.getRange(i + 2, 5).setValue(params.notes || '');
        sheet.getRange(i + 2, 6).setValue(now);
        return { success: true, updated: true };
      }
    }
  }
  const progressId = 'PROG-' + Date.now();
  sheet.appendRow([progressId, params.dealId, params.itemOrder, completed, params.notes || '', now]);
  return { success: true, created: true };
}

function updateDealStatus(ss, params) {
  const sheet = ss.getSheetByName('Deals');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'No deals found' };
  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === params.dealId) {
      sheet.getRange(i + 2, 6).setValue(params.status);
      return { success: true };
    }
  }
  return { error: 'Deal not found' };
}

function addAgent(ss, params) {
  if (!params.legalName) return { error: 'legalName is required' };
  const sheet = ss.getSheetByName('Agents');
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (let r of rows) {
      if (r[3] === params.legalName) return { success: true, existed: true };
    }
  }
  sheet.appendRow([params.displayName || params.legalName, params.email || '', true, params.legalName]);
  return { success: true, created: true };
}
