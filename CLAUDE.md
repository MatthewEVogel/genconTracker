# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run Next.js linting
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run seed` - Seed database with test data using Prisma

### Database Commands
- `prisma migrate dev` - Apply database migrations in development
- `prisma migrate deploy` - Deploy migrations to production (runs automatically in postbuild)
- `prisma generate` - Generate Prisma client
- `prisma studio` - Open Prisma Studio for database inspection

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
- Automatic event updates from GenCon's official data
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

### Running Tests
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage
```

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
- See `VERCEL_DEPLOYMENT_GUIDE.md` for detailed setup

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