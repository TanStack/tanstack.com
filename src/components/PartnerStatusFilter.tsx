import type { PartnerDirectoryStatus } from '~/utils/partner-directory'

const partnerStatusOptions: Array<{
  label: string
  status: PartnerDirectoryStatus
}> = [
  { label: 'Current', status: 'active' },
  { label: 'Previous', status: 'inactive' },
]

export function PartnerStatusFilter({
  selectedStatus,
  onStatusChange,
}: {
  selectedStatus: PartnerDirectoryStatus
  onStatusChange: (status: PartnerDirectoryStatus) => void
}) {
  return (
    <fieldset className="mb-6">
      <legend className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
        Partner status
      </legend>
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
        {partnerStatusOptions.map(({ status, label }) => {
          const isSelected = selectedStatus === status

          return (
            <label key={status} className="cursor-pointer">
              <input
                type="radio"
                name="partner-status"
                value={status}
                checked={isSelected}
                onChange={() => onStatusChange(status)}
                className="peer sr-only"
              />
              <span
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-500 ${
                  isSelected
                    ? status === 'active'
                      ? 'bg-green-700 text-white'
                      : 'bg-orange-700 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
