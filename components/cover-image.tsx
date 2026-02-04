"use client"

import * as React from "react"

type CoverImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "onError" | "src"> & {
  src?: string | null
}

export function CoverImage({ src, ...imgProps }: CoverImageProps) {
  const [isHidden, setIsHidden] = React.useState(false)

  if (!src || isHidden) return null

  return (
    <img
      {...imgProps}
      src={src}
      onError={() => {
        setIsHidden(true)
      }}
    />
  )
}
