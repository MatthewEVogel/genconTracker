# Automatic Event Updates System

This document describes the automatic event update system implemented for the GenCon Tracker application.

## Overview

The system allows administrators to automatically download and update event data from GenCon's official events.zip file, with intelligent handling of canceled events and user data preservation.

## Features Implemented

### 1. Database Schema Updates
- Added `isCanceled` (Boolean) field to Event model
- Added `canceledAt` (DateTime) field to Event model  
- Added `lastUpdated` (DateTime) field to Event model
- All existing data is preserved during updates

### 2. Core Services

#### XLSX Processing (`utils/xlsxToTsv.ts`)
- Parses XLSX files from GenCon's events.zip
- Converts Excel data to internal event format
- Handles column mapping identical to existing TSV import
- Error handling for malformed data

#### Event Update Service (`utils/eventUpdateService.ts`)
- Downloads events.zip from GenCon automatically
- Extracts and parses XLSX files
- Performs differential updates:
  - **New Events**: Added to database
  - **Updated Events**: Existing events updated with new information
  - **Canceled Events**: Marked as canceled (not deleted) if users have them
  - **Cleanup**: Canceled events with no users are automatically deleted

### 3. Admin Interface

#### API Endpoint (`pages/api/admin/update-events.ts`)
- POST endpoint for triggering manual updates
- Admin authentication required
- Returns detailed update statistics
- Comprehensive error handling and logging

#### Admin Panel Updates (`pages/admin.tsx`)
- New "Event Management" section
- "Update Events from GenCon" button
- Real-time update progress display
- Detailed statistics showing:
  - Total events processed
  - New events added
  - Events updated
  - Events canceled
  - Events deleted
  - Any errors encountered

### 4. User Experience

#### Canceled Event Notifications (`components/CanceledEventAlert.tsx`)
- Modal alert system for canceled events
- Session-based notification tracking (shows once per session)
- Lists all canceled events with details
- Automatic cleanup when users dismiss alerts

#### Visual Indicators (`pages/events.tsx`)
- Canceled events shown with red styling
- "CANCELED" banner on event cards
- Strike-through text for canceled event titles
- Cancellation date display
- Events remain visible but clearly marked

#### API Enhancements (`pages/api/user-events.ts`)
- Support for filtering canceled events
- Enhanced query parameters for canceled event detection
- Maintains backward compatibility

### 5. Data Integrity Features

#### Smart Cancellation Handling
- Events are marked as canceled, not immediately deleted
- User relationships are preserved
- Canceled events are only deleted when no users have them
- Events can be "un-canceled" if they reappear in GenCon data

#### Differential Updates
- Only changed events are updated in database
- Preserves user-specific data (priorities, relationships)
- Efficient processing of large event datasets
- Comprehensive logging of all changes

## Usage

### For Administrators

1. **Manual Update**: 
   - Navigate to Admin Panel
   - Click "Update Events from GenCon"
   - Confirm the update operation
   - Monitor progress and results

2. **Update Results**:
   - Success/failure status
   - Detailed statistics
   - Error reporting
   - Last update timestamp

### For Users

1. **Canceled Event Notifications**:
   - Automatic alerts on login if events are canceled
   - One-time notification per session
   - Clear information about what was canceled

2. **Event Browsing**:
   - Canceled events clearly marked with red styling
   - "CANCELED" banner and strike-through text
   - Cancellation date information
   - Events remain searchable and visible

## Technical Details

### Dependencies Added
- `xlsx` - Excel file processing
- `adm-zip` - ZIP file extraction
- `@types/adm-zip` - TypeScript definitions

### Database Migration
- Migration: `20250627184922_add_event_cancellation_fields`
- Adds cancellation fields to existing Event table
- Backward compatible with existing data

### Error Handling
- Network failure recovery
- Malformed data handling
- Database transaction safety
- Comprehensive logging

### Performance Considerations
- Efficient differential updates
- Batch processing of large datasets
- Memory-efficient XLSX parsing
- Minimal database queries

## Future Enhancements

### Planned Features (Not Implemented)
- **Automated Daily Updates**: Cron job scheduling
- **Email Notifications**: Alert users about cancellations via email
- **Advanced Filtering**: Filter by canceled status in event browser
- **Audit Trail**: Detailed history of all event changes
- **Rollback Capability**: Ability to revert updates if needed

### Configuration Options
- Update frequency settings
- Notification preferences
- Cancellation handling policies
- Data retention settings

## Security Considerations

- Admin-only access to update functionality
- Input validation on all data
- SQL injection prevention
- Rate limiting on update endpoints
- Audit logging of admin actions

## Monitoring and Maintenance

### Logs to Monitor
- Update success/failure rates
- Event change statistics
- Error patterns
- Performance metrics

### Regular Maintenance
- Database cleanup of old canceled events
- Log file rotation
- Performance optimization
- Dependency updates

## Testing

The system includes comprehensive error handling and has been designed to be resilient to:
- Network failures during download
- Malformed XLSX files
- Database connection issues
- Concurrent user access during updates
- Large dataset processing

## Support

For issues or questions about the automatic event update system:
1. Check the admin panel for update status and errors
2. Review server logs for detailed error information
3. Verify network connectivity to GenCon's servers
4. Ensure database permissions are correct
