'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useRef } from 'react'

interface NoteEditorProps {
  noteId: string
  content: string
  onChange: (markdown: string) => void
  autoFocus?: boolean
}

export default function NoteEditor({ noteId, content, onChange, autoFocus }: NoteEditorProps) {
  const isInternalUpdate = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((editor.storage as any).markdown.getMarkdown())
    },
    editorProps: {
      attributes: {
        class: 'note-editor-content',
        spellCheck: 'false',
      },
    },
  })

  // 다른 노트 선택 시 에디터 내용 교체
  useEffect(() => {
    if (!editor) return
    isInternalUpdate.current = false
    editor.commands.setContent(content)
    if (autoFocus) {
      setTimeout(() => editor.commands.focus('end'), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  return (
    <EditorContent
      editor={editor}
      style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
    />
  )
}
