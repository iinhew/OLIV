export class RendererUtils {
  // Cache para armazenar plataformas pré-renderizadas
  private static pixelGridCache: Map<string, HTMLCanvasElement> = new Map();

  /**
   * Pré-renderiza a string de pixels em um canvas invisível (Off-screen Rendering).
   * Isso economiza milhares de chamadas fillRect() na thread principal durante o Game Loop.
   */
  public static getOrRenderPixelGrid(
    pixelData: string[], 
    cols: number, 
    rows: number, 
    baseColor: string, 
    isTransparentBg: boolean, 
    width: number, 
    height: number
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;

    // Use a hash or just join the array to create a key. Since array can be large, maybe just a fast hash or simple join.
    // However, it's safer to just use a property from the brand if possible, but let's join it for safety
    const cacheKey = `${pixelData.join('')}_${baseColor}_${isTransparentBg}_${width}_${height}`;
    
    if (this.pixelGridCache.has(cacheKey)) {
      return this.pixelGridCache.get(cacheKey)!;
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d');
    
    if (!offCtx) return null;

    // Desativa suavização para manter o aspecto "pixel art" nítido
    offCtx.imageSmoothingEnabled = false;

    const pSize = height / rows; 

    if (!isTransparentBg) {
      offCtx.fillStyle = baseColor;
      offCtx.fillRect(0, 0, width, height);
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        if (pixelData[index] && pixelData[index] !== '') {
          offCtx.fillStyle = pixelData[index];
          offCtx.fillRect(c * pSize, r * pSize, pSize, pSize);
        }
      }
    }

    this.pixelGridCache.set(cacheKey, offCanvas);
    return offCanvas;
  }
}
