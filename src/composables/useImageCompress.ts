export const MAX_WIDTH = 1280
export const JPEG_QUALITY = 0.85

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = bitmap.width > MAX_WIDTH ? MAX_WIDTH / bitmap.width : 1
  const targetW = Math.round(bitmap.width * scale)
  const targetH = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas') as HTMLCanvasElement
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
