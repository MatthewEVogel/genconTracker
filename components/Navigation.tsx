import { useRouter } from "next/router";
import useUserStore from "@/store/useUserStore";

interface NavigationProps {
  title?: string;
  currentPage?: string;
}

export default function Navigation({ title = "GenCon Events", currentPage }: NavigationProps) {
  const router = useRouter();
  const { user, logout } = useUserStore();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (!user) {
    return null;
  }

  const navItems = [
    { name: "My Schedule", path: "/schedule", key: "schedule" },
    { name: "Browse Events", path: "/events", key: "events" },
    { name: "Tickets", path: "/tickets", key: "tickets" },
    { name: "Refunds", path: "/refunds", key: "refunds" },
  ];

  // Add admin link if user is admin
  if (user.isAdmin) {
    navItems.push({ name: "Admin", path: "/admin", key: "admin" });
  }

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-gray-900">
              {title}
            </h1>
            <nav className="flex space-x-6">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => router.push(item.path)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === item.key
                      ? "bg-blue-100 text-blue-800"
                      : item.key === "admin"
                      ? "text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                      : "text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <span className="hidden sm:block text-sm text-gray-600">
              Welcome, {user.firstName} {user.lastName}!
            </span>
            <button
              onClick={() => router.push('/settings')}
              className={`px-4 py-2 text-white rounded-md transition ${
                currentPage === 'settings' 
                  ? 'bg-gray-800' 
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
