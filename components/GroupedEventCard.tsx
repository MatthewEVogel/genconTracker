import { GroupedEvent } from '@/lib/services/server/eventsListService';
import EventScheduleGrid from './EventScheduleGrid';
import EventInstanceSelector from './EventInstanceSelector';
import { useState } from 'react';

interface GroupedEventCardProps {
  event: GroupedEvent;
  allUsers: Array<{ id: string; firstName: string; lastName: string; genConName: string }>;
  selectedUserId: string;
  onUserChange: (userId: string) => void;
  onAddEvent: (eventId: string) => void;
  isAdmin?: boolean;
}

const formatRequirements = (event: GroupedEvent) => {
  const requirements = [];
  if (event.ageRequired) requirements.push(`Age: ${event.ageRequired}`);
  if (event.experienceRequired) requirements.push(`Experience: ${event.experienceRequired}`);
  if (event.materialsRequired && event.materialsRequired !== 'No') {
    requirements.push(`Materials: ${event.materialsRequired}`);
  }
  return requirements.length > 0 ? requirements.join(' • ') : 'No special requirements';
};

export default function GroupedEventCard({
  event,
  allUsers,
  selectedUserId,
  onUserChange,
  onAddEvent,
  isAdmin = false
}: GroupedEventCardProps) {
  const [showInstanceSelector, setShowInstanceSelector] = useState(false);
  const [selectedInstanceForView, setSelectedInstanceForView] = useState<string | null>(null);

  const handleInstanceClick = (instance: any) => {
    if (!instance.isCanceled && !instance.isUserEvent) {
      setShowInstanceSelector(true);
    }
  };

  const handleSelectInstance = (instanceId: string) => {
    onAddEvent(instanceId);
  };

  // Check if user has any instance of this event
  const userHasAnyInstance = event.instances.some(inst => inst.isUserEvent);
  
  // Count available (non-canceled, non-user) instances
  const availableInstances = event.instances.filter(inst => !inst.isCanceled && !inst.isUserEvent);
  const hasCanceledInstances = event.instances.some(inst => inst.isCanceled);

  return (
    <>
      <div className={`rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow bg-white ${
        isAdmin ? 'border-l-4 border-l-purple-500' : ''
      }`}>
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 flex-1">
              {event.title}
            </h3>
            {event.eventType && (
              <span className="px-2 py-1 rounded text-sm bg-blue-100 text-blue-800 flex-shrink-0">
                {event.eventType}
              </span>
            )}
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {userHasAnyInstance && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✓ In Schedule
              </span>
            )}
            {hasCanceledInstances && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Some Canceled
              </span>
            )}
            <span className="text-xs text-gray-500">
              {event.instances.length} session{event.instances.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Event Details */}
        <div className="space-y-3 mb-4">
          {/* Requirements */}
          <div>
            <h4 className="font-medium text-gray-700 text-sm mb-1">Requirements:</h4>
            <p className="text-sm text-gray-600">
              {formatRequirements(event)}
            </p>
          </div>

          {/* Game System */}
          {event.gameSystem && (
            <div>
              <h4 className="font-medium text-gray-700 text-sm mb-1">Game System:</h4>
              <p className="text-sm text-gray-600">{event.gameSystem}</p>
            </div>
          )}

          {/* Cost */}
          {event.cost && (
            <div>
              <h4 className="font-medium text-gray-700 text-sm mb-1">Cost:</h4>
              <p className="text-sm font-medium text-green-600">${event.cost}</p>
            </div>
          )}
        </div>

        {/* Short Description */}
        {event.shortDescription && (
          <div className="mb-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 line-clamp-3">
              {event.shortDescription}
            </p>
          </div>
        )}

        {/* Schedule Grid */}
        <div className="pt-4 border-t border-gray-200 mb-4">
          <EventScheduleGrid 
            instances={event.instances}
            onInstanceClick={handleInstanceClick}
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {availableInstances.length > 0 && (
            <button
              onClick={() => setShowInstanceSelector(true)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
            >
              Add to Schedule ({availableInstances.length} available)
            </button>
          )}
          
          {availableInstances.length === 0 && !userHasAnyInstance && (
            <button
              disabled
              className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed text-sm font-medium"
            >
              No Available Sessions
            </button>
          )}

          {userHasAnyInstance && availableInstances.length === 0 && (
            <button
              disabled
              className="w-full px-4 py-2 bg-green-100 text-green-700 rounded-md cursor-default text-sm font-medium"
            >
              Already in Schedule
            </button>
          )}
        </div>
      </div>

      {/* Instance Selector Modal */}
      <EventInstanceSelector
        isOpen={showInstanceSelector}
        onClose={() => setShowInstanceSelector(false)}
        eventTitle={event.title}
        instances={event.instances}
        allUsers={allUsers}
        selectedUserId={selectedUserId}
        onUserChange={onUserChange}
        onSelectInstance={handleSelectInstance}
      />
    </>
  );
}
