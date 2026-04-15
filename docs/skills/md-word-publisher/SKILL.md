---
name: md-word-publisher
description: Build and maintain a stable Word-to-doocs/md publishing workflow with clean import output, short-title icon rendering, article CSS style, image-bed setup, and OrbStack local deployment. Use this skill whenever the user mentions doocs/md, Word import, Word排版, 微信排版, 图床配置, 本地镜像, OrbStack, or wants repeatable publishing setup.
---

# md-word-publisher

Use this skill to standardize the full workflow from Word file to publish-ready doocs/md content, with a strong focus on WeChat paste stability.

## When to use
- User wants Word import quality fixes in doocs/md.
- User asks to keep a consistent article style (CSS template).
- User needs image-bed setup or migration checklist.
- User asks to build/run local image in OrbStack.
- User asks to package these actions into a repeatable process.

## What this skill should deliver
1. Word import behavior that removes Word noise and keeps `<strong>` emphasis.
2. Short-title recognition and icon+title block rendering.
3. Stable CSS template for article layout.
4. Stable image upload output (image visible in editor and after WeChat paste).
5. Local OrbStack deployment commands and scripts.

## Workflow

### Step 1: Confirm workspace
1. Prefer project path `/Users/moweijia/Documents/md-2.1.0` when available.
2. If a different repo is used, locate equivalent files before editing.

### Step 2: Word import normalization
Primary file: `apps/web/src/composables/index.ts`

1. Ensure `.doc/.docx` import path exists.
2. Ensure Word conversion keeps bold as `<strong>`.
3. Remove Word placeholder anchors (`a[id^='OLE_LINK']`) if empty.
4. Strip malformed/escaped section-style noise (for example broken `<section ... pingfangsc ...>` text at article top).
5. Normalize spaces (`NBSP`, full-width spaces, duplicate spaces).
6. Convert image paragraphs to centered image HTML that is stable in WeChat:
   - image paragraph margin bottom `8px`
   - image block no extra top/bottom blank line
7. Convert figure captions (`图源/图注/来源/数据来源`) to centered caption with paragraph bottom `8px`.
8. Upload embedded Word images before final import, and retry each image upload on transient failure.
9. If any embedded image still remains as `data:` after upload attempts, abort the whole import instead of inserting mixed content into the editor.

### Step 3: Short-title icon blocks
Primary file: `apps/web/src/composables/index.ts`

Recognize and convert these title patterns:
- `一、标题`
- `二、标题`
- `标题1: 标题`
- `标题2：标题`
- `01. 标题`
- `02、标题`
- `01 标题`

Render short-title as block layout (not flex) to avoid WeChat paste misalignment:
- wrapper: `display: block; text-align: left; clear: both;`
- icon: fixed `60x60` with strong inline constraints (`!important`) and `object-fit: contain`
- title span: `display:block`, no top margin

### Step 4: Style template
1. Use `references/current-theme.css` as baseline article style.
2. Apply in doocs/md right-side CSS panel.
3. Keep this style stable unless user explicitly asks for redesign.

### Step 5: Image-bed configuration
1. Follow `references/image-bed-setup.md`.
2. Validate by uploading at least one image from editor.
3. Confirm generated URL protocol is valid (no `https://https://...`).
4. Save project config via `文件 -> 导入/导出项目配置`.

### Step 6: OrbStack local deployment
1. Use `references/orbstack-runbook.md`.
2. Preferred one-command deployment:
   - `./scripts/orbstack-local.sh`
3. Confirm URL opens and is reachable.

### Step 7: Regression checklist (must run)
After a Word import, verify all items:
1. No style code garbage at article top (no `<section ... pingfangsc ...>` text).
2. All images visible in editor.
3. Image and caption spacing is stable (paragraph bottom `8px`).
4. Short-title icon remains `60x60`, and aligns with subtitle after WeChat paste.
5. No extra `/md` suffix required for local URL when current `vite base` is `/`.
6. Word import never leaves mixed image sources in one article: either all embedded images become remote URLs, or the import is blocked with an error.

## File references in this skill
- CSS template: `references/current-theme.css`
- Image-bed checklist: `references/image-bed-setup.md`
- OrbStack runbook: `references/orbstack-runbook.md`

## Output format
When executing this skill, report results in this order:
1. `Implemented` - what was changed.
2. `Run commands` - exact commands executed.
3. `Access URL` - local service URL if deployed.
4. `Changed files` - exact paths touched.
5. `Next optional steps` - only if useful.
