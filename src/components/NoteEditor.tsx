'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Typography from '@tiptap/extension-typography'
import { useEffect } from 'react'

interface NoteEditorProps {
  noteId: string
  content: string
  onChange: (markdown: string) => void
  autoFocus?: boolean
}

export default function NoteEditor({ noteId, content, onChange, autoFocus }: NoteEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: false, keepAttributes: false },
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      // 체크박스 리스트: - [ ] / - [x]
      TaskList,
      TaskItem.configure({ nested: true }),
      // 링크: [text](url) 또는 자동 감지
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      // 하이라이트: ==text==
      Highlight.configure({ multicolor: false }),
      // 밑줄: underline 단축키 Ctrl+U
      Underline,
      // 스마트 타이포그래피: -- → —, ... → …, "" → ""
      Typography,
      // 플레이스홀더
      Placeholder.configure({
        placeholder: ({ editor }) =>
          editor.isEmpty
            ? '내용을 입력하세요...\n\n# 제목1  ## 제목2  ### 제목3\n- 리스트  - [ ] 체크박스\n**굵게**  *기울임*  ~~취소선~~  ==형광펜==  `코드`'
            : '',
        showOnlyWhenEditable: true,
      }),
    ],
    content,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
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
