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
export type { AggregatorItem, Options, SharedDate } from "./types.ts";
import { Feed, type FeedInfo } from "@vwkd/feed";
import { equal } from "@std/assert";
import type { AggregatorItem, Options, SharedDate } from "./types.ts";

const DENO_KV_MAX_BATCH_SIZE = 1000;

/**
 * JSON Feed aggregator using Deno KV
 *
 * - creates JSON Feed with added items and remaining existing items from cache
 * - caches added items with optional expiry if not already identical in cache
 * - beware: existing items that aren't in added items anymore and have no expiry won't be deleted from cache forever!
 * - beware: expiry is earliest time after which Deno KV deletes items, filter out expired ones, don't bother to delete manually, Deno KV will delete eventually!
 */
export class FeedAggregator<T extends FeedInfo> {
  #initialized = false;
  #kv: Deno.Kv;
  #prefix: string[];
  #info: T;
  #currentDate?: SharedDate;
  #itemsCached: AggregatorItem[] = [];
  #itemsAdded: AggregatorItem[] = [];

  /**
   * Create new stateful JSON Feed
   *
   * @param kv Deno KV store
   * @param prefix prefix for keys
   * @param info Feed info
   * @param options options
   */
  // todo: validate arguments
  constructor(
    kv: Deno.Kv,
    prefix: string[],
    info: T,
    options: Options = {},
  ) {
    const { currentDate } = options;

    this.#kv = kv;
    this.#prefix = prefix;
    this.#info = info;
    this.#currentDate = currentDate;
  }

  /**
   * Initialize cached items from KV store
   *
   * - beware: might get expired items, run `clean()` before using!
   * - beware: must be called first!
   */
  async #init(): Promise<void> {
    // call only once
    if (this.#initialized) {
      return;
    }

    const entriesIterator = this.#kv.list<AggregatorItem>({
      prefix: this.#prefix,
    }, {
      batchSize: DENO_KV_MAX_BATCH_SIZE,
    });

    const entries = await Array.fromAsync(entriesIterator);

    const items = entries
      .map((item) => item.value);

    this.#itemsCached = items;

    this.#initialized = true;
  }

  /**
   * Clean up expired items if any
   *
   * - in case Deno KV hasn't deleted them yet
   * - in case items have expired since created instance or added
   * - beware: must be called first and every time!
   * - note: take `now` as argument to avoid slight time gap
   *
   * @param now current date
   */
  #clean(now: Date): void {
    this.#itemsCached = this.#itemsCached
      .filter(({ expireAt }) => !expireAt || expireAt > now);
    this.#itemsAdded = this.#itemsAdded
      .filter(({ expireAt }) => !expireAt || expireAt > now);
  }

  /**
   * Add one or more items to the feed
   *
   * - errors if item with same ID already added previously
   * - errors if `expireAt` is in the past
   * - if item with same ID is already in cache
   *   - errors if `shouldApproximateDate` is different
   *   - if item is identical, ignores added item, takes existing item from cache
   *   - if item is different
   *     - takes added item, will overwrite existing item in cache
   *     - if `shouldApproximateDate` uses published date of existing item and current date as modified date
   * - if `shouldApproximateDate` uses current date as published date
   *
   * @param items items to add
   */
  // todo: validate arguments
  async add(...items: AggregatorItem[]): Promise<void> {
    const now = this.#currentDate?.value || new Date();

    await this.#init();

    this.#clean(now);

    for (const { item: _item, expireAt, shouldApproximateDate } of items) {
      // clone to avoid modifying input arguments
      const item = structuredClone(_item);
      const itemId = item.id;

      if (this.#itemsAdded.some(({ item: { id } }) => id == itemId)) {
        throw new Error(`Item with ID '${itemId}' already added`);
      }

      if (expireAt && expireAt <= now) {
        throw new Error(
          `Expiry date for item with ID '${itemId}' is not in future`,
        );
      }

      // todo: remove `date_modified`?
      if (
        shouldApproximateDate && (item.date_published || item.date_modified)
      ) {
        throw new Error(
          `Can't approximate date for item with ID '${itemId}' if already has date`,
        );
      }

      const existingItem = this.#itemsCached.find(({ item }) =>
        item.id == itemId
      );

      if (existingItem) {
        if (shouldApproximateDate != existingItem.shouldApproximateDate) {
          throw new Error(
            `Should approximate date for item with ID '${itemId}' is different than for cached`,
          );
        }

        // note: not if `shouldApproximateDate` since `date_published` differs since set for existing item but not for added item
        if (equal(existingItem, item)) {
          // don't use added item
          continue;
        }

        if (shouldApproximateDate) {
          const { date_published: _, ...itemRest } = item;
          const { date_published: __, ...existingItemRest } = existingItem.item;

          // note: if differs only in `date_published`, set for existing item but not for added item
          if (equal(itemRest, existingItemRest)) {
            // don't use added item
            continue;
          }

          item.date_published = existingItem.item.date_published;
          item.date_modified = now.toISOString();
        }

        // don't use existing item
        this.#itemsCached = this.#itemsCached.filter(({ item }) =>
          item.id != itemId
        );
      } else {
        if (shouldApproximateDate) {
          item.date_published = now.toISOString();
        }
      }

      this.#itemsAdded.push({ item, expireAt, shouldApproximateDate });
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
    const now = this.#currentDate?.value || new Date();

    await this.#init();

    this.#clean(now);

    if (this.#itemsAdded.length > 0) {
      // note: `ok` property of result will always be `true` since transaction lacks `.check()`s
      await this.#kv
        .atomic()
        .mutate(...this.#itemsAdded.map((item) => ({
          key: [...this.#prefix, item.item.id],
          value: item,
          type: "set" as const,
          expireIn: item.expireAt &&
            (item.expireAt.getTime() - now.getTime()),
        })))
        .commit();
    }

    const feed = new Feed(this.#info);

    feed.add(...this.#itemsCached.map(({ item }) => item));
    feed.add(...this.#itemsAdded.map(({ item }) => item));

    return feed.toJSON();
  }
}
