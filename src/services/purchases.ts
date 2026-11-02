// Purchases are simulated in the prototype. Step 4 replaces this file with
// RevenueCat (one SDK for the App Store and Google Play); screens don't change.

import { formatMoney, t } from '../i18n';
import { confirm } from './dialog';

export type Product = 'revive' | 'freezePack' | 'species';

export async function purchase(what: string, price: number, currency: string): Promise<boolean> {
  const priceLabel = formatMoney(price, currency);
  return confirm(t.common.simulatedPurchase, t.common.simulatedPurchaseBody(what, priceLabel), t.common.buy);
}
