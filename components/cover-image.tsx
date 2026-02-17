"use client"

import * as React from "react"
import Image, { type ImageProps } from "next/image"

type CoverImageProps = Omit<ImageProps, "src" | "alt" | "fill"> & {
  src?: string | null
  alt: string
  fill?: boolean
}

export function CoverImage({ src, alt, fill = true, ...imgProps }: CoverImageProps) {
  const [isHidden, setIsHidden] = React.useState(false)

  if (!src || isHidden) return null

  return (
    <Image
      {...imgProps}
      src={src}
      alt={alt}
      fill={fill}
      sizes={imgProps.sizes ?? "100vw"}
      onError={() => {
        setIsHidden(true)
      }}
    />
  )
}
