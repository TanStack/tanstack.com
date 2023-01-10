import { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";

import { HiCheck, HiChevronDown } from "react-icons/hi";

import vueLogo from "../images/vue-logo.svg";
import reactLogo from "../images/react-logo.svg";
import solidLogo from "../images/solid-logo.svg";
import svelteLogo from "../images/svelte-logo.svg";
import angularLogo from "../images/angular-logo.svg";
import { Form, useParams } from "@remix-run/react";
import { useNavigate } from "@remix-run/react";

const frameworks = [
  { label: "React", value: "react" },
  { label: "Solid", value: "solid" },
  { label: "Vue", value: "vue" },
  { label: "Svelte", value: "svelte" },
  { label: "Angular", value: "angular" },
];

const logoMap = {
  react: reactLogo,
  solid: solidLogo,
  vue: vueLogo,
  svelte: svelteLogo,
  angular: angularLogo,
};

const properCase = (str: string) => str[0].toUpperCase() + str.slice(1);

export function FrameworkSelect({
  framework,
  availableFrameworks,
}: {
  framework: string;
  availableFrameworks: string[];
}) {
  const navigate = useNavigate();
  const params = useParams();

  const selected = { label: properCase(framework), value: framework };

  const selectFramework = (framework: typeof selected) => {
    navigate(`../${framework.value}/${params['*']}`);
  };

  return (
    <div className="top-16 w-full lg:px-4">
      <div className="text-[.9em] uppercase font-black">Framework</div>
      <Form>
        <Listbox name="framework" value={selected} onChange={selectFramework}>
          <div className="relative mt-1">
            <Listbox.Button className="relative items-center  w-full gap-2 flex hover:bg-gray-100/70 dark:hover:bg-gray-800 cursor-default border-2 dark:border-gray-700/80 rounded-md py-2 pl-3 pr-10 text-left focus:outline-none focus-visible:border-indigo-500  sm:text-sm">
              <figure className="flex ">
                <img
                  height={18}
                  width={18}
                  src={logoMap[selected.value as keyof typeof logoMap]}
                  alt={`${selected.label} logo`}
                />
              </figure>
              <span className="truncate">{selected.label}</span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <HiChevronDown
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </span>
            </Listbox.Button>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-10 dark:bg-gray-800 dark:border-2 border-gray-600/70 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {frameworks
                  .filter((f) => availableFrameworks.includes(f.value))
                  .map((f, personIdx) => (
                    <Listbox.Option
                      key={personIdx}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 px-10 ${
                          active
                            ? "bg-gray-100 dark:bg-gray-700"
                            : "text-gray-900 dark:text-gray-300"
                        }`
                      }
                      value={f}
                    >
                      {({ selected }) => (
                        <>
                          <figure className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-800">
                            <img
                              height={18}
                              width={18}
                              src={logoMap[f.value as keyof typeof logoMap]}
                              alt={`${f.label} logo`}
                            />
                          </figure>
                          <span
                            className={`block truncate ${
                              selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            {f.label}
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-800 dark:text-gray-400">
                              <HiCheck className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>
      </Form>
    </div>
  );
}
