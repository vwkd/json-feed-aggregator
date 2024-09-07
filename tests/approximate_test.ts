import { assertEquals } from "@std/assert";
import { delay } from "@std/async";
import { FeedAggregator } from "../src/main.ts";

const DELAY_MS = 500;
const PREFIX = ["foo", "bar"];

const VERSION = "https://jsonfeed.org/version/1.1";
const INFO = {
  title: "Example Feed",
  home_page_url: "https://example.org",
  feed_url: "https://example.org/feed.json",
};

const ITEM1 = {
  id: "1",
  content_html: "<p>foo</p>",
  url: "https://example.org/foo",
};

const ITEM1_2 = {
  id: "1",
  content_html: "<p>bar</p>",
  url: "https://example.org/foo",
};

const ITEM2 = {
  id: "2",
  content_text: "bar",
  url: "https://example.org/bar",
};

const ITEM2_2 = {
  id: "2",
  content_text: "baz",
  url: "https://example.org/bar",
};

const ITEM3 = {
  id: "3",
  content_html: "<p>foo</p>",
  content_text: "bar",
  url: "https://example.org/foobar",
};

const ITEM3_2 = {
  id: "3",
  content_html: "<p>bar</p>",
  content_text: "bar",
  url: "https://example.org/foobar",
};

Deno.test("add", async () => {
  const currentDate = { value: new Date() };

  const expected = JSON.stringify({
    version: VERSION,
    ...INFO,
    items: [ITEM1, ITEM2, ITEM3].map((item) => ({
      ...item,
      date_published: currentDate.value.toISOString(),
    })),
  });

  const kv = await Deno.openKv(":memory:");

  const feed = new FeedAggregator(kv, PREFIX, INFO, { currentDate });
  await feed.add({ item: ITEM1, shouldApproximateDate: true });
  await feed.add(
    ...[ITEM2, ITEM3].map((item) => ({ item, shouldApproximateDate: true })),
  );

  const actual = await feed.toJSON();

  kv.close();

  assertEquals(actual, expected);
});

Deno.test("overwrite, equal", async () => {
  const currentDate = { value: new Date() };
  const date_published = currentDate.value.toISOString();

  const expected = JSON.stringify({
    version: VERSION,
    ...INFO,
    items: [ITEM1, ITEM2, ITEM3].map((item) => ({
      ...item,
      date_published,
    })),
  });

  const kv = await Deno.openKv(":memory:");

  const feed = new FeedAggregator(kv, PREFIX, INFO, { currentDate });
  await feed.add({ item: ITEM1, shouldApproximateDate: true });
  await feed.add(
    ...[ITEM2, ITEM3].map((item) => ({ item, shouldApproximateDate: true })),
  );

  const actual = await feed.toJSON();

  assertEquals(actual, expected);

  await delay(DELAY_MS * 2);

  currentDate.value = new Date();
  const feed2 = new FeedAggregator(kv, PREFIX, INFO, { currentDate });
  await feed2.add({ item: ITEM1, shouldApproximateDate: true });
  await feed2.add(
    ...[ITEM2, ITEM3].map((item) => ({ item, shouldApproximateDate: true })),
  );

  const actual2 = await feed2.toJSON();

  kv.close();

  assertEquals(actual2, expected);
});

Deno.test("overwrite, different", async () => {
  const currentDate = { value: new Date() };
  const date_published = currentDate.value.toISOString();

  const expected = JSON.stringify({
    version: VERSION,
    ...INFO,
    items: [ITEM1, ITEM2, ITEM3].map((item) => ({
      ...item,
      date_published,
    })),
  });

  const kv = await Deno.openKv(":memory:");

  const feed = new FeedAggregator(kv, PREFIX, INFO, { currentDate });
  await feed.add({ item: ITEM1, shouldApproximateDate: true });
  await feed.add(
    ...[ITEM2, ITEM3].map((item) => ({ item, shouldApproximateDate: true })),
  );

  const actual = await feed.toJSON();

  assertEquals(actual, expected);

  await delay(DELAY_MS * 2);

  currentDate.value = new Date();
  const date_modified = currentDate.value.toISOString();

  const expected2 = JSON.stringify({
    version: VERSION,
    ...INFO,
    items: [ITEM1_2, ITEM2_2, ITEM3_2].map((item) => ({
      ...item,
      date_published,
      date_modified,
    })),
  });

  const feed2 = new FeedAggregator(kv, PREFIX, INFO, { currentDate });
  await feed2.add({ item: ITEM1_2, shouldApproximateDate: true });
  await feed2.add(
    ...[ITEM2_2, ITEM3_2].map((item) => ({
      item,
      shouldApproximateDate: true,
    })),
  );

  const actual2 = await feed2.toJSON();

  kv.close();

  assertEquals(actual2, expected2);
});
