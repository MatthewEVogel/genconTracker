import { useEffect, useState } from 'react';

interface CanceledEvent {
  id: string;
  title: string;
  startDateTime?: string;
  canceledAt: string;
}

interface CanceledEventAlertProps {
  userId: string;
}

export default function CanceledEventAlert({ userId }: CanceledEventAlertProps) {
  const [canceledEvents, setCanceledEvents] = useState<CanceledEvent[]>([]);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const checkForCanceledEvents = async () => {
      try {
        // Get user's canceled events
        const response = await fetch(`/api/user-events?userId=${userId}&canceled=true`);
        if (!response.ok) return;

        const data = await response.json();
        const canceled = data.events?.filter((event: any) => event.isCanceled) || [];

        if (canceled.length === 0) return;

        // Check session storage to see which ones we've already shown
        const shownCanceledEvents = JSON.parse(
          sessionStorage.getItem('shownCanceledEvents') || '[]'
        ) as string[];

        // Find events we haven't shown alerts for yet
        const newCanceledEvents = canceled.filter(
          (event: any) => !shownCanceledEvents.includes(event.id)
        );

        if (newCanceledEvents.length > 0) {
          setCanceledEvents(newCanceledEvents);
          setShowAlert(true);
        }
      } catch (error) {
        console.error('Error checking for canceled events:', error);
      }
    };

    checkForCanceledEvents();
  }, [userId]);

  const handleDismiss = () => {
    // Mark these events as shown in session storage
    const shownCanceledEvents = JSON.parse(
      sessionStorage.getItem('shownCanceledEvents') || '[]'
    ) as string[];

    const newShownEvents = [
      ...shownCanceledEvents,
      ...canceledEvents.map(event => event.id)
    ];

    sessionStorage.setItem('shownCanceledEvents', JSON.stringify(newShownEvents));
    setShowAlert(false);
  };

  if (!showAlert || canceledEvents.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">
                Event{canceledEvents.length > 1 ? 's' : ''} Canceled
              </h3>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">
              The following event{canceledEvents.length > 1 ? 's have' : ' has'} been canceled by GenCon:
            </p>
            
            <div className="space-y-3">
              {canceledEvents.map((event) => (
                <div key={event.id} className="border-l-4 border-red-400 bg-red-50 p-3">
                  <div className="font-medium text-red-800">{event.title}</div>
                  {event.startDateTime && (
                    <div className="text-sm text-red-600 mt-1">
                      Originally scheduled: {event.startDateTime}
                    </div>
                  )}
                  <div className="text-xs text-red-500 mt-1">
                    Canceled: {new Date(event.canceledAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-sm text-gray-600 mb-4">
            <p>
              These events have been automatically removed from your schedule. 
              You may want to look for alternative events or contact GenCon for more information.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleDismiss}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
