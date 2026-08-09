/** Redimensionne une image pour le logo société (JPEG compact, stocké dans org_data). */
export function fileToCompanyLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choisissez un fichier image (PNG, JPG, WebP…).'))
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      reject(new Error('Image trop lourde (max 4 Mo).'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'))
    reader.onload = () => {
      const src = String(reader.result || '')
      const img = new Image()
      img.onerror = () => reject(new Error('Image illisible.'))
      img.onload = () => {
        const maxW = 240
        const maxH = 96
        let w = img.width
        let h = img.height
        const ratio = Math.min(maxW / w, maxH / h, 1)
        w = Math.max(1, Math.round(w * ratio))
        h = Math.max(1, Math.round(h * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas indisponible.'))
          return
        }
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        // JPEG beaucoup plus léger que PNG → évite l’échec de sync cloud
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}
