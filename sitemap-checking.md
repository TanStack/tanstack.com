# Check the sitemap contract

Run the full read-only check against production:

```sh
pnpm sitemap:check --sitemap https://tanstack.com/sitemap.xml
```

For a commit preview, use its sitemap URL and pass its origin as `--base-url`. Entries retain their production canonical URLs, while HTTP requests go to the preview:

```sh
pnpm sitemap:check --sitemap https://YOUR-PREVIEW.workers.dev/sitemap.xml --base-url https://YOUR-PREVIEW.workers.dev
```

The checker makes four concurrent requests, does not follow redirects, and exits nonzero for failed pages. It checks status 200, exactly one matching canonical link, robots meta/header directives, error headings, and disallowed repository-artifact or private paths. It does not run page JavaScript or prove content quality.

Use `--limit 20` for a quick check of the first 20 entries. The output labels this as partial; passing a sample does not verify the whole sitemap. Without a limit every entry is checked, which can take time on a large sitemap. Neither command changes deployed content or clears caches.

Contract regression tests run in the normal unit suite. The deployed check is available for release verification; it is not yet a mandatory deployment gate while the remaining failures in issue #1153 are being fixed.
