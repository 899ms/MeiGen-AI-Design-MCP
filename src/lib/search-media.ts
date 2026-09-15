/** Pick the hit image without reordering the original media/reference bank. */
export function searchPreviewUrl(item: {
  thumbnail_url?: string | null
  media_urls?: readonly string[] | null
  matched_media_index?: number | null
}): string | null {
  const index = item.matched_media_index
  if (typeof index === "number" && Number.isInteger(index) && index >= 0) {
    const matched = item.media_urls?.[index]
    if (typeof matched === "string" && matched.trim()) return matched
  }
  return item.thumbnail_url || item.media_urls?.[0] || null
}
