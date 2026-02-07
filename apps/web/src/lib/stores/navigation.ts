import { create } from 'zustand';

export type NavigationDirection = 'push' | 'pop' | 'tab';

interface NavigationState {
  direction: NavigationDirection;
  setDirection: (d: NavigationDirection) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  direction: 'tab',
  setDirection: (direction) => set({ direction }),
}));
