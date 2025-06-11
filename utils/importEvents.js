const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
          startDateTime: columns[14]?.trim() || null, // Start Date & Time
          duration: columns[15]?.trim() || null, // Duration
          endDateTime: columns[16]?.trim() || null, // End Date & Time
          ageRequired: columns[10]?.trim() || null, // Age Required
          experienceRequired: columns[11]?.trim() || null, // Experience Required
          materialsRequired: columns[12]?.trim() || null, // Materials Required
          cost: columns[25]?.trim() || null, // Cost $
          location: columns[26]?.trim() || null, // Location
          ticketsAvailable: columns[30] ? parseInt(columns[30].trim()) || null : null, // Tickets Available
        };
        
        await prisma.event.create({
          data: eventData
        });
        
        imported++;
        
        if (imported % 100 === 0) {
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
