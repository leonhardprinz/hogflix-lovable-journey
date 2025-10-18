// src/lib/videoRouting.ts
export function isPostHogDemo(categoryName?: string | null): boolean {
  return (categoryName || '').trim().toLowerCase() === 'posthog demo'
}

export function videoHrefFor(categoryName: string | undefined | null, id: string) {
  return isPostHogDemo(categoryName) ? `/demos/${id}` : `/watch/${id}`
}
