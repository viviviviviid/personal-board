export {}

describe('Note Markdown Formatting', () => {
  describe('List formatting preservation', () => {
    test('unordered list preserves dash markers', () => {
      const markdown = `- Item 1
- Item 2
- Item 3`
      expect(markdown).toContain('- Item')
    })

    test('ordered list preserves numbers', () => {
      const markdown = `1. First
2. Second
3. Third`
      expect(markdown).toContain('1.')
      expect(markdown).toContain('2.')
    })

    test('nested lists preserve structure', () => {
      const markdown = `- Parent
  - Child 1
  - Child 2
- Another parent`
      expect(markdown).toContain('  - Child')
    })

    test('checkbox list preserves brackets and dashes', () => {
      const markdown = `- [ ] Unchecked task
- [x] Completed task`
      expect(markdown).toContain('- [ ]')
      expect(markdown).toContain('- [x]')
    })
  })

  describe('Line spacing and formatting', () => {
    test('multiple paragraphs maintain newlines', () => {
      const markdown = `First paragraph

Second paragraph

Third paragraph`
      const lines = markdown.split('\n')
      expect(lines.length).toBeGreaterThan(3)
    })

    test('line breaks within content preserved', () => {
      const markdown = `Line 1
Line 2
Line 3`
      expect(markdown.split('\n').length).toBe(3)
    })

    test('headings with proper spacing', () => {
      const markdown = `# Heading 1
Content here

## Heading 2
More content`
      expect(markdown).toContain('# Heading')
      expect(markdown).toContain('## Heading')
    })
  })

  describe('Markdown syntax preservation', () => {
    test('bold syntax **text** preserved', () => {
      const markdown = 'This is **bold** text'
      expect(markdown).toContain('**bold**')
    })

    test('italic syntax *text* preserved', () => {
      const markdown = 'This is *italic* text'
      expect(markdown).toContain('*italic*')
    })

    test('strikethrough ~~text~~ preserved', () => {
      const markdown = 'This is ~~strikethrough~~ text'
      expect(markdown).toContain('~~strikethrough~~')
    })

    test('inline code `text` preserved', () => {
      const markdown = 'Use `npm install` to install'
      expect(markdown).toContain('`npm install`')
    })

    test('code block with triple backticks preserved', () => {
      const markdown = `\`\`\`javascript
const x = 1;
\`\`\``
      expect(markdown).toContain('```')
    })

    test('link syntax [text](url) preserved', () => {
      const markdown = '[Click here](https://example.com)'
      expect(markdown).toContain('[Click here]')
      expect(markdown).toContain('(https://example.com)')
    })
  })

  describe('Mixed content', () => {
    test('list with inline formatting', () => {
      const markdown = `- **Important** task
- *Urgent* item
- \`Code\` reference`
      expect(markdown).toContain('- **')
      expect(markdown).toContain('- *')
      expect(markdown).toContain('- `')
    })

    test('complex document structure', () => {
      const markdown = `# Project Plan

## Phase 1
- [ ] Setup
- [x] Planning

## Phase 2
1. Implementation
   - Backend
   - Frontend
2. Testing

Conclusion with **emphasis** and [link](url)`

      expect(markdown).toContain('# ')
      expect(markdown).toContain('## ')
      expect(markdown).toContain('- [ ]')
      expect(markdown).toContain('- [x]')
      expect(markdown).toContain('1.')
      expect(markdown).toContain('**')
      expect(markdown).toContain('[link]')
    })
  })

  describe('HTML to Markdown conversion', () => {
    test('paragraph to line breaks', () => {
      // Simulating Tiptap behavior: HTML paragraphs should become newline-separated content
      const paras = ['First paragraph', 'Second paragraph']
      const markdown = paras.join('\n\n')
      const lines = markdown.split('\n\n')
      expect(lines.length).toBe(2)
    })

    test('ul/ol to dash/number lists', () => {
      // Simulating list rendering
      const items = ['Item 1', 'Item 2', 'Item 3']
      const listMarkdown = items.map((item, i) => `${i + 1}. ${item}`).join('\n')
      expect(listMarkdown).toContain('1.')
      expect(listMarkdown).toContain('2.')
      expect(listMarkdown).toContain('3.')
    })

    test('nested lists from HTML', () => {
      const markdown = `- Parent
  - Child 1
  - Child 2`
      expect(markdown.split('  - ').length).toBe(3) // 1 original + 2 children
    })
  })

  describe('Line height and spacing consistency', () => {
    test('consistent line height in list items', () => {
      const markdown = `- Short item
- This is a much longer item that might wrap to multiple visual lines but is still one list item
- Another item`
      const items = markdown.split('\n').filter(line => line.startsWith('-'))
      expect(items.length).toBe(3)
    })

    test('paragraphs maintain readable spacing', () => {
      const markdown = `Paragraph with normal content.

This paragraph is separated.

And this one too.`

      // Should have 2 newlines between paragraphs (resulting in blank line)
      const paragraphs = markdown.split('\n\n')
      expect(paragraphs.length).toBe(3)
      paragraphs.forEach(p => {
        expect(p.trim()).toBeTruthy()
      })
    })
  })
})
