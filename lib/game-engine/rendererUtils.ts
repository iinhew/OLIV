export class RendererUtils {
  // Cache para armazenar plataformas pré-renderizadas
  private static pixelGridCache: Map<string, HTMLCanvasElement> = new Map();

  /**
   * Pré-renderiza a string de pixels em um canvas invisível (Off-screen Rendering).
   * Isso economiza milhares de chamadas fillRect() na thread principal durante o Game Loop.
   */
  public static getOrRenderPixelGrid(
    pixelDataStr: string, 
    cols: number, 
    rows: number, 
    baseColor: string, 
    isTransparentBg: boolean, 
    width: number, 
    height: number
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;

    const cacheKey = `${pixelDataStr}_${baseColor}_${isTransparentBg}_${width}_${height}`;
    
    if (this.pixelGridCache.has(cacheKey)) {
      return this.pixelGridCache.get(cacheKey)!;
    }

    let parsedData: any[] = [];
    try {
      parsedData = JSON.parse(pixelDataStr);
    } catch {
      return null;
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
        if (parsedData[index] && parsedData[index] !== '') {
          offCtx.fillStyle = parsedData[index];
          offCtx.fillRect(c * pSize, r * pSize, pSize, pSize);
        }
      }
    }

    this.pixelGridCache.set(cacheKey, offCanvas);
    return offCanvas;
  }
}
