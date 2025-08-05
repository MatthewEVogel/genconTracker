import { useState, useEffect } from 'react';

interface Event {
  id: string;
  title: string;
  shortDescription: string | null;
  eventType: string | null;
  gameSystem: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  ageRequired: string | null;
  experienceRequired: string | null;
  materialsRequired: string | null;
  cost: string | null;
  location: string | null;
  ticketsAvailable: number | null;
  priority: number;
  isCanceled: boolean;
  _count: {
    desiredEvents: number;
    trackedBy: number;
  };
}

interface EventEditModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventId: string, updates: any) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  loading: boolean;
}

export default function EventEditModal({ 
  event, 
  isOpen, 
  onClose, 
  onSave, 
  onDelete, 
  loading 
}: EventEditModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        shortDescription: event.shortDescription || '',
        eventType: event.eventType || '',
        gameSystem: event.gameSystem || '',
        startDateTime: event.startDateTime || '',
        endDateTime: event.endDateTime || '',
        ageRequired: event.ageRequired || '',
        experienceRequired: event.experienceRequired || '',
        materialsRequired: event.materialsRequired || '',
        cost: event.cost || '',
        location: event.location || '',
        ticketsAvailable: event.ticketsAvailable || '',
        priority: event.priority || 1,
        isCanceled: event.isCanceled || false,
      });
      setHasChanges(false);
    }
  }, [event]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!event || !hasChanges) return;
    
    try {
      await onSave(event.id, formData);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    
    const confirmed = confirm(
      `Are you sure you want to delete "${event.title}"?\n\n` +
      `This will permanently delete the event and remove it from ${event._count.desiredEvents} user wishlists ` +
      `and ${event._count.trackedBy} tracking lists.\n\n` +
      `This action cannot be undone.`
    );
    
    if (confirmed) {
      try {
        await onDelete(event.id);
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  if (!isOpen || !event) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Event</h2>
            <p className="text-sm text-gray-600">ID: {event.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Basic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Short Description
                </label>
                <textarea
                  value={formData.shortDescription}
                  onChange={(e) => handleInputChange('shortDescription', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Type
                </label>
                <input
                  type="text"
                  value={formData.eventType}
                  onChange={(e) => handleInputChange('eventType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., RPG, TCG, Board Game"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Game System
                </label>
                <input
                  type="text"
                  value={formData.gameSystem}
                  onChange={(e) => handleInputChange('gameSystem', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., D&D 5E, Pathfinder, Magic: The Gathering"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., ICC Room 101, JW Marriott"
                />
              </div>
            </div>

            {/* Schedule & Requirements */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Schedule & Requirements</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date/Time
                </label>
                <input
                  type="text"
                  value={formData.startDateTime}
                  onChange={(e) => handleInputChange('startDateTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 8/1/2025, 10:00:00 AM"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date/Time
                </label>
                <input
                  type="text"
                  value={formData.endDateTime}
                  onChange={(e) => handleInputChange('endDateTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 8/1/2025, 2:00:00 PM"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age Required
                </label>
                <input
                  type="text"
                  value={formData.ageRequired}
                  onChange={(e) => handleInputChange('ageRequired', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 18+, 13+, All Ages"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Experience Required
                </label>
                <input
                  type="text"
                  value={formData.experienceRequired}
                  onChange={(e) => handleInputChange('experienceRequired', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., None, Beginner, Intermediate, Expert"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Materials Required
                </label>
                <input
                  type="text"
                  value={formData.materialsRequired}
                  onChange={(e) => handleInputChange('materialsRequired', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., None, Dice, Character Sheet, Deck"
                />
              </div>
            </div>

            {/* Pricing & Availability */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Pricing & Availability</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost
                </label>
                <input
                  type="text"
                  value={formData.cost}
                  onChange={(e) => handleInputChange('cost', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., $10, Free, $25"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tickets Available
                </label>
                <input
                  type="number"
                  value={formData.ticketsAvailable}
                  onChange={(e) => handleInputChange('ticketsAvailable', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="10"
                />
                <p className="text-xs text-gray-500 mt-1">1 = Highest priority, 10 = Lowest priority</p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isCanceled"
                  checked={formData.isCanceled}
                  onChange={(e) => handleInputChange('isCanceled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isCanceled" className="ml-2 block text-sm text-gray-900">
                  Event is canceled
                </label>
              </div>
            </div>

            {/* Event Statistics */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Event Statistics</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{event._count.desiredEvents}</div>
                  <div className="text-sm text-blue-800">On Wishlists</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{event._count.trackedBy}</div>
                  <div className="text-sm text-green-800">Being Tracked</div>
                </div>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>• Wishlists: Users who want to attend this event</p>
                <p>• Tracking: Users monitoring this event for changes</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete Event'}
            </button>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !hasChanges}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
