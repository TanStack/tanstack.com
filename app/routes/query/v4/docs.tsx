import * as React from "react";
import { FaArrowLeft, FaArrowRight, FaDiscord, FaGithub } from "react-icons/fa";
import { CgClose, CgMenuLeft } from "react-icons/cg";
import {
  Link,
  MetaFunction,
  NavLink,
  Outlet,
  useMatches,
} from "@remix-run/react";
import { last } from "~/utils/utils";
import { useReactQueryV4Config } from "../v4";
import { DocSearch } from "@docsearch/react";
import { gradientText } from "./index";
import { Carbon } from "~/components/Carbon";
import { seo } from "~/utils/seo";
import { LinkOrA } from "~/components/LinkOrA";
import { Docs, DocsConfig } from "~/components/Docs";
import { PPPBanner } from "~/components/PPPBanner";

const logo = (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to=".." className={`font-bold`}>
      <span className={`${gradientText}`}>Query</span>{" "}
      <span className="text-sm align-super">v4</span>
    </Link>
  </>
);

const localMenu = {
  label: "Menu",
  children: [
    {
      label: "Home",
      to: "..",
    },
    {
      label: (
        <div className="flex items-center gap-2">
          Github <FaGithub className="text-lg opacity-20" />
        </div>
      ),
      to: "https://github.com/tanstack/query",
    },
    {
      label: (
        <div className="flex items-center gap-2">
          Discord <FaDiscord className="text-lg opacity-20" />
        </div>
      ),
      to: "https://tlinz.com/discord",
    },
  ],
};

export let meta: MetaFunction = () => {
  return seo({
    title:
      "TanStack Query Docs | React Query, Solid Query, Svelte Query, Vue Query",
  });
};

export default function RouteReactQuery() {
  let config = useReactQueryV4Config();

  config = React.useMemo(
    () =>
      ({
        ...config,
        menu: [localMenu, ...config.menu],
      } as DocsConfig),
    [config]
  );

  return (
    <>
      <PPPBanner />
      <Docs
        {...{
          logo,
          colorFrom: "from-rose-500",
          colorTo: "to-violet-500",
          textColor: "text-violet-500",
          config,
        }}
      />
    </>
  );
}
