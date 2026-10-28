DROP TABLE IF EXISTS feeds;

CREATE TABLE IF NOT EXISTS feeds (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,

  UNIQUE(name, source_url)
);

INSERT INTO feeds(name, source_url)
VALUES
  ("m3o", "https://m3o.sh/rss.xml"),
  ("Github Next", "https://githubnext.com/rss.xml"),
  ("HackerNews", "https://news.ycombinator.com/rss");
