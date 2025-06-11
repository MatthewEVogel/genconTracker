import { useRouter } from "next/router";
import { useState } from "react";
import useUserStore from "@/store/useUserStore";

export default function LandingPage() {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { setUser } = useUserStore();

  const handleLogin = async () => {
    if (!name.trim()) return;
    
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create/find user');
      }
      
      setUser(data.user);
      router.push("/schedule");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    // Set full screen with light brown background
    <main className="flex items-center justify-center min-h-screen bg-amber-100 p-4">
      {/* Centered login card */}
      <div className="bg-white shadow-xl rounded-xl p-6 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">
          Welcome to the GenCon Tracker
        </h1>

        <label className="block mb-2 text-gray-600">Enter your name:</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Your name"
          disabled={isLoading}
          className="w-full px-4 py-2 rounded-md border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
        />

        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={isLoading || !name.trim()}
          className="mt-4 w-full py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating account...' : 'Enter'}
        </button>
      </div>
    </main>
  );
}
