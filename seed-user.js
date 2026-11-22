async function main() {
  await import("dotenv/config");

  const username = process.env.SEED_USER_USERNAME?.trim();
  const password = process.env.SEED_USER_PASSWORD;
  const email = process.env.SEED_USER_EMAIL?.trim();
  const name = process.env.SEED_USER_NAME?.trim() || username;
  const role = process.env.SEED_USER_ROLE?.trim() || "kasir";
  const resetPassword = process.env.SEED_USER_RESET_PASSWORD === "true";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL belum diatur.");
  }

  if (!username || !password || (!resetPassword && !email)) {
    throw new Error(
      resetPassword
        ? "Atur SEED_USER_USERNAME dan SEED_USER_PASSWORD untuk reset password."
        : "Atur SEED_USER_USERNAME, SEED_USER_PASSWORD, dan SEED_USER_EMAIL sebelum menjalankan script.",
    );
  }

  if (!resetPassword && role !== "owner" && role !== "kasir") {
    throw new Error("SEED_USER_ROLE hanya boleh 'owner' atau 'kasir'.");
  }

  const [{ PrismaClient }, { PrismaPg }, bcrypt] = await Promise.all([
    import("./generated/prisma/client.ts"),
    import("@prisma/adapter-pg"),
    import("bcryptjs"),
  ]);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    if (resetPassword) {
      const existingUser = await prisma.user.findUnique({
        where: { username },
        select: { username: true },
      });

      if (!existingUser) {
        throw new Error(`User @${username} tidak ditemukan.`);
      }

      await prisma.user.update({
        where: { username },
        data: { password: passwordHash },
      });

      console.log(`Password user @${username} berhasil direset.`);
      return;
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true, email: true },
    });

    if (existingUser) {
      throw new Error(
        `Username atau email sudah digunakan (${existingUser.username}, ${existingUser.email}).`,
      );
    }

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: passwordHash,
        name,
        role,
      },
      select: { username: true, role: true },
    });

    console.log(`User @${newUser.username} berhasil dibuat dengan role ${newUser.role}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Gagal membuat user:", error.message);
  process.exitCode = 1;
});
