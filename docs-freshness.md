# Documentation freshness

Documentation frontmatter supports optional `updated` and `testedWith` fields. Use a quoted YYYY-MM-DD date for `updated` and a mapping of package names to exact installed versions for `testedWith`.

Set `updated` to the date of a substantive content change. Keep it unchanged for rebuilds, cache refreshes, formatting-only changes, and unrelated repository commits. Do not bulk-stamp old documents with today's date. The page and its sitemap entry use the same validated value; documents without one stay undated.

Set `testedWith` only after running the documented example or recipe. Read exact installed package versions from that environment, not manifest ranges or the repository's version label. Record the command, source revision, and outcome in the pull request. Retest when the recipe changes. This field records recipe compatibility, not a claim that the whole framework test suite passed.

A document with `ref` can replace source text or sections. It must declare its own tested versions for that rendered recipe; source-only test claims are not inherited. Its update date is the latest validated date among all documents in its reference chain, and is omitted if any source lacks a date.

Check changed and undated page HTML, canonical sitemap entries, and reference behavior before merging. Never substitute request or deployment timestamps for missing content history.
