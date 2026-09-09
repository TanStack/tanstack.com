---
title: TanStack + SerpApi Partnership
published: 2026-02-24
updated: 2026-09-08
rss: false
excerpt: SerpApi supports TanStack and gives applications structured search results to build on.
library: start,ai
authors:
  - Tanner Linsley
---

![TanStack + SerpApi](/blog-assets/serpapi-partnership/header.png)

Sometimes the data your app needs is out on the web. A research tool might need search results, a dashboard might track where a page appears, or an agent might need sources it can return to a user.

SerpApi is supporting TanStack as a partner and provides a way to retrieve those results as structured JSON. It handles the search engine requests and parsing, including location-specific searches, so your application can work with fields instead of maintaining its own HTML scraper.

In a TanStack Start app, that request belongs in server code. Keep the API key there, call SerpApi, and return the results your interface needs. From there you can build a results page, add filters, or make search available as a tool for an AI workflow.

The [JavaScript integration guide](https://serpapi.com/integrations/javascript) is a good starting point. For tools that connect through MCP, there's also an [MCP integration](https://serpapi.com/integrations/mcp).

Thanks to SerpApi for helping support the open-source work behind TanStack!
