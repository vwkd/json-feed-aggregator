import { assertEquals } from "@std/assert";
import { FeedAggregator } from "../src/main.ts";

const kv = await Deno.openKv(":memory:");

Deno.test("three items", async () => {
  const info = {
    title: "Example Feed",
    home_page_url: "https://example.org",
    feed_url: "https://example.org/feed.json",
  };

  const prefix = ["three", "items"];

  const feed = new FeedAggregator(kv, prefix, info);

  const items = [
    {
      id: "1",
      content_html: "<p>foo</p>",
      url: "https://example.org/foo",
    },
    {
      id: "2",
      content_text: "bar",
      url: "https://example.org/bar",
    },
    {
      id: "3",
      content_html: "<p>foo</p>",
      content_text: "bar",
      url: "https://example.org/foobar",
    },
  ];

  const itemsWithExpiry = items.map((item) => ({ item }));

  await feed.add(...itemsWithExpiry);

  const version = "https://jsonfeed.org/version/1.1";
  const expected = JSON.stringify({
    version,
    ...info,
    items,
  });

  const actual = await feed.toJSON();

  assertEquals(actual, expected);
})
