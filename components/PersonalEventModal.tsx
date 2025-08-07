import React, { useState, useEffect } from 'react';
import { personalEventService, CreatePersonalEventData, PersonalEvent, ConflictInfo } from '../lib/services/client/personalEventService';

interface PersonalEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: (event: PersonalEvent) => void;
  initialStartTime?: Date;
  initialEndTime?: Date;
  currentUserId: string;
  allUsers: Array<{ id: string; firstName: string; lastName: string; genConName: string }>;
  editingEvent?: PersonalEvent | null;
}

export const PersonalEventModal: React.FC<PersonalEventModalProps> = ({
  isOpen,
  onClose,
  onEventCreated,
  initialStartTime,
  initialEndTime,
  currentUserId,
  allUsers,
  editingEvent
}) => {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([currentUserId]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingEvent) {
        // Populate form with existing event data
        setTitle(editingEvent.title);
        setStartTime(formatDateTimeLocal(new Date(editingEvent.startTime)));
        setEndTime(formatDateTimeLocal(new Date(editingEvent.endTime)));
        setLocation(editingEvent.location || '');
        setSelectedAttendees(editingEvent.attendees);
      } else {
        // New event creation
        if (initialStartTime) {
          const roundedStart = personalEventService.roundToNearest15Minutes(initialStartTime);
          const defaultEnd = initialEndTime || personalEventService.getDefaultEndTime(roundedStart);
          
          setStartTime(formatDateTimeLocal(roundedStart));
          setEndTime(formatDateTimeLocal(defaultEnd));
        } else {
          // Default to GenCon Thursday if no initial time provided
          // TODO: Make this automatically get the correct date of the current GenCon
          const genconThursday = new Date(2025, 6, 31, 12, 0); // July 31, 2025 at 12:00 PM
          const roundedStart = personalEventService.roundToNearest15Minutes(genconThursday);
          const defaultEnd = personalEventService.getDefaultEndTime(roundedStart);
          
          setStartTime(formatDateTimeLocal(roundedStart));
          setEndTime(formatDateTimeLocal(defaultEnd));
        }
        setTitle('');
        setLocation('');
        setSelectedAttendees([currentUserId]);
      }
      setError(null);
      setConflicts([]);
      setShowConflicts(false);
    }
  }, [isOpen, initialStartTime, initialEndTime, currentUserId, editingEvent]);

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleAttendeeToggle = (userId: string) => {
    // TODO: Fix the underlying issue where creators can uncheck themselves but events still appear on their calendar
    // For now, prevent the creator from unchecking themselves to avoid calendar display issues
    if (userId === currentUserId) {
      return; // Don't allow creator to uncheck themselves
    }
    
    setSelectedAttendees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime || !endTime) {
      setError('Please fill in all required fields');
      return;
    }

    if (new Date(startTime) >= new Date(endTime)) {
      setError('End time must be after start time');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (editingEvent) {
        // Update existing event
        const updateData = {
          id: editingEvent.id,
          title: title.trim(),
          startTime,
          endTime,
          location: location.trim() || undefined,
          attendees: selectedAttendees
        };

        const response = await personalEventService.updatePersonalEvent(updateData);
        
        if (response.conflicts && response.conflicts.length > 0) {
          setConflicts(response.conflicts);
          setShowConflicts(true);
        } else {
          onEventCreated(response.personalEvent);
          onClose();
        }
      } else {
        // Create new event
        const eventData: CreatePersonalEventData = {
          title: title.trim(),
          startTime,
          endTime,
          location: location.trim() || undefined,
          createdBy: currentUserId,
          attendees: selectedAttendees
        };

        const response = await personalEventService.createPersonalEvent(eventData);
        
        if (response.conflicts && response.conflicts.length > 0) {
          setConflicts(response.conflicts);
          setShowConflicts(true);
        } else {
          onEventCreated(response.personalEvent);
          onClose();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${editingEvent ? 'update' : 'create'} event`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWithConflicts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (editingEvent) {
        // For editing, update the event with force flag
        const updateData = {
          id: editingEvent.id,
          title: title.trim(),
          startTime,
          endTime,
          location: location.trim() || undefined,
          attendees: selectedAttendees,
          force: true
        };

        const response = await personalEventService.updatePersonalEvent(updateData);
        onEventCreated(response.personalEvent);
      } else {
        // For creating, create the event with force flag
        const eventData: CreatePersonalEventData = {
          title: title.trim(),
          startTime,
          endTime,
          location: location.trim() || undefined,
          createdBy: currentUserId,
          attendees: selectedAttendees,
          force: true
        };

        const response = await personalEventService.createPersonalEvent(eventData);
        onEventCreated(response.personalEvent);
      }
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : `Failed to ${editingEvent ? 'update' : 'create'} event`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {editingEvent ? 'Edit Personal Event' : 'Create Personal Event'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {showConflicts ? (
          <div>
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Scheduling Conflicts Detected</h3>
              <p className="text-yellow-700 mb-3">
                The following people have conflicts with this time slot:
              </p>
              
              {conflicts.map((conflict) => (
                <div key={conflict.userId} className="mb-3">
                  <p className="font-medium text-yellow-800">{conflict.userName}:</p>
                  {conflict.personalEventConflicts.map((event) => (
                    <p key={event.id} className="text-sm text-yellow-700 ml-2">
                      • {event.title} ({new Date(event.startTime).toLocaleString()} - {new Date(event.endTime).toLocaleString()})
                    </p>
                  ))}
                  {conflict.genconConflicts.map((event) => (
                    <p key={event.id} className="text-sm text-yellow-700 ml-2">
                      • {event.title} ({new Date(event.startDateTime).toLocaleString()} - {new Date(event.endDateTime).toLocaleString()})
                    </p>
                  ))}
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleCreateWithConflicts}
                className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (editingEvent ? 'Updating...' : 'Creating...') : (editingEvent ? 'Update Anyway' : 'Create Anyway')}
              </button>
              <button
                onClick={() => setShowConflicts(false)}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                disabled={isLoading}
              >
                Edit Event
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter event title"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time *
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time *
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter location (optional)"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attendees
              </label>
              <div className="text-xs text-gray-500 mb-2">
                You are automatically included as the event creator
              </div>
              <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                {allUsers
                  .filter(user => user.id !== currentUserId) // Remove creator from attendee selection
                  .map((user) => (
                  <label key={user.id} className="flex items-center mb-1">
                    <input
                      type="checkbox"
                      checked={selectedAttendees.includes(user.id)}
                      onChange={() => handleAttendeeToggle(user.id)}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      {user.firstName} {user.lastName} ({user.genConName})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (editingEvent ? 'Updating...' : 'Creating...') : (editingEvent ? 'Update Event' : 'Create Event')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
