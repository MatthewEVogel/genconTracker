export interface PurchasedEvent {
  id: string;
  eventId: string;
  recipient: string;
  purchaser: string;
}

export interface PurchasedEventsResponse {
  purchasedEvents: PurchasedEvent[];
}

export interface ParseTicketsResponse {
  message: string;
  ticketsAdded: number;
  refundTickets: PurchasedEvent[];
}

export interface DeleteEventResponse {
  message: string;
  purchasedEvents: PurchasedEvent[];
}

export class RefundService {
  // Get all purchased events (backwards compatible method name)
  static async getRefundTickets(): Promise<PurchasedEventsResponse> {
    const response = await fetch('/api/refunds');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load purchased events');
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

  // Mark a purchased event as refunded (backwards compatible - actually deletes)
  static async markTicketAsRefunded(eventId: string): Promise<DeleteEventResponse> {
    const response = await fetch(`/api/refunds/mark-refunded/${eventId}`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete purchased event');
    }

    return data;
  }

  // Get all purchased events (admin only)
  static async getAllPurchasedEvents(): Promise<PurchasedEventsResponse> {
    const response = await fetch('/api/refunds/all-tickets');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch all events');
    }
    
    return data;
  }

  // Get purchased events for current user
  static async getUserPurchasedEvents(): Promise<PurchasedEventsResponse> {
    const response = await fetch('/api/refunds/user-tickets');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch user events');
    }
    
    return data;
  }

  // Delete a purchased event (admin only)
  static async deletePurchasedEvent(eventId: string): Promise<DeleteEventResponse> {
    const response = await fetch(`/api/refunds/delete/${eventId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete event');
    }

    return data;
  }

  // Get purchase statistics
  static async getPurchaseStats(): Promise<{
    totalPurchases: number;
    uniqueEvents: number;
    uniquePurchasers: number;
    uniqueRecipients: number;
  }> {
    const response = await fetch('/api/refunds/stats');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch purchase statistics');
    }
    
    return data;
  }

  // Bulk delete events (admin only)
  static async bulkDeleteEvents(eventIds: string[]): Promise<DeleteEventResponse> {
    const response = await fetch('/api/refunds/bulk-refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventIds }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to bulk delete events');
    }

    return data;
  }

  // Export purchase data (admin only)
  static async exportPurchaseData(format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const response = await fetch(`/api/refunds/export?format=${format}`);
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to export purchase data');
    }
    
    return await response.blob();
  }
}