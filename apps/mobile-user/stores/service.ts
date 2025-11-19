import type { MatchedPersonnel, ServiceDetails } from '@repo/types';
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer';

interface SelectedSpecification {
    id: string;
    name?: string;
    price: string;
    unit: string;
    estimatedDurationMinutes?: number;
}

export type ServiceItem = {
    id: string;
    label: string;
    description: string | null;
    icon?: string | null;
};

interface ServiceState {
    selectService?: ServiceItem;
    selectServicePersonnelInfo?: MatchedPersonnel;
    selectedServiceTime?: Date;
    selectedSpecification?: SelectedSpecification;
    serviceDetails?: ServiceDetails;

    reset: () => void;
    resetService: () => void;
    resetServicePersonnelInfo: () => void;
    setService: (id: ServiceItem) => void;
    setServicePersonnelInfo: (info: MatchedPersonnel) => void;
    setServiceTime: (time: Date) => void;
    setSelectedSpecification: (spec: SelectedSpecification) => void;
    setServiceDetails: (details: ServiceDetails) => void;
}

const useServiceStore = create<ServiceState>()(
    immer((set) => ({
        selectService: undefined,
        selectServicePersonnelInfo: {} as MatchedPersonnel,
        selectedServiceTime: undefined,
        selectedSpecification: undefined,
        serviceDetails: undefined,

        reset: () => {
            set((state) => {
                state.selectService = undefined;
                state.selectServicePersonnelInfo = {} as MatchedPersonnel;
                state.selectedServiceTime = undefined;
                state.selectedSpecification = undefined;
                state.serviceDetails = undefined;
            });
        },

        resetService: () => {
            set((state) => {
                state.selectService = undefined;
            });
        },

        resetServicePersonnelInfo: () => set((state) => {
            state.selectServicePersonnelInfo = {} as MatchedPersonnel;
        }),

        setService: (item: ServiceItem) => set((state) => {
            state.selectService = item;
        }),

        setServicePersonnelInfo: (info: MatchedPersonnel) => set((state) => {
            state.selectServicePersonnelInfo = info;
        }),

        setServiceTime: (time: Date) => set((state) => {
            state.selectedServiceTime = time;
        }),

        setSelectedSpecification: (spec: SelectedSpecification) => set((state) => {
            state.selectedSpecification = spec;
        }),

        setServiceDetails: (details: ServiceDetails) => set((state) => {
            state.serviceDetails = details;
        })
    }))
);

export default useServiceStore;
