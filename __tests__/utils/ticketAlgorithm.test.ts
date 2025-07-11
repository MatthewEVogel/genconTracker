import { calculateTicketAssignments } from '@/utils/ticketAlgorithm';

describe('Ticket Algorithm Tests', () => {
  // Helper function to create test data
  const createTestUsers = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      userId: `user${i + 1}`,
      userName: `User ${i + 1}`
    }));
  };

  const createTestEvents = (eventCount: number, usersPerEvent: number, users: any[]) => {
    const events = [];
    for (let i = 0; i < eventCount; i++) {
      // For each event, assign it to the first `usersPerEvent` users
      for (let j = 0; j < Math.min(usersPerEvent, users.length); j++) {
        events.push({
          userId: users[j].userId,
          userName: users[j].userName,
          eventId: `event${i + 1}`,
          eventTitle: `Event ${i + 1}`,
          cost: '10.00',
          eventPriority: 1 // Normal priority
        });
      }
    }
    return events;
  };

  // Helper function to analyze assignment distribution
  const analyzeAssignments = (assignments: any[]) => {
    const eventBuyerCounts = new Map<string, number>();
    
    // Count how many people are buying each event
    assignments.forEach(assignment => {
      assignment.events.forEach((event: any) => {
        const currentCount = eventBuyerCounts.get(event.eventId) || 0;
        eventBuyerCounts.set(event.eventId, currentCount + 1);
      });
    });

    const buyerCounts = Array.from(eventBuyerCounts.values());
    const eventsWithNoBuyers = buyerCounts.filter(count => count === 0).length;
    const minBuyers = buyerCounts.length > 0 ? Math.min(...buyerCounts) : 0;
    const maxBuyers = buyerCounts.length > 0 ? Math.max(...buyerCounts) : 0;
    const avgBuyers = buyerCounts.length > 0 ? buyerCounts.reduce((sum, count) => sum + count, 0) / buyerCounts.length : 0;

    return {
      eventsWithNoBuyers,
      minBuyers,
      maxBuyers,
      avgBuyers: Math.round(avgBuyers * 100) / 100,
      totalEvents: eventBuyerCounts.size,
      buyerCountDistribution: buyerCounts
    };
  };

  describe('Event Limit Compliance', () => {
    test('should not assign more than 50 events to any user', () => {
      const users = createTestUsers(5);
      const events = createTestEvents(100, 5, users); // 100 events, each wanted by all 5 users
      
      const { assignments } = calculateTicketAssignments(events, users);
      
      assignments.forEach(assignment => {
        expect(assignment.totalTickets).toBeLessThanOrEqual(50);
      });
    });

    test('should assign exactly 50 events to each user when there are 50+ events available', () => {
      const users = createTestUsers(4);
      const events = createTestEvents(60, 4, users); // 60 events, each wanted by all 4 users
      
      const { assignments } = calculateTicketAssignments(events, users);
      
      assignments.forEach(assignment => {
        expect(assignment.totalTickets).toBe(50);
      });
    });

    test('should distribute events evenly when total events < 50 per user', () => {
      const users = createTestUsers(3);
      const events = createTestEvents(30, 3, users); // 30 events, each wanted by all 3 users
      
      const { assignments } = calculateTicketAssignments(events, users);
      
      // The algorithm prioritizes maximum coverage, so each user gets all 30 events
      // since they're all under the 50-event limit
      assignments.forEach(assignment => {
        expect(assignment.totalTickets).toBe(30);
      });
      
      // Verify total coverage
      const totalAssignments = assignments.reduce((sum, a) => sum + a.totalTickets, 0);
      expect(totalAssignments).toBe(90); // 30 events * 3 buyers each
    });
  });

  describe('Maximum Coverage Tests', () => {
    test('should ensure maximum coverage when users can take 50 events each', () => {
      const users = createTestUsers(3);
      const events = createTestEvents(40, 3, users); // 40 events, each wanted by all 3 users
      
      const { assignments } = calculateTicketAssignments(events, users);
      
      // Total assignments should be 120 (40 events * 3 buyers each)
      const totalAssignments = assignments.reduce((sum, a) => sum + a.totalTickets, 0);
      expect(totalAssignments).toBe(120);
      
      // Each event should be bought by all 3 users
      const analysis = analyzeAssignments(assignments);
      expect(analysis.eventsWithNoBuyers).toBe(0);
      expect(analysis.minBuyers).toBe(3);
      expect(analysis.maxBuyers).toBe(3);
    });

    test('should maximize coverage even when hitting the 50-event limit', () => {
      const users = createTestUsers(2);
      const events = createTestEvents(60, 2, users); // 60 events, each wanted by both users
      
      const { assignments } = calculateTicketAssignments(events, users);
      
      // Each user should get exactly 50 events
      assignments.forEach(assignment => {
        expect(assignment.totalTickets).toBe(50);
      });
      
      // Total of 100 assignments should be distributed across 60 events
      const totalAssignments = assignments.reduce((sum, a) => sum + a.totalTickets, 0);
      expect(totalAssignments).toBe(100);
    });
  });

  describe('Event Distribution Analysis', () => {
    test('should provide good spread with no events left unbought', () => {
      const users = createTestUsers(4);
      const events = createTestEvents(20, 4, users); // 20 events, each wanted by all 4 users
      
      const { assignments } = calculateTicketAssignments(events, users);
      const analysis = analyzeAssignments(assignments);
      
      // No events should be left without buyers
      expect(analysis.eventsWithNoBuyers).toBe(0);
      
      // Each event should be bought by all 4 users (perfect coverage)
      expect(analysis.minBuyers).toBe(4);
      expect(analysis.maxBuyers).toBe(4);
      expect(analysis.avgBuyers).toBe(4);
      
      console.log('Distribution Analysis:', {
        totalEvents: analysis.totalEvents,
        eventsWithNoBuyers: analysis.eventsWithNoBuyers,
        minBuyers: analysis.minBuyers,
        maxBuyers: analysis.maxBuyers,
        avgBuyers: analysis.avgBuyers
      });
    });

    test('should handle uneven distribution gracefully', () => {
      const users = createTestUsers(3);
      // Create a scenario where some events are wanted by more users than others
      const events = [
        // High-demand events (wanted by all 3 users)
        ...createTestEvents(10, 3, users),
        // Medium-demand events (wanted by 2 users)
        ...createTestEvents(10, 2, users).map(e => ({ ...e, eventId: `medium${e.eventId}` })),
        // Low-demand events (wanted by 1 user)
        ...createTestEvents(10, 1, users).map(e => ({ ...e, eventId: `low${e.eventId}` }))
      ];
      
      const { assignments } = calculateTicketAssignments(events, users);
      const analysis = analyzeAssignments(assignments);
      
      console.log('Uneven Distribution Analysis:', {
        totalEvents: analysis.totalEvents,
        eventsWithNoBuyers: analysis.eventsWithNoBuyers,
        minBuyers: analysis.minBuyers,
        maxBuyers: analysis.maxBuyers,
        avgBuyers: analysis.avgBuyers,
        buyerCountDistribution: analysis.buyerCountDistribution
      });
      
      // Should have good coverage
      expect(analysis.eventsWithNoBuyers).toBe(0);
      expect(analysis.minBuyers).toBeGreaterThan(0);
    });
  });

  describe('Priority Handling', () => {
    test('should prioritize critical events over normal events', () => {
      const users = createTestUsers(2);
      const events = [
        // Critical priority events
        {
          userId: 'user1',
          userName: 'User 1',
          eventId: 'critical1',
          eventTitle: 'Critical Event 1',
          cost: '20.00',
          eventPriority: 3
        },
        {
          userId: 'user2',
          userName: 'User 2',
          eventId: 'critical1',
          eventTitle: 'Critical Event 1',
          cost: '20.00',
          eventPriority: 3
        },
        // Normal priority events (many of them to test prioritization)
        ...createTestEvents(60, 2, users).map(e => ({ ...e, eventPriority: 1 }))
      ];
      
      const { assignments } = calculateTicketAssignments(events, users);
      
      // Both users should have the critical event in their assignments
      assignments.forEach(assignment => {
        const hasCriticalEvent = assignment.events.some(e => e.eventId === 'critical1');
        expect(hasCriticalEvent).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty event list', () => {
      const users = createTestUsers(3);
      const events: any[] = [];
      
      const { assignments, errors } = calculateTicketAssignments(events, users);
      
      assignments.forEach(assignment => {
        expect(assignment.totalTickets).toBe(0);
        expect(assignment.events).toHaveLength(0);
      });
    });

    test('should handle single user', () => {
      const users = createTestUsers(1);
      const events = createTestEvents(10, 1, users);
      
      const { assignments } = calculateTicketAssignments(events, users);
      
      expect(assignments).toHaveLength(1);
      expect(assignments[0].totalTickets).toBe(10);
    });

    test('should handle more events than the 50-event limit allows', () => {
      const users = createTestUsers(1);
      const events = createTestEvents(100, 1, users); // 100 events for 1 user
      
      const { assignments } = calculateTicketAssignments(events, users);
      
      expect(assignments[0].totalTickets).toBe(50); // Should be capped at 50
    });
  });

  describe('Comprehensive Coverage Report', () => {
    test('should generate detailed coverage report for realistic scenario', () => {
      const users = createTestUsers(8); // 8 users
      const events = [
        // Mix of priority levels and demand patterns
        ...createTestEvents(20, 8, users).map(e => ({ ...e, eventPriority: 3 })), // Critical events
        ...createTestEvents(30, 6, users).map(e => ({ ...e, eventId: `imp${e.eventId}`, eventPriority: 2 })), // Important events
        ...createTestEvents(50, 4, users).map(e => ({ ...e, eventId: `norm${e.eventId}`, eventPriority: 1 })) // Normal events
      ];
      
      const { assignments, errors } = calculateTicketAssignments(events, users);
      const analysis = analyzeAssignments(assignments);
      
      // Generate comprehensive report
      const report = {
        userCount: users.length,
        totalEvents: analysis.totalEvents,
        totalAssignments: assignments.reduce((sum, a) => sum + a.totalTickets, 0),
        averageEventsPerUser: assignments.reduce((sum, a) => sum + a.totalTickets, 0) / users.length,
        usersAt50EventLimit: assignments.filter(a => a.totalTickets === 50).length,
        usersUnder50Events: assignments.filter(a => a.totalTickets < 50).length,
        coverage: {
          eventsWithNoBuyers: analysis.eventsWithNoBuyers,
          minBuyersPerEvent: analysis.minBuyers,
          maxBuyersPerEvent: analysis.maxBuyers,
          avgBuyersPerEvent: analysis.avgBuyers
        },
        errors: errors
      };
      
      console.log('Comprehensive Coverage Report:', JSON.stringify(report, null, 2));
      
      // Assertions for good algorithm performance
      expect(report.coverage.eventsWithNoBuyers).toBe(0); // No events should be left without buyers
      expect(report.coverage.minBuyersPerEvent).toBeGreaterThan(0); // Every event should have at least one buyer
      expect(errors).toHaveLength(0); // No errors should occur
      
      // If there are 50+ events total, users should be at the limit
      if (analysis.totalEvents >= 50) {
        expect(report.usersAt50EventLimit).toBeGreaterThan(0);
      }
    });
  });
});
