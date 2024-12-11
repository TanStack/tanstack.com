/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as http from "../http.js";
import type * as stats from "../stats.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  http: typeof http;
  stats: typeof stats;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  ossStats: {
    lib: {
      getGithubOwner: FunctionReference<
        "query",
        "internal",
        { owner: string },
        any
      >;
      getNpmOrg: FunctionReference<"query", "internal", { name: string }, any>;
      sync: FunctionReference<
        "action",
        "internal",
        {
          githubAccessToken: string;
          githubOwners: Array<string>;
          minStars: number;
          npmOrgs: Array<string>;
        },
        any
      >;
      updateGithubOwner: FunctionReference<
        "mutation",
        "internal",
        {
          contributorCount?: number;
          dependentCount?: number;
          owner: string;
          starCount?: number;
        },
        any
      >;
      updateGithubRepoStars: FunctionReference<
        "mutation",
        "internal",
        {
          githubAccessToken: string;
          name: string;
          owner: string;
          starCount?: number;
        },
        any
      >;
      updateGithubRepos: FunctionReference<
        "mutation",
        "internal",
        {
          repos: Array<{
            contributorCount: number;
            dependentCount: number;
            dependentCountPrevious?: { count: number; updatedAt: number };
            name: string;
            owner: string;
            starCount: number;
          }>;
        },
        any
      >;
      updateNpmOrg: FunctionReference<
        "mutation",
        "internal",
        {
          dayOfWeekAverages: Array<number>;
          downloadCount: number;
          name: string;
        },
        any
      >;
      updateNpmPackages: FunctionReference<
        "mutation",
        "internal",
        {
          packages: Array<{
            dayOfWeekAverages: Array<number>;
            downloadCount: number;
            name: string;
          }>;
        },
        any
      >;
    };
  };
};
