declare module 'colorthief' {
  export default class ColorThief {
    /**
     * Get the dominant color from an image
     * @param img - Image element
     * @param quality - Quality (1 is highest, 10 is default)
     * @returns RGB tuple [r, g, b]
     */
    getColor(img: HTMLImageElement, quality?: number): [number, number, number];

    /**
     * Get a color palette from an image
     * @param img - Image element
     * @param colorCount - Number of colors to return (2-10)
     * @param quality - Quality (1 is highest, 10 is default)
     * @returns Array of RGB tuples
     */
    getPalette(
      img: HTMLImageElement,
      colorCount?: number,
      quality?: number
    ): [number, number, number][];
  }
}
