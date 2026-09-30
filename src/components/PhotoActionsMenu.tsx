type PhotoActionsMenuProps = { fileName: string; onDelete: () => void }

// Always visible on touch screens; on devices that can hover, it shows on hover or keyboard focus.
export function PhotoActionsMenu({ fileName, onDelete }: PhotoActionsMenuProps) {
  return (
    <div className="absolute right-1 top-1 flex gap-1 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${fileName}`}
        className="rounded bg-white/90 px-2 py-1 text-xs text-red-700 shadow hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Delete
      </button>
    </div>
  )
}
