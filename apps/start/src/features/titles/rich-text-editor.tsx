import { useEffect } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import LinkExtension from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Unlink } from "lucide-react"
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
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      LinkExtension.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: { attributes: { "aria-label": label } },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML(), currentEditor.getText())
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return
    editor.commands.setContent(value || "", { emitUpdate: false })
  }, [editor, value])

  if (!editor) return null

  function setLink() {
    if (!editor) return
    const previousUrl = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Enter URL", previousUrl ?? "")
    if (url === null) return
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().setLink({ href: url.trim() }).run()
  }

  return <div className={styles.richEditor} aria-disabled={disabled}>
    <div className={styles.richToolbar} role="toolbar" aria-label={`${label} formatting`}>
      <button type="button" data-active={editor.isActive("bold")} aria-label="Bold" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} disabled={disabled}><Bold size={16} /></button>
      <button type="button" data-active={editor.isActive("italic")} aria-label="Italic" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={disabled}><Italic size={16} /></button>
      <button type="button" data-active={editor.isActive("bulletList")} aria-label="Bulleted list" title="Bulleted list" onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={disabled}><List size={16} /></button>
      <button type="button" data-active={editor.isActive("orderedList")} aria-label="Numbered list" title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={disabled}><ListOrdered size={16} /></button>
      <button type="button" data-active={editor.isActive("link")} aria-label="Add link" title="Add link" onClick={setLink} disabled={disabled}><LinkIcon size={16} /></button>
      <button type="button" aria-label="Remove link" title="Remove link" onClick={() => editor.chain().focus().unsetLink().run()} disabled={disabled}><Unlink size={16} /></button>
    </div>
    <div className={styles.richSurface} onClick={() => { if (!disabled) editor.chain().focus().run() }}>
      <EditorContent editor={editor} />
    </div>
  </div>
}
