# Test Suite for GenCon Tracker

This directory contains comprehensive tests for the GenCon Tracker application, focusing on the core functionality of managing desired events and schedule conflicts.

## Test Coverage

### DesiredEventsService Tests

The `desiredEventsService.test.ts` file provides comprehensive testing for the core event management functionality:

#### Adding Events (`addDesiredEvent`)
- ✅ Successfully adding events with no conflicts
- ✅ Detecting time conflicts between overlapping events
- ✅ Detecting capacity warnings when events are at or over capacity
- ✅ Preventing duplicate registrations for the same event
- ✅ Handling non-existent events gracefully
- ✅ Managing events without time information

#### Removing Events (`removeDesiredEvent`)
- ✅ Successfully removing desired events
- ✅ Handling attempts to remove non-existent events

#### Retrieving Events (`getUserDesiredEvents`)
- ✅ Fetching all desired events for a user
- ✅ Filtering by canceled status (include/exclude canceled events)
- ✅ Proper data structure and relationships

#### Utility Functions
- ✅ Checking if user has specific desired events (`userHasDesiredEvent`)
- ✅ Getting event signup counts (`getEventDesiredCount`)
- ✅ Retrieving canceled events for notifications (`getUserCanceledEvents`)

#### Conflict Detection
- ✅ **Exact time overlap**: Events with identical start/end times
- ✅ **Partial overlap**: Events that start during another event's duration
- ✅ **Adjacent events**: Ensuring events that end when another begins don't conflict
- ✅ **Events without times**: Handling events with null/undefined time information

#### Capacity Management
- ✅ **Capacity warnings**: Detecting when signup count meets or exceeds available tickets
- ✅ **Unlimited events**: Handling events with no ticket limits
- ✅ **Over-capacity scenarios**: Managing events with more signups than tickets

### UserListService Tests

The `userListService.test.ts` file provides comprehensive testing for user management functionality:

#### Creating Users (`createUser`)
- ✅ Successfully creating users with minimal required data
- ✅ Creating users with all optional fields (Google OAuth, admin status, notifications)
- ✅ Data sanitization (trimming whitespace, converting emails to lowercase)
- ✅ Handling empty optional fields

#### Removing Users (`deleteUser`)
- ✅ Successfully deleting existing users
- ✅ Preventing deletion of non-existent users
- ✅ Proper error handling for invalid user IDs

#### Updating Users (`updateUser`)
- ✅ Partial updates (only updating provided fields)
- ✅ Data sanitization on updates
- ✅ Notification preference updates
- ✅ Admin status changes
- ✅ Handling undefined values (not updating those fields)
- ✅ Proper handling of boolean false values

#### Retrieving Users
- ✅ Getting users by ID (`getUserById`)
- ✅ Getting users by email (`getUserByEmail`) with case-insensitive search
- ✅ Getting users by Google ID (`getUserByGoogleId`)
- ✅ Getting all users (`getAllUsers`) with proper ordering
- ✅ Getting admin users only (`getAdminUsers`)
- ✅ Checking user existence by email (`userExistsByEmail`)

#### Data Validation and Edge Cases
- ✅ Email case normalization (always lowercase)
- ✅ Whitespace trimming for names and emails
- ✅ Proper handling of optional OAuth fields
- ✅ Boolean value handling in updates
- ✅ Empty array returns when no data exists

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- __tests__/services/server/desiredEventsService.test.ts
npm test -- __tests__/services/server/userListService.test.ts
```

### Run All Service Tests
```bash
npm test -- __tests__/services/server/
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

## Test Structure

The tests use Jest with the following patterns:

- **Mocking**: Prisma database calls are mocked to isolate business logic
- **Comprehensive scenarios**: Each function is tested with multiple edge cases
- **Clear descriptions**: Test names clearly describe the scenario being tested
- **Proper setup/teardown**: Each test starts with a clean mock state

## Key Test Scenarios

### Time Conflict Detection
The conflict detection tests ensure that:
- Events with overlapping times are properly identified
- Adjacent events (end time = start time) don't conflict
- Events without time information don't cause conflicts
- Multiple conflicts are properly reported

### Capacity Management
The capacity tests verify:
- Events at capacity show warnings
- Events over capacity show warnings
- Events without ticket limits don't show warnings
- Proper counting of existing signups

### Error Handling
Tests ensure proper error handling for:
- Duplicate event registrations
- Non-existent events
- Non-existent user events (for removal)

## Mock Data

The tests use realistic mock data including:
- User objects with proper IDs and information
- Event objects with complete event details
- Conflicting events with overlapping time ranges
- Various capacity scenarios

## Event Tracking Tests

### New Test Coverage Added

#### `__tests__/api/eventTracking.test.ts`
Tests for the event tracking API endpoints:
- **POST /api/events/[eventId]/track** - Track an event
- **DELETE /api/events/[eventId]/track** - Untrack an event  
- **GET /api/user-tracked-events** - Get user's tracked events

**Test Coverage:**
- ✅ Successful tracking/untracking operations
- ✅ Authentication validation (401 errors)
- ✅ Event existence validation (404 errors)
- ✅ Duplicate tracking prevention (400 errors)
- ✅ Method validation (405 errors)
- ✅ Proper API response formats

#### `__tests__/api/eventsListTracking.test.ts`
Tests for the events list API with tracking information:
- **GET /api/events-list** - Event list with `isTracked` field

**Test Coverage:**
- ✅ Tracking information included for authenticated users
- ✅ No tracking information for unauthenticated users
- ✅ Handling users with no tracked events
- ✅ Database error handling
- ✅ Query parameter pass-through
- ✅ Method validation

#### `__tests__/services/client/eventService.test.ts`
Tests for the client-side EventService tracking methods:
- `EventService.trackEvent(eventId)`
- `EventService.untrackEvent(eventId)`
- `EventService.getTrackedEvents()`

**Test Coverage:**
- ✅ Successful API calls with proper request formatting
- ✅ Error handling for API failures
- ✅ Network error handling
- ✅ Default error messages when none provided
- ✅ Return value validation

#### `__tests__/utils/eventUpdateService.test.ts`
Tests for the event update service with change detection and notifications:
- Event change detection logic
- Notification system for tracked events
- Event cancellation and deletion logic with tracking considerations

**Test Coverage:**
- ✅ Change detection for all event fields (title, time, location, cost, etc.)
- ✅ Notification sending to users tracking changed events
- ✅ Event cancellation with tracking user notifications
- ✅ Event deletion vs cancellation based on tracking users
- ✅ Preservation of events with tracking users
- ✅ New event creation without notifications
- ✅ Handling events with no changes
- ✅ Error handling for fetch, database, and notification failures

#### `__tests__/integration/eventTracking.test.ts`
End-to-end integration tests using real database operations:
- Complete event tracking workflows
- Multi-user tracking scenarios
- Data integrity validation

**Test Coverage:**
- ✅ User can track and untrack events
- ✅ Multiple users can track the same event
- ✅ Single user can track multiple events
- ✅ Tracking relationships preserved during event updates
- ✅ Event cancellation with tracking users
- ✅ User filtering by notification preferences
- ✅ Cascade delete behavior for users and events
- ✅ Duplicate tracking prevention
- ✅ Database constraint validation

### Running Event Tracking Tests

```bash
# Run all event tracking tests
npm test -- __tests__/api/eventTracking.test.ts __tests__/services/client/eventService.test.ts __tests__/api/eventsListTracking.test.ts __tests__/utils/eventUpdateService.test.ts __tests__/integration/eventTracking.test.ts

# Run individual test files
npm test -- __tests__/api/eventTracking.test.ts
npm test -- __tests__/services/client/eventService.test.ts
npm test -- __tests__/api/eventsListTracking.test.ts
npm test -- __tests__/utils/eventUpdateService.test.ts
npm test -- __tests__/integration/eventTracking.test.ts
```

## Future Test Additions

Consider adding tests for:
- Performance tests for large datasets
- Frontend component tests for event management UI
- End-to-end tests for complete user workflows
- Load testing for event update notifications
