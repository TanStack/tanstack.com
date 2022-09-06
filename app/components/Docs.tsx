import { DocSearch } from "@docsearch/react";
import * as React from "react";
import { CgClose, CgMenuLeft } from "react-icons/cg";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { NavLink, Outlet, useMatches } from "@remix-run/react";
import { last } from "~/utils/utils";
import { Carbon } from "./Carbon";
import { LinkOrA } from "./LinkOrA";
import { Search } from "./Search";
import { gradientText } from "~/routes/query/v4/index";
import BytesForm from "./BytesForm";

export type DocsConfig = {
  docSearch: {
    appId: string;
    indexName: string;
    apiKey: string;
  };
  menu: {
    label: string | React.ReactNode;
    children: {
      label: string;
      to: string;
    }[];
  }[];
};

export function Docs({
  colorFrom,
  colorTo,
  textColor,
  logo,
  config,
}: {
  colorFrom: string;
  colorTo: string;
  textColor: string;
  logo: React.ReactNode;
  config: DocsConfig;
}) {
  const matches = useMatches();
  const lastMatch = last(matches);

  const detailsRef = React.useRef<HTMLElement>(null!);

  const flatMenu = React.useMemo(
    () => config.menu.flatMap((d) => d.children),
    [config.menu]
  );

  const docsMatch = matches.find((d) => d.pathname.includes("/docs"));

  const relativePathname = lastMatch.pathname.replace(
    docsMatch?.pathname! + "/",
    ""
  );

  const index = flatMenu.findIndex((d) => d.to === relativePathname);
  const prevItem = flatMenu[index - 1];
  const nextItem = flatMenu[index + 1];

  const menuItems = config.menu.map((group, i) => {
    return (
      <div key={i}>
        <div className="text-[.9em] uppercase font-black">{group.label}</div>
        <div className="h-2" />
        <div className="pl-2 space-y-2 text-[.9em]">
          {group.children?.map((child, i) => {
            return (
              <div key={i}>
                {child.to.startsWith("http") ? (
                  <a href={child.to}>{child.label}</a>
                ) : (
                  <NavLink
                    to={child.to}
                    className={(props) =>
                      props.isActive
                        ? `font-bold text-transparent bg-clip-text bg-gradient-to-r ${colorFrom} ${colorTo}`
                        : ""
                    }
                    onClick={() => {
                      detailsRef.current.removeAttribute("open");
                    }}
                    end
                  >
                    {child.label}
                  </NavLink>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  });

  const smallMenu = (
    <div
      className="lg:hidden bg-white sticky top-0 z-20
              dark:bg-black"
    >
      <details
        ref={detailsRef}
        id="docs-details"
        className="border-b border-gray-500 border-opacity-20"
      >
        <summary className="p-4 flex gap-2 items-center justify-between">
          <div className="flex gap-2 items-center text-xl md:text-2xl">
            <CgMenuLeft className="icon-open mr-2 cursor-pointer" />
            <CgClose className="icon-close mr-2 cursor-pointer" />
            {logo}
          </div>
          <Search {...config.docSearch} />
        </summary>
        <div
          className="flex flex-col gap-4 p-4 whitespace-nowrap h-[0vh] overflow-y-auto
          border-t border-gray-500 border-opacity-20 bg-gray-100 text-lg
          dark:bg-gray-900"
        >
          {menuItems}
        </div>
      </details>
    </div>
  );

  const largeMenu = (
    <div className="hidden lg:flex flex-col gap-4 h-screen sticky top-0 z-20">
      <div className="px-4 pt-4 flex gap-2 items-center text-2xl">{logo}</div>
      <div>
        <DocSearch
          appId={config.docSearch.appId}
          indexName={config.docSearch.indexName}
          apiKey={config.docSearch.apiKey}
        />
      </div>
      <div className="flex-1 flex flex-col gap-4 px-4 whitespace-nowrap overflow-y-auto text-base pb-[300px]">
        {menuItems}
      </div>
      <div className="carbon-small absolute bottom-0 w-full">
        <Carbon />
      </div>
    </div>
  );

  const aside = (
    <aside className="p-6 xl:p-12">
      <ul className="sticky top-10 border border-black/10 dark:border-white/10 p-6 rounded-lg max-w-[30ch]">
        {config?.docSearch?.indexName?.includes("query") && (
          <li className="mb-8">
            <h6 className="text-[.9em] uppercase font-black mb-4">
              Want to Skip the Docs?
            </h6>
            <p className="text-sm">
              Fast track your learning and <br />
              <a
                className={`${gradientText}`}
                href="https://ui.dev/react-query?from=tanstack"
                target="_blank"
              >
                <span>take the offical React Query course ↗️</span>
              </a>
            </p>
          </li>
        )}
        <li>
          <h6 className="text-[.9em] uppercase font-black mb-4">
            Subscribe to Bytes
          </h6>
          <p className="text-sm mb-4">
            Your weekly dose of JavaScript news. Delivered every Monday to over
            100,000 devs, for free.
          </p>
          <BytesForm />
        </li>
      </ul>
    </aside>
  );

  return (
    <div className="min-h-screen flex flex-col  lg:grid lg:grid-cols-[250px_minmax(500px,_1fr)_minmax(300px,_400px)] w-full">
      {smallMenu}
      {largeMenu}
      <div className="flex-1 min-h-0 flex relative justify-center">
        <Outlet />
        <div
          className="fixed bottom-0 left-0 right-0
                      lg:pl-[250px] z-10"
        >
          <div className="p-4 flex justify-center gap-4">
            {prevItem ? (
              <LinkOrA
                to={prevItem.to}
                className="flex gap-2 items-center py-1 px-2 text-sm self-start rounded-md
              bg-white text-gray-600 dark:bg-black dark:text-gray-400
              shadow-lg dark:border dark:border-gray-800
              lg:text-lg"
              >
                <FaArrowLeft /> {prevItem.label}
              </LinkOrA>
            ) : null}
            {nextItem ? (
              <LinkOrA
                to={nextItem.to}
                className="py-1 px-2 text-sm self-end rounded-md
                bg-white dark:bg-black
                shadow-lg dark:border dark:border-gray-800
                lg:text-lg
                "
              >
                <div className="flex gap-2 items-center font-bold">
                  <span
                    className={`bg-gradient-to-r ${colorFrom} ${colorTo} bg-clip-text text-transparent`}
                  >
                    {nextItem.label}
                  </span>{" "}
                  <FaArrowRight className={textColor} />
                </div>
              </LinkOrA>
            ) : null}
          </div>
        </div>
      </div>
      {aside}
    </div>
  );
}
