export type {
  Attachment,
  Author,
  BaseItem,
  FeedInfo,
  HTMLItem,
  Hub,
  Item,
  TextItem,
} from "@vwkd/feed";
export type { AggregatorItem } from "./types.ts";
import { Feed, type FeedInfo } from "@vwkd/feed";
import { equal } from "@std/assert";
import type { AggregatorItem } from "./types.ts";

const DENO_KV_MAX_BATCH_SIZE = 1000;

/**
 * JSON Feed aggregator using Deno KV
 *
 * - creates JSON Feed with added items and remaining existing items from cache
 * - caches added items with optional expiry if not already identical in cache
 * - beware: existing items that aren't in added items anymore and have no expiry won't be deleted from cache forever!
 * - beware: expiry is earliest time after which Deno KV deletes items, may get slightly expired ones but doesn't matter, don't bother to do deletion work manually!
 */
export class FeedAggregator<T extends FeedInfo> {
  #initialized = false;
  #kv: Deno.Kv;
  #prefix: string[];
  #info: T;
  #now: Date;
  #itemsCached: AggregatorItem[] = [];
  #itemsAdded: AggregatorItem[] = [];

  /**
   * Create new stateful JSON Feed
   *
   * @param kv Deno KV store
   * @param prefix prefix for keys
   * @param info Feed info
   */
  // todo: validate arguments
  constructor(kv: Deno.Kv, prefix: string[], info: T) {
    this.#kv = kv;
    this.#prefix = prefix;
    this.#info = info;
    this.#now = new Date();
  }

  /**
   * Initialize cached items from KV store
   *
   * - filter out expired items, will get deleted by Deno KV eventually
   * - beware: must be called first and only once!
   */
  async #init(): Promise<void> {
    const entriesIterator = this.#kv.list<AggregatorItem>({
      prefix: this.#prefix,
    }, {
      batchSize: DENO_KV_MAX_BATCH_SIZE,
    });

    const entries = await Array.fromAsync(entriesIterator);

    const items = entries
      .map((item) => item.value);

    const itemsWithoutExpired = items
      .filter(({ expireAt }) => !expireAt || expireAt > this.#now);

    this.#itemsCached = itemsWithoutExpired;
  }

  /**
   * Add one or more items to the feed
   *
   * - errors if item with same ID already added previously
   * - errors if `expireAt` is in the past
   * - if item with same ID is already in cache
   *   - if item is identical, ignores added item, takes existing item from cache
   *   - if item is different, takes added item, will overwrite existing item in cache
   *
   * @param items items to add
   */
  // todo: validate arguments
  async add(...items: AggregatorItem[]): Promise<void> {
    if (!this.#initialized) {
      await this.#init();
      this.#initialized = true;
    }

    for (const { item, expireAt } of items) {
      const itemId = item.id;

      if (this.#itemsAdded.some(({ item: { id } }) => id == itemId)) {
        throw new Error(`Item with ID '${itemId}' already added`);
      }

      if (expireAt && expireAt <= this.#now) {
        throw new Error(
          `Expiry date for item with ID '${itemId}' is not in future`,
        );
      }

      const existingItem = this.#itemsCached.find(({ item }) =>
        item.id == itemId
      );

      if (existingItem) {
        if (equal(existingItem, item)) {
          // don't use added item
          continue;
        } else {
          // don't use existing item
          this.#itemsCached = this.#itemsCached.filter(({ item }) =>
            item.id != itemId
          );
        }
      }

      this.#itemsAdded.push({ item, expireAt });
    }
  }

  /**
   * Get feed as JSON
   *
   * - store added items in cache
   * - add all items to feed and return it as JSON
   *
   * @returns feed as JSON
   */
  async toJSON(): Promise<string> {
    if (!this.#initialized) {
      await this.#init();
      this.#initialized = true;
    }

    if (this.#itemsAdded.length > 0) {
      // note: `ok` property of result will always be `true` since transaction lacks `.check()`s
      await this.#kv
        .atomic()
        .mutate(...this.#itemsAdded.map((item) => ({
          key: [...this.#prefix, item.item.id],
          value: item,
          type: "set" as const,
          expireIn: item.expireAt &&
            (item.expireAt.getTime() - this.#now.getTime()),
        })))
        .commit();
    }

    const feed = new Feed(this.#info);

    feed.add(...this.#itemsCached.map(({ item }) => item));
    feed.add(...this.#itemsAdded.map(({ item }) => item));

    return feed.toJSON();
  }
}
