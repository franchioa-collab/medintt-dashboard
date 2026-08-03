import { google } from 'googleapis';

const sheets = google.sheets('v4');

// Parsear credenciales desde variable de entorno
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

export async function getSheetData(sheetId: string): Promise<string[][]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: sheetId,
      range: "'Calendario Maestro Anual'!A4:Z50",
      valueRenderOption: 'FORMATTED_VALUE',
    });

    return response.data.values || [];
  } catch (error) {
    console.error(`Error fetching sheet ${sheetId}:`, error);
    throw error;
  }
}

export async function getAllSheetsData(sheetIds: { [key: string]: string }) {
  const results: { [key: string]: string[][] } = {};
  const errors: { [key: string]: string } = {};

  for (const [id, sheetId] of Object.entries(sheetIds)) {
    try {
      results[id] = await getSheetData(sheetId);
    } catch (error) {
      errors[id] = (error as Error).message;
    }
  }

  return { results, errors };
}
