export interface RefundTicket {
  id: string;
  eventId: string;
  eventName: string;
  recipient: string;
  purchaser: string;
  createdAt: string;
  needsRefund?: boolean;
  isRefunded?: boolean;
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

export interface PurchasedTicketsResponse {
  tickets: RefundTicket[];
}

export class RefundService {
  // Get all tickets that need refunds
  static async getRefundTickets(): Promise<RefundTicketsResponse> {
    const response = await fetch('/api/refunds');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load refund tickets');
    }
    
    return data;
  }

  // Parse tickets from GenCon purchase text
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

  // Mark a ticket as refunded
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

  // Get all purchased tickets (admin only)
  static async getAllPurchasedTickets(): Promise<PurchasedTicketsResponse> {
    const response = await fetch('/api/refunds/all-tickets');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch all tickets');
    }
    
    return data;
  }

  // Get purchased tickets for current user
  static async getUserPurchasedTickets(): Promise<PurchasedTicketsResponse> {
    const response = await fetch('/api/refunds/user-tickets');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch user tickets');
    }
    
    return data;
  }

  // Delete a purchased ticket (admin only)
  static async deletePurchasedTicket(ticketId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/refunds/delete/${ticketId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete ticket');
    }

    return data;
  }

  // Get refund statistics
  static async getRefundStats(): Promise<{
    totalTickets: number;
    refundedTickets: number;
    pendingRefunds: number;
    refundRate: number;
  }> {
    const response = await fetch('/api/refunds/stats');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch refund statistics');
    }
    
    return data;
  }

  // Bulk mark tickets as refunded (admin only)
  static async bulkMarkRefunded(ticketIds: string[]): Promise<MarkRefundedResponse> {
    const response = await fetch('/api/refunds/bulk-refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ticketIds }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to bulk mark tickets as refunded');
    }

    return data;
  }

  // Export refund data (admin only)
  static async exportRefundData(format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const response = await fetch(`/api/refunds/export?format=${format}`);
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to export refund data');
    }
    
    return await response.blob();
  }
}