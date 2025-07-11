import { parseGenConTickets, detectDuplicateTickets, ParsedTicket } from '@/utils/ticketParser';

describe('Ticket Parser Tests', () => {
  describe('GenCon Ticket Parsing', () => {
    test('should parse valid GenCon ticket format correctly', () => {
      const testText = `RPG25ND272941 - Dread: Victim's Choice	Liv Benjamin	05/18/25 at 12:44PM
MHE25ND271404 - Kefa's Intro to Miniature Painting	Hannah Episcopia	05/18/25 at 12:44PM`;

      const result = parseGenConTickets(testText);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        eventId: 'RPG25ND272941',
        eventName: "Dread: Victim's Choice",
        recipient: 'Liv Benjamin'
      });
      expect(result[1]).toEqual({
        eventId: 'MHE25ND271404',
        eventName: "Kefa's Intro to Miniature Painting",
        recipient: 'Hannah Episcopia'
      });
    });

    test('should handle empty or invalid input', () => {
      expect(parseGenConTickets('')).toEqual([]);
      expect(parseGenConTickets('invalid text')).toEqual([]);
      expect(parseGenConTickets('RPG25ND272941 - Missing Tab Data')).toEqual([]);
    });

    test('should handle malformed event IDs', () => {
      const testText = `INVALID123 - Event Name	Recipient	Date
RPG25ND272941 - Valid Event	Valid Recipient	Date`;

      const result = parseGenConTickets(testText);

      expect(result).toHaveLength(1);
      expect(result[0].eventId).toBe('RPG25ND272941');
    });

    test('should trim whitespace from parsed fields', () => {
      const testText = `  RPG25ND272941  -   Event Name   	  Recipient Name  	Date`;

      const result = parseGenConTickets(testText);

      expect(result).toHaveLength(1);
      expect(result[0].eventId).toBe('RPG25ND272941');
      expect(result[0].eventName).toBe('Event Name');
      expect(result[0].recipient).toBe('Recipient Name');
    });

    test('should handle special characters in event names and recipients', () => {
      const testText = `RPG25ND272941 - Event: Special & Characters!	O'Connor, John Jr.	Date`;

      const result = parseGenConTickets(testText);

      expect(result).toHaveLength(1);
      expect(result[0].eventName).toBe("Event: Special & Characters!");
      expect(result[0].recipient).toBe("O'Connor, John Jr.");
    });
  });

  describe('Duplicate Detection', () => {
    test('should identify no duplicates when all tickets are unique', () => {
      const tickets: ParsedTicket[] = [
        { eventId: 'RPG25ND272941', eventName: 'Event 1', recipient: 'John Doe' },
        { eventId: 'RPG25ND272942', eventName: 'Event 2', recipient: 'Jane Smith' },
        { eventId: 'RPG25ND272941', eventName: 'Event 1', recipient: 'Bob Johnson' }
      ];

      const result = detectDuplicateTickets(tickets);

      expect(result.keepTickets).toHaveLength(3);
      expect(result.refundTickets).toHaveLength(0);
    });

    test('should identify duplicates for same event and recipient', () => {
      const tickets: ParsedTicket[] = [
        { eventId: 'RPG25ND272941', eventName: 'Event 1', recipient: 'John Doe' },
        { eventId: 'RPG25ND272941', eventName: 'Event 1', recipient: 'John Doe' }, // Duplicate
        { eventId: 'RPG25ND272942', eventName: 'Event 2', recipient: 'Jane Smith' },
        { eventId: 'RPG25ND272941', eventName: 'Event 1', recipient: 'John Doe' }  // Another duplicate
      ];

      const result = detectDuplicateTickets(tickets);

      expect(result.keepTickets).toHaveLength(2); // Keep first occurrence of each unique combo
      expect(result.refundTickets).toHaveLength(2); // Refund the duplicates
      expect(result.refundTickets[0].recipient).toBe('John Doe');
      expect(result.refundTickets[1].recipient).toBe('John Doe');
    });

    test('should handle multiple different duplicate groups', () => {
      const tickets: ParsedTicket[] = [
        // John Doe duplicates for Event 1
        { eventId: 'RPG25ND272941', eventName: 'Event 1', recipient: 'John Doe' },
        { eventId: 'RPG25ND272941', eventName: 'Event 1', recipient: 'John Doe' },
        // Jane Smith duplicates for Event 2
        { eventId: 'RPG25ND272942', eventName: 'Event 2', recipient: 'Jane Smith' },
        { eventId: 'RPG25ND272942', eventName: 'Event 2', recipient: 'Jane Smith' },
        { eventId: 'RPG25ND272942', eventName: 'Event 2', recipient: 'Jane Smith' },
        // No duplicates
        { eventId: 'RPG25ND272943', eventName: 'Event 3', recipient: 'Bob Johnson' }
      ];

      const result = detectDuplicateTickets(tickets);

      expect(result.keepTickets).toHaveLength(3); // One from each unique combo
      expect(result.refundTickets).toHaveLength(3); // 1 John + 2 Jane duplicates
    });

    test('should preserve order of first occurrence', () => {
      const tickets: ParsedTicket[] = [
        { eventId: 'RPG25ND272942', eventName: 'Event 2', recipient: 'Jane Smith' },
        { eventId: 'RPG25ND272941', eventName: 'Event 1', recipient: 'John Doe' },
        { eventId: 'RPG25ND272941', eventName: 'Event 1', recipient: 'John Doe' }, // Duplicate
        { eventId: 'RPG25ND272942', eventName: 'Event 2', recipient: 'Jane Smith' }  // Duplicate
      ];

      const result = detectDuplicateTickets(tickets);

      expect(result.keepTickets).toHaveLength(2);
      expect(result.keepTickets[0].recipient).toBe('Jane Smith'); // First occurrence
      expect(result.keepTickets[1].recipient).toBe('John Doe');   // First occurrence
      expect(result.refundTickets).toHaveLength(2);
    });
  });

  describe('Integration Tests', () => {
    test('should parse and detect duplicates in realistic GenCon data', () => {
      const testText = `RPG25ND272941 - Dread: Victim's Choice	Liv Benjamin	05/18/25 at 12:44PM
MHE25ND271404 - Kefa's Intro to Miniature Painting	Hannah Episcopia	05/18/25 at 12:44PM
ZED25ND275584 - Blood on the Clocktower: Trouble Brewing LTP	David Farago	05/18/25 at 12:44PM
ZED25ND275584 - Blood on the Clocktower: Trouble Brewing LTP	Zachary O'Grady	05/18/25 at 12:44PM
ZED25ND275584 - Blood on the Clocktower: Trouble Brewing LTP	Eleni Pappas	05/18/25 at 12:44PM
RPG25ND272941 - Dread: Victim's Choice	Matthew Vogel	05/18/25 at 12:08PM
RPG25ND272941 - Dread: Victim's Choice	Matthew Vogel	05/18/25 at 12:08PM`;

      const parsed = parseGenConTickets(testText);
      const { keepTickets, refundTickets } = detectDuplicateTickets(parsed);

      expect(parsed).toHaveLength(7);
      expect(keepTickets).toHaveLength(6); // 6 unique event+recipient combinations
      expect(refundTickets).toHaveLength(1); // 1 duplicate (Matthew Vogel's second RPG25ND272941)
      
      // Verify the duplicate is correctly identified
      expect(refundTickets[0].eventId).toBe('RPG25ND272941');
      expect(refundTickets[0].recipient).toBe('Matthew Vogel');
    });

    test('should handle edge case with no valid tickets', () => {
      const testText = `Invalid line 1
Another invalid line
Not a ticket format`;

      const parsed = parseGenConTickets(testText);
      const { keepTickets, refundTickets } = detectDuplicateTickets(parsed);

      expect(parsed).toHaveLength(0);
      expect(keepTickets).toHaveLength(0);
      expect(refundTickets).toHaveLength(0);
    });

    test('should handle mixed valid and invalid lines', () => {
      const testText = `Invalid line
RPG25ND272941 - Valid Event	Valid Recipient	Date
Another invalid line
MHE25ND271404 - Another Valid Event	Another Recipient	Date
Yet another invalid line`;

      const parsed = parseGenConTickets(testText);
      const { keepTickets, refundTickets } = detectDuplicateTickets(parsed);

      expect(parsed).toHaveLength(2);
      expect(keepTickets).toHaveLength(2);
      expect(refundTickets).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large datasets efficiently', () => {
      // Generate a large dataset with some duplicates
      const tickets: ParsedTicket[] = [];
      
      // Add 1000 unique tickets
      for (let i = 0; i < 1000; i++) {
        tickets.push({
          eventId: `EVT${i.toString().padStart(8, '0')}`,
          eventName: `Event ${i}`,
          recipient: `Recipient ${i}`
        });
      }
      
      // Add 100 duplicates
      for (let i = 0; i < 100; i++) {
        tickets.push({
          eventId: `EVT${i.toString().padStart(8, '0')}`,
          eventName: `Event ${i}`,
          recipient: `Recipient ${i}`
        });
      }

      const startTime = Date.now();
      const result = detectDuplicateTickets(tickets);
      const endTime = Date.now();

      expect(result.keepTickets).toHaveLength(1000);
      expect(result.refundTickets).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
