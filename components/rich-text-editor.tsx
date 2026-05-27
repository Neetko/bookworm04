"use client"

import { useEffect } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Unlink } from "lucide-react"

type RichTextEditorProps = {
  value: string
  onChange: (html: string, text: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  editorClassName?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  disabled = false,
  className,
  editorClassName,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none min-h-[160px] cursor-text focus:outline-none",
          editorClassName
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const text = editor.getText()
      onChange(html, text)
    },
  })

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) return null

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Enter URL", previousUrl ?? "")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().setLink({ href: url }).run()
  }

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <div className="flex flex-wrap gap-2 border-b p-2">
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("bold") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("italic") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("bulletList") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("orderedList") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("link") ? "default" : "outline"}
          onClick={setLink}
          disabled={disabled}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={disabled}
        >
          <Unlink className="h-4 w-4" />
        </Button>
      </div>
      <div
        className="p-3"
        onClick={() => {
          if (!disabled) {
            editor.chain().focus().run()
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
