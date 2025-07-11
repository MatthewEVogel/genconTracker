import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useUserStore from "@/store/useUserStore";
import Navigation from "@/components/Navigation";
import { useCustomAlerts } from "@/hooks/useCustomAlerts";

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  _count: {
    userEvents: number;
  };
}

interface UpdateResult {
  success: boolean;
  message: string;
  stats: {
    downloaded: boolean;
    totalEvents: number;
    newEvents: number;
    updatedEvents: number;
    canceledEvents: number;
    deletedEvents: number;
    errors: string[];
  };
}

export default function AdminPage() {
  const router = useRouter();
  const { user, logout } = useUserStore();
  const { customAlert, customConfirm, AlertComponent } = useCustomAlerts();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  
  // Event update state
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);

  useEffect(() => {
    // Redirect to login if no user is logged in
    if (!user) {
      router.push("/");
      return;
    }

    // Redirect if user is not an admin
    if (!user.isAdmin) {
      router.push("/schedule");
      return;
    }

    fetchUsers();
  }, [user, router]);

  const fetchUsers = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/admin/users?adminUserId=${user.id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }
      
      setUsers(data.users);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userToDelete: AdminUser) => {
    if (!user) return;
    
    const confirmMessage = `Are you sure you want to delete ${userToDelete.firstName} ${userToDelete.lastName} (${userToDelete.email})?\n\nThis will permanently delete their account and all associated events. This action cannot be undone.`;
    
    const confirmed = await customConfirm(confirmMessage, 'Delete User');
    if (!confirmed) {
      return;
    }
    
    try {
      setDeleteLoading(userToDelete.id);
      setError("");
      
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.id,
          userIdToDelete: userToDelete.id
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }
      
      // Remove user from local state
      setUsers(users.filter(u => u.id !== userToDelete.id));
      
      await customAlert(`Successfully deleted user: ${data.deletedUser.firstName} ${data.deletedUser.lastName}`, 'Success');
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleUpdateEvents = async () => {
    const confirmed = await customConfirm('This will download the latest events from GenCon and update the database. This may take a few minutes. Continue?', 'Update Events');
    if (!confirmed) {
      return;
    }

    try {
      setUpdateLoading(true);
      setUpdateResult(null);
      setError("");

      const response = await fetch('/api/admin/update-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      setUpdateResult(result);
      setLastUpdateTime(new Date().toLocaleString());

      if (result.success) {
        await customAlert(`Events updated successfully!\n\nNew: ${result.stats.newEvents}\nUpdated: ${result.stats.updatedEvents}\nCanceled: ${result.stats.canceledEvents}\nDeleted: ${result.stats.deletedEvents}`, 'Update Complete');
      } else {
        setError(result.message);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(`Failed to update events: ${errorMsg}`);
      console.error('Error updating events:', err);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Access denied. Admin privileges required.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation title="GenCon Events" currentPage="admin" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notification Management Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Notification Management</h2>
            <div className="space-x-3">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/admin/send-notifications', { 
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ test: true })
                    });
                    const result = await response.json();
                    if (result.success) {
                      await customAlert(`Test notifications sent!\nEmails: ${result.emailsSent}\nTexts: ${result.textsSent}\nUsers notified: ${result.usersNotified}`, 'Test Complete');
                    } else {
                      await customAlert(result.message || result.error || 'Failed to send test notifications', 'Error');
                    }
                  } catch (error) {
                    await customAlert('Error sending test notifications: ' + error, 'Error');
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
              >
                Send Test Notifications
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/admin/send-notifications', { method: 'POST' });
                    const result = await response.json();
                    if (result.sent) {
                      await customAlert(`Notifications sent!\nEmails: ${result.emailsSent}\nTexts: ${result.textsSent}\nUsers notified: ${result.usersNotified}`, 'Notifications Sent');
                    } else {
                      await customAlert(result.reason || result.message || 'No notifications sent', 'No Notifications');
                    }
                  } catch (error) {
                    await customAlert('Error sending notifications: ' + error, 'Error');
                  }
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
              >
                Test Registration Reminders
              </button>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p className="mb-2">
              Test the registration reminder system. This will check if any reminders should be sent based on the current registration timer:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>1 day before registration opens</li>
              <li>6 hours before registration opens</li>
              <li>30 minutes before registration opens</li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              Note: In development, notifications are logged to the console. In production, they would be sent via email/SMS services.
            </p>
          </div>
        </div>

        {/* Event Management Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Event Management</h2>
            <div className="space-x-3">
              <button
                onClick={handleUpdateEvents}
                disabled={updateLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50"
              >
                {updateLoading ? 'Updating Events...' : 'Update Events from GenCon'}
              </button>
              <button
                onClick={async () => {
                  const confirmed = await customConfirm('This will permanently delete ALL purchased tickets from the database. This action cannot be undone. Are you sure?', 'Clear All Tickets');
                  if (!confirmed) {
                    return;
                  }
                  try {
                    const response = await fetch('/api/admin/clear-tickets', { method: 'DELETE' });
                    const result = await response.json();
                    if (response.ok) {
                      await customAlert(`Successfully deleted ${result.deletedCount} tickets`, 'Success');
                    } else {
                      await customAlert(result.error || 'Failed to clear tickets', 'Error');
                    }
                  } catch (error) {
                    await customAlert('Error clearing tickets: ' + error, 'Error');
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
              >
                Clear All Tickets
              </button>
            </div>
          </div>

          {lastUpdateTime && (
            <div className="mb-4 text-sm text-gray-600">
              Last update: {lastUpdateTime}
            </div>
          )}

          {updateResult && (
            <div className={`border rounded-lg p-4 mb-6 ${
              updateResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className={`font-medium mb-2 ${
                updateResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {updateResult.success ? 'Update Successful' : 'Update Failed'}
              </div>
              <div className={`text-sm mb-3 ${
                updateResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {updateResult.message}
              </div>
              
              {updateResult.success && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-blue-600">{updateResult.stats.totalEvents}</div>
                    <div className="text-gray-600">Total Events</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-green-600">{updateResult.stats.newEvents}</div>
                    <div className="text-gray-600">New</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-yellow-600">{updateResult.stats.updatedEvents}</div>
                    <div className="text-gray-600">Updated</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-orange-600">{updateResult.stats.canceledEvents}</div>
                    <div className="text-gray-600">Canceled</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-red-600">{updateResult.stats.deletedEvents}</div>
                    <div className="text-gray-600">Deleted</div>
                  </div>
                </div>
              )}

              {updateResult.stats.errors.length > 0 && (
                <div className="mt-4">
                  <div className="text-red-800 font-medium mb-2">Errors:</div>
                  <ul className="text-red-700 text-sm space-y-1">
                    {updateResult.stats.errors.map((error, index) => (
                      <li key={index} className="list-disc list-inside">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="text-sm text-gray-600">
            <p className="mb-2">
              This will download the latest events.zip file from GenCon and update the database with any changes:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>New events will be added to the database</li>
              <li>Existing events will be updated with new information</li>
              <li>Events no longer in the GenCon data will be marked as canceled</li>
              <li>Canceled events with no user registrations will be deleted</li>
            </ul>
          </div>
        </div>

        {/* User Management Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="text-red-800 font-medium">Error:</div>
              <div className="text-red-700 text-sm">{error}</div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="text-lg text-gray-600">Loading users...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Events
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((userItem) => (
                    <tr key={userItem.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {userItem.firstName} {userItem.lastName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{userItem.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userItem.isAdmin 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {userItem.isAdmin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {userItem._count.userEvents}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(userItem.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {!userItem.isAdmin && userItem.id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(userItem)}
                            disabled={deleteLoading === userItem.id}
                            className="text-red-600 hover:text-red-900 transition disabled:opacity-50"
                          >
                            {deleteLoading === userItem.id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                        {userItem.isAdmin && (
                          <span className="text-gray-400">Protected</span>
                        )}
                        {userItem.id === user.id && !userItem.isAdmin && (
                          <span className="text-gray-400">You</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-500 text-lg">No users found.</div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      
      {/* Custom Alert Component */}
      <AlertComponent />
    </div>
  );
}
