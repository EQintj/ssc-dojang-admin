import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export async function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // Strip potential surrounding quotes from the environment variable
  if (privateKey?.startsWith('"') && privateKey?.endsWith('"')) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
  }

  if (!email || !privateKey) {
    throw new Error('Google Service Account credentials missing in environment variables');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: SCOPES,
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client as any });
}

export const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Define headers for the sheet
export const SHEET_HEADERS = [
  'id',
  'gym_name',
  'password',
  'contact',
  'address',
  'event_scale',
  'sns_agreed',
  'parts',
  'facilities',
  'total_count',
  'total_price',
  'manager_name',
  'status',
  'created_at'
];
