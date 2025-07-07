import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import useUserStore from "@/store/useUserStore";
import Timeline from "@/components/Timeline";
import CountdownTimer from "@/components/CountdownTimer";
import Navigation from "@/components/Navigation";

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
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [wishlistText, setWishlistText] = useState('');
  const [wishlistImporting, setWishlistImporting] = useState(false);
  const [wishlistResults, setWishlistResults] = useState<any>(null);

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

  const fetchRegistrationTimer = async () => {
    try {
      const response = await fetch('/api/registration-timer');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch registration timer');
      }
      
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

      const method = registrationTimer ? 'PUT' : 'POST';
      const body = registrationTimer
        ? {
            id: registrationTimer.id,
            registrationDate: newTimerDate,    // "YYYY-MM-DDTHH:MM"
            userId: user.id,
            timezoneOffsetMinutes,             // Include timezone offset
          }
        : {
            registrationDate: newTimerDate,
            userId: user.id,
            timezoneOffsetMinutes,             // Include timezone offset
          };

      // Debug: Log the payload being sent
      console.log('Sending payload:', body);
      console.log('timezoneOffsetMinutes:', timezoneOffsetMinutes);

      const response = await fetch('/api/registration-timer', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to set registration timer');
      }

      setRegistrationTimer(data.timer);
      setShowTimerModal(false);
      setNewTimerDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleImportWishlist = async () => {
    if (!user || !wishlistText.trim()) return;

    try {
      setWishlistImporting(true);
      setError('');

      const response = await fetch('/api/wishlist/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          wishlistText: wishlistText
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import wishlist');
      }

      setWishlistResults(data);
      
      // Refresh schedule data to show newly added events
      await fetchScheduleData();
      await fetchUserEvents();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during import');
    } finally {
      setWishlistImporting(false);
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

        {/* Control Buttons */}
        <div className="mb-6 flex justify-center space-x-4">
          {/* Wishlist Import Button */}
          <button
            onClick={() => {
              setShowWishlistModal(true);
              setWishlistResults(null);
              setWishlistText('');
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
          >
            Import Wishlist
          </button>

          {/* Admin Timer Controls */}
          {user.isAdmin && (
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
          )}
        </div>

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

      {/* Wishlist Import Modal */}
      {showWishlistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-green-600 mb-2">
                Import GenCon Wishlist
              </h3>
              
              <p className="text-gray-700 mb-4">
                Paste your GenCon wishlist content below. The system will automatically extract event IDs and add them to your schedule.
              </p>

              {!wishlistResults ? (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wishlist Content
                    </label>
                    <textarea
                      value={wishlistText}
                      onChange={(e) => setWishlistText(e.target.value)}
                      placeholder="Paste your GenCon wishlist content here..."
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      The system will look for event IDs in the format: RPG25ND272941, WKS25ND272414, etc.
                    </p>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={handleImportWishlist}
                      disabled={wishlistImporting || !wishlistText.trim()}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {wishlistImporting ? 'Importing...' : 'Import Wishlist'}
                    </button>
                    <button
                      onClick={() => {
                        setShowWishlistModal(false);
                        setWishlistText('');
                        setWishlistResults(null);
                      }}
                      className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Import Results */}
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-800 mb-2">Import Summary</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-green-600">{wishlistResults.summary.successfullyAdded}</div>
                          <div className="text-gray-600">Added</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-yellow-600">{wishlistResults.summary.alreadyRegistered}</div>
                          <div className="text-gray-600">Already Registered</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-red-600">{wishlistResults.summary.notFoundInDatabase}</div>
                          <div className="text-gray-600">Not Found</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-orange-600">{wishlistResults.summary.canceledEvents}</div>
                          <div className="text-gray-600">Canceled</div>
                        </div>
                      </div>
                    </div>

                    {/* Added Events */}
                    {wishlistResults.details.addedEvents.length > 0 && (
                      <div className="bg-white border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-800 mb-2">
                          ✅ Successfully Added ({wishlistResults.details.addedEvents.length})
                        </h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {wishlistResults.details.addedEvents.map((event: any, index: number) => (
                            <div key={index} className="text-sm text-gray-700">
                              <span className="font-mono text-blue-600">{event.id}</span> - {event.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Already Registered */}
                    {wishlistResults.details.alreadyRegistered.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-medium text-yellow-800 mb-2">
                          ⚠️ Already Registered ({wishlistResults.details.alreadyRegistered.length})
                        </h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {wishlistResults.details.alreadyRegistered.map((event: any, index: number) => (
                            <div key={index} className="text-sm text-gray-700">
                              <span className="font-mono text-blue-600">{event.eventId}</span> - {event.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Not Found */}
                    {wishlistResults.details.notFound.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="font-medium text-red-800 mb-2">
                          ❌ Not Found in Database ({wishlistResults.details.notFound.length})
                        </h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {wishlistResults.details.notFound.map((event: any, index: number) => (
                            <div key={index} className="text-sm text-gray-700">
                              <span className="font-mono text-blue-600">{event.eventId}</span> - {event.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Canceled Events */}
                    {wishlistResults.details.canceled.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <h4 className="font-medium text-orange-800 mb-2">
                          🚫 Canceled Events ({wishlistResults.details.canceled.length})
                        </h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {wishlistResults.details.canceled.map((event: any, index: number) => (
                            <div key={index} className="text-sm text-gray-700">
                              <span className="font-mono text-blue-600">{event.eventId}</span> - {event.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setShowWishlistModal(false);
                        setWishlistText('');
                        setWishlistResults(null);
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => {
                        setWishlistResults(null);
                        setWishlistText('');
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition"
                    >
                      Import Another
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
