import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import useUserStore from '@/store/useUserStore';
import Navigation from '@/components/Navigation';

export default function Settings() {
  const router = useRouter();
  const { data: session } = useSession();
  const { user, setUser, clearUser } = useUserStore();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    emailNotifications: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!user && !session?.user) {
      router.push('/');
      return;
    }

    // Use session data if available, fallback to store data
    const userData = session?.user || user;
    if (!userData) return;

    // Initialize form with user data (prioritize session data)
    setFormData({
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      email: userData.email || '',
      emailNotifications: userData.emailNotifications || false
    });
  }, [user, session, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user?.id,
          ...formData
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setUser(data.user);
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user?.id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }

      // Clear user data and redirect to home
      clearUser();
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleLogout = () => {
    clearUser();
    router.push('/');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation title="GenCon Events" currentPage="settings" />

      {/* Main Content */}
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Account Settings</h2>
            <p className="text-sm text-gray-600">
              Update your personal information and manage your account.
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

            {/* Profile Update Form */}
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>


              {/* Notification Settings */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      id="emailNotifications"
                      name="emailNotifications"
                      type="checkbox"
                      checked={formData.emailNotifications}
                      onChange={(e) => setFormData(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-900">
                      Email notifications
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 ml-6">
                    Receive email alerts for event updates, cancellations, and ticket assignments
                  </p>

                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-red-900 mb-2">Danger Zone</h3>
            <p className="text-sm text-gray-600 mb-4">
              Deleting your account will permanently remove all your data, including your wishlisted events and remove you from the calendar. This action cannot be undone.
            </p>
            
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Delete Account
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-red-900">
                  Are you sure you want to delete your account? This action cannot be undone.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={loading}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Deleting...' : 'Yes, Delete Account'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
