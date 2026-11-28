import { useEffect, useRef } from "react"
import styles from "./catalog.module.css"

type RichTextEditorProps = {
  value: string
  onChange: (html: string, text: string) => void
  label: string
  placeholder?: string
  disabled?: boolean
}

export function RichTextEditor({
  value,
  onChange,
  label,
  placeholder = "Write something…",
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastEmittedRef = useRef<string | null>(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || (lastEmittedRef.current !== null && value === lastEmittedRef.current)) return
    editor.innerHTML = value
    lastEmittedRef.current = value
  }, [value])

  function emitChange() {
    const editor = editorRef.current
    if (!editor) return
    const text = editor.textContent?.replace(/\u00a0/g, " ").trim() ?? ""
    const html = text ? editor.innerHTML : ""
    lastEmittedRef.current = html
    onChange(html, text)
  }

  function runCommand(command: string, argument?: string) {
    if (disabled) return
    editorRef.current?.focus()
    document.execCommand(command, false, argument)
    emitChange()
  }

  function toolbarButton(labelText: string, command: string, argument?: string) {
    return <button
      type="button"
      aria-label={labelText}
      title={labelText}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault()
        runCommand(command, argument)
      }}
    >{labelText}</button>
  }

  return <div className={styles.richEditor} aria-disabled={disabled}>
    <div className={styles.richToolbar} role="toolbar" aria-label={`${label} formatting`}>
      {toolbarButton("Bold", "bold")}
      {toolbarButton("Italic", "italic")}
      {toolbarButton("Underline", "underline")}
      {toolbarButton("Bullets", "insertUnorderedList")}
      {toolbarButton("Numbered list", "insertOrderedList")}
      {toolbarButton("Quote", "formatBlock", "blockquote")}
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(event) => {
          event.preventDefault()
          if (disabled) return
          const href = window.prompt("Link URL")?.trim()
          if (href) runCommand("createLink", href)
        }}
      >Link</button>
      {toolbarButton("Clear formatting", "removeFormat")}
    </div>
    <div
      ref={editorRef}
      className={styles.richSurface}
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      data-placeholder={placeholder}
      onInput={emitChange}
      onBlur={emitChange}
    />
  </div>
}
