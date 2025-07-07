export interface ParsedWishlistEvent {
  eventId: string;
  title: string;
  priority?: number;
}

export function parseGenConWishlist(text: string): ParsedWishlistEvent[] {
  const events: ParsedWishlistEvent[] = [];
  
  // Regex to match event IDs: 3 letters, 2 numbers, 2 letters, 6 numbers
  const eventIdRegex = /([A-Z]{3}\d{2}[A-Z]{2}\d{6})/g;
  
  // Split text into lines to process each line
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Find event ID in the line
    const eventIdMatch = line.match(eventIdRegex);
    if (eventIdMatch) {
      const eventId = eventIdMatch[0];
      
      // Try to extract title and priority from the line
      let title = '';
      let priority: number | undefined;
      
      // Look for priority number at the start of the line
      const priorityMatch = line.match(/^\s*(\d+)\s+/);
      if (priorityMatch) {
        priority = parseInt(priorityMatch[1]);
      }
      
      // Extract title - look for text after the event ID
      const titleMatch = line.match(new RegExp(`${eventId}\\s+(.+?)(?:\\s+(?:Thursday|Friday|Saturday|Sunday)|$)`));
      if (titleMatch) {
        title = titleMatch[1].trim();
      } else {
        // Fallback: try to find any text after the event ID
        const fallbackMatch = line.match(new RegExp(`${eventId}\\s+(.+)`));
        if (fallbackMatch) {
          title = fallbackMatch[1].trim();
          // Remove common suffixes like day names, times, costs
          title = title.replace(/\s+(Thursday|Friday|Saturday|Sunday).*$/i, '');
          title = title.replace(/\s+\d+:\d+\s+(AM|PM).*$/i, '');
          title = title.replace(/\s+\$\d+.*$/i, '');
        }
      }
      
      // Only add if we have a valid event ID
      if (eventId) {
        events.push({
          eventId,
          title: title || 'Unknown Event',
          priority
        });
      }
    }
  }
  
  // Remove duplicates based on eventId
  const uniqueEvents = events.filter((event, index, self) => 
    index === self.findIndex(e => e.eventId === event.eventId)
  );
  
  return uniqueEvents;
}

export function validateWishlistEvents(events: ParsedWishlistEvent[]): {
  validEvents: ParsedWishlistEvent[];
  invalidEvents: ParsedWishlistEvent[];
} {
  const validEvents: ParsedWishlistEvent[] = [];
  const invalidEvents: ParsedWishlistEvent[] = [];
  
  for (const event of events) {
    // Basic validation - check if event ID matches expected format
    const isValidFormat = /^[A-Z]{3}\d{2}[A-Z]{2}\d{6}$/.test(event.eventId);
    
    if (isValidFormat) {
      validEvents.push(event);
    } else {
      invalidEvents.push(event);
    }
  }
  
  return { validEvents, invalidEvents };
}

// Test function to validate parsing with the example wishlist data
export function testWishlistParsing() {
  const testText = `
1
RPG25ND272941	Dread: Victim's Choice
Dread, 1st Edition
Saturday
2:00 PM EDT	5 hr	$6	View	

2
WKS25ND272414	Make a Steel Chainmail Dice Bag	Friday
1:00 PM EDT	2 hr	$36	View	

3
SPA25ND272897	Intro to Sword Fighting	Friday
10:00 AM EDT	1 hr	$20	View	
  `;
  
  const parsed = parseGenConWishlist(testText);
  console.log('Parsed wishlist events:', parsed);
  
  const { validEvents, invalidEvents } = validateWishlistEvents(parsed);
  console.log('Valid events:', validEvents);
  console.log('Invalid events:', invalidEvents);
  
  return { parsed, validEvents, invalidEvents };
}
