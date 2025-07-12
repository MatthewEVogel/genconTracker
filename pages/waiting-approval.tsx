import { useRouter } from "next/router";
import { useEffect } from "react";
import { signOut } from "next-auth/react";
import useUserStore from "@/store/useUserStore";

export default function WaitingApprovalPage() {
  const router = useRouter();
  const { user, logout } = useUserStore();

  useEffect(() => {
    // If user is approved, redirect to schedule
    if (user && user.approved) {
      router.push('/schedule');
      return;
    }
  }, [user, router]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Account Pending Approval
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your account has been created successfully
            </p>
          </div>

          <div className="mt-8">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Waiting for Admin Approval
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Your account is currently pending approval from an administrator. 
                      You will be able to access the GenCon Tracker once your account has been approved.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm text-gray-600">
                <p className="mb-4">
                  <strong>What happens next?</strong>
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>An administrator will review your account request</li>
                  <li>You'll receive access once approved</li>
                  <li>This usually takes 1-2 business days</li>
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={handleSignOut}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Sign Out
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                If you have questions, please contact the administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
