"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import type { Genre } from "@/lib/types"
import { GENRE_DOT_CLASS } from "@/lib/types"
import { cn } from "@/lib/utils"

type Slide = { left: string; right: string }

export function ReaderClient(props: {
  bookId: string
  title: string
  author: string
  slides: Slide[]
  primaryGenre: Genre | null
}) {
  const { bookId, title, author, slides, primaryGenre } = props

  const carouselRef = useRef<HTMLDivElement | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)

  const lastSlideRef = useRef(0)
  const [pagesRead, setPagesRead] = useState(0)

  const dotClass = useMemo(() => {
    return primaryGenre ? GENRE_DOT_CLASS[primaryGenre] : "bg-muted"
  }, [primaryGenre])

  useEffect(() => {
    const root = carouselRef.current
    if (!root) return

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-carousel-item]"))
    if (items.length === 0) return

    let raf = 0

    const obs = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0]

        if (!best?.target) return

        const idx = Number((best.target as HTMLElement).dataset.index ?? "0")
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => {
          const next = Number.isFinite(idx) ? idx : 0
          setActiveSlide(next)

          const prev = lastSlideRef.current
          if (next > prev) {
            setPagesRead((p) => p + (next - prev) * 2)
          }
          lastSlideRef.current = next
        })
      },
      { root, threshold: [0.55, 0.7, 0.85] }
    )

    items.forEach((el) => obs.observe(el))

    return () => {
      cancelAnimationFrame(raf)
      obs.disconnect()
    }
  }, [slides.length])

  return (
    <div className="reader-mode">
      <a
        href={`/books/${bookId}`}
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          color: "white",
          textDecoration: "none",
          zIndex: 100,
          padding: "0.5rem 1rem",
          border: "1px solid white",
          borderRadius: "4px",
        }}
      >
        Close
      </a>

      <div className="container">
        <div className="flex items-center gap-3">
          <h1 className="m-0">
            Reading: <span className="underline text-primary">{title}</span>
          </h1>

          <div className="flex items-center gap-2" aria-label="Pages read">
            <span className={cn("inline-block h-3 w-3 rounded-full", dotClass)} />
            <span className="text-sm text-white/90 tabular-nums">{pagesRead}</span>
          </div>
        </div>

        <div className="sprite-wrapper">
          <div className="book">
            <div className="carousel" ref={carouselRef} style={{ "--slides": slides.length } as CSSProperties}>
              <div className="sprite"></div>

              {slides.map((slide, index) => (
                <div className="carousel-item" data-carousel-item data-index={index} key={index}>
                  <div className="page-container">
                    <div className="page left-page">
                      <div>
                        {index === 0 && (
                          <>
                            <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.2rem" }}>{title}</h2>
                            <p style={{ margin: 0, textIndent: "1rem" }}>
                              <strong>By {author}</strong>
                            </p>
                            <br />
                          </>
                        )}
                        <div style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.85rem", maxWidth: "90%" }}>
                          {slide.left}
                        </div>
                      </div>
                    </div>

                    <div className="page right-page">
                      <div>
                        <div style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.85rem", maxWidth: "90%" }}>
                          {slide.right}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
