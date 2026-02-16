import { create } from 'zustand';

interface LicenseState {
  license: {
    success: true;
    companyName: string;
    licenseId: string;
    licenseType: 'PURCHASED';
    planType: 'VIP';
    limits: { maxPhotos: 'unlimited' };
  };
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => void;
  authenticate: (licenseKey: string) => Promise<boolean>;
  logout: () => void;

  // Computed helpers
  canModify: () => boolean;
  isTrialExpired: () => boolean;
  trialDaysRemaining: () => number | null;
  isVip: () => boolean;
  canUseAi: () => boolean;
  isDemo: () => boolean;
  isTrial: () => boolean;
}

const FULL_LICENSE = {
  success: true as const,
  companyName: '積算OCR',
  licenseId: 'FULL-ACCESS',
  licenseType: 'PURCHASED' as const,
  planType: 'VIP' as const,
  limits: { maxPhotos: 'unlimited' as const },
};

export const useLicenseStore = create<LicenseState>((set, get) => ({
  license: FULL_LICENSE,
  isLoading: false,
  error: null,

  initialize: () => {
    set({ license: FULL_LICENSE, isLoading: false });
  },

  authenticate: async () => true,

  logout: () => {},

  canModify: () => true,
  isTrialExpired: () => false,
  trialDaysRemaining: () => null,
  isVip: () => true,
  canUseAi: () => true,
  isDemo: () => false,
  isTrial: () => false,
}));
