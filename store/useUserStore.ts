import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  googleId?: string;
  provider: string;
  image?: string;
  createdAt: string;
}

interface UserState {
  user: User | null;
  hasHydrated: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
  logout: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      hasHydrated: false,

      // Called when someone logs in with their user object
      setUser: (user) => set({ user }),

      // Called when someone clears user data
      clearUser: () => set({ user: null }),

      // Called when someone logs out
      logout: () => set({ user: null }),

      // Called when the store has been hydrated from localStorage
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "user-storage", // This is the key in localStorage
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
        }
      },
    }
  )
);

// Initialize hydration on client side
if (typeof window !== 'undefined') {
  useUserStore.persist.rehydrate();
}

export default useUserStore;
