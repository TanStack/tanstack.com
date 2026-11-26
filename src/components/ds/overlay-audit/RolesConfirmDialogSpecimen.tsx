import type { SpecimenProps } from './types'

/**
 * AUDIT SPECIMEN — verbatim shell of the inline confirm dialog in
 * `src/routes/admin/roles.$roleId.tsx` (~line 326).
 *
 * The worst case in the audit and worth keeping visible: no portal, no Radix,
 * no focus trap, no Escape handler, no labelled dialog role, no close button,
 * and no max-height. Rendered inline in the route tree.
 */
export function RolesConfirmDialogSpecimen({
  open,
  onOpenChange,
}: SpecimenProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Confirm Removal
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Are you sure you want to remove this user from the role?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}
