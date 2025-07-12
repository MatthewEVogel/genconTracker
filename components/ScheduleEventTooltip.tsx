import { useState, useRef, useEffect } from 'react';
import { ScheduleEvent } from '@/lib/services/client/scheduleService';

interface ScheduleEventTooltipProps {
  event: ScheduleEvent;
  children: React.ReactNode;
  isUserEvent?: boolean;
}

export default function ScheduleEventTooltip({ event, children, isUserEvent = false }: ScheduleEventTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatDateTime = (dateTimeStr?: string | null) => {
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

  const formatEndDateTime = (endDateTimeStr?: string | null) => {
    if (!endDateTimeStr) return null;
    
    try {
      const end = new Date(endDateTimeStr);
      return end.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return null;
    }
  };

  const calculateDuration = (startDateTime?: string | null, endDateTime?: string | null) => {
    if (!startDateTime || !endDateTime) return null;
    
    try {
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      const durationMs = end.getTime() - start.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      }
      return null;
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

  const endTime = formatEndDateTime(event.endDateTime);
  const duration = calculateDuration(event.startDateTime, event.endDateTime);

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
                  <h3 className="font-semibold text-sm leading-tight text-gray-900">
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
                    <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                      {event.eventType}
                    </span>
                  )}
                </div>
              </div>

              {/* Time Information */}
              <div>
                <h4 className="font-medium text-gray-700 text-xs mb-1">Schedule:</h4>
                <p className="text-xs text-gray-600">
                  {formatDateTime(event.startDateTime)}
                  {endTime && (
                    <>
                      <br />
                      <span className="text-gray-500">Ends at {endTime}</span>
                      {duration && (
                        <span className="text-gray-500"> ({duration})</span>
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

              {/* Capacity */}
              {event.ticketsAvailable !== null && event.ticketsAvailable !== undefined && (
                <div>
                  <h4 className="font-medium text-gray-700 text-xs mb-1">Capacity:</h4>
                  <p className="text-xs text-blue-600 font-medium">
                    {event.ticketsAvailable} tickets maximum
                  </p>
                </div>
              )}

              {/* Additional Info */}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  💡 Click the event for more options (add/remove from schedule)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
