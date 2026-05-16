import { EventInstance } from '@/lib/services/server/eventsListService';

interface EventScheduleGridProps {
  instances: EventInstance[];
  onInstanceClick?: (instance: EventInstance) => void;
}

const DAYS = ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday'];

// Helper to get day name from date
const getDayName = (dateStr: string | null): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  } catch {
    return '';
  }
};

// Helper to get formatted time from date
const getTimeStr = (dateStr: string | null): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  } catch {
    return '';
  }
};

// Helper to get hour for sorting (0-23)
const getHour = (dateStr: string | null): number => {
  if (!dateStr) return 0;
  try {
    const date = new Date(dateStr);
    return date.getUTCHours();
  } catch {
    return 0;
  }
};

export default function EventScheduleGrid({ instances, onInstanceClick }: EventScheduleGridProps) {
  // Group instances by day and time
  const instancesByDay = new Map<string, EventInstance[]>();
  
  instances.forEach(instance => {
    const day = getDayName(instance.startDateTime);
    if (day) {
      const existing = instancesByDay.get(day) || [];
      existing.push(instance);
      instancesByDay.set(day, existing);
    }
  });

  // Sort instances within each day by time
  instancesByDay.forEach((dayInstances, day) => {
    dayInstances.sort((a, b) => {
      const hourA = getHour(a.startDateTime);
      const hourB = getHour(b.startDateTime);
      return hourA - hourB;
    });
  });

  // Get all unique times across all days
  const allTimes = new Set<string>();
  instances.forEach(instance => {
    const timeStr = getTimeStr(instance.startDateTime);
    if (timeStr) allTimes.add(timeStr);
  });
  const sortedTimes = Array.from(allTimes).sort((a, b) => {
    // Sort by hour
    const hourA = parseInt(a.split(':')[0]);
    const hourB = parseInt(b.split(':')[0]);
    const periodA = a.includes('PM') ? 12 : 0;
    const periodB = b.includes('PM') ? 12 : 0;
    const totalA = (hourA === 12 ? 0 : hourA) + periodA;
    const totalB = (hourB === 12 ? 0 : hourB) + periodB;
    return totalA - totalB;
  });

  return (
    <div className="w-full overflow-x-auto">
      <div className="text-xs text-gray-500 mb-2 font-medium">
        Available Times ({instances.length} session{instances.length !== 1 ? 's' : ''})
      </div>
      <div className="min-w-max border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-200">
                Time
              </th>
              {DAYS.map(day => (
                <th key={day} className="px-2 py-2 text-center font-medium text-gray-700 border-r border-gray-200 last:border-r-0 min-w-[60px]">
                  {day.substring(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTimes.map(timeStr => (
              <tr key={timeStr} className="hover:bg-gray-50">
                <td className="px-2 py-2 font-medium text-gray-600 border-r border-gray-200 whitespace-nowrap">
                  {timeStr}
                </td>
                {DAYS.map(day => {
                  const dayInstances = instancesByDay.get(day) || [];
                  const instance = dayInstances.find(inst => getTimeStr(inst.startDateTime) === timeStr);
                  
                  return (
                    <td key={day} className="px-2 py-2 text-center border-r border-gray-200 last:border-r-0">
                      {instance ? (
                        <button
                          onClick={() => onInstanceClick && onInstanceClick(instance)}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                            instance.isCanceled
                              ? 'bg-red-100 text-red-600 cursor-not-allowed line-through'
                              : instance.isUserEvent
                              ? 'bg-green-100 text-green-700 hover:bg-green-200 ring-2 ring-green-400'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                          }`}
                          disabled={instance.isCanceled}
                          title={
                            instance.isCanceled
                              ? 'Canceled'
                              : instance.isUserEvent
                              ? 'In your schedule'
                              : 'Click to add'
                          }
                        >
                          {instance.isCanceled ? '✗' : instance.isUserEvent ? '✓' : '●'}
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold">●</span>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold ring-2 ring-green-400">✓</span>
          <span>In Schedule</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 font-bold line-through">✗</span>
          <span>Canceled</span>
        </div>
      </div>
    </div>
  );
}
