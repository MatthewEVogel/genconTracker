import { PrismaClient } from '@prisma/client';

export interface TestUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
}

export interface TestEvent {
  id: string;
  title: string;
  shortDescription?: string;
  eventType?: string;
  gameSystem?: string;
  startDateTime?: string;
  duration?: string;
  endDateTime?: string;
  ageRequired?: string;
  experienceRequired?: string;
  materialsRequired?: string;
  cost?: string;
  location?: string;
  ticketsAvailable?: number;
  priority?: number; // Event's inherent priority (1=Normal, 2=Important, 3=Critical)
  createdAt: Date;
}

export interface TestUserEvent {
  id: string;
  userId: string;
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TestDataGenerator {
  private userCounter = 0;
  private eventCounter = 0;

  // Generate realistic test users
  generateUsers(count: number): TestUser[] {
    const users: TestUser[] = [];
    const firstNames = [
      'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry',
      'Ivy', 'Jack', 'Kate', 'Liam', 'Maya', 'Noah', 'Olivia', 'Paul',
      'Quinn', 'Ruby', 'Sam', 'Tara', 'Uma', 'Victor', 'Wendy', 'Xander',
      'Yara', 'Zoe'
    ];

    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
      'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
      'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
    ];

    for (let i = 0; i < count; i++) {
      const firstName = firstNames[this.userCounter % firstNames.length];
      const lastName = lastNames[this.userCounter % lastNames.length];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${this.userCounter > 0 ? this.userCounter : ''}@example.com`;
      
      users.push({
        id: `test-user-${this.userCounter}`,
        firstName,
        lastName,
        email,
        createdAt: new Date(),
      });
      this.userCounter++;
    }

    return users;
  }

  // Generate realistic GenCon-style events
  generateEvents(count: number): TestEvent[] {
    const events: TestEvent[] = [];
    
    const eventTypes = ['RPG', 'Board Game', 'Card Game', 'Miniatures', 'LARP', 'Seminar', 'Tournament'];
    const gameSystems = ['D&D 5E', 'Pathfinder', 'Call of Cthulhu', 'Shadowrun', 'Vampire', 'Settlers of Catan', 'Magic: The Gathering', 'Warhammer 40K'];
    const locations = ['Room 101', 'Room 102', 'Hall A', 'Hall B', 'Ballroom C', 'Conference Room 1', 'Gaming Area 2'];
    
    const eventTitles = [
      'Dragon Heist Adventure',
      'Curse of Strahd',
      'Tomb of Annihilation',
      'Waterdeep Mysteries',
      'Call of Cthulhu: Dark Secrets',
      'Shadowrun: Corporate Espionage',
      'Vampire Masquerade',
      'Pathfinder Society',
      'Magic Tournament',
      'Catan Championship',
      'Warhammer 40K Battle',
      'Board Game Marathon',
      'RPG Design Workshop',
      'Game Master Seminar',
      'Indie Game Showcase'
    ];

    // Generate events across 4 days (Thursday-Sunday)
    const days = ['2024-08-01', '2024-08-02', '2024-08-03', '2024-08-04']; // Thu, Fri, Sat, Sun
    const timeSlots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

    for (let i = 0; i < count; i++) {
      const day = days[i % days.length];
      const timeSlot = timeSlots[i % timeSlots.length];
      const duration = Math.random() > 0.5 ? 4 : 2; // 2 or 4 hour events
      
      const startDateTime = `${day}T${timeSlot}:00Z`;
      const endTime = new Date(`${day}T${timeSlot}:00Z`);
      endTime.setHours(endTime.getHours() + duration);
      const endDateTime = endTime.toISOString();

      const title = eventTitles[this.eventCounter % eventTitles.length] + 
                   (this.eventCounter >= eventTitles.length ? ` ${Math.floor(this.eventCounter / eventTitles.length) + 1}` : '');

      events.push({
        id: `test-event-${this.eventCounter}`,
        title,
        shortDescription: `An exciting ${duration}-hour gaming session`,
        eventType: eventTypes[i % eventTypes.length],
        gameSystem: gameSystems[i % gameSystems.length],
        startDateTime,
        duration: `${duration} hours`,
        endDateTime,
        ageRequired: Math.random() > 0.7 ? '18+' : '13+',
        experienceRequired: Math.random() > 0.5 ? 'None' : 'Some',
        materialsRequired: 'Provided',
        cost: Math.random() > 0.3 ? '4' : '8', // Most events $4, some $8
        location: locations[i % locations.length],
        ticketsAvailable: Math.floor(Math.random() * 4) + 4, // 4-7 tickets
        createdAt: new Date(),
      });
      this.eventCounter++;
    }

    return events;
  }

  // Generate user event assignments (no priorities - those are on events now)
  generateUserEvents(users: TestUser[], events: TestEvent[], eventsPerUser: number = 5): TestUserEvent[] {
    const userEvents: TestUserEvent[] = [];
    let counter = 0;

    users.forEach(user => {
      // Shuffle events to get random selection
      const shuffledEvents = [...events].sort(() => Math.random() - 0.5);
      const selectedEvents = shuffledEvents.slice(0, eventsPerUser);

      selectedEvents.forEach((event, index) => {
        userEvents.push({
          id: `test-user-event-${counter}`,
          userId: user.id,
          eventId: event.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        counter++;
      });
    });

    return userEvents;
  }

  // Generate time conflicts for testing
  generateConflictingEvents(): TestEvent[] {
    return [
      {
        id: 'conflict-event-1',
        title: 'Conflicting Event A',
        startDateTime: '2024-08-01T10:00:00Z',
        endDateTime: '2024-08-01T14:00:00Z',
        duration: '4 hours',
        cost: '4',
        ticketsAvailable: 6,
        createdAt: new Date(),
      },
      {
        id: 'conflict-event-2',
        title: 'Conflicting Event B',
        startDateTime: '2024-08-01T12:00:00Z', // Overlaps with Event A
        endDateTime: '2024-08-01T16:00:00Z',
        duration: '4 hours',
        cost: '4',
        ticketsAvailable: 6,
        createdAt: new Date(),
      },
    ];
  }

  // Generate events that will test the 50-ticket limit
  // Ensures every event has at least one interested user (realistic for production)
  generateLargeScaleScenario(): { users: TestUser[], events: TestEvent[], userEvents: TestUserEvent[] } {
    const users = this.generateUsers(20); // 20 users
    const events = this.generateEvents(60); // 60 events
    
    const userEvents: TestUserEvent[] = [];
    let counter = 0;

    // STEP 1: Ensure every event has at least one interested user
    // This mirrors production where we only run the algorithm on events people want
    events.forEach((event, eventIndex) => {
      const assignedUser = users[eventIndex % users.length]; // Round-robin assignment

      userEvents.push({
        id: `large-scale-user-event-${counter}`,
        userId: assignedUser.id,
        eventId: event.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      counter++;
    });

    // STEP 2: Add additional random user-event relationships for realistic distribution
    // This gives us the complexity of multiple users wanting the same events
    users.forEach(user => {
      const additionalEvents = Math.floor(Math.random() * 8) + 5; // 5-12 additional events per user
      const shuffledEvents = [...events].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < additionalEvents; i++) {
        const event = shuffledEvents[i];
        
        // Skip if this user already wants this event
        const alreadyWants = userEvents.some(ue => ue.userId === user.id && ue.eventId === event.id);
        if (alreadyWants) continue;

        userEvents.push({
          id: `large-scale-user-event-${counter}`,
          userId: user.id,
          eventId: event.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        counter++;
      }
    });

    return { users, events, userEvents };
  }

  // Reset counters for fresh test data
  reset(): void {
    this.userCounter = 0;
    this.eventCounter = 0;
  }
}

export const testDataGenerator = new TestDataGenerator();
