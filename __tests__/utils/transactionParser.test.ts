/**
 * Tests for transaction parsing logic
 */

interface ParsedTransaction {
  eventId: string;
  recipient: string;
  amount: string;
  type: 'purchase' | 'refund';
  description: string;
}

interface ParseResults {
  year: string;
  transactions: ParsedTransaction[];
  errors: string[];
}

// Extract the parsing logic for testing
function parseTransactionData(text: string): ParseResults {
  const lines = text.split('\n');
  const results: ParseResults = {
    year: '',
    transactions: [],
    errors: []
  };

  // Find the GenCon year
  const yearMatch = text.match(/Gen Con Indy (\d{4})/);
  if (!yearMatch) {
    results.errors.push('Could not find GenCon year in transaction data');
    return results;
  }
  
  results.year = yearMatch[1];
  
  // Regex to match transaction lines - handle nested parentheses and tabs
  const transactionRegex = new RegExp(
    `Gen Con Indy ${results.year} - Ticket (Purchase|Return) - ([A-Z0-9]+) \\((.+?)\\)\\t([^\\t]+)\\t\\$([0-9.]+)`,
    'g'
  );

  let match;
  while ((match = transactionRegex.exec(text)) !== null) {
    const [, type, eventId, description, recipient, amount] = match;
    
    results.transactions.push({
      eventId: eventId.trim(),
      recipient: recipient.trim(),
      amount: amount.trim(),
      type: type.toLowerCase() === 'purchase' ? 'purchase' : 'refund',
      description: description.trim()
    });
  }

  if (results.transactions.length === 0) {
    results.errors.push('No transaction lines found. Please check the format of your pasted data.');
  }

  return results;
}

describe('Transaction Parser', () => {
  describe('parseTransactionData', () => {
    const samplePurchaseData = `Transaction: 2025/05/18 12:44 PM
Description	Recipient	Amount
Gen Con Indy 2025 - Ticket Purchase - RPG25ND286543 (The (In)glorious Birth of New Kor'ak on Thursday, 2:00 PM EDT)	Hannah Episcopia	$4.00
Gen Con Indy 2025 - Ticket Purchase - NMN25ND286148 (Horus Heresy: The Age of Darkness! on Saturday, 11:00 AM EDT)	Peter Casey	$2.00`;

    const sampleRefundData = `Transaction: 2025/06/08 05:04 PM
Description	Recipient	Amount
Gen Con Indy 2025 - Ticket Return - RPG25ND286543 (The (In)glorious Birth of New Kor'ak on Thursday, 2:00 PM EDT)	Hannah Episcopia	$4.00
Gen Con Indy 2025 - Ticket Return - NMN25ND286148 (Horus Heresy: The Age of Darkness! on Saturday, 11:00 AM EDT)	Peter Casey	$2.00`;

    const mixedTransactionData = `Transaction: 2025/06/08 05:04 PM
Description	Recipient	Amount
Gen Con Indy 2025 - Ticket Return - RPG25ND286543 (The (In)glorious Birth of New Kor'ak on Thursday, 2:00 PM EDT)	Hannah Episcopia	$4.00
Gen Con Indy 2025 - Ticket Purchase - RPG25ND272304 (The Rebellion Awakens on Saturday, 2:00 PM EDT)	Peter Casey	$4.00
Gen Con Indy 2025 - Ticket Return - NMN25ND286148 (Horus Heresy: The Age of Darkness! on Saturday, 11:00 AM EDT)	David Farago	$2.00`;

    it('should extract the correct GenCon year', () => {
      const result = parseTransactionData(samplePurchaseData);
      expect(result.year).toBe('2025');
      expect(result.errors).toHaveLength(0);
    });

    it('should parse purchase transactions correctly', () => {
      const result = parseTransactionData(samplePurchaseData);
      
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]).toEqual({
        eventId: 'RPG25ND286543',
        recipient: 'Hannah Episcopia',
        amount: '4.00',
        type: 'purchase',
        description: "The (In)glorious Birth of New Kor'ak on Thursday, 2:00 PM EDT"
      });
      expect(result.transactions[1]).toEqual({
        eventId: 'NMN25ND286148',
        recipient: 'Peter Casey',
        amount: '2.00',
        type: 'purchase',
        description: "Horus Heresy: The Age of Darkness! on Saturday, 11:00 AM EDT"
      });
    });

    it('should parse refund transactions correctly', () => {
      const result = parseTransactionData(sampleRefundData);
      
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]).toEqual({
        eventId: 'RPG25ND286543',
        recipient: 'Hannah Episcopia',
        amount: '4.00',
        type: 'refund',
        description: "The (In)glorious Birth of New Kor'ak on Thursday, 2:00 PM EDT"
      });
      expect(result.transactions[1]).toEqual({
        eventId: 'NMN25ND286148',
        recipient: 'Peter Casey',
        amount: '2.00',
        type: 'refund',
        description: "Horus Heresy: The Age of Darkness! on Saturday, 11:00 AM EDT"
      });
    });

    it('should parse mixed purchase and refund transactions', () => {
      const result = parseTransactionData(mixedTransactionData);
      
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].type).toBe('refund');
      expect(result.transactions[1].type).toBe('purchase');
      expect(result.transactions[2].type).toBe('refund');
    });

    it('should handle nested parentheses in descriptions', () => {
      const result = parseTransactionData(samplePurchaseData);
      
      expect(result.transactions[0].description).toBe("The (In)glorious Birth of New Kor'ak on Thursday, 2:00 PM EDT");
    });

    it('should handle various event ID formats', () => {
      const eventData = `Transaction: 2025/05/18 12:44 PM
Description	Recipient	Amount
Gen Con Indy 2025 - Ticket Purchase - ABC123 (Test Event)	John Doe	$5.00
Gen Con Indy 2025 - Ticket Purchase - XYZ25ND999888 (Another Test)	Jane Smith	$10.00`;

      const result = parseTransactionData(eventData);
      
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].eventId).toBe('ABC123');
      expect(result.transactions[1].eventId).toBe('XYZ25ND999888');
    });

    it('should handle different price formats', () => {
      const priceData = `Transaction: 2025/05/18 12:44 PM
Description	Recipient	Amount
Gen Con Indy 2025 - Ticket Purchase - EVENT1 (Test Event)	John Doe	$5.00
Gen Con Indy 2025 - Ticket Purchase - EVENT2 (Another Test)	Jane Smith	$48.00
Gen Con Indy 2025 - Ticket Purchase - EVENT3 (Expensive Event)	Bob Wilson	$100.50`;

      const result = parseTransactionData(priceData);
      
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].amount).toBe('5.00');
      expect(result.transactions[1].amount).toBe('48.00');
      expect(result.transactions[2].amount).toBe('100.50');
    });

    it('should return error when no GenCon year found', () => {
      const invalidData = `Transaction: 2025/05/18 12:44 PM
Description	Recipient	Amount
Some other event - Ticket Purchase - EVENT1 (Test)	John Doe	$5.00`;

      const result = parseTransactionData(invalidData);
      
      expect(result.year).toBe('');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toContain('Could not find GenCon year in transaction data');
    });

    it('should return error when no transaction lines found', () => {
      const noTransactionsData = `Transaction: 2025/05/18 12:44 PM
Description	Recipient	Amount
Gen Con Indy 2025 - Some other format	John Doe	$5.00`;

      const result = parseTransactionData(noTransactionsData);
      
      expect(result.year).toBe('2025');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toContain('No transaction lines found. Please check the format of your pasted data.');
    });

    it('should handle empty input', () => {
      const result = parseTransactionData('');
      
      expect(result.year).toBe('');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toContain('Could not find GenCon year in transaction data');
    });

    it('should handle malformed transaction lines gracefully', () => {
      const malformedData = `Transaction: 2025/05/18 12:44 PM
Description	Recipient	Amount
Gen Con Indy 2025 - Ticket Purchase - EVENT1 (Test Event)	John Doe	$5.00
Gen Con Indy 2025 - Malformed line without proper format
Gen Con Indy 2025 - Ticket Return - EVENT2 (Another Event)	Jane Smith	$10.00`;

      const result = parseTransactionData(malformedData);
      
      // Should parse the valid lines and ignore malformed ones
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].eventId).toBe('EVENT1');
      expect(result.transactions[1].eventId).toBe('EVENT2');
    });

    it('should correctly identify Purchase vs Return types', () => {
      const typeTestData = `Transaction: 2025/05/18 12:44 PM
Description	Recipient	Amount
Gen Con Indy 2025 - Ticket Purchase - EVENT1 (Test)	John Doe	$5.00
Gen Con Indy 2025 - Ticket Return - EVENT2 (Test)	Jane Smith	$10.00`;

      const result = parseTransactionData(typeTestData);
      
      expect(result.transactions[0].type).toBe('purchase');
      expect(result.transactions[1].type).toBe('refund');
    });

    it('should handle special characters in names and descriptions', () => {
      const specialCharsData = `Transaction: 2025/05/18 12:44 PM
Description	Recipient	Amount
Gen Con Indy 2025 - Ticket Purchase - EVENT1 (Test with "quotes" & symbols!)	O'Connor, Mary-Jane	$5.00`;

      const result = parseTransactionData(specialCharsData);
      
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].recipient).toBe("O'Connor, Mary-Jane");
      expect(result.transactions[0].description).toBe('Test with "quotes" & symbols!');
    });
  });
});