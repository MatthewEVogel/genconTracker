export interface RefundedEvent {
  id: string;
  userName: string;
  ticketId: string;
  ticket?: {
    id: string;
    eventId: string;
    recipient: string;
    purchaser: string;
  };
}

export interface CreateRefundedEventData {
  userName: string;
  ticketId: string;
}

export interface RefundedEventsResponse {
  refundedEvents: RefundedEvent[];
}

export interface RefundedEventResponse {
  refundedEvent: RefundedEvent;
}

export interface RefundedEventsSummary {
  totalRefunds: number;
  uniqueUsers: number;
  uniqueTickets: number;
  recentRefunds: RefundedEvent[];
}

export class RefundedEventsService {
  // Get all refunded events
  static async getAllRefundedEvents(includeDetails?: boolean): Promise<RefundedEventsResponse> {
    const params = includeDetails ? '?includeDetails=true' : '';
    const response = await fetch(`/api/refunded-events${params}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load refunded events');
    }
    
    return data;
  }

  // Get refunded events by user name
  static async getRefundedEventsByUserName(userName: string, includeDetails?: boolean): Promise<RefundedEventsResponse> {
    const params = includeDetails ? '?includeDetails=true' : '';
    const response = await fetch(`/api/refunded-events/user/${userName}${params}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load user refunded events');
    }
    
    return data;
  }

  // Get refunded events by ticket ID
  static async getRefundedEventsByTicketId(ticketId: string, includeDetails?: boolean): Promise<RefundedEventsResponse> {
    const params = includeDetails ? '?includeDetails=true' : '';
    const response = await fetch(`/api/refunded-events/ticket/${ticketId}${params}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load ticket refunded events');
    }
    
    return data;
  }

  // Create a new refunded event record
  static async createRefundedEvent(data: CreateRefundedEventData): Promise<RefundedEventResponse> {
    const response = await fetch('/api/refunded-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create refunded event');
    }

    return result;
  }

  // Delete a refunded event record
  static async deleteRefundedEvent(refundedEventId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/refunded-events/${refundedEventId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete refunded event');
    }

    return data;
  }

  // Check if a ticket is refunded for a specific user
  static async isTicketRefunded(userName: string, ticketId: string): Promise<{ isRefunded: boolean }> {
    const response = await fetch(`/api/refunded-events/check/${userName}/${ticketId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to check refund status');
    }
    
    return data;
  }

  // Get a specific refunded event record
  static async getRefundedEvent(userName: string, ticketId: string): Promise<{ refundedEvent: RefundedEvent | null }> {
    const response = await fetch(`/api/refunded-events/get/${userName}/${ticketId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get refunded event');
    }
    
    return data;
  }

  // Get refunded events summary statistics
  static async getRefundedEventsSummary(): Promise<RefundedEventsSummary> {
    const response = await fetch('/api/refunded-events/summary');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch refunded events summary');
    }
    
    return data;
  }

  // Get count of refunded events by user
  static async getRefundedEventsCountByUser(userName: string): Promise<{ count: number }> {
    const response = await fetch(`/api/refunded-events/count/user/${userName}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get user refund count');
    }
    
    return data;
  }
}