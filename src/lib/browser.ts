import html2canvas from 'html2canvas-pro'

export async function saveCardAsImage(el: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(el, {
    scale: Math.min(window.devicePixelRatio || 1, 3),
    backgroundColor: '#1b2838',
  })
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  )
  if (!blob) throw new Error('canvas export failed')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}
