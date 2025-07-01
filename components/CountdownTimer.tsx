import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: Date;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function CountdownTimer({ targetDate, className = '' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string>('America/New_York'); // Default to EDT
  const [timezoneDetected, setTimezoneDetected] = useState(false);

  // Detect user's timezone on component mount
  useEffect(() => {
    const detectTimezone = async () => {
      try {
        // First try to get timezone from browser
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (browserTimezone) {
          setUserTimezone(browserTimezone);
          setTimezoneDetected(true);
          return;
        }
      } catch (error) {
        console.log('Browser timezone detection failed:', error);
      }

      // Try geolocation as fallback
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              // Use a timezone API to get timezone from coordinates
              const { latitude, longitude } = position.coords;
              const response = await fetch(
                `https://api.timezonedb.com/v2.1/get-time-zone?key=demo&format=json&by=position&lat=${latitude}&lng=${longitude}`
              );
              
              if (response.ok) {
                const data = await response.json();
                if (data.zoneName) {
                  setUserTimezone(data.zoneName);
                  setTimezoneDetected(true);
                  return;
                }
              }
            } catch (error) {
              console.log('Geolocation timezone detection failed:', error);
            }
            
            // If all else fails, keep EDT default
            setTimezoneDetected(true);
          },
          (error) => {
            console.log('Geolocation permission denied or failed:', error);
            // Keep EDT default
            setTimezoneDetected(true);
          },
          { timeout: 5000 }
        );
      } else {
        // Geolocation not supported, keep EDT default
        setTimezoneDetected(true);
      }
    };

    detectTimezone();
  }, []);

  useEffect(() => {
    if (!timezoneDetected) return; // Wait for timezone detection

    const calculateTimeLeft = () => {
      // Create dates in the user's timezone
      const now = new Date();
      const target = new Date(targetDate);
      
      // Convert target date to user's timezone for display
      const targetInUserTz = new Date(target.toLocaleString("en-US", { timeZone: userTimezone }));
      const nowInUserTz = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
      
      // Calculate difference using UTC timestamps to avoid timezone issues
      const difference = target.getTime() - now.getTime();

      // Add a small buffer (1 second) to prevent premature expiration
      if (difference > 1000) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
        setIsExpired(false);
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsExpired(true);
      }
    };

    // Calculate immediately
    calculateTimeLeft();

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate, userTimezone, timezoneDetected]);

  if (!timezoneDetected) {
    return (
      <div className={`text-center p-4 bg-gray-100 border border-gray-300 rounded-lg ${className}`}>
        <h2 className="text-xl font-bold text-gray-800 mb-2">⏰ Loading Timer...</h2>
        <p className="text-gray-600">Detecting your timezone...</p>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className={`text-center p-4 bg-red-100 border border-red-300 rounded-lg ${className}`}>
        <h2 className="text-xl font-bold text-red-800 mb-2">🎟️ Registration is Open!</h2>
        <p className="text-red-700">Event registration has started. Good luck!</p>
      </div>
    );
  }

  return (
    <div className={`text-center p-4 bg-amber-100 border border-amber-300 rounded-lg ${className}`}>
      <h2 className="text-xl font-bold text-amber-800 mb-2">⏰ Time Until Registration</h2>
      <div className="flex justify-center space-x-4 text-lg font-mono">
        <div className="bg-white px-3 py-2 rounded shadow">
          <div className="text-2xl font-bold text-amber-800">{timeLeft.days}</div>
          <div className="text-xs text-amber-600">DAYS</div>
        </div>
        <div className="bg-white px-3 py-2 rounded shadow">
          <div className="text-2xl font-bold text-amber-800">{timeLeft.hours}</div>
          <div className="text-xs text-amber-600">HOURS</div>
        </div>
        <div className="bg-white px-3 py-2 rounded shadow">
          <div className="text-2xl font-bold text-amber-800">{timeLeft.minutes}</div>
          <div className="text-xs text-amber-600">MINUTES</div>
        </div>
        <div className="bg-white px-3 py-2 rounded shadow">
          <div className="text-2xl font-bold text-amber-800">{timeLeft.seconds}</div>
          <div className="text-xs text-amber-600">SECONDS</div>
        </div>
      </div>
      <p className="text-amber-700 mt-2 text-sm">
        Registration opens: {new Date(targetDate).toLocaleString('en-US', { 
          timeZone: userTimezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short'
        })}
      </p>
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500 border-t pt-2">
          <p>Debug Info:</p>
          <p>Detected Timezone: {userTimezone}</p>
          <p>Target (UTC): {new Date(targetDate).toISOString()}</p>
          <p>Now (UTC): {new Date().toISOString()}</p>
          <p>Target (Local): {new Date(targetDate).toLocaleString('en-US', { timeZone: userTimezone })}</p>
          <p>Now (Local): {new Date().toLocaleString('en-US', { timeZone: userTimezone })}</p>
          <p>Difference: {new Date(targetDate).getTime() - new Date().getTime()}ms</p>
        </div>
      )}
    </div>
  );
}
