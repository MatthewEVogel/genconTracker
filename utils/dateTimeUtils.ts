/**
 * Utility functions for consistent datetime formatting across the app
 * All times are stored in UTC and should be displayed without timezone conversion
 */

/**
 * Format a datetime string to display day and time in UTC (GenCon time)
 * @param dateTimeStr - ISO datetime string
 * @returns Formatted string like "Thursday 1:00 PM"
 */
export function formatDateTime(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return 'TBD';
  
  try {
    const date = new Date(dateTimeStr);
    // Use UTC to avoid timezone conversion
    const dayOfWeek = date.toLocaleDateString('en-US', { 
      weekday: 'long',
      timeZone: 'UTC'
    });
    
    // Format time using UTC methods to display actual event time
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    const time = `${displayHours}:${displayMinutes} ${ampm}`;
    
    return `${dayOfWeek} ${time}`;
  } catch {
    return dateTimeStr;
  }
}

/**
 * Format just the time portion of a datetime string in UTC
 * @param dateTimeStr - ISO datetime string
 * @returns Formatted string like "1:00 PM"
 */
export function formatTime(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return 'TBD';
  
  try {
    const date = new Date(dateTimeStr);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    
    return `${displayHours}:${displayMinutes} ${ampm}`;
  } catch {
    return dateTimeStr;
  }
}

/**
 * Get the day of week for a datetime string in UTC
 * @param dateTimeStr - ISO datetime string  
 * @returns Day name like "Thursday"
 */
export function getDayOfWeek(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    timeZone: 'UTC'
  });
}

/**
 * Format date with month and day in UTC
 * @param dateTimeStr - ISO datetime string
 * @returns Formatted string like "Jul 30"
 */
export function formatDate(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return 'TBD';
  
  try {
    const date = new Date(dateTimeStr);
    const month = date.toLocaleDateString('en-US', { 
      month: 'short',
      timeZone: 'UTC'
    });
    const day = date.getUTCDate();
    
    return `${month} ${day}`;
  } catch {
    return dateTimeStr;
  }
}
