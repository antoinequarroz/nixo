// In-app purchases through RevenueCat (one SDK for the App Store and Google Play).
// Without RevenueCat keys, on the web or in Expo Go, purchases are simulated
// with a confirmation dialog, so the prototype stays playable everywhere.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Alert, Platform } from 'react-native';

import { formatMoney, t } from '../i18n';
import { confirm } from './dialog';

/** Product ids to create in App Store Connect, Google Play and RevenueCat. */
export const PRODUCTS = {
  /** Consumable. */
  revive: 'nixo_revive',
  /** Consumable, gives 3 streak freezes. */
  freezePack: 'nixo_freeze_pack_3',
  /** Non-consumable, one per paid species. */
  species: (speciesId: string) => `nixo_species_${speciesId}`,
} as const;

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const realPurchases = !!apiKey && Platform.OS !== 'web' && !inExpoGo;

type PurchasesModule = typeof import('react-native-purchases').default;
let sdk: PurchasesModule | null = null;

function purchases(): PurchasesModule | null {
  if (!realPurchases) return null;
  if (!sdk) {
    // Loaded lazily so web and Expo Go never touch the native module.
    sdk = (require('react-native-purchases') as typeof import('react-native-purchases')).default;
    sdk.configure({ apiKey: apiKey! });
  }
  return sdk;
}

/**
 * Buys one product. Resolves true when the person paid (or confirmed the
 * simulated purchase), false when they cancelled or the store failed.
 */
export async function purchase(productId: string, label: string, fallbackPrice: number, currency: string): Promise<boolean> {
  const rc = purchases();
  if (!rc) {
    return confirm(t.common.simulatedPurchase, t.common.simulatedPurchaseBody(label, formatMoney(fallbackPrice, currency)), t.common.buy);
  }
  try {
    const [product] = await rc.getProducts([productId], rc.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    if (!product) throw new Error(`Unknown product ${productId}`);
    await rc.purchaseStoreProduct(product);
    return true;
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    Alert.alert(t.common.purchaseFailed, String((e as Error).message ?? e));
    return false;
  }
}

/** Species bought earlier (after a reinstall or on a new phone). */
export async function ownedSpeciesFromStore(): Promise<string[]> {
  const rc = purchases();
  if (!rc) return [];
  try {
    const info = await rc.getCustomerInfo();
    const prefix = PRODUCTS.species('');
    return info.allPurchasedProductIdentifiers.filter((id) => id.startsWith(prefix)).map((id) => id.slice(prefix.length));
  } catch {
    return [];
  }
}

/** Store price in the person's currency, when the store is connected. */
export async function storePrice(productId: string): Promise<string | null> {
  const rc = purchases();
  if (!rc) return null;
  try {
    const [product] = await rc.getProducts([productId], rc.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    return product?.priceString ?? null;
  } catch {
    return null;
  }
}
