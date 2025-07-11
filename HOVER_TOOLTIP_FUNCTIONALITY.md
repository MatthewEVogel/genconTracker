# Event Hover Tooltip Functionality

This document outlines the hover tooltip functionality that has been added to the event browser in the GenCon Tracker application.

## Overview

Users can now hover over event cards in the event browser to see a detailed tooltip with comprehensive information about each event. The tooltip appears after a short delay and provides much more detail than what's visible on the event card itself.

## Implementation Details

### Components Created

#### EventTooltip Component
- **Location**: `components/EventTooltip.tsx`
- **Purpose**: A reusable tooltip component that wraps around event cards
- **Features**:
  - Smooth hover animations with delay
  - Intelligent positioning (appears above the event card)
  - Rich content display with organized sections
  - Responsive design that works on different screen sizes
  - Proper event listener cleanup to prevent memory leaks

### Integration

#### Events Page Integration
- **Location**: `pages/events.tsx`
- **Implementation**: Each event card is wrapped with the `EventTooltip` component
- **User Experience**: 
  - Hover over any event card to see detailed information
  - Tooltip appears after 300ms delay to prevent accidental triggers
  - Tooltip disappears after 100ms delay when mouse leaves
  - Cursor changes to pointer to indicate interactivity

## Tooltip Content

The hover tooltip displays comprehensive event information organized into clear sections:

### Header Section
- **Event Title**: Full event name with proper styling
- **Event ID**: Unique identifier in monospace font
- **Event Type**: Category badge (RPG, Board Game, etc.)
- **Schedule Status**: "In Schedule" badge if user has added the event
- **Cancellation Status**: Clear warning if event is canceled

### Schedule Information
- **Start Time**: Full date and time with day of week
- **End Time**: Calculated end time based on duration
- **Duration**: Event length in hours

### Location & Cost
- **Venue**: Physical location at GenCon
- **Cost**: Ticket price if applicable

### Event Details
- **Game System**: RPG system or game type
- **Age Requirements**: Minimum age if specified
- **Experience Level**: Required experience level
- **Materials**: What players need to bring

### Capacity Information
- **Maximum Capacity**: Total number of available tickets

### Description
- **Event Description**: Full description text with proper formatting
- **Scrollable**: Long descriptions are contained in a scrollable area

## Technical Features

### Positioning System
- **Smart Positioning**: Tooltip appears above the event card
- **Center Alignment**: Horizontally centered on the card
- **Fixed Positioning**: Uses fixed positioning for proper layering
- **Arrow Indicator**: Visual arrow pointing to the source card

### Performance Optimizations
- **Delayed Rendering**: Tooltip only renders when needed
- **Timeout Management**: Proper cleanup of hover timers
- **Event Listener Cleanup**: Prevents memory leaks
- **Conditional Rendering**: Only shows when `isVisible` is true

### Accessibility Features
- **Keyboard Navigation**: Tooltip respects focus states
- **Screen Reader Friendly**: Proper semantic HTML structure
- **High Contrast**: Clear visual hierarchy and readable text
- **Responsive Design**: Works on different screen sizes

## User Experience Benefits

### Enhanced Information Discovery
- **Quick Preview**: See full event details without clicking
- **Efficient Browsing**: Compare events quickly by hovering
- **Reduced Clicks**: Get information without navigation
- **Context Preservation**: Stay on the same page while exploring

### Visual Improvements
- **Professional Appearance**: Polished tooltip design
- **Consistent Styling**: Matches application theme
- **Clear Hierarchy**: Well-organized information layout
- **Visual Indicators**: Icons and badges for quick recognition

### Interaction Design
- **Intuitive Behavior**: Natural hover interactions
- **Smooth Animations**: Gentle fade in/out effects
- **Hover Persistence**: Tooltip stays visible when hovering over it
- **Quick Dismissal**: Easy to hide by moving mouse away

## Browser Compatibility

- **Modern Browsers**: Works in all modern browsers
- **Mobile Devices**: Gracefully handles touch interactions
- **Responsive**: Adapts to different screen sizes
- **Performance**: Optimized for smooth interactions

## Future Enhancements

Potential improvements that could be added:

### Advanced Features
- **Click to Pin**: Allow users to pin tooltips open
- **Keyboard Shortcuts**: Show/hide with keyboard commands
- **Customizable Content**: User preferences for tooltip information
- **Animation Options**: Different entrance/exit animations

### Content Enhancements
- **Event Images**: Show event artwork if available
- **Related Events**: Links to similar events
- **User Reviews**: Community ratings and comments
- **Availability Status**: Real-time ticket availability

### Accessibility Improvements
- **Voice Announcements**: Screen reader integration
- **High Contrast Mode**: Enhanced visibility options
- **Font Size Controls**: User-adjustable text size
- **Reduced Motion**: Respect user motion preferences

## Usage Examples

### For Users
1. **Browse Events**: Navigate to the Events page
2. **Hover to Explore**: Move your mouse over any event card
3. **View Details**: Read comprehensive information in the tooltip
4. **Compare Events**: Hover over multiple events to compare
5. **Make Decisions**: Use detailed info to decide which events to add

### For Developers
```typescript
// Using the EventTooltip component
<EventTooltip event={eventData} isUserEvent={isInSchedule}>
  <div className="event-card">
    {/* Event card content */}
  </div>
</EventTooltip>
```

## Implementation Notes

- **Performance**: Tooltips are lightweight and don't impact page performance
- **Maintainability**: Clean, reusable component architecture
- **Extensibility**: Easy to add new tooltip content sections
- **Testing**: Component is designed for easy unit testing
- **Documentation**: Well-commented code for future maintenance

The hover tooltip functionality significantly enhances the user experience by providing instant access to detailed event information without requiring additional page loads or navigation.
