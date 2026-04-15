# Image Bed Setup Checklist

Use this checklist when configuring image hosting in doocs/md.

## Recommended provider strategy
- If your network can access jsDelivr steadily, GitHub default flow can return CDN URLs:
  - `https://fastly.jsdelivr.net/gh/<user>/<repo>@<branch>/<path>`
- If CDN is unstable in your environment, use any direct public host that renders correctly in doocs/md + WeChat paste.
- Priority is render stability, not provider preference.

## Required checks (must pass)
1. Open `右侧设置 -> 图床配置`.
2. Pick one provider and fill required keys.
3. Upload one test image from editor.
4. Confirm generated URL is valid protocol and host:
   - Correct: `https://xxx...`
   - Wrong: `https://https://xxx...`
5. Import a Word file with images and verify images are visible in editor preview.
6. Verify the imported result contains no `data:` image sources. If any embedded image upload fails, the import should be blocked instead of leaving mixed sources.
7. Copy result into WeChat editor and verify image still renders.
8. Save project config via `文件 -> 导入/导出项目配置` for backup.

## GitHub notes
- GitHub upload uses repo API and can return `download_url`.
- Default flow may map raw GitHub URL to jsDelivr URL.
- If you switch provider or repo/branch, re-run one test import immediately.

## Troubleshooting quick list
- Images not shown in editor after Word import:
  1. Check 图床配置是否保存成功。
  2. Check URL produced by uploader is directly openable.
  3. Check URL is not malformed (`https://https://...`).
  4. If the import is blocked, treat it as expected protection against mixed `data:` + remote image sources and fix the upload path first.
- Images shown in editor but broken in WeChat:
  1. Check host accessibility in WeChat network.
  2. Change to a host that WeChat can access more reliably.

## Notes
- Keep one image bed per publication channel if possible.
- After changing image-bed settings, always run one full Word-import regression test.
