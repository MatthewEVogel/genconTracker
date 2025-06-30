import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useUserStore from "@/store/useUserStore";
import { TicketAssignment, getPriorityEmoji, getPriorityLabel } from "@/utils/ticketAlgorithm";

// Helper function to generate GenCon event URL from event ID
const getGenConEventUrl = (eventId: string): string | null => {
  // Extract last 6 digits from event ID (format: XXXXXXXnnnnnn)
  const match = eventId.match(/(\d{6})$/);
  return match ? `https://www.gencon.com/events/${match[1]}` : null;
};

// Helper function to sort names alphabetically by last name
const sortNamesByLastName = (names: string[]): string[] => {
  return names.sort((a, b) => {
    // Split names to get last name for sorting
    const aLastName = a.split(' ').pop() || '';
    const bLastName = b.split(' ').pop() || '';
    return aLastName.localeCompare(bLastName);
  });
};

export default function TicketsPage() {
  const router = useRouter();
  const { user, logout } = useUserStore();
  const [assignment, setAssignment] = useState<TicketAssignment | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCalculated, setLastCalculated] = useState<string>("");

  useEffect(() => {
    // Redirect to login if no user is logged in
    if (!user) {
      router.push("/");
      return;
    }

    fetchTicketAssignment();
  }, [user, router]);

  const fetchTicketAssignment = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/${user.id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch ticket assignment');
      }
      
      setAssignment(data.assignment);
      setErrors(data.errors || []);
      setLastCalculated(data.lastCalculated);
    } catch (err) {
      console.error('Error fetching ticket assignment:', err);
      setErrors([err instanceof Error ? err.message : 'An error occurred']);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const calculateTotalCost = () => {
    if (!assignment) return 0;
    return assignment.events.reduce((total, event) => {
      const cost = parseFloat(event.cost) || 0;
      return total + cost;
    }, 0);
  };

  const groupEventsByPriority = () => {
    if (!assignment) return { critical: [], important: [], normal: [] };
    
    const critical = assignment.events.filter(e => e.priority === 3);
    const important = assignment.events.filter(e => e.priority === 2);
    const normal = assignment.events.filter(e => e.priority === 1);
    
    return { critical, important, normal };
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
                Ticket Shopping List
              </h1>
              <nav className="flex space-x-4">
                <button
                  onClick={() => router.push('/schedule')}
                  className="text-blue-600 hover:text-blue-800 transition"
                >
                  My Schedule
                </button>
                <button
                  onClick={() => router.push('/events')}
                  className="text-blue-600 hover:text-blue-800 transition"
                >
                  Browse Events
                </button>
                {user.isAdmin && (
                  <button
                    onClick={() => router.push('/admin')}
                    className="text-purple-600 hover:text-purple-800 transition font-medium"
                  >
                    Admin
                  </button>
                )}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">Welcome, {user.firstName} {user.lastName}!</span>
              <button
                onClick={() => router.push('/settings')}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
              >
                Settings
              </button>
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
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-lg text-gray-600">Calculating ticket assignments...</div>
          </div>
        ) : (
          <>
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h3 className="text-red-800 font-medium mb-2">Errors:</h3>
                <ul className="list-disc list-inside text-red-700 text-sm">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {assignment ? (
              <>
                {/* Summary Card */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {assignment.totalTickets}
                      </div>
                      <div className="text-sm text-gray-600">
                        Total Tickets (Limit: 50)
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className={`h-2 rounded-full ${
                            assignment.totalTickets > 45 ? 'bg-red-500' : 
                            assignment.totalTickets > 35 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${(assignment.totalTickets / 50) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        ${calculateTotalCost().toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Estimated Total Cost
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600">
                        {assignment.events.length}
                      </div>
                      <div className="text-sm text-gray-600">
                        Events to Purchase
                      </div>
                    </div>
                  </div>
                  
                  {lastCalculated && (
                    <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                      <p className="text-sm text-gray-500">
                        Last calculated: {new Date(lastCalculated).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Events by Priority */}
                {(() => {
                  const { critical, important, normal } = groupEventsByPriority();
                  
                  return (
                    <div className="space-y-6">
                      {critical.length > 0 && (
                        <div className="bg-white rounded-lg shadow-md p-6">
                          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            🔴 Critical Priority Events ({critical.length})
                          </h2>
                          <div className="space-y-4">
                            {critical.map((event, index) => (
                              <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 pr-4">
                                    <h3 className="font-medium text-gray-900">{event.eventTitle}</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                      Event ID: {event.eventId}
                                    </p>
                                    <div className="text-sm text-gray-600">
                                      <span className="font-medium">Buying for:</span>
                                      <ul className="mt-1 space-y-1">
                                        {sortNamesByLastName(event.buyingFor).map((name, nameIndex) => (
                                          <li key={nameIndex} className="ml-2">• {name}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <div className="text-lg font-semibold text-green-600">
                                      ${event.cost}
                                    </div>
                                    {getGenConEventUrl(event.eventId) && (
                                      <a
                                        href={getGenConEventUrl(event.eventId)!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition text-sm font-medium border border-blue-300"
                                        title="View on GenCon"
                                      >
                                        View on GenCon 🔗
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {important.length > 0 && (
                        <div className="bg-white rounded-lg shadow-md p-6">
                          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            🟡 Important Priority Events ({important.length})
                          </h2>
                          <div className="space-y-4">
                            {important.map((event, index) => (
                              <div key={index} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 pr-4">
                                    <h3 className="font-medium text-gray-900">{event.eventTitle}</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                      Event ID: {event.eventId}
                                    </p>
                                    <div className="text-sm text-gray-600">
                                      <span className="font-medium">Buying for:</span>
                                      <ul className="mt-1 space-y-1">
                                        {sortNamesByLastName(event.buyingFor).map((name, nameIndex) => (
                                          <li key={nameIndex} className="ml-2">• {name}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <div className="text-lg font-semibold text-green-600">
                                      ${event.cost}
                                    </div>
                                    {getGenConEventUrl(event.eventId) && (
                                      <a
                                        href={getGenConEventUrl(event.eventId)!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition text-sm font-medium border border-blue-300"
                                        title="View on GenCon"
                                      >
                                        View on GenCon 🔗
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {normal.length > 0 && (
                        <div className="bg-white rounded-lg shadow-md p-6">
                          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            ⚪ Normal Priority Events ({normal.length})
                          </h2>
                          <div className="space-y-4">
                            {normal.map((event, index) => (
                              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 pr-4">
                                    <h3 className="font-medium text-gray-900">{event.eventTitle}</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                      Event ID: {event.eventId}
                                    </p>
                                    <div className="text-sm text-gray-600">
                                      <span className="font-medium">Buying for:</span>
                                      <ul className="mt-1 space-y-1">
                                        {sortNamesByLastName(event.buyingFor).map((name, nameIndex) => (
                                          <li key={nameIndex} className="ml-2">• {name}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <div className="text-lg font-semibold text-green-600">
                                      ${event.cost}
                                    </div>
                                    {getGenConEventUrl(event.eventId) && (
                                      <a
                                        href={getGenConEventUrl(event.eventId)!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition text-sm font-medium border border-blue-300"
                                        title="View on GenCon"
                                      >
                                        View on GenCon 🔗
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {assignment.events.length === 0 && (
                  <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <div className="text-gray-500 text-lg">
                      No tickets assigned yet.
                    </div>
                    <p className="text-gray-400 mt-2">
                      Add some events to your schedule to see your ticket assignments.
                    </p>
                    <button
                      onClick={() => router.push('/events')}
                      className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                    >
                      Browse Events
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-gray-500 text-lg">
                  Unable to calculate ticket assignments.
                </div>
                <button
                  onClick={fetchTicketAssignment}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  Try Again
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
