import { useState, useEffect, useCallback } from 'react';

interface AlertState {
  show: boolean;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface CustomAlertModalProps {
  alertState: AlertState;
  onClose: () => void;
}

function CustomAlertModal({ alertState, onClose }: CustomAlertModalProps) {
  const { show, type, title, message, onConfirm, onCancel } = alertState;

  // Handle escape key press
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && show) {
        if (type === 'confirm' && onCancel) {
          onCancel();
        }
        onClose();
      }
    };

    if (show) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [show, type, onCancel, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              {type === 'alert' ? (
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6 text-yellow-600"
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
              )}
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">
                {title}
              </h3>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {message}
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            {type === 'confirm' && (
              <button
                onClick={() => {
                  if (onCancel) onCancel();
                  onClose();
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                onClose();
              }}
              className={`px-4 py-2 text-white rounded-md transition ${
                type === 'alert' 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {type === 'alert' ? 'OK' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useCustomAlerts() {
  const [alertState, setAlertState] = useState<AlertState>({
    show: false,
    type: 'alert',
    title: '',
    message: '',
  });

  const closeAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, show: false }));
  }, []);

  const customAlert = useCallback((message: string, title: string = 'Alert') => {
    return new Promise<void>((resolve) => {
      setAlertState({
        show: true,
        type: 'alert',
        title,
        message,
        onConfirm: resolve,
      });
    });
  }, []);

  const customConfirm = useCallback((message: string, title: string = 'Confirm') => {
    return new Promise<boolean>((resolve) => {
      setAlertState({
        show: true,
        type: 'confirm',
        title,
        message,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, []);

  const AlertComponent = useCallback(() => (
    <CustomAlertModal alertState={alertState} onClose={closeAlert} />
  ), [alertState, closeAlert]);

  return {
    customAlert,
    customConfirm,
    AlertComponent,
  };
}
