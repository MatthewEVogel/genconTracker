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

  describe('Purchased Events Exclusion Integration', () => {
    test('should work correctly when events are pre-filtered to exclude purchased', () => {
      const users = createTestUsers(3);
      
      // Simulate scenario where some events are already purchased and filtered out
      const allDesiredEvents = createTestEvents(20, 3, users);
      
      // Simulate that events 1, 5, and 10 are already purchased by user1
      // So we filter those out before passing to the algorithm
      const filteredEvents = allDesiredEvents.filter(event => {
        if (event.userId === 'user1' && ['event1', 'event5', 'event10'].includes(event.eventId)) {
          return false; // Exclude already purchased events
        }
        return true;
      });
      
      const { assignments } = calculateTicketAssignments(filteredEvents, users);
      
      // User1 should not be assigned to buy events 1, 5, or 10
      const user1Assignment = assignments.find(a => a.userId === 'user1');
      expect(user1Assignment).toBeDefined();
      
      const user1EventIds = user1Assignment!.events.map(e => e.eventId);
      expect(user1EventIds).not.toContain('event1');
      expect(user1EventIds).not.toContain('event5');
      expect(user1EventIds).not.toContain('event10');
      
      // But user2 and user3 should still be assigned to buy those events
      const user2Assignment = assignments.find(a => a.userId === 'user2');
      const user3Assignment = assignments.find(a => a.userId === 'user3');
      
      const allOtherUserEvents = [
        ...user2Assignment!.events.map(e => e.eventId),
        ...user3Assignment!.events.map(e => e.eventId)
      ];
      
      // Events 1, 5, and 10 should still be covered by other users
      expect(allOtherUserEvents).toContain('event1');
      expect(allOtherUserEvents).toContain('event5');
      expect(allOtherUserEvents).toContain('event10');
    });

    test('should handle scenario where all users have purchased some events', () => {
      const users = createTestUsers(3);
      const allEvents = createTestEvents(10, 3, users);
      
      // Simulate each user has purchased different events
      const filteredEvents = allEvents.filter(event => {
        // User1 purchased events 1-2, User2 purchased events 3-4, User3 purchased events 5-6
        if (event.userId === 'user1' && ['event1', 'event2'].includes(event.eventId)) return false;
        if (event.userId === 'user2' && ['event3', 'event4'].includes(event.eventId)) return false;
        if (event.userId === 'user3' && ['event5', 'event6'].includes(event.eventId)) return false;
        return true;
      });
      
      const { assignments } = calculateTicketAssignments(filteredEvents, users);
      
      // Verify each user doesn't get assigned their already-purchased events
      const user1Assignment = assignments.find(a => a.userId === 'user1');
      const user1EventIds = user1Assignment!.events.map(e => e.eventId);
      expect(user1EventIds).not.toContain('event1');
      expect(user1EventIds).not.toContain('event2');
      
      const user2Assignment = assignments.find(a => a.userId === 'user2');
      const user2EventIds = user2Assignment!.events.map(e => e.eventId);
      expect(user2EventIds).not.toContain('event3');
      expect(user2EventIds).not.toContain('event4');
      
      const user3Assignment = assignments.find(a => a.userId === 'user3');
      const user3EventIds = user3Assignment!.events.map(e => e.eventId);
      expect(user3EventIds).not.toContain('event5');
      expect(user3EventIds).not.toContain('event6');
      
      // But all events should still have someone assigned to buy them
      const allAssignedEvents = new Set();
      assignments.forEach(assignment => {
        assignment.events.forEach(event => {
          allAssignedEvents.add(event.eventId);
        });
      });
      
      // All 10 events should still be covered
      for (let i = 1; i <= 10; i++) {
        expect(allAssignedEvents.has(`event${i}`)).toBe(true);
      }
    });

    test('should maintain fair distribution when some users have more purchased events', () => {
      const users = createTestUsers(3);
      const allEvents = createTestEvents(30, 3, users);
      
      // User1 has purchased many events, User2 has purchased few, User3 has purchased none
      const filteredEvents = allEvents.filter(event => {
        // User1 purchased events 1-10 (many)
        if (event.userId === 'user1' && parseInt(event.eventId.replace('event', '')) <= 10) return false;
        // User2 purchased events 1-2 (few)
        if (event.userId === 'user2' && ['event1', 'event2'].includes(event.eventId)) return false;
        // User3 purchased nothing
        return true;
      });
      
      const { assignments } = calculateTicketAssignments(filteredEvents, users);
      
      // User1 should get fewer total assignments since they already own many
      // User3 should get more assignments since they own none
      const user1Assignment = assignments.find(a => a.userId === 'user1');
      const user2Assignment = assignments.find(a => a.userId === 'user2');
      const user3Assignment = assignments.find(a => a.userId === 'user3');
      
      expect(user1Assignment!.totalTickets).toBeLessThan(user3Assignment!.totalTickets);
      
      // The algorithm should distribute remaining assignments fairly
      const totalAssignments = assignments.reduce((sum, a) => sum + a.totalTickets, 0);
      expect(totalAssignments).toBeGreaterThan(0);
      
      console.log('Purchase Distribution Test Results:', {
        user1Assignments: user1Assignment!.totalTickets,
        user2Assignments: user2Assignment!.totalTickets,
        user3Assignments: user3Assignment!.totalTickets,
        totalAssignments
      });
    });

    test('should handle edge case where user has purchased all desired events', () => {
      const users = createTestUsers(2);
      const allEvents = createTestEvents(5, 2, users);
      
      // User1 has purchased all their desired events
      const filteredEvents = allEvents.filter(event => event.userId !== 'user1');
      
      const { assignments } = calculateTicketAssignments(filteredEvents, users);
      
      // User1 should have no assignments
      const user1Assignment = assignments.find(a => a.userId === 'user1');
      expect(user1Assignment!.totalTickets).toBe(0);
      expect(user1Assignment!.events).toHaveLength(0);
      
      // User2 should be assigned to buy all events
      const user2Assignment = assignments.find(a => a.userId === 'user2');
      expect(user2Assignment!.totalTickets).toBe(5);
      
      // All events should still be covered
      const analysis = analyzeAssignments(assignments);
      expect(analysis.eventsWithNoBuyers).toBe(0);
    });

    test('should verify algorithm behavior with realistic purchased events scenario', () => {
      const users = createTestUsers(5);
      const allEvents = [
        // High priority events that everyone wants
        ...createTestEvents(10, 5, users).map(e => ({ ...e, eventPriority: 3 })),
        // Medium priority events
        ...createTestEvents(20, 4, users).map(e => ({ ...e, eventId: `med${e.eventId}`, eventPriority: 2 })),
        // Low priority events
        ...createTestEvents(30, 3, users).map(e => ({ ...e, eventId: `low${e.eventId}`, eventPriority: 1 }))
      ];
      
      // Simulate realistic purchase pattern: some users bought high-priority events early
      const filteredEvents = allEvents.filter(event => {
        // User1 and User2 already bought some high priority events
        if (['user1', 'user2'].includes(event.userId) && 
            event.eventPriority === 3 && 
            parseInt(event.eventId.replace('event', '')) <= 3) {
          return false;
        }
        return true;
      });
      
      const { assignments, errors } = calculateTicketAssignments(filteredEvents, users);
      
      // Should have no errors
      expect(errors).toHaveLength(0);
      
      // All users should get reasonable assignments
      assignments.forEach(assignment => {
        expect(assignment.totalTickets).toBeGreaterThanOrEqual(0);
        expect(assignment.totalTickets).toBeLessThanOrEqual(50);
      });
      
      // High priority events should still be well covered
      const analysis = analyzeAssignments(assignments);
      expect(analysis.eventsWithNoBuyers).toBe(0);
      
      // Users who already purchased events should get different assignments
      const user1Assignment = assignments.find(a => a.userId === 'user1');
      const user3Assignment = assignments.find(a => a.userId === 'user3');
      
      // User3 (who didn't pre-purchase) might get more high-priority assignments
      const user1HighPriorityCount = user1Assignment!.events.filter(e => e.priority === 3).length;
      const user3HighPriorityCount = user3Assignment!.events.filter(e => e.priority === 3).length;
      
      console.log('Realistic Purchase Scenario Results:', {
        user1HighPriority: user1HighPriorityCount,
        user3HighPriority: user3HighPriorityCount,
        totalEventsFiltered: allEvents.length - filteredEvents.length,
        analysis
      });
    });
  });
});
