import * as mammoth from 'mammoth'

const SHORT_TITLE_ICON_BASE_URL = `https://raw.githubusercontent.com/skymao2021/oss/master/uPic`
const SHORT_TITLE_MAX_LENGTH = 80

const CHINESE_NUMERAL_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

const BLOCK_TAG_NAMES = new Set([
  `p`,
  `h1`,
  `h2`,
  `h3`,
  `h4`,
  `h5`,
  `h6`,
  `blockquote`,
  `pre`,
  `ul`,
  `ol`,
  `table`,
  `hr`,
  `div`,
])

interface ShortTitleMatch {
  order?: number
  title: string
}

function replaceEditorContent(content: string) {
  const store = useStore()
  store.editor!.dispatch({
    changes: { from: 0, to: store.editor!.state.doc.length, insert: `` },
  })

  requestAnimationFrame(() => {
    store.editor!.dispatch({
      changes: { from: 0, to: store.editor!.state.doc.length, insert: content },
    })
  })
}

function normalizeInlineSpaces(text: string) {
  return text
    .replace(/\u00A0/g, ` `)
    .replace(/\u3000/g, ` `)
    .replace(/[ \t]{2,}/g, ` `)
}

function normalizeBlockText(text: string) {
  return normalizeInlineSpaces(text).replace(/\s+/g, ` `).trim()
}

function chineseNumeralToNumber(input: string) {
  if (input.length === 1) {
    return CHINESE_NUMERAL_MAP[input] ?? (input === `十` ? 10 : undefined)
  }

  if (input === `十`) {
    return 10
  }

  if (input.startsWith(`十`) && input.length === 2) {
    const ones = CHINESE_NUMERAL_MAP[input[1]]
    return ones == null ? undefined : 10 + ones
  }

  if (input.endsWith(`十`) && input.length === 2) {
    const tens = CHINESE_NUMERAL_MAP[input[0]]
    return tens == null ? undefined : tens * 10
  }

  if (input.length === 3 && input[1] === `十`) {
    const tens = CHINESE_NUMERAL_MAP[input[0]]
    const ones = CHINESE_NUMERAL_MAP[input[2]]
    if (tens == null || ones == null) {
      return undefined
    }

    return tens * 10 + ones
  }

  return undefined
}

function matchShortTitle(text: string): ShortTitleMatch | null {
  const normalized = normalizeBlockText(text)
  if (!normalized || normalized.length > SHORT_TITLE_MAX_LENGTH) {
    return null
  }

  const chineseMatch = normalized.match(/^([一二三四五六七八九十两]{1,3})[、.．]\s*(.+)$/u)
  if (chineseMatch) {
    const order = chineseNumeralToNumber(chineseMatch[1])
    const title = normalizeBlockText(chineseMatch[2])
    if (title) {
      return {
        order,
        title,
      }
    }
  }

  const namedTitleMatch = normalized.match(/^标题\s*([0-9]{1,2})\s*[:：]\s*(.+)$/u)
  if (namedTitleMatch) {
    return {
      order: Number(namedTitleMatch[1]),
      title: normalizeBlockText(namedTitleMatch[2]),
    }
  }

  const dotOrCommaNumberMatch = normalized.match(/^([0-9]{1,2})\s*[.．、]\s*(.+)$/u)
  if (dotOrCommaNumberMatch) {
    return {
      order: Number(dotOrCommaNumberMatch[1]),
      title: normalizeBlockText(dotOrCommaNumberMatch[2]),
    }
  }

  const blankSeparatedNumberMatch = normalized.match(/^([0-9]{1,2})\s+(.+)$/u)
  if (blankSeparatedNumberMatch) {
    return {
      order: Number(blankSeparatedNumberMatch[1]),
      title: normalizeBlockText(blankSeparatedNumberMatch[2]),
    }
  }

  return null
}

function createShortTitleElement(doc: Document, title: string, order: number) {
  const wrapper = doc.createElement(`div`)
  wrapper.setAttribute(`style`, `display: flex; flex-direction: column; text-align: left;`)

  const image = doc.createElement(`img`)
  image.setAttribute(`src`, `${SHORT_TITLE_ICON_BASE_URL}/${Math.max(1, order)}.png`)
  image.setAttribute(`width`, `60`)
  image.setAttribute(`height`, `60`)
  image.setAttribute(`style`, `display: block; margin-bottom: 0;`)

  const span = doc.createElement(`span`)
  span.setAttribute(`style`, `font-size: 20px; font-family: PingFangSC-light; font-weight: bold; color: rgb(0, 0, 0); letter-spacing: 0.2px; display: block; margin-top: 0;`)
  span.textContent = title

  wrapper.append(image, span)
  return wrapper
}

function removeWordPlaceholderAnchors(root: HTMLElement) {
  const placeholderAnchors = root.querySelectorAll(`a[id^='OLE_LINK']`)
  placeholderAnchors.forEach((anchor) => {
    const hasHref = !!anchor.getAttribute(`href`)
    const hasText = !!normalizeBlockText(anchor.textContent ?? ``)
    if (!hasHref && !hasText) {
      anchor.remove()
    }
  })
}

function normalizeTextNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let currentTextNode = walker.nextNode() as Text | null
  while (currentTextNode) {
    currentTextNode.textContent = normalizeInlineSpaces(currentTextNode.textContent ?? ``)
    currentTextNode = walker.nextNode() as Text | null
  }
}

function serializeBlockElement(element: Element, fallbackOrderRef: { value: number }) {
  const tagName = element.tagName.toLowerCase()
  const normalizedText = normalizeBlockText(element.textContent ?? ``)

  if (!normalizedText && tagName !== `hr`) {
    return ``
  }

  const shortTitle = matchShortTitle(normalizedText)
  if (shortTitle?.title) {
    const order = shortTitle.order && shortTitle.order > 0 ? shortTitle.order : fallbackOrderRef.value
    fallbackOrderRef.value = Math.max(fallbackOrderRef.value + 1, order + 1)
    return createShortTitleElement(element.ownerDocument, shortTitle.title, order).outerHTML
  }

  if (tagName === `p`) {
    return element.innerHTML.trim()
  }

  if (/^h[1-6]$/.test(tagName)) {
    return `<${tagName}>${element.innerHTML.trim()}</${tagName}>`
  }

  return element.outerHTML.trim()
}

function normalizeWordHtml(html: string) {
  const parser = new DOMParser()
  const document = parser.parseFromString(html, `text/html`)
  const root = document.body

  removeWordPlaceholderAnchors(root)
  normalizeTextNodes(root)

  const fallbackOrderRef = { value: 1 }
  const parts: string[] = []

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeBlockText(node.textContent ?? ``)
      if (text) {
        parts.push(text)
      }
      continue
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue
    }

    const element = node as Element
    const tagName = element.tagName.toLowerCase()

    if (BLOCK_TAG_NAMES.has(tagName)) {
      const block = serializeBlockElement(element, fallbackOrderRef)
      if (block) {
        parts.push(block)
      }
      continue
    }

    const inlineHtml = element.outerHTML.trim()
    if (inlineHtml) {
      parts.push(inlineHtml)
    }
  }

  return parts
    .join(`\n\n`)
    .replace(/<\/strong>\s*<strong>/g, ``)
    .replace(/\n{3,}/g, `\n\n`)
    .trim()
}

export function useImportMarkdownContent() {
  const { open, reset, onChange } = useFileDialog({
    accept: `.md`,
  })

  onChange((files) => {
    if (files == null || files.length === 0) {
      return
    }

    const file = files[0]
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onload = (event) => {
      replaceEditorContent(event.target!.result as string)
      toast.success(`文档导入成功`)
    }
  })

  return () => {
    reset()
    open()
  }
}

export function useImportWordContent() {
  const { open, reset, onChange } = useFileDialog({
    accept: `.doc,.docx`,
  })

  onChange((files) => {
    if (files == null || files.length === 0) {
      return
    }

    const file = files[0]
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)

    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result
        if (!(arrayBuffer instanceof ArrayBuffer)) {
          toast.error(`Word 文档读取失败`)
          return
        }

        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            styleMap: [
              `b => strong`,
              `p[style-name='Heading 1'] => h1:fresh`,
              `p[style-name='Heading 2'] => h2:fresh`,
              `p[style-name='Heading 3'] => h3:fresh`,
            ],
          },
        )

        const content = normalizeWordHtml(result.value)
        replaceEditorContent(content)

        toast.success(`Word 文档导入成功`)
      }
      catch (error) {
        console.error(error)
        toast.error(`Word 文档导入失败，请优先使用 .docx 格式`)
      }
    }
  })

  return () => {
    reset()
    open()
  }
}
