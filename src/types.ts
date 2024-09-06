import type { Item } from "@vwkd/feed";

/**
 * Item with options
 */
export interface AggregatorItem {
  /** Item */
  item: Item;
  /** Expiry date of item */
  expireAt?: Date;
  /** Should use current date as published or last modified date */
  shouldApproximateDate?: boolean;
}
