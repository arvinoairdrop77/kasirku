import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RequestedItem = {
  id: string;
  qty: number;
  price: number;
  options: string;
};

class OrderRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getJakartaStartOfDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: getJakartaStartOfDay(new Date()) },
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("GET /api/orders failed", error);
    return NextResponse.json({ error: "Gagal mengambil riwayat transaksi" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Format request tidak valid" }, { status: 400 });
    }

    if (!isRecord(body) || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Keranjang transaksi kosong atau tidak valid" }, { status: 400 });
    }

    const method = body.method;
    const discountType = body.discountType;
    const discountValue = body.discountValue;
    const includeTax = body.includeTax;
    const payAmount = body.payAmount;

    if (
      (method !== "cash" && method !== "qris" && method !== "card") ||
      (discountType !== "percent" && discountType !== "nominal") ||
      typeof discountValue !== "number" ||
      !Number.isFinite(discountValue) ||
      discountValue < 0 ||
      (discountType === "percent" && discountValue > 100) ||
      typeof includeTax !== "boolean" ||
      !Number.isSafeInteger(payAmount) ||
      Number(payAmount) < 0
    ) {
      return NextResponse.json({ error: "Rincian pembayaran tidak valid" }, { status: 400 });
    }

    const items: RequestedItem[] = [];
    for (const value of body.items) {
      if (!isRecord(value)) {
        return NextResponse.json({ error: "Item transaksi tidak valid" }, { status: 400 });
      }

      const { id, qty, price, options } = value;
      if (
        typeof id !== "string" ||
        !id.trim() ||
        !Number.isSafeInteger(qty) ||
        Number(qty) <= 0 ||
        !Number.isSafeInteger(price) ||
        Number(price) <= 0 ||
        (options !== undefined && typeof options !== "string")
      ) {
        return NextResponse.json({ error: "Item transaksi tidak valid" }, { status: 400 });
      }

      items.push({
        id,
        qty: Number(qty),
        price: Number(price),
        options: typeof options === "string" ? options : "",
      });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const productIds = [...new Set(items.map((item) => item.id))];
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, isActive: true },
        });
        const productsById = new Map(products.map((product) => [product.id, product]));

        if (products.length !== productIds.length) {
          throw new OrderRequestError("Produk tidak ditemukan atau sudah nonaktif", 409);
        }

        let subtotal = 0;
        const orderItems = items.map((item) => {
          const product = productsById.get(item.id);
          if (!product) {
            throw new OrderRequestError("Produk tidak ditemukan", 409);
          }

          const hasExtraEspresso = item.options.includes("Extra Espresso (+5k)");
          const hasOatMilk = item.options.includes("Oat Milk (+6k)");
          const surcharge = hasExtraEspresso ? 5000 : hasOatMilk ? 6000 : 0;

          if (
            (hasExtraEspresso && hasOatMilk) ||
            (surcharge > 0 && product.category === "Makanan Berat") ||
            item.price !== product.price + surcharge
          ) {
            throw new OrderRequestError(
              `Harga ${product.name} berubah atau opsi tidak valid. Muat ulang produk.`,
              409,
            );
          }

          subtotal += item.price * item.qty;
          return {
            id: item.id,
            qty: item.qty,
            price: item.price,
            name: product.name,
          };
        });

        if (!Number.isSafeInteger(subtotal)) {
          throw new OrderRequestError("Total transaksi tidak valid", 400);
        }

        const discountAmount =
          discountType === "percent"
            ? Math.round((subtotal * discountValue) / 100)
            : Math.min(Math.round(discountValue), subtotal);
        const afterDiscount = Math.max(subtotal - discountAmount, 0);
        const taxAmount = includeTax ? Math.round(afterDiscount * 0.11) : 0;
        const total = afterDiscount + taxAmount;
        const acceptedAmount = Number(payAmount);

        if (method === "cash" ? acceptedAmount < total : acceptedAmount !== total) {
          throw new OrderRequestError("Jumlah pembayaran tidak sesuai total transaksi", 400);
        }

        const quantitiesByProduct = new Map<string, number>();
        for (const item of items) {
          quantitiesByProduct.set(
            item.id,
            (quantitiesByProduct.get(item.id) ?? 0) + item.qty,
          );
        }

        for (const [id, qty] of quantitiesByProduct) {
          const product = productsById.get(id);
          if (!product) {
            throw new OrderRequestError("Produk tidak ditemukan", 409);
          }

          const update = await tx.product.updateMany({
            where: {
              id,
              isActive: true,
              price: product.price,
              stock: { gte: qty },
            },
            data: { stock: { decrement: qty } },
          });

          if (update.count !== 1) {
            throw new OrderRequestError(
              `Stok ${product.name} berubah atau tidak mencukupi`,
              409,
            );
          }
        }

        const order = await tx.order.create({
          data: {
            userId: user.id,
            total,
            payAmount: acceptedAmount,
            change: method === "cash" ? acceptedAmount - total : 0,
            method,
            items: {
              create: orderItems.map(({ id, qty, price, name }) => ({
                productId: id,
                name,
                price,
                qty,
              })),
            },
          },
          include: { items: true },
        });

        return { order, subtotal, discountAmount, taxAmount };
      });

      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      if (error instanceof OrderRequestError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  } catch (error) {
    console.error("POST /api/orders failed", error);
    return NextResponse.json({ error: "Gagal menyimpan transaksi" }, { status: 500 });
  }
}
