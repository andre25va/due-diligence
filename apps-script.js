// ROA KC Due Diligence - Google Apps Script Backend
// Paste this entire file into your Google Apps Script editor
// Deploy as Web App: Execute as Me, Anyone can access

const SPREADSHEET_ID = '10wQfPmnsdH5FwhUjH51eV72H5lgxhFYyqq4vyUmXf2I';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    const ss = getSpreadsheet();
    if (action === 'getAgents') result = getAgents(ss);
    else if (action === 'getChecklist') result = getChecklist(ss);
    else if (action === 'getDeals') result = getDeals(ss, e.parameter.legalName);
    else if (action === 'getProgress') result = getProgress(ss, e.parameter.dealId);
    else result = { error: 'Unknown action' };
  } catch(err) {
    result = { error: err.toString() };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  let result;
  try {
    const ss = getSpreadsheet();
    if (action === 'createDeal') result = createDeal(ss, data);
    else if (action === 'updateProgress') result = updateProgress(ss, data);
    else if (action === 'updateDealStatus') result = updateDealStatus(ss, data);
    else if (action === 'addAgent') result = addAgent(ss, data);
    else result = { error: 'Unknown action' };
  } catch(err) {
    result = { error: err.toString() };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Returns all active agents with both displayName and legalName
function getAgents(ss) {
  const sheet = ss.getSheetByName('Agents');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  return rows
    .filter(r => r[0] && r[2] === true)
    .map(r => ({
      displayName: r[0],
      email: r[1],
      legalName: r[3] || r[0]  // fallback to displayName if no legal name
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

// Uses legalName as the unique agent identifier
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

// Uses legalName as the unique agent identifier for the deal
function createDeal(ss, data) {
  if (!data.legalName) return { error: 'legalName is required' };
  const sheet = ss.getSheetByName('Deals');
  const dealId = 'DEAL-' + Date.now();
  const now = new Date().toISOString();
  sheet.appendRow([dealId, data.legalName, data.address, data.representation, data.notes || '', 'Active', now]);
  return { success: true, dealId };
}

function updateProgress(ss, data) {
  const sheet = ss.getSheetByName('Progress');
  const lastRow = sheet.getLastRow();
  const now = new Date().toISOString();
  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === data.dealId && String(rows[i][2]) === String(data.itemOrder)) {
        sheet.getRange(i + 2, 1, 1, 6).setValues([[
          rows[i][0], data.dealId, data.itemOrder, data.completed, data.notes || '', now
        ]]);
        return { success: true, updated: true };
      }
    }
  }
  const progressId = 'PROG-' + Date.now();
  sheet.appendRow([progressId, data.dealId, data.itemOrder, data.completed, data.notes || '', now]);
  return { success: true, created: true };
}

function updateDealStatus(ss, data) {
  const sheet = ss.getSheetByName('Deals');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'No deals found' };
  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === data.dealId) {
      sheet.getRange(i + 2, 6).setValue(data.status);
      return { success: true };
    }
  }
  return { error: 'Deal not found' };
}

// Adds a new agent only if their legalName doesn't already exist
function addAgent(ss, data) {
  if (!data.legalName) return { error: 'legalName is required' };
  const sheet = ss.getSheetByName('Agents');
  const lastRow = sheet.getLastRow();
  
  // Check for duplicate by legal name (case-insensitive)
  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toLowerCase() === data.legalName.toLowerCase()) {
        return { success: false, duplicate: true, message: 'Agent with this legal name already exists' };
      }
    }
  }
  
  sheet.appendRow([data.displayName || data.legalName, data.email || '', true, data.legalName]);
  return { success: true, created: true };
}
