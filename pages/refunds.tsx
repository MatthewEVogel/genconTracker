import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import useUserStore from '@/store/useUserStore';

interface RefundTicket {
  id: string;
  eventId: string;
  eventName: string;
  recipient: string;
  purchaser: string;
  createdAt: string;
}

export default function Refunds() {
  const router = useRouter();
  const { data: session } = useSession();
  const { user, clearUser } = useUserStore();
  const [pasteText, setPasteText] = useState('');
  const [refundTickets, setRefundTickets] = useState<RefundTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user && !session?.user) {
      router.push('/');
      return;
    }
    
    // Load refund tickets on page load
    loadRefundTickets();
  }, [user, session, router]);

  const loadRefundTickets = async () => {
    try {
      const response = await fetch('/api/refunds');
      const data = await response.json();
      
      if (response.ok) {
        setRefundTickets(data.refundTickets || []);
      } else {
        setError(data.error || 'Failed to load refund tickets');
      }
    } catch (err) {
      setError('Failed to load refund tickets');
    }
  };

  const handleParseTickets = async () => {
    if (!pasteText.trim()) {
      setError('Please paste your GenCon purchase page text');
      return;
    }

    setParsing(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/refunds/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: pasteText }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setRefundTickets(data.refundTickets || []);
        setPasteText(''); // Clear the text area
      } else {
        setError(data.error || 'Failed to parse tickets');
      }
    } catch (err) {
      setError('Failed to parse tickets');
    } finally {
      setParsing(false);
    }
  };

  const handleMarkRefunded = async (ticketId: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/refunds/mark-refunded/${ticketId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setRefundTickets(data.refundTickets || []);
        setSuccess('Ticket marked as refunded');
      } else {
        setError(data.error || 'Failed to mark ticket as refunded');
      }
    } catch (err) {
      setError('Failed to mark ticket as refunded');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPasteText('');
    setError('');
    setSuccess('');
  };

  const handleLogout = () => {
    clearUser();
    router.push('/');
  };

  if (!user && !session?.user) {
    return <div>Loading...</div>;
  }

  const userData = session?.user || user;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                GenCon Tracker - Refunds
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {userData?.firstName} {userData?.lastName}!
              </span>
              <button
                onClick={() => router.push('/events')}
                className="text-blue-600 hover:text-blue-800"
              >
                Browse Events
              </button>
              <button
                onClick={() => router.push('/schedule')}
                className="text-blue-600 hover:text-blue-800"
              >
                My Schedule
              </button>
              <button
                onClick={() => router.push('/tickets')}
                className="text-blue-600 hover:text-blue-800"
              >
                Tickets
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="text-blue-600 hover:text-blue-800"
              >
                Settings
              </button>
              {userData?.isAdmin && (
                <button
                  onClick={() => router.push('/admin')}
                  className="text-purple-600 hover:text-purple-800 font-medium"
                >
                  Admin
                </button>
              )}
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Ticket Refund Manager</h2>
            <p className="text-sm text-gray-600">
              Paste your GenCon purchase page to identify duplicate tickets that need refunds.
            </p>
          </div>

          <div className="px-6 py-4">
            {/* Success Message */}
            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Paste Area */}
            <div className="mb-6">
              <label htmlFor="pasteText" className="block text-sm font-medium text-gray-700 mb-2">
                Paste Your GenCon Purchase Page:
              </label>
              <textarea
                id="pasteText"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste the entire GenCon purchase confirmation page here..."
                rows={8}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={handleParseTickets}
                  disabled={parsing || !pasteText.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {parsing ? 'Parsing...' : 'Parse Tickets'}
                </button>
                <button
                  onClick={handleClear}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Refund List */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Tickets Needing Refund ({refundTickets.length})
              </h3>
              
              {refundTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No duplicate tickets found.</p>
                  <p className="text-sm">Paste your purchase page above to check for duplicates.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {refundTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="border border-red-200 bg-red-50 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="text-red-600 font-medium mr-2">❌</span>
                          <div>
                            <p className="font-medium text-gray-900">
                              {ticket.eventId} - {ticket.eventName}
                            </p>
                            <p className="text-sm text-gray-600">
                              Recipient: {ticket.recipient} | Purchased by: {ticket.purchaser}
                            </p>
                            <p className="text-xs text-gray-500">
                              Added: {new Date(ticket.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkRefunded(ticket.id)}
                        disabled={loading}
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
                      >
                        {loading ? 'Processing...' : 'Mark as Refunded ✓'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
