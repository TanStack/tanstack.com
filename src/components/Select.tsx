import { Fragment, ReactNode } from 'react'
import { Listbox, Transition } from '@headlessui/react'

import { Check, ChevronsUpDown } from 'lucide-react'

export type SelectOption = {
  label: string
  value: string
  logo?: string
}

export type SelectProps<T extends SelectOption> = {
  className?: string
  icon?: ReactNode
  selected: string
  available: T[]
  onSelect: (selected: T) => void
}

export function Select<T extends SelectOption>({
  className = '',
  icon,
  selected,
  available,
  onSelect,
}: SelectProps<T>) {
  if (available.length === 0) {
    return null
  }

  const selectedOption = available.find(({ value }) => selected === value)

  if (!selectedOption) {
    return null
  }

  return (
    <div className={`w-full ${className}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <Listbox name="framework" value={selectedOption} onChange={onSelect}>
          <div className="relative">
            <Listbox.Button className="relative items-center w-full gap-2 flex hover:bg-gray-500/10 cursor-default rounded-md py-1.5 px-2 text-left focus:outline-none sm:text-sm">
              {icon ? (
                <span className="flex items-center justify-center w-6 h-6 rounded border border-gray-500/20">
                  {icon}
                </span>
              ) : selectedOption.logo ? (
                <span className="flex items-center justify-center w-6 h-6 rounded border border-gray-500/20">
                  <img
                    height={16}
                    width={16}
                    src={selectedOption.logo}
                    alt={`${selectedOption.label} logo`}
                  />
                </span>
              ) : null}
              <span className="truncate font-medium">
                {selectedOption.label}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronsUpDown
                  className="h-4 w-4 opacity-40"
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
              <Listbox.Options className="absolute z-10 dark:bg-gray-800 border border-gray-500/20 mt-1 max-h-60 w-fit overflow-auto rounded-md bg-white py-1 text-base shadow-md ring-1 ring-black/5 focus:outline-none sm:text-sm">
                {Object.values(available).map((option) => (
                  <Listbox.Option
                    key={option.value}
                    className={({ active }) =>
                      `relative cursor-default select-none py-2 pr-10 ${
                        active
                          ? 'bg-gray-100 dark:bg-gray-700'
                          : 'text-gray-900 dark:text-gray-300'
                      } ${option.logo ? 'pl-10' : 'pl-2'}`
                    }
                    value={option}
                  >
                    {({ selected }) => (
                      <>
                        {option.logo ? (
                          <figure className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-800">
                            <img
                              height={18}
                              width={18}
                              src={option.logo}
                              alt={`${option.label} logo`}
                            />
                          </figure>
                        ) : null}
                        <span
                          className={`block truncate ${
                            selected ? 'font-medium' : 'font-normal'
                          }`}
                        >
                          {option.label}
                        </span>
                        {selected ? (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-800 dark:text-gray-400">
                            <Check className="h-5 w-5" aria-hidden="true" />
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
      </form>
    </div>
  )
}
