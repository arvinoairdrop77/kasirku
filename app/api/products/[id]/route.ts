import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  deleteProductImage,
  ProductImageError,
  readProductRequest,
  saveProductImage,
} from "@/lib/product-image";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  let uploadedImage: string | null = null;

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { body, image, removeImage } = await readProductRequest(req);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Data produk tidak valid" }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const data: {
      name?: string;
      price?: number;
      stock?: number;
      category?: string | null;
      isActive?: boolean;
      image?: string | null;
    } = {};

    if ("name" in input) {
      if (typeof input.name !== "string" || !input.name.trim()) {
        return NextResponse.json({ error: "Nama produk tidak valid" }, { status: 400 });
      }
      data.name = input.name.trim();
    }
    if ("price" in input) {
      const price = Number(input.price);
      if (!Number.isSafeInteger(price) || price <= 0) {
        return NextResponse.json({ error: "Harga produk tidak valid" }, { status: 400 });
      }
      data.price = price;
    }
    if ("stock" in input) {
      const stock = Number(input.stock);
      if (!Number.isSafeInteger(stock) || stock < 0) {
        return NextResponse.json({ error: "Stok produk tidak valid" }, { status: 400 });
      }
      data.stock = stock;
    }
    if ("category" in input) {
      if (input.category !== null && typeof input.category !== "string") {
        return NextResponse.json({ error: "Kategori produk tidak valid" }, { status: 400 });
      }
      data.category =
        typeof input.category === "string" && input.category.trim()
          ? input.category.trim()
          : null;
    }
    if ("isActive" in input) {
      if (typeof input.isActive !== "boolean") {
        return NextResponse.json({ error: "Status produk tidak valid" }, { status: 400 });
      }
      data.isActive = input.isActive;
    }
    const imageChanged = image !== null || removeImage;
    const existingProduct = imageChanged
      ? await prisma.product.findUnique({
          where: { id },
          select: { image: true },
        })
      : null;
    if (imageChanged && !existingProduct) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    if (image) {
      uploadedImage = await saveProductImage(image);
      data.image = uploadedImage;
    } else if (removeImage) {
      data.image = null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan produk" }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    const oldImage = existingProduct?.image;
    uploadedImage = null;
    if (imageChanged && oldImage && oldImage !== product.image) {
      try {
        await deleteProductImage(oldImage);
      } catch (cleanupError) {
        console.error("Failed to remove previous product image", cleanupError);
      }
    }

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
    console.error("PATCH /api/products/[id] failed", error);
    return NextResponse.json({ error: "Gagal memperbarui produk" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json(product);
  } catch (error) {
    console.error("DELETE /api/products/[id] failed", error);
    return NextResponse.json({ error: "Gagal menonaktifkan produk" }, { status: 500 });
  }
}