import * as React from "react";
import { FaDiscord, FaGithub } from "react-icons/fa";
import type { MetaFunction } from "@remix-run/node";
import { Link, useParams } from "@remix-run/react";
import { gradientText } from "../index";
import { seo } from "~/utils/seo";
import type { DocsConfig } from "~/components/Docs";
import { Docs } from "~/components/Docs";
import { PPPBanner } from "~/components/PPPBanner";
import { repo, useReactQueryDocsConfig } from "~/routes/query";
import type { MenuItem } from "~/routes/query";

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

const localMenu: MenuItem = {
  label: "Menu",
  children: [
    {
      label: "Home",
      to: "..",
    },
    {
      label: (
        <div className="flex items-center gap-2">
          GitHub <FaGithub className="text-lg opacity-20" />
        </div>
      ),
      to: `https://github.com/${repo}`,
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
  const { framework, version } = useParams();
  let config = useReactQueryDocsConfig(version);

  const docsConfig = React.useMemo(() => {
    const availableFrameworks = config.menu.map((m) => m.framework);
    const frameworkMenu = config.menu.find((d) => d.framework === framework);
    if (!frameworkMenu) return null;
    return {
      ...config,
      menu: [localMenu, ...(frameworkMenu?.menuItems || [])],
      framework: frameworkMenu?.framework,
      availableFrameworks,
    } as DocsConfig;
  }, [framework, config]);

  return (
    <>
      <PPPBanner />
      <Docs
        {...{
          logo,
          colorFrom: "from-rose-500",
          colorTo: "to-violet-500",
          textColor: "text-violet-500",
          config: docsConfig!,
          framework: docsConfig!.framework,
          availableFrameworks: docsConfig!.availableFrameworks,
        }}
      />
    </>
  );
}
