import * as mammoth from 'mammoth'
import { toBase64 } from '@/utils'
import { fileUpload } from '@/utils/file'

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

function stripWordStyleFragments(input: string) {
  let output = input
  const markers = [`<section`, `&lt;section`]
  const styleKeywordPattern = /(pingfangsc|word-break|word-wrap|letter-spacing|font-size|line-height|overflow-x|text-align|font-family|rgb\(|margin-|padding)/i
  const cjkPattern = /[\u3400-\u9fff]/u

  markers.forEach((marker) => {
    let lower = output.toLowerCase()
    let startIndex = lower.indexOf(marker)

    while (startIndex !== -1) {
      const endToken = marker === `&lt;section` ? `&gt;` : `>`
      const endIndex = lower.indexOf(endToken, startIndex)
      const sliceEnd = endIndex >= 0 ? endIndex + endToken.length : Math.min(output.length, startIndex + 1200)
      const fragment = output.slice(startIndex, sliceEnd)
      const shouldStrip = styleKeywordPattern.test(fragment) && !cjkPattern.test(fragment)

      if (shouldStrip) {
        output = `${output.slice(0, startIndex)}${output.slice(sliceEnd)}`
        lower = output.toLowerCase()
        startIndex = lower.indexOf(marker, startIndex)
      }
      else {
        startIndex = lower.indexOf(marker, startIndex + marker.length)
      }
    }
  })

  return output
}

function getFileExtensionFromMime(mime: string) {
  if (mime.includes(`png`))
    return `png`
  if (mime.includes(`jpeg`) || mime.includes(`jpg`))
    return `jpg`
  if (mime.includes(`gif`))
    return `gif`
  if (mime.includes(`webp`))
    return `webp`
  if (mime.includes(`bmp`))
    return `bmp`
  if (mime.includes(`svg`))
    return `svg`
  return `png`
}

function dataUrlToFile(dataUrl: string, fallbackName: string): File | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    return null
  }

  const mimeType = match[1]
  const base64 = match[2]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const ext = getFileExtensionFromMime(mimeType)
  return new File([bytes], `${fallbackName}.${ext}`, { type: mimeType })
}

function normalizeImageUrl(url: string) {
  const normalized = url.trim()
  if (!normalized) {
    return normalized
  }
  if (normalized.startsWith(`data:`) || normalized.startsWith(`blob:`)) {
    return normalized
  }
  if (normalized.startsWith(`//`)) {
    return `https:${normalized}`
  }
  if (!/^[a-z][a-z\d+\-.]*:\/\//i.test(normalized)) {
    return `https://${normalized}`
  }
  return normalized
}

async function uploadWordImages(html: string): Promise<{
  html: string
  uploadedCount: number
  failedCount: number
}> {
  const parser = new DOMParser()
  const document = parser.parseFromString(html, `text/html`)
  const images = Array.from(document.body.querySelectorAll(`img`))
  if (images.length === 0) {
    return { html, uploadedCount: 0, failedCount: 0 }
  }

  let uploadedCount = 0
  let failedCount = 0

  for (let index = 0; index < images.length; index++) {
    const image = images[index]
    const src = image.getAttribute(`src`)?.trim() || ``
    if (!src.startsWith(`data:`)) {
      continue
    }

    const imageFile = dataUrlToFile(src, `word-import-${Date.now()}-${index + 1}`)
    if (!imageFile) {
      continue
    }

    try {
      const base64Content = await toBase64(imageFile)
      const url = await fileUpload(base64Content, imageFile)
      image.setAttribute(`src`, normalizeImageUrl(url))
      uploadedCount++
    }
    catch (error) {
      failedCount++
      console.error(`Word 图片上传失败`, error)
    }
  }

  return {
    html: document.body.innerHTML,
    uploadedCount,
    failedCount,
  }
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
  wrapper.setAttribute(`style`, `display: block; text-align: left; clear: both;`)

  const image = doc.createElement(`img`)
  image.setAttribute(`src`, `${SHORT_TITLE_ICON_BASE_URL}/${Math.max(1, order)}.png`)
  image.setAttribute(`width`, `60`)
  image.setAttribute(`height`, `60`)
  image.setAttribute(`style`, `display: block !important; width: 60px !important; height: 60px !important; max-width: 60px !important; min-width: 60px !important; max-height: 60px !important; min-height: 60px !important; object-fit: contain; margin: 0 0 4px 0;`)

  const span = doc.createElement(`span`)
  span.setAttribute(`style`, `display: block !important; margin: 0; font-size: 20px; font-family: PingFangSC-light; font-weight: bold; color: rgb(0, 0, 0); letter-spacing: 0.2px; line-height: 1.4;`)
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
    const normalizedText = normalizeInlineSpaces(currentTextNode.textContent ?? ``)
    currentTextNode.textContent = stripWordStyleFragments(normalizedText)
    currentTextNode = walker.nextNode() as Text | null
  }
}

function unwrapSectionElements(root: HTMLElement) {
  const sections = Array.from(root.querySelectorAll(`section`))
  sections.forEach((section) => {
    const parent = section.parentNode
    if (!parent) {
      return
    }

    while (section.firstChild) {
      parent.insertBefore(section.firstChild, section)
    }
    section.remove()
  })
}

function isWordStyleNoise(text: string, html: string = ``) {
  const normalizedText = normalizeBlockText(stripWordStyleFragments(text))
  if (!normalizedText) {
    return false
  }

  const lowerText = normalizedText.toLowerCase()
  const lowerHtml = stripWordStyleFragments(html).toLowerCase()

  const isSectionTagOnly = /^<\s*\/?\s*section\b[^>]*>$/i.test(normalizedText)
    || /^&lt;\s*\/?\s*section\b.*&gt;$/i.test(normalizedText)
  const looksLikeTagString = /^<[^>]+>$/.test(normalizedText) || /^&lt;[^>]+&gt;$/i.test(normalizedText)
  const startsWithSectionTag = /^(&lt;|<)\s*\/?\s*section\b/.test(lowerText)
  const hasStyleKeywords = /(pingfangsc|word-break|word-wrap|letter-spacing|font-size|line-height|overflow-x|text-align|font-family|rgb\(|margin-|padding)/.test(lowerText)
  const hasMalformedAttributes = (normalizedText.match(/=\"\"/g)?.length ?? 0) >= 2
  const hasSectionMarker = lowerText.includes(`<section`) || lowerText.includes(`&lt;section`)
  const hasCjkChars = /[\u3400-\u9fff]/u.test(normalizedText)
  const escapedSectionInHtml = lowerHtml.includes(`&lt;section`) || lowerHtml.includes(`&lt;/section`)
  const likelyBrokenSectionStyleText = hasSectionMarker && hasStyleKeywords && !hasCjkChars

  return isSectionTagOnly
    || (looksLikeTagString && hasStyleKeywords)
    || (startsWithSectionTag && (hasStyleKeywords || hasMalformedAttributes))
    || likelyBrokenSectionStyleText
    || escapedSectionInHtml
}

function hasMediaContent(element: Element) {
  return !!element.querySelector(`img,video,audio,svg,figure,iframe,table`)
}

function extractImageHtmlFromParagraph(element: Element) {
  const clone = element.cloneNode(true) as HTMLElement
  const doc = element.ownerDocument
  clone.querySelectorAll(`img`).forEach(img => img.replaceWith(doc.createTextNode(``)))
  const remainingText = normalizeBlockText(stripWordStyleFragments(clone.textContent ?? ``))
  if (remainingText) {
    return null
  }

  const imageSources = Array
    .from(element.querySelectorAll(`img`))
    .map(img => normalizeImageUrl(img.getAttribute(`src`) || ``))
    .filter(Boolean)

  if (imageSources.length === 0) {
    return null
  }

  return imageSources
    .map((src) => {
      return `<p style="margin: 0 0 8px; padding: 0; line-height: 0; text-align: center;"><img src="${src}" style="display: block; margin: 0 auto; padding: 0; border: 0; max-width: 100%; height: auto;"/></p>`
    })
    .join(`\n`)
}

function isImageCaptionText(text: string) {
  const normalized = normalizeBlockText(text)
  return /^(图注|图源|来源|数据来源)\s*[:：]/u.test(normalized)
}

function buildImageCaptionHtml(content: string) {
  const cleanedContent = content
    .replace(/^(\s|&nbsp;|<br\s*\/?>)+/gi, ``)
    .replace(/(\s|&nbsp;|<br\s*\/?>)+$/gi, ``)
    .trim()
  return `<p style="text-align: center; font-size: 14px; line-height: 1.6; color: rgba(0, 0, 0, 0.55); margin: 0 0 8px; padding: 0;">${cleanedContent}</p>`
}

function serializeBlockElement(element: Element, fallbackOrderRef: { value: number }) {
  const tagName = element.tagName.toLowerCase()
  const normalizedText = normalizeBlockText(stripWordStyleFragments(element.textContent ?? ``))
  const containsMedia = hasMediaContent(element)

  if (!normalizedText && !containsMedia && tagName !== `hr`) {
    return ``
  }

  const shortTitle = matchShortTitle(normalizedText)
  if (shortTitle?.title) {
    const order = shortTitle.order && shortTitle.order > 0 ? shortTitle.order : fallbackOrderRef.value
    fallbackOrderRef.value = Math.max(fallbackOrderRef.value + 1, order + 1)
    return createShortTitleElement(element.ownerDocument, shortTitle.title, order).outerHTML
  }

  if (tagName === `p`) {
    const innerHtml = stripWordStyleFragments(element.innerHTML).trim()
    if (!innerHtml || isWordStyleNoise(normalizedText, innerHtml)) {
      return ``
    }

    if (isImageCaptionText(normalizedText)) {
      return buildImageCaptionHtml(innerHtml)
    }

    const imageHtml = extractImageHtmlFromParagraph(element)
    if (imageHtml) {
      return imageHtml
    }

    return innerHtml
  }

  if (/^h[1-6]$/.test(tagName)) {
    return `<${tagName}>${element.innerHTML.trim()}</${tagName}>`
  }

  return element.outerHTML.trim()
}

function normalizeWordHtml(html: string) {
  const parser = new DOMParser()
  const sanitizedHtml = stripWordStyleFragments(html)
  const document = parser.parseFromString(sanitizedHtml, `text/html`)
  const root = document.body

  unwrapSectionElements(root)
  removeWordPlaceholderAnchors(root)
  normalizeTextNodes(root)

  const fallbackOrderRef = { value: 1 }
  const parts: string[] = []

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeBlockText(stripWordStyleFragments(node.textContent ?? ``))
      if (text && !isWordStyleNoise(text, text)) {
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

    const inlineHtml = stripWordStyleFragments(element.outerHTML).trim()
    if (inlineHtml && !isWordStyleNoise(stripWordStyleFragments(element.textContent ?? ``), inlineHtml)) {
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
            convertImage: mammoth.images.imgElement(async (image) => {
              const base64 = await image.read(`base64`)
              return {
                src: `data:${image.contentType};base64,${base64}`,
              }
            }),
          },
        )

        const uploadResult = await uploadWordImages(result.value)
        const content = normalizeWordHtml(uploadResult.html)
        replaceEditorContent(content)

        if (uploadResult.failedCount > 0) {
          toast.warning(`Word 图片上传：成功 ${uploadResult.uploadedCount} 张，失败 ${uploadResult.failedCount} 张，请检查图床配置`)
        }
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
