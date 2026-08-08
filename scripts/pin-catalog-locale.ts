// The catalog case components format axis labels with `toLocaleDateString(undefined, …)`
// and `toLocaleString()`, which resolve against the machine's locale. Generating the
// landing assets on a non-English machine therefore produces different SVG text — e.g.
// `10월 6일` instead of `Oct 6` — which changes the content hash and makes
// `--check` report the committed assets as stale.
//
// `@tanstack/react-charts-catalog` already pins `en-US` on every `Intl.NumberFormat` and
// `Intl.DateTimeFormat` it constructs, so the bare prototype calls are an oversight rather
// than a deliberate choice. Until that is fixed upstream, default them here so generation
// is reproducible regardless of the machine's locale.
//
// Setting `process.env.LANG` does not work: Node resolves ICU's default locale at process
// start, before any module code runs.
//
// Imported for side effects, and must be imported before the catalog case components so the
// patch is in place when they render. Call sites that pass an explicit locale keep it.

const GENERATION_LOCALE = 'en-US'

const originalToLocaleDateString = Date.prototype.toLocaleDateString
Date.prototype.toLocaleDateString = function toLocaleDateString(
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
) {
  return originalToLocaleDateString.call(
    this,
    locales ?? GENERATION_LOCALE,
    options,
  )
}

const originalDateToLocaleString = Date.prototype.toLocaleString
Date.prototype.toLocaleString = function toLocaleString(
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
) {
  return originalDateToLocaleString.call(
    this,
    locales ?? GENERATION_LOCALE,
    options,
  )
}

const originalNumberToLocaleString = Number.prototype.toLocaleString
Number.prototype.toLocaleString = function toLocaleString(
  locales?: Intl.LocalesArgument,
  options?: Intl.NumberFormatOptions,
) {
  return originalNumberToLocaleString.call(
    this,
    locales ?? GENERATION_LOCALE,
    options,
  )
}
