# Archived diagnostic templates

These files document the experiment. They are not application code or a proposed deployment. In particular, the empty-WASM control cannot generate OG images, and the rebundle did not solve the cold delay.

- `probe.js.txt` is the standalone minimal handler. `/noop` performs no I/O. `/cache` performs a Cache API miss, and `/r2` performs a read-only HEAD miss.
- `measure.py.txt` records curl timing, response instance/counter headers, and ray IDs. Its optional arguments select a path and request count. The hostnames in the file refer to temporary Workers that have been deleted.
- `rebundle.mjs.txt` records the esbuild experiment. It expects the original full-probe files/configuration prepared in `dist/server`; it is not a standalone project build command.

The complete Worker upload was tested by placing the minimal handler beside the site's built `index.js` and `assets` modules, with the same ESModule/CompiledWasm discovery rules. Merely sharing that upload was enough to reproduce the delay, without importing the application. The full-app variant added a static import of built `index.js` and forwarded `/docs` to the actual docs URL.

The synthetic variants used the same minimal handler and binding configuration:

1. Data: concatenate built `index.js` and the server asset JavaScript into one file, uploaded with a Data rule.
2. Single JS: encode the same text as `export default <JSON string>` in one extra ESModule.
3. Many JS: split that text into 1,000 slices, each exported as a JSON string in an ESModule.
4. Empty WASM: retain the site's JavaScript modules, replace its original compiled WASM with the eight-byte empty WASM module, and only exercise `/noop`.

Each config used the same account, compatibility date/flags, and read-only diagnostic paths. Only `GITHUB_CONTENT_CACHE` was bound, with no database, application secrets, Durable Object namespaces, or scheduled tasks. Full-app and rebundled probes also retained the production static assets binding. All probes enabled native tracing and logs. Production routes were never attached.

Join request records to Wrangler tail output by `cf-ray`. Exclude non-200 responses from latency summaries while retaining them in the raw dataset. Separate first observed instance requests from reused instances. Report connection setup independently, and do not sum application spans that overlap or depend on Worker I/O clocks.
