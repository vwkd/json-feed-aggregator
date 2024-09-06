import { assertEquals } from "@std/assert";
import { FeedAggregator } from "../src/main.ts";

const kv = await Deno.openKv(":memory:");

Deno.test("minimal", async () => {
  const info = {
    title: "Example Feed",
    home_page_url: "https://example.org",
    feed_url: "https://example.org/feed.json",
  };

  const prefix = ["minimal"];

  const feed = new FeedAggregator(kv, prefix, info);

  const version = "https://jsonfeed.org/version/1.1";
  const items = [] as const;
  const expected = JSON.stringify({
    version,
    ...info,
    items,
  });

  const actual = await feed.toJSON();

  assertEquals(actual, expected);
})
