const { google } = require('googleapis');
const HEADERS = ['Telegram ID','Full Name','National ID','Leave Type','Start Date','End Date','Reason','Status','Step','Request ID'];
function client() {
  let raw;
  try { raw = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'); }
  catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON'); }
  if (!raw.client_email || !raw.private_key) throw new Error('Google service account credentials are missing');
  const auth = new google.auth.GoogleAuth({ credentials: raw, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}
const spreadsheetId = () => { if (!process.env.GOOGLE_SHEET_ID) throw new Error('GOOGLE_SHEET_ID is missing'); return process.env.GOOGLE_SHEET_ID; };
const range = () => `'${(process.env.GOOGLE_SHEET_TAB || 'Sheet1').replace(/'/g,"''")}'!A:J`;
async function allRows() {
  const api = client();
  const res = await api.spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range: range() });
  const values = res.data.values || [];
  const headers = values[0] || [];
  const missing = HEADERS.filter(h => !headers.includes(h));
  if (missing.length) throw new Error('Missing Google Sheet columns: ' + missing.join(', '));
  return values.slice(1).map((cells, i) => {
    const row = { _rowNumber: i + 2 };
    headers.forEach((h, j) => row[h] = cells[j] ?? '');
    return row;
  }).filter(r => r['Request ID']);
}
async function updateStatus(rowNumber, status) {
  const api = client();
  await api.spreadsheets.values.update({ spreadsheetId: spreadsheetId(), range: `'${(process.env.GOOGLE_SHEET_TAB || 'Sheet1').replace(/'/g,"''")}'!H${rowNumber}`, valueInputOption: 'RAW', requestBody: { values: [[status]] } });
}
module.exports = { allRows, updateStatus };
