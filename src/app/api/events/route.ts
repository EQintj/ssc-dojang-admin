import { NextResponse } from 'next/server';
import { getSheetsClient, SHEET_ID, SHEET_HEADERS } from '@/lib/googleSheets';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    
    // Get the first sheet's name automatically
    const sheetMeta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });
    const sheetName = sheetMeta.data.sheets?.[0].properties?.title || 'Sheet1';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A:N`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json([]);
    }

    const headers = rows[0];
    const data = rows.slice(1).map((row) => {
      const obj: any = {};
      headers.forEach((header, index) => {
        let value = row[index];
        // Parse numeric values and JSON strings
        if (header === 'total_count' || header === 'total_price') {
          value = Number(value);
        } else if (header === 'parts' || header === 'facilities' || header === 'sns_agreed') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // If not JSON, keep as is
          }
        }
        obj[header] = value;
      });
      return obj;
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching events from Google Sheets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sheets = await getSheetsClient();

    // Check if headers exist, if not create them
    const sheetMeta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });
    const sheetName = sheetMeta.data.sheets?.[0].properties?.title || 'Sheet1';

    const currentSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A1:N1`,
    });

    if (!currentSheet.data.values || currentSheet.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [SHEET_HEADERS] },
      });
    }

    const newEvent = {
      id: uuidv4(),
      created_at: new Date().toISOString(),
      ...body,
      status: body.status || 'pending',
    };

    // Prepare row data based on headers
    const row = SHEET_HEADERS.map((header) => {
      let value = (newEvent as any)[header];
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value === undefined ? '' : value;
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A:N`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });

    return NextResponse.json(newEvent);
  } catch (error: any) {
    console.error('Error saving event to Google Sheets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json();
    if (!id) throw new Error('ID is required for update');

    const sheets = await getSheetsClient();
    const sheetMeta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });
    const sheetName = sheetMeta.data.sheets?.[0].properties?.title || 'Sheet1';

    // Find the row with matching ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A:A`,
    });

    const rows = response.data.values;
    const rowIndex = rows?.findIndex((r) => r[0] === id);

    if (rowIndex === undefined || rowIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get current row to merge updates
    const rowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!${rowIndex + 1}:${rowIndex + 1}`,
    });
    
    const currentRow = rowResponse.data.values?.[0] || [];
    const eventData: any = {};
    SHEET_HEADERS.forEach((header, index) => {
      eventData[header] = currentRow[index];
    });

    const updatedEvent = { ...eventData, ...updates };

    const newRow = SHEET_HEADERS.map((header) => {
      let value = updatedEvent[header];
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value === undefined ? '' : value;
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [newRow] },
    });

    return NextResponse.json(updatedEvent);
  } catch (error: any) {
    console.error('Error updating event in Google Sheets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) throw new Error('ID is required for deletion');

    const sheets = await getSheetsClient();
    const sheetMeta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });
    const sheetName = sheetMeta.data.sheets?.[0].properties?.title || 'Sheet1';

    // Find the row with matching ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A:A`,
    });

    const rows = response.data.values;
    const rowIndex = rows?.findIndex((r) => r[0] === id);

    if (rowIndex === undefined || rowIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Clear the row content
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!${rowIndex + 1}:${rowIndex + 1}`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting event from Google Sheets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
