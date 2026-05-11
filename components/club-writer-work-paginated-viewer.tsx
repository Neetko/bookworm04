"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

const A4_PAGE_WIDTH = 794
const A4_PAGE_HEIGHT = 1123
const PAGE_VIEWPORT_HEIGHT = 860
const DOCUMENT_FONT_FAMILY = "Georgia, 'Times New Roman', serif"
const DOCUMENT_BODY_CLASS_NAME =
  "max-w-none text-[17px] leading-8 tracking-normal text-zinc-950 [&_a]:text-zinc-900 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_li]:my-1 [&_ol]:my-4 [&_p]:mb-5 [&_ul]:my-4 last:[&_p]:mb-0"

type ClubWriterWorkPaginatedViewerProps = {
  title: string
  authorName: string
  updatedAtLabel: string
  isCompleted: boolean
  sanitizedHtml: string
}

type PageData = {
  html: string
}

const BLOCK_TAGS = new Set(["p", "blockquote", "ul", "ol", "pre"])
const INLINE_TAGS = new Set(["strong", "b", "em", "i", "u", "s", "a", "code", "br"])

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildIntroBlock(title: string, authorName: string, updatedAtLabel: string, isCompleted: boolean) {
  return `
    <section class="mb-8 border-b border-zinc-200 pb-6">
      <h1 style="font-family:${DOCUMENT_FONT_FAMILY}" class="text-3xl font-semibold leading-tight tracking-normal text-zinc-950 sm:text-[2.35rem]">${escapeHtml(title)}</h1>
      <div class="mt-3 flex flex-wrap items-center gap-3 text-sm tracking-normal text-zinc-600">
        <span>by ${escapeHtml(authorName)}</span>
        <span>•</span>
        <span>Updated ${escapeHtml(updatedAtLabel)}</span>
        ${isCompleted ? '<span>•</span><span class="font-medium text-emerald-700">Completed manuscript</span>' : ""}
      </div>
    </section>
  `
}

function htmlToBlocks(html: string) {
  if (!html.trim()) return [] as string[]

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html")
  const root = doc.body.firstElementChild
  if (!root) return [] as string[]

  const blocks: string[] = []
  const inlineBuffer: string[] = []

  const flushInlineBuffer = () => {
    if (inlineBuffer.length === 0) return
    blocks.push(`<p>${inlineBuffer.join("")}</p>`)
    inlineBuffer.length = 0
  }

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ""
      if (text.trim()) {
        inlineBuffer.push(escapeHtml(text))
      }
      continue
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue

    const element = node as HTMLElement
    const tagName = element.tagName.toLowerCase()

    if (BLOCK_TAGS.has(tagName)) {
      flushInlineBuffer()
      blocks.push(element.outerHTML)
      continue
    }

    if (INLINE_TAGS.has(tagName)) {
      inlineBuffer.push(element.outerHTML)
      continue
    }

    flushInlineBuffer()
    blocks.push(element.outerHTML)
  }

  flushInlineBuffer()
  return blocks.filter((block) => block.trim().length > 0)
}

function getElementTextPreservingBreaks(element: HTMLElement) {
  return element.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function wrapTextInTag(tagName: string, text: string, listStart?: number) {
  const escaped = escapeHtml(text).replace(/\n/g, "<br />")

  if (tagName === "blockquote") {
    return `<blockquote><p>${escaped}</p></blockquote>`
  }

  if (tagName === "pre") {
    return `<pre>${escaped}</pre>`
  }

  if (tagName === "ol") {
    return `<ol${typeof listStart === "number" ? ` start="${listStart}"` : ""}><li>${escaped}</li></ol>`
  }

  if (tagName === "ul") {
    return `<ul><li>${escaped}</li></ul>`
  }

  return `<${tagName}>${escaped}</${tagName}>`
}

function splitTextIntoUnits(text: string) {
  const sentenceUnits = text.match(/[^.!?\n]+(?:[.!?]+|$)|\n+/g)?.map((unit) => unit.trim()).filter(Boolean) ?? []
  if (sentenceUnits.length > 1) return sentenceUnits
  return text.split(/\s+/).map((unit) => unit.trim()).filter(Boolean)
}

function splitTextualBlock(
  blockHtml: string,
  pieceFits: (html: string) => boolean
) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${blockHtml}</div>`, "text/html")
  const element = doc.body.firstElementChild?.firstElementChild as HTMLElement | null
  if (!element) return [blockHtml]

  const tagName = element.tagName.toLowerCase()
  const text = getElementTextPreservingBreaks(element)
  if (!text) return [blockHtml]

  const units = splitTextIntoUnits(text)
  if (units.length <= 1) return [blockHtml]

  const chunks: string[] = []
  let currentUnits: string[] = []
  let listStart = 1

  const flush = () => {
    if (currentUnits.length === 0) return
    chunks.push(wrapTextInTag(tagName, currentUnits.join(tagName === "pre" ? "\n" : " "), listStart))
    listStart += currentUnits.length
    currentUnits = []
  }

  for (const unit of units) {
    const nextUnits = [...currentUnits, unit]
    const candidate = wrapTextInTag(tagName, nextUnits.join(tagName === "pre" ? "\n" : " "), listStart)

    if (pieceFits(candidate)) {
      currentUnits = nextUnits
      continue
    }

    if (currentUnits.length > 0) {
      flush()
      currentUnits = [unit]
      continue
    }

    const words = unit.split(/\s+/).map((word) => word.trim()).filter(Boolean)
    if (words.length <= 1) {
      currentUnits = [unit]
      flush()
      continue
    }

    let currentWords: string[] = []
    for (const word of words) {
      const nextWords = [...currentWords, word]
      const wordCandidate = wrapTextInTag(tagName, nextWords.join(" "), listStart)
      if (pieceFits(wordCandidate)) {
        currentWords = nextWords
        continue
      }

      if (currentWords.length > 0) {
        chunks.push(wrapTextInTag(tagName, currentWords.join(" "), listStart))
        listStart += 1
        currentWords = [word]
        continue
      }

      chunks.push(wrapTextInTag(tagName, word, listStart))
      listStart += 1
    }

    if (currentWords.length > 0) {
      chunks.push(wrapTextInTag(tagName, currentWords.join(" "), listStart))
      listStart += 1
    }
  }

  flush()
  return chunks.length > 0 ? chunks : [blockHtml]
}

function splitListBlock(
  blockHtml: string,
  pieceFits: (html: string) => boolean
) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${blockHtml}</div>`, "text/html")
  const list = doc.body.firstElementChild?.firstElementChild as HTMLOListElement | HTMLUListElement | null
  if (!list) return [blockHtml]

  const tagName = list.tagName.toLowerCase()
  const items = Array.from(list.children).filter((child) => child.tagName.toLowerCase() === "li") as HTMLLIElement[]
  if (items.length <= 1) {
    return splitTextualBlock(blockHtml, pieceFits)
  }

  const chunks: string[] = []
  let currentItems: string[] = []
  let start = Number(list.getAttribute("start") ?? "1")

  const buildListHtml = (listItems: string[], startValue: number) => {
    if (tagName === "ol") {
      return `<ol start="${startValue}">${listItems.join("")}</ol>`
    }
    return `<ul>${listItems.join("")}</ul>`
  }

  for (const item of items) {
    const candidateItems = [...currentItems, item.outerHTML]
    const candidateHtml = buildListHtml(candidateItems, start)
    if (pieceFits(candidateHtml)) {
      currentItems = candidateItems
      continue
    }

    if (currentItems.length > 0) {
      chunks.push(buildListHtml(currentItems, start))
      start += currentItems.length
      currentItems = [item.outerHTML]
      continue
    }

    const splitItemPieces = splitTextualBlock(`<p>${item.innerHTML}</p>`, (pieceHtml) => pieceFits(buildListHtml([`<li>${pieceHtml}</li>`], start)))
    if (splitItemPieces.length > 1) {
      for (const piece of splitItemPieces) {
        chunks.push(buildListHtml([`<li>${piece}</li>`], start))
        start += 1
      }
    } else {
      chunks.push(buildListHtml([item.outerHTML], start))
      start += 1
    }
  }

  if (currentItems.length > 0) {
    chunks.push(buildListHtml(currentItems, start))
  }

  return chunks.length > 0 ? chunks : [blockHtml]
}

function splitOversizedBlock(
  blockHtml: string,
  pieceFits: (html: string) => boolean
) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${blockHtml}</div>`, "text/html")
  const element = doc.body.firstElementChild?.firstElementChild as HTMLElement | null
  if (!element) return [blockHtml]

  const tagName = element.tagName.toLowerCase()
  if (tagName === "ul" || tagName === "ol") {
    return splitListBlock(blockHtml, pieceFits)
  }

  return splitTextualBlock(blockHtml, pieceFits)
}

export function ClubWriterWorkPaginatedViewer({
  title,
  authorName,
  updatedAtLabel,
  isCompleted,
  sanitizedHtml,
}: ClubWriterWorkPaginatedViewerProps) {
  const viewerShellRef = useRef<HTMLDivElement | null>(null)
  const measureContentRef = useRef<HTMLDivElement | null>(null)

  const [pages, setPages] = useState<PageData[]>([])
  const [activePage, setActivePage] = useState(0)
  const [isPaginating, setIsPaginating] = useState(true)
  const [pageScale, setPageScale] = useState(1)

  const introBlock = useMemo(
    () => buildIntroBlock(title, authorName, updatedAtLabel, isCompleted),
    [authorName, isCompleted, title, updatedAtLabel]
  )

  useEffect(() => {
    let cancelled = false

    const waitForFonts = async () => {
      const fontSet = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
      if (fontSet?.ready) {
        try {
          await fontSet.ready
        } catch {
          // Ignore font readiness failures and paginate with currently available fonts.
        }
      }
    }

    const paginate = async () => {
      setIsPaginating(true)
      await waitForFonts()
      if (cancelled) return

      const measureContent = measureContentRef.current
      if (!measureContent) return

      const blocks = htmlToBlocks(sanitizedHtml)
      const renderedPages: PageData[] = []
      let queue = [...blocks]
      let currentBlocks: string[] = []
      let isFirstPage = true

      const renderPageContent = (blockItems: string[], includeIntro: boolean) =>
        `${includeIntro ? introBlock : ""}${blockItems.join("")}`

      const fitsPage = (html: string) => {
        measureContent.innerHTML = html
        return measureContent.scrollHeight <= measureContent.clientHeight + 1
      }

      while (queue.length > 0) {
        const block = queue.shift() ?? ""
        const candidateHtml = renderPageContent([...currentBlocks, block], isFirstPage)

        if (fitsPage(candidateHtml)) {
          currentBlocks.push(block)
          continue
        }

        if (currentBlocks.length > 0) {
          renderedPages.push({ html: renderPageContent(currentBlocks, isFirstPage) })
          currentBlocks = []
          isFirstPage = false
          queue.unshift(block)
          continue
        }

        const splitBlocks = splitOversizedBlock(block, (pieceHtml) => fitsPage(renderPageContent([pieceHtml], isFirstPage)))
        if (splitBlocks.length > 1) {
          queue = [...splitBlocks, ...queue]
          continue
        }

        renderedPages.push({ html: renderPageContent([block], isFirstPage) })
        isFirstPage = false
      }

      const trailingHtml = renderPageContent(currentBlocks, isFirstPage)
      if (currentBlocks.length > 0 || (renderedPages.length === 0 && introBlock && fitsPage(trailingHtml))) {
        renderedPages.push({ html: trailingHtml })
      }

      if (!cancelled) {
        setPages(renderedPages.length > 0 ? renderedPages : [{ html: renderPageContent([], true) }])
        setActivePage(0)
        setIsPaginating(false)
      }
    }

    void paginate()

    return () => {
      cancelled = true
    }
  }, [introBlock, sanitizedHtml])

  useEffect(() => {
    const viewerShell = viewerShellRef.current
    if (!viewerShell) return

    const updateScale = () => {
      const nextScale = Math.min(1, viewerShell.clientWidth / A4_PAGE_WIDTH)
      setPageScale((currentScale) => (Math.abs(currentScale - nextScale) < 0.01 ? currentScale : nextScale))
    }

    updateScale()

    const observer = new ResizeObserver(() => {
      updateScale()
    })

    observer.observe(viewerShell)
    window.addEventListener("resize", updateScale)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateScale)
    }
  }, [])

  useEffect(() => {
    setActivePage(0)
  }, [pages.length])

  const totalPages = pages.length
  const currentPage = pages[activePage] ?? pages[0] ?? null
  const scaledPageWidth = A4_PAGE_WIDTH * pageScale
  const scaledPageHeight = A4_PAGE_HEIGHT * pageScale

  const goToPage = (pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= totalPages) return
    setActivePage(pageIndex)
  }

  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [1] as Array<number | "ellipsis">

    const items: Array<number | "ellipsis"> = []

    if (totalPages <= 7) {
      for (let page = 1; page <= totalPages; page += 1) {
        items.push(page)
      }
      return items
    }

    items.push(1)

    if (activePage + 1 > 3) {
      items.push("ellipsis")
    }

    for (let page = Math.max(2, activePage); page <= Math.min(totalPages - 1, activePage + 2); page += 1) {
      items.push(page)
    }

    if (activePage + 1 < totalPages - 2) {
      items.push("ellipsis")
    }

    items.push(totalPages)
    return items
  }, [activePage, totalPages])

  return (
    <>
      <div className="relative">
        <div ref={viewerShellRef} className="rounded-xl border bg-muted/20 p-3">
          <div className="mx-auto w-full max-w-[794px]">
            {isPaginating ? (
              <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: `${PAGE_VIEWPORT_HEIGHT}px` }}>
                Preparing manuscript pages…
              </div>
            ) : currentPage ? (
              <div className="relative">
                <div className="mx-auto" style={{ width: `${scaledPageWidth}px`, height: `${scaledPageHeight}px` }}>
                  <div
                    className="absolute left-1/2 top-0 flex origin-top-left -translate-x-1/2 flex-col rounded-md border border-zinc-300 bg-white text-black shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5"
                    style={{
                      width: `${A4_PAGE_WIDTH}px`,
                      height: `${A4_PAGE_HEIGHT}px`,
                      transform: `translateX(-50%) scale(${pageScale})`,
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-zinc-200 px-10 py-6 text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
                      <span>Club PDF preview</span>
                      <span>{authorName}</span>
                    </div>

                    <div
                      className={`min-h-0 flex-1 overflow-hidden px-10 py-8 ${DOCUMENT_BODY_CLASS_NAME}`}
                      style={{ fontFamily: DOCUMENT_FONT_FAMILY }}
                      dangerouslySetInnerHTML={{ __html: currentPage.html }}
                    />

                    <div className="mt-auto flex items-center justify-between border-t border-zinc-200 px-10 py-5 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                      <span>Bookworm Writer Clubs</span>
                      <span>Page {activePage + 1}</span>
                    </div>
                  </div>
                </div>

                {totalPages > 1 ? (
                  <div className="absolute left-full top-0 ml-4 hidden xl:flex xl:flex-col xl:items-center xl:gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => goToPage(activePage - 1)}
                      disabled={activePage === 0}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex max-h-[70vh] flex-col items-center gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {pageNumbers.map((pageNumber, index) =>
                        pageNumber === "ellipsis" ? (
                          <span key={`page-ellipsis-${index}`} className="px-1 py-1 text-sm text-muted-foreground">
                            ···
                          </span>
                        ) : (
                          <Button
                            key={`page-button-desktop-${pageNumber}`}
                            type="button"
                            variant={activePage + 1 === pageNumber ? "default" : "ghost"}
                            size="icon"
                            className="h-8 w-8 text-sm"
                            onClick={() => goToPage(pageNumber - 1)}
                            aria-label={`Go to page ${pageNumber}`}
                            aria-current={activePage + 1 === pageNumber ? "page" : undefined}
                          >
                            {pageNumber}
                          </Button>
                        )
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => goToPage(activePage + 1)}
                      disabled={activePage === totalPages - 1}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: `${PAGE_VIEWPORT_HEIGHT}px` }}>
                No manuscript pages available.
              </div>
            )}
          </div>
        </div>

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-2 xl:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => goToPage(activePage - 1)}
              disabled={activePage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((pageNumber, index) =>
                pageNumber === "ellipsis" ? (
                  <span key={`page-ellipsis-mobile-${index}`} className="px-1 text-sm text-muted-foreground">
                    ···
                  </span>
                ) : (
                  <Button
                    key={`page-button-mobile-${pageNumber}`}
                    type="button"
                    variant={activePage + 1 === pageNumber ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8 text-sm"
                    onClick={() => goToPage(pageNumber - 1)}
                    aria-label={`Go to page ${pageNumber}`}
                    aria-current={activePage + 1 === pageNumber ? "page" : undefined}
                  >
                    {pageNumber}
                  </Button>
                )
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => goToPage(activePage + 1)}
              disabled={activePage === totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] opacity-0" aria-hidden>
        <div
          className="flex flex-col rounded-md border border-zinc-300 bg-white text-black ring-1 ring-black/5"
          style={{ width: `${A4_PAGE_WIDTH}px`, height: `${A4_PAGE_HEIGHT}px` }}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-10 py-6 text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
            <span>Club PDF preview</span>
            <span>{authorName}</span>
          </div>
          <div
            ref={measureContentRef}
            className={`min-h-0 flex-1 overflow-hidden px-10 py-8 ${DOCUMENT_BODY_CLASS_NAME}`}
            style={{ fontFamily: DOCUMENT_FONT_FAMILY }}
          />
          <div className="flex items-center justify-between border-t border-zinc-200 px-10 py-5 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
            <span>Bookworm Writer Clubs</span>
            <span>Page 1</span>
          </div>
        </div>
      </div>
    </>
  )
}
