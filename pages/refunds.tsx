import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useUserStore from '@/store/useUserStore';
import Navigation from '@/components/Navigation';

interface RefundCandidateTicket {
  id: string;
  eventId: string;
  recipient: string;
  purchaser: string;
  eventTitle?: string;
}

interface RefundedTicketInfo {
  eventId: string;
  recipient: string;
  refundedCount: number;
}

interface RefundAnalysisResult {
  recipient: string;
  needsRefund: RefundCandidateTicket[];
  alreadyRefunded: RefundedTicketInfo[];
  totalTickets: number;
  ticketsToRefund: number;
}

interface RefundsAnalysisResponse {
  refundAnalysis: RefundAnalysisResult[];
  summary: {
    totalRecipients: number;
    totalTicketsNeedingRefund: number;
    totalRecipientsNeedingRefunds: number;
  };
}

export default function Refunds() {
  const router = useRouter();
  const { user } = useUserStore();
  const [refundAnalysis, setRefundAnalysis] = useState<RefundAnalysisResult[]>([]);
  const [summary, setSummary] = useState<RefundsAnalysisResponse['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingTicketId, setProcessingTicketId] = useState<string | null>(null);
  const [expandedRecipients, setExpandedRecipients] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    
    loadRefundAnalysis();
  }, [user, router]);

  const loadRefundAnalysis = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/refunds/analyze');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load refund analysis');
      }
      
      const data: RefundsAnalysisResponse = await response.json();
      setRefundAnalysis(data.refundAnalysis);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load refund analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRefunded = async (ticketId: string, recipient: string) => {
    setProcessingTicketId(ticketId);
    setError('');

    try {
      // Create refund record using the new refunded events API
      const response = await fetch('/api/refunded-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: recipient,
          ticketId: ticketId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark ticket as refunded');
      }

      // Reload the analysis to reflect the change
      await loadRefundAnalysis();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark ticket as refunded');
    } finally {
      setProcessingTicketId(null);
    }
  };

  const toggleRecipientExpanded = (recipient: string) => {
    const newExpanded = new Set(expandedRecipients);
    if (newExpanded.has(recipient)) {
      newExpanded.delete(recipient);
    } else {
      newExpanded.add(recipient);
    }
    setExpandedRecipients(newExpanded);
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
      <Navigation currentPage="refunds" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Duplicate Event Refunds
          </h2>
          <p className="text-gray-600">
            This page shows people who have been registered for the same event multiple times. 
            Refund duplicate registrations, keeping only one per person per event.
          </p>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{summary.totalRecipientsNeedingRefunds}</div>
                <div className="text-sm text-blue-800">Recipients needing refunds</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">{summary.totalTicketsNeedingRefund}</div>
                <div className="text-sm text-red-800">Tickets needing refund</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <button
                  onClick={loadRefundAnalysis}
                  disabled={loading}
                  className="text-green-600 hover:text-green-800 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? 'Refreshing...' : '🔄 Refresh Analysis'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="text-lg text-gray-600">Loading refund analysis...</div>
          </div>
        )}

        {/* No Refunds Needed */}
        {!loading && refundAnalysis.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-500">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Duplicate Refunds Needed!</h3>
              <p className="text-gray-600">
                All event registrations are properly handled. No duplicate tickets requiring refunds were found.
              </p>
            </div>
          </div>
        )}

        {/* Refunds by Recipient */}
        {!loading && refundAnalysis.length > 0 && (
          <div className="space-y-4">
            {refundAnalysis.map((analysis) => (
              <div key={analysis.recipient} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div 
                  className="px-6 py-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleRecipientExpanded(analysis.recipient)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-3 text-lg">
                        {expandedRecipients.has(analysis.recipient) ? '📂' : '📁'}
                      </span>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{analysis.recipient}</h3>
                        <p className="text-sm text-gray-600">
                          {analysis.ticketsToRefund} ticket{analysis.ticketsToRefund !== 1 ? 's' : ''} needing refund
                          {analysis.alreadyRefunded.length > 0 && (
                            <span className="ml-2 text-green-600">
                              ({analysis.alreadyRefunded.reduce((sum, r) => sum + r.refundedCount, 0)} already refunded)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {analysis.totalTickets} total tickets
                      </div>
                    </div>
                  </div>
                </div>

                {expandedRecipients.has(analysis.recipient) && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    {/* Already Refunded Section */}
                    {analysis.alreadyRefunded.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-md font-medium text-green-700 mb-3 flex items-center">
                          ✅ Already Refunded
                        </h4>
                        <div className="space-y-2">
                          {analysis.alreadyRefunded.map((refunded, index) => (
                            <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-green-800">Event ID: {refunded.eventId}</span>
                                <span className="text-sm text-green-600">
                                  {refunded.refundedCount} refund{refunded.refundedCount !== 1 ? 's' : ''} processed
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Needs Refund Section */}
                    <div>
                      <h4 className="text-md font-medium text-red-700 mb-3 flex items-center">
                        ❌ Needs Refund ({analysis.needsRefund.length})
                      </h4>
                      <div className="space-y-3">
                        {analysis.needsRefund.map((ticket) => (
                          <div
                            key={ticket.id}
                            className="border border-red-200 bg-red-50 rounded-lg p-4 flex items-center justify-between"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                Event ID: {ticket.eventId}
                              </p>
                              <p className="text-sm text-gray-600">
                                Purchased by: {ticket.purchaser}
                              </p>
                              <p className="text-xs text-gray-500">
                                Ticket ID: {ticket.id}
                              </p>
                            </div>
                            <button
                              onClick={() => handleMarkRefunded(ticket.id, ticket.recipient)}
                              disabled={processingTicketId === ticket.id}
                              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
                            >
                              {processingTicketId === ticket.id ? 'Processing...' : 'Mark as Refunded ✓'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}