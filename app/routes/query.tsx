import { Outlet } from "@remix-run/react";
import type { LoaderArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { seo } from "~/utils/seo";
import { useMatchesData } from "~/utils/utils";

export const repo = "tanstack/query";

const latestBranch = "main";
export const latestVersion = "v5";
export const availableVersions = [
  {
    name: "v5",
    branch: latestBranch,
  },
  {
    name: "v4",
    branch: "v4",
  },
  {
    name: "v3",
    branch: "v3",
  },
] as const

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion;

  if (version === "latest") {
    return latestBranch
  }
  
  return availableVersions.find(v => v.name === version)?.branch ?? latestBranch;
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
    image: "https://github.com/tanstack/query/raw/main/media/repo-header.png",
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
