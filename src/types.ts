import type { Item } from "@vwkd/feed";

/**
 * Feed options
 */
export interface Options {
  /** Current date */
  currentDate?: SharedDate;
}

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

/**
 * Shared date
 *
 * - allows to set deterministic value of date, e.g. for testing
 * - user can mutate `value` property of argument to change date
 */
// todo: make such user can change but library can only read
export interface SharedDate {
  /** Date to share */
  value: Date;
}
