import { Outlet } from "@remix-run/react";
import type { LoaderArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { seo } from "~/utils/seo";
import { useMatchesData } from "~/utils/utils";

export const repo = "tanstack/query";

export const latestBranch = "main";
export const latestVersion = "v4";
export const availableVersions = ["v5", "v4", "v3"];

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion;

  return ["latest", latestVersion].includes(version) ? latestBranch : version;
}

export type Menu = {
  framework: string;
  menuItems: MenuItem[];
};

export type MenuItem = {
  label: string | React.ReactNode;
  children: {
    label: string | React.ReactNode;
    to: string;
  }[];
};

export type GithubDocsConfig = {
  docSearch: {
    appId: string;
    apiKey: string;
    indexName: string;
  };
  menu: Menu[];
  users: string[];
};

export const useReactQueryDocsConfig = (version?: string) =>
  useMatchesData(`/query/${version}`) as GithubDocsConfig;

export let meta: MetaFunction = (meta) => {
  return seo({
    title: "TanStack Query | React Query, Solid Query, Svelte Query, Vue Query",
    description:
      "Powerful asynchronous state management, server-state utilities and  data fetching for TS/JS, React, Solid, Svelte and Vue",
    image: "https://github.com/tanstack/query/raw/beta/media/repo-header.png",
  });
};

export const loader = async (context: LoaderArgs) => {
  if (
    !context.request.url.includes("/query/v") &&
    !context.request.url.includes("/query/latest")
  ) {
    return redirect(`${new URL(context.request.url).origin}/query/latest`);
  }

  return new Response("OK");
};

export default function RouteQuery() {
  return <Outlet />;
}
