import {
  loadPricingSnapshot,
  PricingCatalogService
} from './pricing-catalog.mjs'

export const pricingCatalog = new PricingCatalogService(await loadPricingSnapshot())
void pricingCatalog.refresh()
