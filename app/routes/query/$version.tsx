import { Link, Outlet, useLocation, useSearchParams } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderArgs } from "@remix-run/node";
import { DefaultErrorBoundary } from "~/components/DefaultErrorBoundary";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { fetchRepoFile } from "~/utils/documents.server";
import { useLocalStorage } from "~/utils/useLocalStorage";
import { useClientOnlyRender } from "~/utils/useClientOnlyRender";
import { repo, getBranch, latestVersion } from "~/routes/query";

export const loader = async (context: LoaderArgs) => {
  const branch = getBranch(context.params.version);
  const config = await fetchRepoFile(repo, branch, `docs/config.json`);

  if (!config) {
    throw new Error("Repo docs/config.json not found!");
  }

  return json(JSON.parse(config));
};

export const ErrorBoundary = DefaultErrorBoundary;
export const CatchBoundary = DefaultCatchBoundary;

export default function RouteVersionParam() {
  // After user clicks hide, do not show modal for a month, and then remind users that there is a new version!
  const [showModal, setShowModal] = useLocalStorage(
    "showRedirectToLatestModal",
    true,
    1000 * 60 * 24 * 30
  );
  const location = useLocation();
  const [params] = useSearchParams();

  const showV3Redirect = params.get("from") === "reactQueryV3";
  const original = params.get("original");

  const version = location.pathname.match(/\/query\/v(\d)/)?.[1] || "999";
  const isLowerVersion = Number(version) < Number(latestVersion[1]);
  const redirectTarget = location.pathname.replace(`v${version}`, "latest");

  if (!useClientOnlyRender()) {
    return null;
  }

  return (
    <>
      {showV3Redirect ? (
        <div className="p-4 bg-blue-500 text-white flex items-center justify-center gap-4">
          <div>
            Looking for the{" "}
            <a
              href={original || "/query/latest"}
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
      {isLowerVersion && showModal ? (
        <div className="p-4 bg-blue-500 text-white flex items-center justify-center gap-4">
          <div>
            You are currently reading <strong>v{version}</strong> docs. Redirect
            to{" "}
            <a href={redirectTarget} className="font-bold underline">
              latest
            </a>{" "}
            version?
          </div>
          <Link
            to={redirectTarget}
            replace
            className="bg-white text-black py-1 px-2 rounded-md uppercase font-black text-xs"
          >
            Latest
          </Link>
          <button
            onClick={() => setShowModal(false)}
            className="bg-white text-black py-1 px-2 rounded-md uppercase font-black text-xs"
          >
            Hide
          </button>
        </div>
      ) : null}
      <Outlet />
    </>
  );
}
