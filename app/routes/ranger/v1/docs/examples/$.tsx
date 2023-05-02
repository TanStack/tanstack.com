import * as React from "react";
import type { LoaderFunction, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { DocTitle } from "~/components/DocTitle";
import { v1branch } from "~/routes/ranger/v1";
import { seo } from "~/utils/seo";
import { capitalize, slugToTitle } from "~/utils/utils";

export const loader: LoaderFunction = async (context) => {
  const { "*": examplePath } = context.params;
  const [kind, _name] = (examplePath ?? "").split("/");
  const [name, search] = _name.split("?");

  return json({ kind, name, search: search ?? "" });
};

export let meta: MetaFunction = ({ data }) => {
  return seo({
    title: `${capitalize(data.kind)} Ranger ${slugToTitle(
      data.name
    )} Example | TanStack Ranger Docs`,
    description: `An example showing how to implement ${slugToTitle(
      data.name
    )} in ${capitalize(data.kind)} Ranger`,
  });
};

export default function RouteReactTableDocs() {
  const { kind, name } = useLoaderData();

  const examplePath = [kind, name].join("/");

  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto">
      <div className="p-4 lg:p-6">
        <DocTitle>
          {capitalize(kind)} Example: {slugToTitle(name)}
        </DocTitle>
      </div>
      <div className="flex-1 lg:ml-6 flex flex-col min-h-0">
        <iframe
          src={`https://codesandbox.io/embed/github/tanstack/ranger/tree/${v1branch}/examples/${examplePath}?autoresize=1&fontsize=14&theme=${
            isDark ? "dark" : "light"
          }`}
          title={`tanstack/ranger: ${examplePath}`}
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          className="flex-1 w-full overflow-hidden lg:rounded-l-2xl shadow-xl shadow-gray-700/20 bg-white dark:bg-black"
        />
      </div>
      <div className="lg:h-16 lg:mt-2" />
    </div>
  );
}
