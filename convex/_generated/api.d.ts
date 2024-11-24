/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

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
      getGithubOwnerStars: FunctionReference<
        "query",
        "internal",
        { owner: string },
        any
      >;
      initGithubOwner: FunctionReference<
        "mutation",
        "internal",
        { owner: string },
        any
      >;
      sync: FunctionReference<
        "action",
        "internal",
        { githubOwners: Array<string>; personalAccessToken: string },
        any
      >;
      updateGithubOwner: FunctionReference<
        "mutation",
        "internal",
        { owner: string; stars: number },
        any
      >;
      updateGithubRepoStars: FunctionReference<
        "mutation",
        "internal",
        { name: string; owner: string; stars: number },
        any
      >;
      updateGithubStars: FunctionReference<
        "mutation",
        "internal",
        { repos: Array<{ name: string; owner: string; stars: number }> },
        any
      >;
    };
  };
};
