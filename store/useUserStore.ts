import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  name: string;
  createdAt: string;
}

interface UserState {
  user: User | null;
  setUser: (user: User) => void;
  logout: () => void;
}

const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,

      // Called when someone logs in with their user object
      setUser: (user) => set({ user }),

      // Called when someone logs out
      logout: () => set({ user: null }),
    }),
    {
      name: "user-storage", // This is the key in localStorage
    }
  )
);

export default useUserStore;
