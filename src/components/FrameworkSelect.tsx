import { Listbox, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { HiCheck, HiChevronDown } from 'react-icons/hi'

export type SelectOption = {
  label: string
  value: string
  logo?: string
}

export type SelectProps<T extends SelectOption> = {
  className?: string
  label: string
  selected: string
  available: T[]
  onSelect: (selected: T) => void
}

export function FrameworkSelect<T extends SelectOption>({
  className = '',
  label,
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
    <div className={`top-16 w-full flex-1 ${className}`}>
      <div className="pl-2 text-[.8em] font-black uppercase">{label}</div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <Listbox name="framework" value={selectedOption} onChange={onSelect}>
          <div className="relative mt-1">
            <Listbox.Button className="relative flex w-full cursor-default items-center gap-2 rounded-md border-2 py-2 pr-10 pl-2 text-left hover:bg-gray-100/70 focus:outline-none focus-visible:border-indigo-500 sm:text-sm dark:border-gray-700/80 dark:hover:bg-gray-800">
              {selectedOption.logo ? (
                <figure className="flex">
                  <img
                    height={18}
                    width={18}
                    src={selectedOption.logo}
                    alt={`${selectedOption.label} logo`}
                  />
                </figure>
              ) : null}
              <span className="truncate">{selectedOption.label}</span>
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
              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-fit overflow-auto rounded-md border-gray-600/70 bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm dark:border-2 dark:bg-gray-800">
                {Object.values(available).map((option) => (
                  <Listbox.Option
                    key={option.value}
                    className={({ active }) =>
                      `relative cursor-default py-2 pr-10 select-none ${
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
      </form>
    </div>
  )
}
