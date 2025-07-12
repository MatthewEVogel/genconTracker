import { useState, useRef, useEffect } from 'react';
import { Event } from '@/lib/services/client/eventService';

interface EventTooltipProps {
  event: Event;
  children: React.ReactNode;
  isUserEvent?: boolean;
}

export default function EventTooltip({ event, children, isUserEvent = false }: EventTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatDateTime = (dateTimeStr?: string) => {
    if (!dateTimeStr) return 'TBD';
    
    try {
      const date = new Date(dateTimeStr);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const time = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      return `${dayOfWeek}, ${dateStr} at ${time}`;
    } catch {
      return dateTimeStr;
    }
  };

  const formatEndDateTime = (startDateTime?: string, duration?: string) => {
    if (!startDateTime || !duration) return null;
    
    try {
      const start = new Date(startDateTime);
      const durationMatch = duration.match(/(\d+)/);
      if (!durationMatch) return null;
      
      const hours = parseInt(durationMatch[1]);
      const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
      
      return end.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return null;
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Position tooltip at mouse position
    setPosition({
      x: e.clientX,
      y: e.clientY - 10
    });

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 800); // Longer delay before showing to prevent accidental triggers
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Update tooltip position as mouse moves
    if (isVisible) {
      setPosition({
        x: e.clientX,
        y: e.clientY - 10
      });
    }
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100); // Small delay before hiding
  };

  const handleTooltipMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleTooltipMouseLeave = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const endTime = formatEndDateTime(event.startDateTime, event.duration);

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative"
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
          className="fixed z-[60] pointer-events-auto"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-sm w-80">
            {/* Arrow pointing down */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-300"></div>
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-px">
                <div className="w-0 h-0 border-l-7 border-r-7 border-t-7 border-l-transparent border-r-transparent border-t-white"></div>
              </div>
            </div>

            {/* Tooltip Content */}
            <div className="space-y-3">
              {/* Header */}
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className={`font-semibold text-sm leading-tight ${
                    event.isCanceled ? 'text-red-800 line-through' : 'text-gray-900'
                  }`}>
                    {event.title}
                  </h3>
                  {isUserEvent && (
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex-shrink-0">
                      In Schedule
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                    {event.id}
                  </span>
                  {event.eventType && (
                    <span className={`px-2 py-1 rounded text-xs ${
                      event.isCanceled 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {event.eventType}
                    </span>
                  )}
                </div>
              </div>

              {/* Canceled Banner */}
              {event.isCanceled && (
                <div className="bg-red-100 border border-red-300 rounded p-2">
                  <div className="flex items-center">
                    <svg className="h-4 w-4 text-red-600 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-red-800 font-semibold text-xs">CANCELED</span>
                  </div>
                </div>
              )}

              {/* Time Information */}
              <div>
                <h4 className="font-medium text-gray-700 text-xs mb-1">Schedule:</h4>
                <p className="text-xs text-gray-600">
                  {formatDateTime(event.startDateTime)}
                  {endTime && (
                    <>
                      <br />
                      <span className="text-gray-500">Ends at {endTime}</span>
                      {event.duration && (
                        <span className="text-gray-500"> ({event.duration})</span>
                      )}
                    </>
                  )}
                </p>
              </div>

              {/* Location & Cost */}
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {event.location && (
                    <div>
                      <h4 className="font-medium text-gray-700 text-xs mb-1">Location:</h4>
                      <p className="text-xs text-gray-600">📍 {event.location}</p>
                    </div>
                  )}
                </div>
                <div className="text-right ml-3">
                  {event.cost && (
                    <div>
                      <h4 className="font-medium text-gray-700 text-xs mb-1">Cost:</h4>
                      <p className="text-xs font-medium text-green-600">
                        ${event.cost}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Game System */}
              {event.gameSystem && (
                <div>
                  <h4 className="font-medium text-gray-700 text-xs mb-1">Game System:</h4>
                  <p className="text-xs text-gray-600">{event.gameSystem}</p>
                </div>
              )}

              {/* Requirements */}
              <div>
                <h4 className="font-medium text-gray-700 text-xs mb-1">Requirements:</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  {event.ageRequired && (
                    <p>👥 Age: {event.ageRequired}</p>
                  )}
                  {event.experienceRequired && (
                    <p>🎯 Experience: {event.experienceRequired}</p>
                  )}
                  {event.materialsRequired && event.materialsRequired !== 'No' && (
                    <p>📦 Materials: {event.materialsRequired}</p>
                  )}
                  {!event.ageRequired && !event.experienceRequired && (!event.materialsRequired || event.materialsRequired === 'No') && (
                    <p className="text-gray-500">No special requirements</p>
                  )}
                </div>
              </div>

              {/* Capacity */}
              {event.ticketsAvailable !== null && (
                <div>
                  <h4 className="font-medium text-gray-700 text-xs mb-1">Capacity:</h4>
                  <p className="text-xs text-blue-600 font-medium">
                    {event.ticketsAvailable} tickets maximum
                  </p>
                </div>
              )}

              {/* Description */}
              {event.shortDescription && (
                <div>
                  <h4 className="font-medium text-gray-700 text-xs mb-1">Description:</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {event.shortDescription}
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
