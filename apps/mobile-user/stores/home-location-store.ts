import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { SelectLocation } from "@/stores/address-store";

interface HomeLocationState {
    selectedLocation: SelectLocation | null;
}

interface HomeLocationActions {
    setSelectedLocation: (location: SelectLocation) => void;
    reset: () => void;
}

type HomeLocationStore = HomeLocationState & HomeLocationActions;

export const useHomeLocationStore = create<HomeLocationStore>()(
    immer((set) => ({
        selectedLocation: null,
        setSelectedLocation: (location) => {
            set((state) => {
                state.selectedLocation = location;
            });
        },
        reset: () => {
            set((state) => {
                state.selectedLocation = null;
            });
        },
    })),
);
