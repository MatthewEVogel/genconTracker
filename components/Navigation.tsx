import { useRouter } from "next/router";
import { signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import useUserStore from "@/store/useUserStore";

interface NavigationProps {
  title?: string;
  currentPage?: string;
}

export default function Navigation({ title = "GenCon Events", currentPage }: NavigationProps) {
  const router = useRouter();
  const { user, logout } = useUserStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileNavigation = (path: string) => {
    setIsMobileMenuOpen(false);
    router.push(path);
  };

  const handleMobileLogout = async () => {
    setIsMobileMenuOpen(false);
    await handleLogout();
  };

  const handleLogout = async () => {
    try {
      console.log('Logout initiated for user:', user);
      
      if (user?.provider === 'google') {
        // do not auto-redirect, so we can clear our store first
        console.log('Signing out Google user');
        const { url } = await signOut({
          redirect: false,
          callbackUrl: '/',
        });
        console.log('NextAuth signOut completed, url:', url);
        
        logout();               // clear Zustand store
        console.log('Store cleared, redirecting to:', url);
        router.push(url!);      // now navigate to callbackUrl
        return;
      } else {
        console.log('Signing out regular user');
        logout();
        router.push('/');
      }
    } catch (err) {
      console.error('Error during logout:', err);
      logout();
      router.push('/');
    }
  };

  if (!user) {
    return null;
  }

  const navItems = [
    { name: "My Schedule", path: "/schedule", key: "schedule" },
    { name: "Browse Events", path: "/events", key: "events" },
    { name: "Tickets", path: "/tickets", key: "tickets" },
    { name: "Transactions", path: "/transactions", key: "transactions" },
    { name: "Refunds", path: "/refunds", key: "refunds" },
  ];

  // Add admin link if user is admin
  if (user.isAdmin) {
    navItems.push({ name: "Admin", path: "/admin", key: "admin" });
  }

  return (
    <header className="bg-white shadow-sm border-b relative" ref={menuRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Left side - Title and Desktop Navigation */}
          <div className="flex items-center space-x-8">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              {title}
            </h1>
            {/* Desktop Navigation - Hidden on mobile */}
            <nav className="hidden md:flex space-x-6">
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

          {/* Right side - Desktop buttons and Mobile hamburger */}
          <div className="flex items-center space-x-4">
            {/* Desktop welcome text */}
            <span className="hidden lg:block text-sm text-gray-600">
              Welcome, {user.firstName} {user.lastName}!
            </span>
            
            {/* Desktop buttons - Hidden on mobile */}
            <div className="hidden md:flex items-center space-x-4">
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

            {/* Mobile user initial and hamburger button */}
            <div className="md:hidden flex items-center space-x-3">
              {/* User initial circle */}
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                {user.firstName.charAt(0).toUpperCase()}
              </div>
              
              {/* Hamburger button */}
              <button
                onClick={toggleMobileMenu}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                aria-label="Toggle mobile menu"
                aria-expanded={isMobileMenuOpen}
              >
                <div className="w-6 h-6 flex flex-col justify-center items-center">
                  <span
                    className={`block h-0.5 w-6 bg-current transition-all duration-300 ${
                      isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''
                    }`}
                  />
                  <span
                    className={`block h-0.5 w-6 bg-current transition-all duration-300 mt-1 ${
                      isMobileMenuOpen ? 'opacity-0' : ''
                    }`}
                  />
                  <span
                    className={`block h-0.5 w-6 bg-current transition-all duration-300 mt-1 ${
                      isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu - Slide down */}
        <div
          className={`md:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-200 shadow-lg transition-all duration-300 ease-in-out z-50 ${
            isMobileMenuOpen
              ? 'opacity-100 translate-y-0 visible'
              : 'opacity-0 -translate-y-2 invisible'
          }`}
        >
          <div className="px-4 py-4 space-y-1">
            {/* User welcome section */}
            <div className="px-3 py-3 border-b border-gray-100 mb-2">
              <p className="text-sm font-medium text-gray-900">
                Welcome, {user.firstName} {user.lastName}!
              </p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>

            {/* Navigation items */}
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => handleMobileNavigation(item.path)}
                className={`w-full text-left px-3 py-3 rounded-md text-base font-medium transition-colors ${
                  currentPage === item.key
                    ? "bg-blue-100 text-blue-800"
                    : item.key === "admin"
                    ? "text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {item.name}
              </button>
            ))}

            {/* Settings and Logout */}
            <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
              <button
                onClick={() => handleMobileNavigation('/settings')}
                className={`w-full text-left px-3 py-3 rounded-md text-base font-medium transition-colors ${
                  currentPage === 'settings'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Settings
              </button>
              <button
                onClick={handleMobileLogout}
                className="w-full text-left px-3 py-3 rounded-md text-base font-medium text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu backdrop */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-25 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </header>
  );
}
