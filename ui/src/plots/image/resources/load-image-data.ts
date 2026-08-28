import { getCachedLoadedImageData, setCachedLoadedImageData } from "./cache.ts";

export async function loadImageData(url: string): Promise<ImageData | null> {
  const cached = getCachedLoadedImageData(url);
  if (cached) return cached;

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height);
        setCachedLoadedImageData(url, data);
        resolve(data);
      } catch (error) {
        console.warn("[cairn] loadImageData failed:", error);
        resolve(null);
      }
    };
    image.onerror = (error) => {
      console.warn("[cairn] loadImageData: image failed to load:", url, error);
      resolve(null);
    };
    image.src = url;
  });
}
