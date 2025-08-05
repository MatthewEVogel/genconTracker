import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import useUserStore from "@/store/useUserStore";

export default function LandingPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const { user, setUser, logout, hasHydrated } = useUserStore();
  const { data: session, status } = useSession();

  // Check if user is already logged in and redirect
  useEffect(() => {
    if (hasHydrated && status !== "loading") {
      if (session?.user) {
        // User is logged in via NextAuth, sync with Zustand store
        setUser(session.user as any);
        router.push("/schedule");
      } else if (user) {
        // Check if user in store is a Google user but no NextAuth session
        // This means they've been logged out from NextAuth but store wasn't cleared
        if (user.provider === 'google') {
          // Clear the store since NextAuth session is gone
          logout();
          setIsCheckingAuth(false);
        } else {
          // User is logged in via manual registration - check approval status
          if (user.provider === 'manual' && !user.approved) {
            router.push("/waiting-approval");
          } else {
            router.push("/schedule");
          }
        }
      } else {
        setIsCheckingAuth(false);
      }
    }
  }, [user, session, status, router, hasHydrated, setUser, logout]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      setError('All fields are required');
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch('/api/user-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create/find user');
      }
      
      // Sign in the user with NextAuth using credentials provider
      const signInResult = await signIn('credentials', {
        email: formData.email,
        redirect: false
      });
      
      if (signInResult?.error) {
        throw new Error('Failed to sign in after account creation');
      }
      
      // The session will be established and _app.tsx will handle the redirect
      // based on the user's approval status
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-amber-100">
        <div className="bg-white shadow-xl rounded-xl p-6">
          <div className="text-center text-gray-600">Checking authentication...</div>
        </div>
      </main>
    );
  }

  return (
    // Set full screen with light brown background
    <main className="flex items-center justify-center min-h-screen bg-amber-100 p-4">
      {/* Centered login card */}
      <div className="bg-white shadow-xl rounded-xl p-6 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
          Welcome to the GenCon Tracker
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600">First Name:</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              placeholder="First name"
              disabled={isLoading}
              required
              className="w-full px-4 py-2 rounded-md border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600">Last Name:</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              placeholder="Last name"
              disabled={isLoading}
              required
              className="w-full px-4 py-2 rounded-md border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600">Email:</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="your.email@example.com"
              disabled={isLoading}
              required
              className="w-full px-4 py-2 rounded-md border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()}
            className="w-full py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-3 text-sm text-gray-500">or</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* Google Sign In */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/schedule' })}
          disabled={isLoading}
          className="w-full py-2 px-4 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-gray-700 font-medium">Sign in with Google</span>
        </button>
      </div>
    </main>
  );
}
