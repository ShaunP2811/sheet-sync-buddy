/**
 * Google Sheets API service — client-side calls using user's OAuth token
 */
import type {
  GoogleSpreadsheet,
  GoogleSheetTab,
  CellUpdate,
} from '@/types/google';
import type { SheetRow } from '@/types/sync';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** Encode a tab name for the Sheets API range parameter.
 *  Tab names with spaces or special characters must be single-quoted. */
function encodeRange(tabName: string): string {
  // If tab name contains spaces, special chars, or starts with a digit, wrap in single quotes
  // Escape any single quotes within the name by doubling them
  const escaped = tabName.replace(/'/g, "''");
  const quoted = `'${escaped}'`;
  return encodeURIComponent(quoted);
}

/** List spreadsheets the user has access to */
export async function listSpreadsheets(token: string): Promise<GoogleSpreadsheet[]> {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const res = await fetch(
    `${DRIVE_API}?q=${q}&fields=files(id,name,webViewLink,modifiedTime)&orderBy=modifiedByMeTime desc&pageSize=50`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`Failed to list spreadsheets: ${res.status}`);
  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    url: f.webViewLink,
    modifiedTime: f.modifiedTime,
  }));
}

/** List tabs/sheets in a spreadsheet */
export async function listTabs(token: string, spreadsheetId: string): Promise<GoogleSheetTab[]> {
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}?fields=sheets(properties)`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`Failed to list tabs: ${res.status}`);
  const data = await res.json();
  return (data.sheets || []).map((s: any) => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title,
    index: s.properties.index,
    rowCount: s.properties.gridProperties?.rowCount || 0,
    columnCount: s.properties.gridProperties?.columnCount || 0,
  }));
}

/** Read all rows from a tab, returning headers + row records */
export async function readRows(
  token: string,
  spreadsheetId: string,
  tabName: string
): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const range = encodeRange(tabName);
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`Failed to read rows: ${res.status}`);
  const data = await res.json();
  const values: string[][] = data.values || [];
  if (values.length === 0) return { headers: [], rows: [] };

  const headers = values[0];
  const rows: SheetRow[] = values.slice(1).map((row) => {
    const record: SheetRow = {};
    headers.forEach((h, i) => {
      record[h] = row[i] || '';
    });
    return record;
  });

  return { headers, rows };
}

/** Append rows to a tab */
export async function appendRows(
  token: string,
  spreadsheetId: string,
  tabName: string,
  rows: string[][]
): Promise<void> {
  const range = encodeRange(tabName);
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!res.ok) throw new Error(`Failed to append rows: ${res.status}`);
}

/** Update individual cells */
export async function updateCells(
  token: string,
  spreadsheetId: string,
  tabName: string,
  updates: CellUpdate[],
  headers: string[]
): Promise<void> {
  const data = updates.map((u) => {
    const colLetter = columnToLetter(u.column);
    const escaped = tabName.replace(/'/g, "''");
    const range = `'${escaped}'!${colLetter}${u.row + 2}`; // +2 for 1-indexed and header row
    return { range, values: [[u.value]] };
  });

  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data,
      }),
    }
  );
  if (!res.ok) throw new Error(`Failed to update cells: ${res.status}`);
}

/** Create a new tab in a spreadsheet */
export async function createTab(
  token: string,
  spreadsheetId: string,
  tabName: string,
  headers?: string[]
): Promise<void> {
  // Create the sheet
  const createRes = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: tabName } } }],
    }),
  });
  if (!createRes.ok) throw new Error(`Failed to create tab: ${createRes.status}`);

  // Add headers if provided
  if (headers && headers.length > 0) {
    await appendRows(token, spreadsheetId, tabName, [headers]);
  }
}

function columnToLetter(col: number): string {
  let letter = '';
  let c = col;
  while (c >= 0) {
    letter = String.fromCharCode((c % 26) + 65) + letter;
    c = Math.floor(c / 26) - 1;
  }
  return letter;
}
