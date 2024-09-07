import { assertEquals } from "@std/assert";
import { FeedAggregator } from "../src/main.ts";

const PREFIX = ["foo", "bar"];

const VERSION = "https://jsonfeed.org/version/1.1";
const INFO = {
  title: "Example Feed",
  home_page_url: "https://example.org",
  feed_url: "https://example.org/feed.json",
};

Deno.test("create", async () => {
  const expected = JSON.stringify({
    version: VERSION,
    ...INFO,
    items: [],
  });

  const kv = await Deno.openKv(":memory:");

  const feed = new FeedAggregator(kv, PREFIX, INFO);

  const actual = await feed.toJSON();

  kv.close();

  assertEquals(actual, expected);
});
