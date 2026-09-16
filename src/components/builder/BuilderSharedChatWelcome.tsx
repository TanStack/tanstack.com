export function BuilderSharedChatWelcome() {
  return (
    <div className="grid min-h-full place-items-center px-5 py-16">
      <div className="w-full max-w-sm">
        <h2 className="text-lg font-semibold text-text-primary">
          What would you like to change?
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          The creator’s chat isn’t shared. Start your own conversation about
          this project, then fork to save your changes.
        </p>
      </div>
    </div>
  )
}
