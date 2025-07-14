# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server
- `npm run build` - Build production application (includes typecheck)
- `npm run start` - Start production server
- `npm run lint` - Run Next.js linting
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run test:ci` - Run tests for CI (no watch mode)
- `npm run seed` - Seed database with test data using Prisma

### Database Commands
- `prisma migrate dev` - Apply database migrations in development
- `prisma migrate deploy` - Deploy migrations to production (runs automatically in postbuild)
- `prisma generate` - Generate Prisma client
- `prisma studio` - Open Prisma Studio for database inspection
- `npm run db:migrate` - Deploy migrations (alias for prisma migrate deploy)
- `npm run db:push` - Push schema changes to database without migration

## Architecture Overview

### Tech Stack
- **Next.js 15** - Full-stack React framework with API routes
- **TypeScript** - Type safety throughout
- **Prisma** - ORM with PostgreSQL database
- **NextAuth** - Authentication with Google OAuth
- **Tailwind CSS** - Utility-first styling
- **Zustand** - Lightweight state management
- **Jest** - Testing framework

### Project Structure
```
├── components/          # React components
├── lib/
│   ├── auth.ts         # NextAuth configuration
│   ├── prisma.ts       # Prisma client instance
│   └── services/       # Business logic layer
│       ├── client/     # Client-side service calls
│       └── server/     # Server-side database operations
├── pages/
│   ├── api/           # Next.js API routes
│   └── *.tsx          # Page components
├── store/             # Zustand state management
├── utils/             # Utility functions and services
└── prisma/            # Database schema and migrations
```

### Service Layer Architecture
The application uses a clean service layer pattern:
- **Server Services** (`lib/services/server/`) - Direct database operations using Prisma
- **Client Services** (`lib/services/client/`) - API calls from frontend components
- **API Routes** (`pages/api/`) - Thin controllers that call server services

### Key Services
- **EventService** - Event filtering, searching, and management
- **RefundService** - Purchased ticket refund tracking
- **RegistrationTimerService** - GenCon registration countdown timer
- **ScheduleService** - User's personalized event schedule

## Database Schema

### Core Models
- **User** - User accounts with OAuth support, notification preferences
- **Event** - GenCon events with cancellation tracking
- **UserEvent** - Many-to-many relationship for user's wishlist
- **TicketAssignment** - Ticket purchasing algorithm results
- **PurchasedTicket** - Actual purchased tickets with refund tracking
- **RegistrationTimer** - Admin-configurable registration date

### Important Database Features
- Uses PostgreSQL in production (Vercel), SQLite in development
- Cascading deletes for user relationships
- Event cancellation tracking (`isCanceled`, `canceledAt`)
- Ticket assignment algorithm with calculation run tracking

## Key Features

### Event Management
- **Automatic daily event updates** - Events update automatically at 2:00 AM via Vercel Cron Jobs
- Manual event updates available for admins via admin panel
- Event cancellation detection and user notification
- Advanced filtering (day, time, type, search)
- Pagination support for large event lists

### User Authentication
- Google OAuth integration via NextAuth
- Admin user system with protected routes
- User notification preferences (email/SMS)

### Ticket System
- Wishlist management for desired events
- Ticket assignment algorithm for optimal purchasing
- Purchased ticket tracking with refund management
- Registration timer countdown

### Notifications
- SendGrid email notifications
- Twilio SMS notifications
- Registration reminder system (1 day, 6 hours, 30 minutes)

## Testing

### Test Structure
- Tests in `__tests__/` directory
- Test utilities in `__tests__/utils/`
- Coverage reporting available
- Focus on algorithm testing (ticket assignment, wishlist validation)
- Uses Jest with jsdom environment for React component testing
- Test database setup with SQLite for isolation

### Running Tests
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage
npm run test:ci          # CI mode (no watch)
```

### Test Configuration
- Jest configuration uses Next.js preset for optimal integration
- Path aliases (`@/`) work in tests matching project structure
- Coverage collection from pages, components, and utils directories
- Test files should follow pattern: `*.test.{js,ts,tsx}`

## Development Workflow

### Environment Setup
1. Copy `.env.example` to `.env.local`
2. Set up Google OAuth credentials
3. Configure SendGrid and Twilio for notifications
4. Run `npm run dev` to start development

### Database Workflow
1. Edit `prisma/schema.prisma` for schema changes
2. Run `prisma migrate dev` to create and apply migrations
3. Run `prisma generate` to update client
4. Use `prisma studio` to inspect data

### Deployment
- Deploys to Vercel automatically
- Database migrations run via postbuild script
- Environment variables must be configured in Vercel dashboard
- TypeScript type checking runs during build (build fails on type errors)
- **Automatic event updates** scheduled via Vercel Cron Jobs (daily at 2:00 AM)
- See `VERCEL_DEPLOYMENT_GUIDE.md` for detailed setup

## Automated Event Updates

### Daily Automatic Updates
- **Schedule**: Events update automatically every day at 2:00 AM UTC
- **Implementation**: Uses Vercel Cron Jobs with `vercel.json` configuration
- **Endpoint**: `/api/cron/update-events` (protected with `CRON_SECRET`)
- **Process**: Downloads GenCon's official events.zip, extracts XLSX, performs differential database update

### Manual Admin Updates
- **Admin Panel**: Admins can manually trigger updates via `/api/admin/update-events`
- **Test Endpoint**: Admins can test cron functionality via `/api/admin/test-cron`
- **Authentication**: Requires admin privileges and proper session

### Configuration
- **Environment Variable**: `CRON_SECRET` must be set for cron job authentication
- **Vercel Setup**: Cron jobs are configured in `vercel.json` with schedule `"0 2 * * *"`
- **Error Handling**: Comprehensive logging and error reporting for both manual and automated updates

### Update Process
1. Downloads events.zip from GenCon's official source
2. Extracts and parses XLSX file containing event data
3. Performs differential update: creates new events, updates existing ones
4. Marks missing events as canceled (if users are registered) or deletes them
5. Cleans up canceled events with no associated users

## Important Implementation Details

### Service Layer Pattern
Always use the service layer for database operations:
```typescript
// Client-side: Call client service
import { EventService } from '@/lib/services/client/eventService';
const events = await EventService.getEvents(filters);

// Server-side: Use server service in API routes
import { EventService } from '@/lib/services/server/eventService';
const events = await EventService.getEvents(filters);
```

### Error Handling
- API routes return consistent error responses
- Client services throw errors for failed requests
- Database operations use Prisma's built-in error handling
- User-facing errors are handled gracefully

### Authentication
- Use `useSession()` hook for client-side auth state
- Protect API routes with `getServerSession()`
- Admin routes check `user.isAdmin` flag
- OAuth configured for Google provider only

### State Management
- Global state uses Zustand store (`store/useUserStore.ts`)
- Local component state for UI-only data
- Server state managed by API calls, not global store