"use client"

import { useId, useState } from "react"

export function CustomBadge({ name, imageUrl }: { name: string; imageUrl: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <span
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={id}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={name} className="size-3.5 rounded-sm object-cover" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground shadow-lg"
        >
          {name}
        </span>
      )}
    </span>
  )
}
