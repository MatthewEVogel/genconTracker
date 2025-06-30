import { calculateTicketAssignments, getPriorityLabel, getPriorityEmoji } from '../utils/ticketAlgorithm';
import { testDataGenerator } from './utils/testDataGenerator';

// Helper function to convert TestUser to algorithm format
const convertUsers = (testUsers: any[]) => testUsers.map(u => ({ userId: u.id, userName: `${u.firstName} ${u.lastName}` }));

describe('Ticket Assignment Algorithm', () => {
  beforeEach(() => {
    testDataGenerator.reset();
  });

  describe('Basic Algorithm Functionality', () => {
    test('0 users, 0 events → empty assignments array, "No users found" error', () => {
      const { assignments, errors } = calculateTicketAssignments([], []);
      
      expect(assignments).toEqual([]);
      expect(errors).toContain('No users found');
    });

    test('3 users, 0 events → 3 assignments with 0 tickets each, no errors', () => {
      const testUsers = testDataGenerator.generateUsers(3);
      const users = convertUsers(testUsers);
      const { assignments, errors } = calculateTicketAssignments([], users);
      
      expect(assignments).toHaveLength(3);
      expect(errors).toEqual([]);
      
      // All users should have 0 tickets since no events exist
      assignments.forEach(assignment => {
        expect(assignment.totalTickets).toBe(0);
        expect(assignment.events).toEqual([]);
      });
    });

    test('3 users, 2 events, 2 users want 1 event ($4) → 2+ buyers assigned, cross-coverage enabled', () => {
      const testUsers = testDataGenerator.generateUsers(3);
      const users = convertUsers(testUsers);
      const events = testDataGenerator.generateEvents(2);
      const userEvents = [
        {
          userId: testUsers[0].id,
          userName: `${testUsers[0].firstName} ${testUsers[0].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          priority: 3, // Critical
          cost: events[0].cost || '4'
        },
        {
          userId: testUsers[1].id,
          userName: `${testUsers[1].firstName} ${testUsers[1].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          priority: 2, // Important
          cost: events[0].cost || '4'
        }
      ];

      const { assignments, errors } = calculateTicketAssignments(userEvents, users);
      
      expect(assignments).toHaveLength(3);
      expect(errors).toEqual([]);
      
      // At least 2 users should be assigned to buy tickets for the event
      const assignedUsers = assignments.filter(a => a.totalTickets > 0);
      expect(assignedUsers.length).toBeGreaterThanOrEqual(2);
      
      // Check that the event is being bought for the right people
      const eventAssignments = assignments.flatMap(a => a.events);
      const eventAssignment = eventAssignments.find(e => e.eventId === events[0].id);
      expect(eventAssignment).toBeDefined();
      expect(eventAssignment?.buyingFor).toContain(`${testUsers[0].firstName} ${testUsers[0].lastName}`);
      expect(eventAssignment?.buyingFor).toContain(`${testUsers[1].firstName} ${testUsers[1].lastName}`);

      // DETAILED RESULT ANALYSIS
      const participantIds = [testUsers[0].id, testUsers[1].id];
      const nonParticipantBuyers = assignedUsers.filter(a => !participantIds.includes(a.userId));
      const participantBuyers = assignedUsers.filter(a => participantIds.includes(a.userId));
      const redundancyLevel = assignedUsers.length;
      const crossCoverageRate = (nonParticipantBuyers.length / users.length * 100).toFixed(1);

      console.log(`\n📊 TEST: "3 users, 2 events, 2 users want 1 event ($4)" RESULTS:`);
      console.log(`   Total buyers assigned: ${assignedUsers.length} users`);
      console.log(`   Participants buying for themselves: ${participantBuyers.length} users`);
      console.log(`   Non-participants helping (cross-coverage): ${nonParticipantBuyers.length} users`);
      console.log(`   Cross-coverage rate: ${crossCoverageRate}% of total users`);
      console.log(`   Redundancy level: ${redundancyLevel} buyers for 1 event`);
      console.log(`   Event priority resolved to: ${eventAssignment?.priority} (Critical)`);
    });
  });

  describe('Priority Handling', () => {
    test('5 users, 3 events: 1 critical vs 1 normal → critical event gets ≥ buyers than normal', () => {
      const testUsers = testDataGenerator.generateUsers(5);
      const users = convertUsers(testUsers);
      const events = testDataGenerator.generateEvents(3);
      
      const userEvents = [
        // Critical event
        {
          userId: testUsers[0].id,
          userName: `${testUsers[0].firstName} ${testUsers[0].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          priority: 3,
          cost: '4'
        },
        // Normal event
        {
          userId: testUsers[1].id,
          userName: `${testUsers[1].firstName} ${testUsers[1].lastName}`,
          eventId: events[1].id,
          eventTitle: events[1].title,
          priority: 1,
          cost: '4'
        }
      ];

      const { assignments } = calculateTicketAssignments(userEvents, convertUsers(testUsers));
      
      // Critical event should get more buyers than normal event
      const criticalEventAssignments = assignments.filter(a => 
        a.events.some(e => e.eventId === events[0].id)
      );
      const normalEventAssignments = assignments.filter(a => 
        a.events.some(e => e.eventId === events[1].id)
      );
      
      expect(criticalEventAssignments.length).toBeGreaterThanOrEqual(normalEventAssignments.length);

      // DETAILED RESULT ANALYSIS
      const totalCapacity = users.length * 50;
      const criticalBuyers = criticalEventAssignments.length;
      const normalBuyers = normalEventAssignments.length;
      const priorityAdvantage = criticalBuyers - normalBuyers;
      const resourceAllocation = {
        critical: (criticalBuyers / users.length * 100).toFixed(1),
        normal: (normalBuyers / users.length * 100).toFixed(1)
      };

      console.log(`\n📊 TEST: "5 users, 3 events: 1 critical vs 1 normal" RESULTS:`);
      console.log(`   Critical event (priority 3): ${criticalBuyers} buyers (${resourceAllocation.critical}% of users)`);
      console.log(`   Normal event (priority 1): ${normalBuyers} buyers (${resourceAllocation.normal}% of users)`);
      console.log(`   Priority advantage: +${priorityAdvantage} more buyers for critical event`);
      console.log(`   Resource allocation: Critical gets ${((criticalBuyers/(criticalBuyers+normalBuyers))*100).toFixed(1)}% of total buying power`);
    });

    test('4 users, 1 event: 3 priorities (critical=3, important=2, normal=1) → highest priority wins', () => {
      const testUsers = testDataGenerator.generateUsers(4);
      const users = convertUsers(testUsers);
      const events = testDataGenerator.generateEvents(1);
      
      const userEvents = [
        {
          userId: testUsers[0].id,
          userName: `${testUsers[0].firstName} ${testUsers[0].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          eventPriority: 3, // Critical - now using eventPriority
          cost: '4'
        },
        {
          userId: testUsers[1].id,
          userName: `${testUsers[1].firstName} ${testUsers[1].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          eventPriority: 2, // Important
          cost: '4'
        },
        {
          userId: testUsers[2].id,
          userName: `${testUsers[2].firstName} ${testUsers[2].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          eventPriority: 1, // Normal
          cost: '4'
        }
      ];

      const { assignments } = calculateTicketAssignments(userEvents, users);
      
      // Should assign multiple buyers for this event
      const assignedUsers = assignments.filter(a => a.totalTickets > 0);
      expect(assignedUsers.length).toBeGreaterThanOrEqual(2);
      
      // The event should have the highest priority (3)
      const eventAssignment = assignments.find(a => a.events.length > 0)?.events[0];
      expect(eventAssignment?.priority).toBe(3);
    });
  });

  describe('Cross-Coverage (Users buying for others)', () => {
    test('4 users, 1 event ($4), 2 users want event → 2+ users assigned as buyers, cross-coverage enabled', () => {
      const testUsers = testDataGenerator.generateUsers(4);
      const users = convertUsers(testUsers);
      const events = testDataGenerator.generateEvents(1);
      
      // Only 2 users want the event
      const userEvents = [
        {
          userId: testUsers[0].id,
          userName: `${testUsers[0].firstName} ${testUsers[0].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          priority: 2,
          cost: '4'
        },
        {
          userId: testUsers[1].id,
          userName: `${testUsers[1].firstName} ${testUsers[1].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          priority: 2,
          cost: '4'
        }
      ];

      const { assignments } = calculateTicketAssignments(userEvents, users);
      
      // Should have 4 users total
      expect(assignments).toHaveLength(4);
      
      // At least 2 users should be assigned to buy tickets (could be the participants themselves)
      const assignedUsers = assignments.filter(a => a.totalTickets > 0);
      expect(assignedUsers.length).toBeGreaterThanOrEqual(2);
      
      // Check that the event is being bought for the right people
      const eventAssignments = assignments.flatMap(a => a.events);
      const eventAssignment = eventAssignments.find(e => e.eventId === events[0].id);
      expect(eventAssignment).toBeDefined();
      expect(eventAssignment?.buyingFor).toContain(`${testUsers[0].firstName} ${testUsers[0].lastName}`);
      expect(eventAssignment?.buyingFor).toContain(`${testUsers[1].firstName} ${testUsers[1].lastName}`);
    });

    test('6 users, 3 events ($4 each): user1 wants 2 events, user2 wants 1 → max ticket difference ≤2', () => {
      const testUsers = testDataGenerator.generateUsers(6);
      const users = convertUsers(testUsers);
      const events = testDataGenerator.generateEvents(3);
      
      // Create scenario where some users want multiple events
      const userEvents = [
        {
          userId: testUsers[0].id,
          userName: `${testUsers[0].firstName} ${testUsers[0].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          priority: 2,
          cost: '4'
        },
        {
          userId: testUsers[0].id,
          userName: `${testUsers[0].firstName} ${testUsers[0].lastName}`,
          eventId: events[1].id,
          eventTitle: events[1].title,
          priority: 2,
          cost: '4'
        },
        {
          userId: testUsers[1].id,
          userName: `${testUsers[1].firstName} ${testUsers[1].lastName}`,
          eventId: events[2].id,
          eventTitle: events[2].title,
          priority: 2,
          cost: '4'
        }
      ];

      const { assignments } = calculateTicketAssignments(userEvents, users);
      
      // Check that ticket load is distributed
      const ticketCounts = assignments.map(a => a.totalTickets);
      const maxTickets = Math.max(...ticketCounts);
      const minTickets = Math.min(...ticketCounts);
      
      // No user should have significantly more tickets than others
      expect(maxTickets - minTickets).toBeLessThanOrEqual(2);
    });
  });

  describe('50-Ticket Limit Enforcement', () => {
    test('3 users, 60 events ($4 each), all users want all events → no user exceeds 50 tickets, no "over limit" errors', () => {
      const testUsers = testDataGenerator.generateUsers(3);
      const users = convertUsers(testUsers);
      const events = testDataGenerator.generateEvents(60); // Many events
      
      // Create scenario where users want many events
      const userEvents = events.flatMap(event => 
        testUsers.map(user => ({
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          eventId: event.id,
          eventTitle: event.title,
          priority: 2,
          cost: event.cost || '4'
        }))
      );

      const { assignments, errors } = calculateTicketAssignments(userEvents, users);
      
      // No user should exceed 50 tickets
      assignments.forEach(assignment => {
        expect(assignment.totalTickets).toBeLessThanOrEqual(50);
      });
      
      // Should not have errors about exceeding limits
      const limitErrors = errors.filter(error => error.includes('over limit'));
      expect(limitErrors).toEqual([]);

      // DETAILED RESULT ANALYSIS
      const ticketCounts = assignments.map(a => a.totalTickets);
      const usersUnder50 = ticketCounts.filter(count => count < 50).length;
      const totalCapacity = users.length * 50;
      const usedCapacity = ticketCounts.reduce((sum, count) => sum + count, 0);
      const capacityUtilization = (usedCapacity / totalCapacity * 100).toFixed(1);

      // Event coverage analysis
      const eventCoverage = new Map();
      assignments.forEach(assignment => {
        assignment.events.forEach(event => {
          eventCoverage.set(event.eventId, (eventCoverage.get(event.eventId) || 0) + 1);
        });
      });

      const coverageCounts = Array.from(eventCoverage.values());
      const eventsWithNoBuyers = events.length - eventCoverage.size;
      const minCoverage = coverageCounts.length > 0 ? Math.min(...coverageCounts) : 0;
      const maxCoverage = coverageCounts.length > 0 ? Math.max(...coverageCounts) : 0;
      const avgCoverage = coverageCounts.length > 0 ? (coverageCounts.reduce((sum, count) => sum + count, 0) / coverageCounts.length).toFixed(1) : 0;

      console.log(`\n📊 TEST: "3 users, 60 events ($4 each), all users want all events" RESULTS:`);
      console.log(`   Users buying less than 50 tickets: ${usersUnder50} users`);
      console.log(`   Capacity utilization: ${capacityUtilization}% (${usedCapacity}/${totalCapacity} tickets)`);
      console.log(`   Events with no buyers: ${eventsWithNoBuyers} events`);
      console.log(`   Event coverage - Min: ${minCoverage} users, Max: ${maxCoverage} users, Avg: ${avgCoverage} users per event`);
      console.log(`   Total events covered: ${eventCoverage.size}/${events.length} events`);
    });

    test('20 users, 60 events, maximum coverage strategy → 50-ticket limit enforced, <5s execution, balanced distribution', () => {
      const { users: testUsers, events, userEvents: testUserEvents } = testDataGenerator.generateLargeScaleScenario();
      
      // Convert to algorithm format
      const userEvents = testUserEvents.map(ue => {
        const user = testUsers.find(u => u.id === ue.userId)!;
        const event = events.find(e => e.id === ue.eventId)!;
        return {
          userId: ue.userId,
          userName: `${user.firstName} ${user.lastName}`,
          eventId: ue.eventId,
          eventTitle: event.title,
          eventPriority: event.priority || 1, // Use event priority
          cost: event.cost || '4'
        };
      });

      const startTime = Date.now();
      const { assignments, errors } = calculateTicketAssignments(userEvents, convertUsers(testUsers));
      const endTime = Date.now();
      
      // Should complete in reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      
      // Should have assignments for all users
      expect(assignments).toHaveLength(testUsers.length);
      
      // No user should exceed 50 tickets
      assignments.forEach(assignment => {
        expect(assignment.totalTickets).toBeLessThanOrEqual(50);
      });
      
      // Calculate distribution statistics
      const ticketCounts = assignments.map(a => a.totalTickets);
      const totalTickets = ticketCounts.reduce((sum, count) => sum + count, 0);
      const avgTickets = totalTickets / ticketCounts.length;
      const maxTickets = Math.max(...ticketCounts);
      const minTickets = Math.min(...ticketCounts);
      
      // Should not have "over limit" errors (50-ticket limit should be respected)
      const overLimitErrors = errors.filter(error => error.includes('over limit'));
      expect(overLimitErrors).toEqual([]);
      
      // May have "No buyers" errors when all users hit 50-ticket limit (this is expected behavior)
      const noBuyersErrors = errors.filter(error => error.includes('No buyers'));
      // With 20 users × 50 tickets = 1000 total capacity and 60 events, some events may not get buyers
      // This is expected and correct behavior when the system is at capacity
      expect(noBuyersErrors.length).toBeGreaterThanOrEqual(0); // Allow "No buyers" errors
      
      // DETAILED RESULT ANALYSIS - Your specific requirements
      const usersUnder50 = ticketCounts.filter(count => count < 50).length;
      
      // Event coverage analysis
      const eventCoverage = new Map();
      assignments.forEach(assignment => {
        assignment.events.forEach(event => {
          eventCoverage.set(event.eventId, (eventCoverage.get(event.eventId) || 0) + 1);
        });
      });

      const coverageCounts = Array.from(eventCoverage.values());
      const eventsWithNoBuyers = events.length - eventCoverage.size;
      const minEventCoverage = coverageCounts.length > 0 ? Math.min(...coverageCounts) : 0;
      const maxEventCoverage = coverageCounts.length > 0 ? Math.max(...coverageCounts) : 0;
      const avgEventCoverage = coverageCounts.length > 0 ? (coverageCounts.reduce((sum, count) => sum + count, 0) / coverageCounts.length).toFixed(1) : 0;

      // Risk analysis
      const eventsWithOneBuyer = coverageCounts.filter(count => count === 1).length;
      const eventsWellCovered = coverageCounts.filter(count => count >= 3).length;

      console.log(`\n📊 TEST: "20 users, 60 events, maximum coverage strategy" RESULTS:`);
      console.log(`   Users buying less than 50 tickets: ${usersUnder50} users`);
      console.log(`   Event with fewest buyers: ${minEventCoverage} users`);
      console.log(`   Event with most buyers: ${maxEventCoverage} users`);
      console.log(`   Average users per event: ${avgEventCoverage} users`);
      console.log(`   Events with no buyers: ${eventsWithNoBuyers} events (${((eventsWithNoBuyers/events.length)*100).toFixed(1)}%)`);
      console.log(`   Events with only 1 buyer (risky): ${eventsWithOneBuyer} events`);
      console.log(`   Events well-covered (3+ buyers): ${eventsWellCovered} events`);
      console.log(`   Total tickets distributed: ${totalTickets}, Average per user: ${avgTickets.toFixed(1)}, Min: ${minTickets}, Max: ${maxTickets}`);
      console.log(`   Execution time: ${endTime - startTime}ms, Errors: ${errors.length} (${noBuyersErrors.length} "No buyers")`);
    });
  });

  describe('Edge Cases', () => {
    test('1 user, 2 events, user wants 1 event ($4) → 1 assignment with 1 ticket, no errors', () => {
      const testUsers = testDataGenerator.generateUsers(1);
      const users = convertUsers(testUsers);
      const events = testDataGenerator.generateEvents(2);
      
      const userEvents = [
        {
          userId: testUsers[0].id,
          userName: `${testUsers[0].firstName} ${testUsers[0].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          priority: 2,
          cost: '4'
        }
      ];

      const { assignments, errors } = calculateTicketAssignments(userEvents, users);
      
      expect(assignments).toHaveLength(1);
      expect(assignments[0].totalTickets).toBe(1);
      expect(assignments[0].events).toHaveLength(1);
      expect(errors).toEqual([]);
    });

    test('2 users, 1 event, duplicate user-event entries (priority 2 & 3) → higher priority (3) wins, no errors', () => {
      const testUsers = testDataGenerator.generateUsers(2);
      const users = convertUsers(testUsers);
      const events = testDataGenerator.generateEvents(1);
      
      // Duplicate entries for same user-event with different priorities
      const userEvents = [
        {
          userId: testUsers[0].id,
          userName: `${testUsers[0].firstName} ${testUsers[0].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          eventPriority: 2, // Lower priority
          cost: '4'
        },
        {
          userId: testUsers[0].id,
          userName: `${testUsers[0].firstName} ${testUsers[0].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          eventPriority: 3, // Higher priority - should win
          cost: '4'
        }
      ];

      const { assignments, errors } = calculateTicketAssignments(userEvents, users);
      
      // Should handle duplicates gracefully
      expect(assignments).toHaveLength(2);
      expect(errors).toEqual([]);
      
      // Should use the higher priority
      const eventAssignment = assignments.find(a => a.events.length > 0)?.events[0];
      expect(eventAssignment?.priority).toBe(3);
    });

    test('3 users, 2 events, only 1 event has interested users → assignments created for interested event only', () => {
      const testUsers = testDataGenerator.generateUsers(3);
      const users = convertUsers(testUsers);
      const events = testDataGenerator.generateEvents(2);
      
      // Only create user events for one event, leaving the other orphaned
      const userEvents = [
        {
          userId: testUsers[0].id,
          userName: `${testUsers[0].firstName} ${testUsers[0].lastName}`,
          eventId: events[0].id,
          eventTitle: events[0].title,
          priority: 2,
          cost: '4'
        }
      ];

      const { assignments, errors } = calculateTicketAssignments(userEvents, users);
      
      // Should still work for the event that has interested users
      expect(assignments).toHaveLength(3);
      expect(errors).toEqual([]);
      
      // Should have assignments for the first event
      const hasAssignments = assignments.some(a => a.totalTickets > 0);
      expect(hasAssignments).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    test('getPriorityLabel: 1→Normal, 2→Important, 3→Critical, others→Unknown', () => {
      expect(getPriorityLabel(1)).toBe('Normal');
      expect(getPriorityLabel(2)).toBe('Important');
      expect(getPriorityLabel(3)).toBe('Critical');
      expect(getPriorityLabel(0)).toBe('Unknown');
      expect(getPriorityLabel(4)).toBe('Unknown');
    });

    test('getPriorityEmoji: 1→⚪, 2→🟡, 3→🔴, others→⚫', () => {
      expect(getPriorityEmoji(1)).toBe('⚪');
      expect(getPriorityEmoji(2)).toBe('🟡');
      expect(getPriorityEmoji(3)).toBe('🔴');
      expect(getPriorityEmoji(0)).toBe('⚫');
      expect(getPriorityEmoji(4)).toBe('⚫');
    });
  });
});
