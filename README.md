# README

JSON Feed aggregator using Deno KV



## Features

- create stateful JSON Feed Version 1.1
- add one or more items
- serialize to JSON



## Usage

### Create feed

```js
import { FeedAggregator } from "@vwkd/feed-aggregator";

const kv = await Deno.openKv(":memory:");
const prefix = ["foo", "bar"];

const feed = new FeedAggregator(
  kv,
  prefix,
  {
    title: "Example Feed",
    home_page_url: "https://example.org",
    feed_url: "https://example.org/feed.json",
  },
);

await feed.add({
  item: {
    id: "1",
    content_html: "<p>foo</p>",
    url: "https://example.org/foo",
  },
});

await feed.add(...[
  {
    item: {
      id: "2",
      content_text: "bar",
      url: "https://example.org/bar",
    },
  },
  {
    item: {
      id: "3",
      content_html: "<p>foo</p>",
      content_text: "bar",
      url: "https://example.org/foobar",
    },
  },
]);

console.log(await feed.toJSON());
```
