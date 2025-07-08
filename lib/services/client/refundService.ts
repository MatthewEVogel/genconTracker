export interface RefundTicket {
  id: string;
  eventId: string;
  eventName: string;
  recipient: string;
  purchaser: string;
  createdAt: string;
}

export interface RefundTicketsResponse {
  refundTickets: RefundTicket[];
}

export interface ParseTicketsResponse {
  message: string;
  ticketsAdded: number;
  refundTickets: RefundTicket[];
}

export interface MarkRefundedResponse {
  message: string;
  refundTickets: RefundTicket[];
}

export class RefundService {
  static async getRefundTickets(): Promise<RefundTicketsResponse> {
    const response = await fetch('/api/refunds');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load refund tickets');
    }
    
    return data;
  }

  static async parseTickets(text: string): Promise<ParseTicketsResponse> {
    const response = await fetch('/api/refunds/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to parse tickets');
    }

    return data;
  }

  static async markTicketAsRefunded(ticketId: string): Promise<MarkRefundedResponse> {
    const response = await fetch(`/api/refunds/mark-refunded/${ticketId}`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to mark ticket as refunded');
    }

    return data;
  }
}