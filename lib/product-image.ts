import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const PRODUCT_IMAGE_PREFIX = "/uploads/products/";
const PRODUCT_IMAGE_DIRECTORY = path.join(process.cwd(), "public", "uploads", "products");
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class ProductImageError extends Error {}

export async function readProductRequest(request: Request): Promise<{
  body: unknown;
  image: File | null;
  removeImage: boolean;
}> {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return { body: await request.json(), image: null, removeImage: false };
  }

  const formData = await request.formData();
  const body: Record<string, string> = {};
  let image: File | null = null;

  for (const [key, value] of formData.entries()) {
    if (key === "image") {
      if (typeof value === "string") {
        if (value) throw new ProductImageError("File gambar tidak valid");
      } else {
        image = value;
      }
    } else if (key !== "removeImage") {
      if (typeof value !== "string") {
        throw new ProductImageError("Data produk tidak valid");
      }
      body[key] = value;
    }
  }

  return {
    body,
    image,
    removeImage: formData.get("removeImage") === "true",
  };
}

export async function saveProductImage(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
    throw new ProductImageError("Ukuran gambar maksimal 5 MB");
  }

  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    throw new ProductImageError("Format gambar harus JPG, PNG, atau WEBP");
  }

  const image = Buffer.from(await file.arrayBuffer());
  const isValidImage =
    (file.type === "image/jpeg" &&
      image.length >= 3 &&
      image[0] === 0xff &&
      image[1] === 0xd8 &&
      image[2] === 0xff) ||
    (file.type === "image/png" &&
      image.length >= 8 &&
      image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (file.type === "image/webp" &&
      image.length >= 12 &&
      image.toString("ascii", 0, 4) === "RIFF" &&
      image.toString("ascii", 8, 12) === "WEBP");

  if (!isValidImage) {
    throw new ProductImageError("Isi file bukan gambar yang valid");
  }

  await mkdir(PRODUCT_IMAGE_DIRECTORY, { recursive: true });
  const fileName = `${randomUUID()}.${extension}`;
  await writeFile(path.join(PRODUCT_IMAGE_DIRECTORY, fileName), image, { flag: "wx" });
  return `${PRODUCT_IMAGE_PREFIX}${fileName}`;
}

export async function deleteProductImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl?.startsWith(PRODUCT_IMAGE_PREFIX)) return;

  const fileName = imageUrl.slice(PRODUCT_IMAGE_PREFIX.length);
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(fileName)) return;

  try {
    await unlink(path.join(PRODUCT_IMAGE_DIRECTORY, fileName));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}
