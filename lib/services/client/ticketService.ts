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
  purchasedEvents: PurchasedEvent[];
}

export interface DeleteTicketResponse {
  message: string;
  purchasedEvents: PurchasedEvent[];
}

export class TicketService {
  // Get all purchased events
  static async getAllPurchasedEvents(): Promise<PurchasedEventsResponse> {
    const response = await fetch('/api/tickets/all');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load purchased events');
    }
    
    return data;
  }

  // Parse tickets from GenCon purchase text
  static async parseTickets(text: string): Promise<ParseTicketsResponse> {
    const response = await fetch('/api/tickets/parse', {
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

  // Get purchased events for current user
  static async getUserPurchasedEvents(): Promise<PurchasedEventsResponse> {
    const response = await fetch('/api/tickets/user');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch user events');
    }
    
    return data;
  }

  // Delete a purchased event (admin only)
  static async deletePurchasedEvent(eventId: string): Promise<DeleteTicketResponse> {
    const response = await fetch(`/api/tickets/delete/${eventId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete event');
    }

    return data;
  }

  // Get purchased events by event ID
  static async getPurchasedEventsByEventId(eventId: string): Promise<PurchasedEventsResponse> {
    const response = await fetch(`/api/tickets/event/${eventId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch events by event ID');
    }
    
    return data;
  }

  // Get summary statistics
  static async getPurchasesSummary(): Promise<{
    totalPurchases: number;
    uniqueEvents: number;
    uniquePurchasers: number;
    uniqueRecipients: number;
  }> {
    const response = await fetch('/api/tickets/stats');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch purchase statistics');
    }
    
    return data;
  }

  // Export purchase data (admin only)
  static async exportPurchaseData(format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const response = await fetch(`/api/tickets/export?format=${format}`);
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to export purchase data');
    }
    
    return await response.blob();
  }
}