export interface ParsedTicket {
  eventId: string;
  eventName: string;
  recipient: string;
}

export function parseGenConTickets(text: string): ParsedTicket[] {
  const tickets: ParsedTicket[] = [];
  
  // Regex to match the ticket format: optional leading whitespace, 3 letters, 2 numbers, 2 letters, 6 numbers, optional whitespace "-" optional whitespace
  // Then capture everything up to the first tab (event name) and everything up to the second tab (recipient)
  const ticketRegex = /^\s*([A-Z]{3}\d{2}[A-Z]{2}\d{6})\s*-\s*(.+?)\t(.+?)(?:\t|$)/gm;
  
  let match;
  while ((match = ticketRegex.exec(text)) !== null) {
    const [, eventId, eventName, recipient] = match;
    
    // Clean up the data
    const cleanEventId = eventId.trim();
    const cleanEventName = eventName.trim();
    const cleanRecipient = recipient.trim();
    
    // Only add if all fields are present
    if (cleanEventId && cleanEventName && cleanRecipient) {
      tickets.push({
        eventId: cleanEventId,
        eventName: cleanEventName,
        recipient: cleanRecipient
      });
    }
  }
  
  return tickets;
}

export function detectDuplicateTickets(tickets: ParsedTicket[]): {
  keepTickets: ParsedTicket[];
  refundTickets: ParsedTicket[];
} {
  const keepTickets: ParsedTicket[] = [];
  const refundTickets: ParsedTicket[] = [];
  
  // Group tickets by eventId + recipient combination
  const ticketGroups = new Map<string, ParsedTicket[]>();
  
  tickets.forEach(ticket => {
    // Create a unique key combining eventId and recipient
    const key = `${ticket.eventId}|${ticket.recipient}`;
    if (!ticketGroups.has(key)) {
      ticketGroups.set(key, []);
    }
    ticketGroups.get(key)!.push(ticket);
  });
  
  // For each group, keep the first ticket and mark others for refund
  ticketGroups.forEach(group => {
    if (group.length === 1) {
      // Only one ticket for this event+recipient combination, keep it
      keepTickets.push(group[0]);
    } else {
      // Multiple tickets for same event+recipient combination (duplicate!)
      // Keep the first one (chronologically as they appear in the text)
      keepTickets.push(group[0]);
      // Mark the rest for refund
      refundTickets.push(...group.slice(1));
    }
  });
  
  return { keepTickets, refundTickets };
}

// Test function to validate parsing with the example data
export function testTicketParsing() {
  const testText = `
Item	Recipient	Purchased
RPG25ND272941 - Dread: Victim's Choice	Liv Benjamin	05/18/25 at 12:44PM
MHE25ND271404 - Kefa's Intro to Miniature Painting	Hannah Episcopia	05/18/25 at 12:44PM
RPG25ND283010 - Battle at the Heart of Infinity	David Farago	05/18/25 at 12:44PM
RPG25ND277167 - Warped FM	Aidan Callahan	05/18/25 at 12:44PM
ZED25ND275584 - Blood on the Clocktower: Trouble Brewing LTP	David Farago	05/18/25 at 12:44PM
ZED25ND275584 - Blood on the Clocktower: Trouble Brewing LTP	Zachary O'Grady	05/18/25 at 12:44PM
ZED25ND275584 - Blood on the Clocktower: Trouble Brewing LTP	Eleni Pappas	05/18/25 at 12:44PM
ZED25ND294398 - Kill Team Live! Warhammer 40,000 Laser Tag!	Matthew Vogel	05/18/25 at 12:44PM
RPG25ND272941 - Dread: Victim's Choice	Matthew Vogel	05/18/25 at 12:08PM
NMN25ND286123 - Kill Team Dungeon Crawl	Matthew Vogel	05/18/25 at 12:08PM
RPG25ND272947 - ADGNEPSEF555	Matthew Vogel	05/18/25 at 12:08PM
  `;
  
  const parsed = parseGenConTickets(testText);
  console.log('Parsed tickets:', parsed);
  
  const { keepTickets, refundTickets } = detectDuplicateTickets(parsed);
  console.log('Keep tickets:', keepTickets);
  console.log('Refund tickets:', refundTickets);
  
  return { parsed, keepTickets, refundTickets };
}
