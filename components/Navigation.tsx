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
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {title}
            </h1>
            <nav className="flex space-x-4">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => router.push(item.path)}
                  className={`transition ${
                    currentPage === item.key
                      ? "text-blue-800 font-medium"
                      : item.key === "admin"
                      ? "text-purple-600 hover:text-purple-800 font-medium"
                      : "text-blue-600 hover:text-blue-800"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">Welcome, {user.firstName} {user.lastName}!</span>
            <button
              onClick={() => router.push('/settings')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
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
