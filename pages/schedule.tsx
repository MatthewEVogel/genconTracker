import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import useUserStore from "@/store/useUserStore";
import Timeline from "@/components/Timeline";
import CountdownTimer from "@/components/CountdownTimer";
import Navigation from "@/components/Navigation";
import { ScheduleService } from "@/lib/services/client/scheduleService";
import { RegistrationTimerService } from "@/lib/services/client/registrationTimerService";

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
  const [registrationTimer, setRegistrationTimer] = useState<{
    id: string;
    registrationDate: string;
  } | null>(null);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [newTimerDate, setNewTimerDate] = useState('');
  const [userTimezone, setUserTimezone] = useState<string>('America/New_York');

  useEffect(() => {
    // Redirect to login if no user is logged in
    if (!user) {
      router.push("/");
      return;
    }

    // Detect user's timezone
    try {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTimezone) {
        setUserTimezone(browserTimezone);
      }
    } catch (error) {
      console.log('Browser timezone detection failed, using EDT default');
    }

    fetchScheduleData();
    fetchUserEvents();
    fetchRegistrationTimer();
  }, [user, router]);

  const fetchScheduleData = async () => {
    try {
      const data = await ScheduleService.getScheduleData();
      setScheduleData(data.scheduleData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const fetchUserEvents = async () => {
    if (!user) return;
    
    try {
      const data = await ScheduleService.getUserEvents(user.id);
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
      const data = await ScheduleService.addUserEvent(user.id, eventId);

      // Check for conflicts or capacity warnings
      if ((data.conflicts && data.conflicts.length > 0) || data.capacityWarning) {
        setConflictModal({
          show: true,
          eventId,
          conflicts: data.conflicts || [],
          capacityWarning: data.capacityWarning || false
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
      await ScheduleService.removeUserEvent(user.id, eventId);

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

  const fetchRegistrationTimer = async () => {
    try {
      const data = await RegistrationTimerService.getRegistrationTimer();
      setRegistrationTimer(data.timer);
    } catch (err) {
      console.error('Error fetching registration timer:', err);
      // Don't show error for missing timer, it's optional
    }
  };

  const handleSetTimer = async () => {
    if (!user || !user.isAdmin || !newTimerDate) return;

    try {
      // Get the browser's timezone offset in minutes (e.g. -240 for EDT)
      const timezoneOffsetMinutes = new Date().getTimezoneOffset();

      const timerData = {
        id: registrationTimer?.id,
        registrationDate: newTimerDate,
        userId: user.id,
        timezoneOffsetMinutes,
      };

      // Debug: Log the payload being sent
      console.log('Sending payload:', timerData);
      console.log('timezoneOffsetMinutes:', timezoneOffsetMinutes);

      const data = await RegistrationTimerService.setRegistrationTimer(timerData);

      setRegistrationTimer(data.timer);
      setShowTimerModal(false);
      setNewTimerDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleLogout = async () => {
    try {
      // Sign out from NextAuth first if using Google OAuth
      if (user?.provider === 'google') {
        await signOut({ redirect: false });
      }
      
      // Clear Zustand store after NextAuth signout
      logout();
      
      // Small delay to ensure cleanup is complete
      setTimeout(() => {
        router.push("/");
      }, 100);
    } catch (error) {
      console.error('Error during logout:', error);
      // Clear store and redirect even if there's an error
      logout();
      router.push("/");
    }
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
      <Navigation title="GenCon Events" currentPage="schedule" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}

        {/* Registration Countdown Timer */}
        {registrationTimer && (
          <div className="mb-6">
            <CountdownTimer 
              targetDate={new Date(registrationTimer.registrationDate)} 
              className="max-w-4xl mx-auto"
            />
          </div>
        )}

        {/* Admin Timer Controls */}
        {user.isAdmin && (
          <div className="mb-6 flex justify-center">
            <button
              onClick={() => {
                setShowTimerModal(true);
                if (registrationTimer) {
                  // Convert the existing timer to local datetime-local format
                  const existingDate = new Date(registrationTimer.registrationDate);
                  // Format for datetime-local input (YYYY-MM-DDTHH:MM)
                  const year = existingDate.getFullYear();
                  const month = String(existingDate.getMonth() + 1).padStart(2, '0');
                  const day = String(existingDate.getDate()).padStart(2, '0');
                  const hours = String(existingDate.getHours()).padStart(2, '0');
                  const minutes = String(existingDate.getMinutes()).padStart(2, '0');
                  const localDateString = `${year}-${month}-${day}T${hours}:${minutes}`;
                  setNewTimerDate(localDateString);
                }
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
            >
              {registrationTimer ? 'Update Registration Timer' : 'Set Registration Timer'}
            </button>
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
            currentUser={{ id: user.id, name: `${user.firstName} ${user.lastName}` }}
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

      {/* Timer Setting Modal */}
      {showTimerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-purple-600 mb-2">
                {registrationTimer ? 'Update Registration Timer' : 'Set Registration Timer'}
              </h3>
              
              <p className="text-gray-700 mb-4">
                Set the date and time when event registration opens. This will display a countdown timer for all users.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Date & Time ({userTimezone})
                </label>
                <input
                  type="datetime-local"
                  value={newTimerDate}
                  onChange={(e) => setNewTimerDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Time will be set in your local timezone: {userTimezone}
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleSetTimer}
                disabled={!newTimerDate}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {registrationTimer ? 'Update Timer' : 'Set Timer'}
              </button>
              <button
                onClick={() => {
                  setShowTimerModal(false);
                  setNewTimerDate('');
                }}
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
