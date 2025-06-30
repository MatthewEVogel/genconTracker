import * as XLSX from 'xlsx';

export interface ParsedEventData {
  id: string;
  title: string;
  shortDescription?: string;
  eventType?: string;
  gameSystem?: string;
  startDateTime?: string;
  duration?: string;
  endDateTime?: string;
  ageRequired?: string;
  experienceRequired?: string;
  materialsRequired?: string;
  cost?: string;
  location?: string;
  ticketsAvailable?: number;
}

export function parseXlsxToEvents(buffer: Buffer): ParsedEventData[] {
  try {
    // Read the workbook from buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON array
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (jsonData.length < 2) {
      throw new Error('XLSX file appears to be empty or has no data rows');
    }
    
    // Skip header row and process data
    const dataRows = jsonData.slice(1);
    const events: ParsedEventData[] = [];
    
    for (const row of dataRows) {
      // Skip empty rows or rows without required data
      if (!row || row.length < 31 || !row[0] || !row[2]) {
        continue;
      }
      
      try {
        // Map XLSX columns to our database fields (same mapping as TSV)
        const eventData: ParsedEventData = {
          id: String(row[0]).trim(), // Game ID
          title: String(row[2]).trim(), // Title
          shortDescription: row[3] ? String(row[3]).trim() : undefined, // Short Description
          eventType: row[5] ? String(row[5]).trim() : undefined, // Event Type
          gameSystem: row[6] ? String(row[6]).trim() : undefined, // Game System
          startDateTime: row[14] ? String(row[14]).trim() : undefined, // Start Date & Time
          duration: row[15] ? String(row[15]).trim() : undefined, // Duration
          endDateTime: row[16] ? String(row[16]).trim() : undefined, // End Date & Time
          ageRequired: row[10] ? String(row[10]).trim() : undefined, // Age Required
          experienceRequired: row[11] ? String(row[11]).trim() : undefined, // Experience Required
          materialsRequired: row[12] ? String(row[12]).trim() : undefined, // Materials Required
          cost: row[25] ? String(row[25]).trim() : undefined, // Cost $
          location: row[26] ? String(row[26]).trim() : undefined, // Location
          ticketsAvailable: row[30] ? parseInt(String(row[30]).trim()) || undefined : undefined, // Tickets Available
        };
        
        events.push(eventData);
      } catch (error) {
        console.warn(`Error parsing event row with ID ${row[0]}:`, error);
        continue;
      }
    }
    
    console.log(`Successfully parsed ${events.length} events from XLSX`);
    return events;
    
  } catch (error) {
    console.error('Error parsing XLSX file:', error);
    throw new Error(`Failed to parse XLSX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function convertXlsxToTsv(buffer: Buffer): string {
  try {
    // Read the workbook from buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to TSV format
    const tsvData = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
    
    return tsvData;
  } catch (error) {
    console.error('Error converting XLSX to TSV:', error);
    throw new Error(`Failed to convert XLSX to TSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
