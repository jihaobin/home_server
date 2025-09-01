import { UserAddresses } from '@repo/types';
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer';

export type SelectAddress = Omit<UserAddresses, "geom"> & {
    lng: number;
    lat: number;
}

export type SelectLocation = Pick<SelectAddress, "lng" | "lat" | "city" | "detailedAddress" | "district" | "province" >;

// 地址编辑状态 - 精简版
interface AddressEditState {
  /** 当前选中的地址信息 (用于跨页面共享) */
  selectedAddress: SelectAddress | null;

  /** 是否手动选择了地址信息，如果是则停止自动定位 */
  isManualSelect: boolean;
}

interface AddressEditActions {
  /** 设置地址信息 */
  setSelectedAddress: (address: SelectAddress) => void;

  /** 更新地址信息 */
  updateAddress: (data: Partial<SelectAddress>) => void;

  /** 手动选择地址 */
  manualSelectAddress: () => void;

  /** 重置所有状态 */
  reset: () => void;
}

type AddressEditStore = AddressEditState & AddressEditActions;


export const useAddressEditStore = create<AddressEditStore>()(
  immer((set) => ({
    // 初始状态
    selectedAddress: null,
    isManualSelect: false,

    // Actions
    setSelectedAddress: (address: SelectAddress) => {
      set((state) => {
        state.selectedAddress = address;
      });
    },

    updateAddress: (data: Partial<SelectAddress>) => {
      set((state) => {
        if (state.selectedAddress) {
          state.selectedAddress = { ...state.selectedAddress, ...data };
        }else {
            state.selectedAddress = { ...data } as SelectAddress;
        }
      });
    },

    manualSelectAddress: () => {
      set((state) => {
        // state.updateAddress(address);
        state.isManualSelect = true;
      });
    },

    reset: () => {
      set((state) => {
        state.selectedAddress = null;
        state.isManualSelect = false;
      });
    },
  }))
);
