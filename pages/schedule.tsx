import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useUserStore from "@/store/useUserStore";
import Timeline from "@/components/Timeline";

interface Event {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  eventType?: string;
  location?: string;
  cost?: string;
  ticketsAvailable?: number;
}

interface User {
  id: string;
  name: string;
  events: Event[];
}

const DAYS = ['Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SchedulePage() {
  const router = useRouter();
  const { user, logout } = useUserStore();
  const [scheduleData, setScheduleData] = useState<User[]>([]);
  const [userEventIds, setUserEventIds] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState('Thursday');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [conflictModal, setConflictModal] = useState<{
    show: boolean;
    eventId: string;
    conflicts: any[];
    capacityWarning: boolean;
  }>({ show: false, eventId: '', conflicts: [], capacityWarning: false });

  useEffect(() => {
    // Redirect to login if no user is logged in
    if (!user) {
      router.push("/");
      return;
    }

    fetchScheduleData();
    fetchUserEvents();
  }, [user, router]);

  const fetchScheduleData = async () => {
    try {
      const response = await fetch('/api/schedule');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch schedule data');
      }
      
      setScheduleData(data.scheduleData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const fetchUserEvents = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/user-events?userId=${user.id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user events');
      }
      
      setUserEventIds(data.userEvents.map((ue: any) => ue.event.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async (eventId: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/user-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id, eventId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add event');
      }

      // Check for conflicts or capacity warnings
      if (data.conflicts.length > 0 || data.capacityWarning) {
        setConflictModal({
          show: true,
          eventId,
          conflicts: data.conflicts,
          capacityWarning: data.capacityWarning
        });
        return;
      }

      // Success - refresh data
      await fetchScheduleData();
      await fetchUserEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleRemoveEvent = async (eventId: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/user-events', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id, eventId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove event');
      }

      // Success - refresh data
      await fetchScheduleData();
      await fetchUserEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleConfirmAddEvent = async () => {
    // Force add the event despite conflicts
    setUserEventIds(prev => [...prev, conflictModal.eventId]);
    setConflictModal({ show: false, eventId: '', conflicts: [], capacityWarning: false });
    
    // Refresh data
    await fetchScheduleData();
    await fetchUserEvents();
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                GenCon Tracker - Schedule
              </h1>
              <nav className="flex space-x-4">
                <button
                  onClick={() => router.push('/events')}
                  className="text-blue-600 hover:text-blue-800 transition"
                >
                  Browse Events
                </button>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">Welcome, {user.name}!</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}

        {/* Day Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    selectedDay === day
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {day}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-lg text-gray-600">Loading schedule...</div>
          </div>
        ) : (
          <Timeline
            scheduleData={scheduleData}
            currentUser={user}
            selectedDay={selectedDay}
            onAddEvent={handleAddEvent}
            onRemoveEvent={handleRemoveEvent}
            userEventIds={userEventIds}
          />
        )}
      </main>

      {/* Conflict Warning Modal */}
      {conflictModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-red-600 mb-2">
                Warning: Event Conflicts Detected
              </h3>
              
              {conflictModal.conflicts.length > 0 && (
                <div className="mb-4">
                  <p className="text-gray-700 mb-2">
                    This event conflicts with the following events in your schedule:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                    {conflictModal.conflicts.map((conflict, index) => (
                      <li key={index}>
                        {conflict.title} ({new Date(conflict.startDateTime).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })} - {new Date(conflict.endDateTime).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {conflictModal.capacityWarning && (
                <div className="mb-4">
                  <p className="text-gray-700">
                    This event is at or over capacity. You may still sign up, but tickets may not be available.
                  </p>
                </div>
              )}

              <p className="text-gray-700">
                Do you want to add this event anyway? Conflicting events will be shown in red on your timeline.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleConfirmAddEvent}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
              >
                Add Anyway
              </button>
              <button
                onClick={() => setConflictModal({ show: false, eventId: '', conflicts: [], capacityWarning: false })}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
