import { Link, Outlet, useLocation, useSearchParams } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import type { LoaderArgs } from "@remix-run/node";
import { DefaultErrorBoundary } from "~/components/DefaultErrorBoundary";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { fetchRepoFile } from "~/utils/documents.server";
import { repo, getBranch } from "~/routes/query";

export const loader = async (context: LoaderArgs) => {
  const url = new URL(context.request.url);
  if (
    url.pathname.endsWith(`/query/v3`) ||
    url.pathname.endsWith(`/query/v3/`)
  ) {
    throw redirect(`https://react-query-v3.tanstack.com`, 301);
  }

  const branch = getBranch(context.params.version);
  const config = await fetchRepoFile(repo, branch, `docs/config.json`);

  if (!config) {
    throw new Error("Repo docs/config.json not found!");
  }

  return json(JSON.parse(config));
};

export const ErrorBoundary = DefaultErrorBoundary;
export const CatchBoundary = DefaultCatchBoundary;

export default function RouteReactQuery() {
  const [params] = useSearchParams();
  const location = useLocation();

  const showV3Redirect = params.get("from") === "reactQueryV3";
  const original = params.get("original");

  return (
    <>
      {showV3Redirect ? (
        <div className="p-4 bg-blue-500 text-white flex items-center justify-center gap-4">
          <div>
            Looking for the{" "}
            <a
              href={original || "https://react-query-v3.tanstack.com"}
              className="font-bold underline"
            >
              React Query v3 documentation
            </a>
            ?
          </div>
          <Link
            to={location.pathname}
            replace
            className="bg-white text-black py-1 px-2 rounded-md uppercase font-black text-xs"
          >
            Hide
          </Link>
        </div>
      ) : null}
      <Outlet />
    </>
  );
}
