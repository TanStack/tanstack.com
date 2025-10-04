## Code-splitting cleanup (TanStack Router warnings)

Fix: Remove named exports from route files so they can be code-split. If symbols are needed elsewhere, move them to a non-route module (e.g., `src/components/` or `src/routes/_shared/`) and import locally.

Checklist

- [x] `src/routes/$libraryId/route.tsx`: remove export of `RouteForm`
- [x] `src/routes/_libraries/terms.tsx`: remove export of `RouteComp`
- [x] `src/routes/_libraries/privacy.tsx`: remove export of `RouteComp`
- [x] `src/routes/_libraries/partners.tsx`: remove export of `RouteComp`
- [x] `src/routes/_libraries/ethos.tsx`: remove export of `RouteComp`
- [x] `src/routes/_libraries/brand-guide.tsx`: remove export of `RouteComponent`
- [x] `src/routes/_libraries/blog.$.tsx`: remove export of `BlogPost`
- [x] `src/routes/_libraries/virtual.$version.index.tsx`: remove export of `RouteComp`
- [x] `src/routes/_libraries/table.$version.index.tsx`: remove export of `TableVersionIndex`
- [x] `src/routes/_libraries/store.$version.index.tsx`: remove export of `StoreVersionIndex`
- [x] `src/routes/_libraries/start.$version.index.tsx`: remove export of `VersionIndex`
- [x] `src/routes/_libraries/ranger.$version.index.tsx`: remove export of `VersionIndex`
- [x] `src/routes/_libraries/query.$version.index.tsx`: remove export of `VersionIndex`
- [x] `src/routes/_libraries/pacer.$version.index.tsx`: remove export of `PacerVersionIndex`
- [x] `src/routes/_libraries/form.$version.index.tsx`: remove export of `FormVersionIndex`
- [x] `src/routes/_libraries/devtools.$version.index.tsx`: remove export of `DevtoolsVersionIndex`
- [x] `src/routes/_libraries/db.$version.index.tsx`: remove export of `DBVersionIndex`
- [x] `src/routes/_libraries/config.$version.index.tsx`: remove export of `FormVersionIndex`

Notes

- If any of the above symbols are imported from other modules, migrate them to a non-route file and re-import locally.
- After edits, run the build and ensure warnings are gone.

Open issue

- [x] `TypeError: (intermediate value).routerEntry.getRouter is not a function` → Verified router export and build succeeded

Additional

- Updated `src/server/sponsors.ts` to use `setResponseHeaders` API for headers.
