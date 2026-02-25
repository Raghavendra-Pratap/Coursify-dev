/**
 * Stub for root type-check only. Real impl in coursify-app/lib/video-utils.ts.
 */
export async function getVideoUrl(
  _videoUrl: string,
  _storageType: 'google_drive' | 'supabase' | 'external_url'
): Promise<string> {
  throw new Error('video-utils is only available in coursify-app')
}

export async function stitchVideoSegments(_segments: Array<{ videoUrl: string }>): Promise<string> {
  throw new Error('video-utils is only available in coursify-app')
}
