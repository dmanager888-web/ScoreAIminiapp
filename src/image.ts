export type ImagePayload = {
  base64: string;
  mime: string;
};

export async function fileToPayload(file: File): Promise<ImagePayload> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie uma imagem (print do jogo).");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Imagem grande demais. Use um print menor.");
  }

  const bitmap = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível ler a imagem.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Não foi possível ler a imagem.");
  }
  return { base64, mime: "image/jpeg" };
}
