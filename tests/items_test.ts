import { assertEquals } from "@std/assert";
import { FeedAggregator } from "../src/main.ts";

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

const ITEM2 = {
  id: "2",
  content_text: "bar",
  url: "https://example.org/bar",
};

const ITEM3 = {
  id: "3",
  content_html: "<p>foo</p>",
  content_text: "bar",
  url: "https://example.org/foobar",
};

Deno.test("add", async () => {
  const expected = JSON.stringify({
    version: VERSION,
    ...INFO,
    items: [ITEM1, ITEM2, ITEM3],
  });

  const kv = await Deno.openKv(":memory:");

  const feed = new FeedAggregator(kv, PREFIX, INFO);
  await feed.add({ item: ITEM1 });
  await feed.add(...[ITEM2, ITEM3].map((item) => ({ item })));

  const actual = await feed.toJSON();

  kv.close();

  assertEquals(actual, expected);
});

Deno.test("load", async () => {
  const expected = JSON.stringify({
    version: VERSION,
    ...INFO,
    items: [ITEM1, ITEM2, ITEM3],
  });

  const kv = await Deno.openKv(":memory:");

  const feed = new FeedAggregator(kv, PREFIX, INFO);
  await feed.add({ item: ITEM1 });
  await feed.add(...[ITEM2, ITEM3].map((item) => ({ item })));

  const actual = await feed.toJSON();

  assertEquals(actual, expected);

  const feed2 = new FeedAggregator(kv, PREFIX, INFO);

  const actual2 = await feed2.toJSON();

  kv.close();

  assertEquals(actual2, expected);
});
