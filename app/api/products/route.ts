import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  deleteProductImage,
  ProductImageError,
  readProductRequest,
  saveProductImage,
} from "@/lib/product-image";

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "true";
    const products = await prisma.product.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/products failed", error);
    return NextResponse.json({ error: "Gagal ambil produk" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let uploadedImage: string | null = null;

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { body, image } = await readProductRequest(req);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Data produk tidak valid" }, { status: 400 });
    }

    const { name, price, stock, category } = body as Record<string, unknown>;
    const parsedPrice = Number(price);
    const parsedStock = Number(stock);

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !Number.isSafeInteger(parsedPrice) ||
      parsedPrice <= 0 ||
      !Number.isSafeInteger(parsedStock) ||
      parsedStock < 0 ||
      (category !== undefined && category !== null && typeof category !== "string")
    ) {
      return NextResponse.json({ error: "Data produk tidak valid" }, { status: 400 });
    }

    uploadedImage = await saveProductImage(image);
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        price: parsedPrice,
        stock: parsedStock,
        category: typeof category === "string" && category.trim() ? category.trim() : null,
        image: uploadedImage,
      },
    });
    uploadedImage = null;
    return NextResponse.json(product);
  } catch (error) {
    if (uploadedImage) {
      try {
        await deleteProductImage(uploadedImage);
      } catch (cleanupError) {
        console.error("Failed to remove unlinked product image", cleanupError);
      }
    }
    if (error instanceof ProductImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/products failed", error);
    return NextResponse.json({ error: "Gagal nambah produk" }, { status: 500 });
  }
}