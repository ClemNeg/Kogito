import React, { createContext, useContext, useEffect, useState } from 'react';
import Purchases, { CustomerInfo, LOG_LEVEL } from 'react-native-purchases';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

const RC_API_KEY = 'goog_pBzmMwUMvFOPCgxBrpjfHCjclwh';
const ENTITLEMENT_ID = 'premium';

interface SubscriptionContextType {
  isPremium: boolean;
  loading: boolean;
  purchasePremium: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPremium: false,
  loading: true,
  purchasePremium: async () => false,
  restorePurchases: async () => false,
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (IS_EXPO_GO) { setLoading(false); return; }
    try {
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: RC_API_KEY });
    } catch (err) {
      console.error('RevenueCat configure error:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (IS_EXPO_GO || !user) return;
    Purchases.logIn(user.uid)
      .then(() => checkPremium())
      .catch((err) => {
        console.error('RevenueCat logIn error:', err);
        setLoading(false);
      });
  }, [user]);

  const checkPremium = async () => {
    if (IS_EXPO_GO) { setLoading(false); return; }
    try {
      const info: CustomerInfo = await Purchases.getCustomerInfo();
      setIsPremium(info.entitlements.active[ENTITLEMENT_ID] !== undefined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const purchasePremium = async (): Promise<boolean> => {
    if (IS_EXPO_GO) return false;
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages[0];
      if (!pkg) return false;
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const active = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPremium(active);
      return active;
    } catch (err: any) {
      if (!err.userCancelled) console.error(err);
      return false;
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    if (IS_EXPO_GO) return false;
    try {
      const info = await Purchases.restorePurchases();
      const active = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPremium(active);
      return active;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  return (
    <SubscriptionContext.Provider value={{ isPremium, loading, purchasePremium, restorePurchases }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
