const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper function to parse date from MM/DD/YYYY HH:MM AM/PM format
function parseDateTime(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  try {
    // Parse date like "07/31/2025 09:00 AM" to ISO format
    const date = new Date(dateStr.trim());
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch (error) {
    return null;
  }
}

// Helper function to parse cost
function parseCost(costStr) {
  if (!costStr || costStr.trim() === '' || costStr.trim() === '0') return null;
  try {
    const cost = parseFloat(costStr.trim());
    return isNaN(cost) ? null : cost;
  } catch (error) {
    return null;
  }
}

async function importEvents() {
  try {
    console.log('Starting events import...');
    
    // Read the TSV file
    const tsvPath = path.join(process.cwd(), 'events.tsv');
    const tsvContent = fs.readFileSync(tsvPath, 'utf-8');
    
    // Split into lines and remove the header
    const lines = tsvContent.split('\n');
    const header = lines[0].split('\t');
    const dataLines = lines.slice(1).filter(line => line.trim() !== '');
    
    console.log(`Found ${dataLines.length} events to import`);
    
    // Clear existing events
    await prisma.event.deleteMany();
    console.log('Cleared existing events');
    
    let imported = 0;
    let skipped = 0;
    
    for (const line of dataLines) {
      const columns = line.split('\t');
      
      // Skip if not enough columns or missing required data
      if (columns.length < 31 || !columns[0] || !columns[2]) {
        skipped++;
        continue;
      }
      
      try {
        // Map TSV columns to our database fields
        const eventData = {
          id: columns[0].trim(), // Game ID
          title: columns[2].trim(), // Title
          shortDescription: columns[3]?.trim() || null, // Short Description
          eventType: columns[5]?.trim() || null, // Event Type
          gameSystem: columns[6]?.trim() || null, // Game System
          startDateTime: parseDateTime(columns[14]), // Start Date & Time
          duration: columns[15]?.trim() || null, // Duration
          endDateTime: parseDateTime(columns[16]), // End Date & Time
          ageRequired: columns[10]?.trim() || null, // Age Required
          experienceRequired: columns[11]?.trim() || null, // Experience Required
          materialsRequired: columns[12]?.trim() || null, // Materials Required
          cost: parseCost(columns[25]), // Cost $
          location: columns[26]?.trim() || null, // Location
          ticketsAvailable: columns[30] ? parseInt(columns[30].trim()) || null : null, // Tickets Available
        };
        
        await prisma.event.create({
          data: eventData
        });
        
        imported++;
        
        if (imported % 1000 === 0) {
          console.log(`Imported ${imported} events...`);
        }
        
      } catch (error) {
        console.error(`Error importing event ${columns[0]}: ${error.message}`);
        skipped++;
      }
    }
    
    console.log(`Import completed! Imported: ${imported}, Skipped: ${skipped}`);
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importEvents();
