'use server'

import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"
import crypto from "crypto"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
})

export async function registerUser(formData: FormData) {
  try {
    const data = registerSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
      displayName: formData.get("displayName"),
    })

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })

    if (existingUser) {
      return { error: "Email này đã được sử dụng" }
    }

    // Pgcrypto/Bcrypt compatible hash
    const hashedPassword = await bcrypt.hash(data.password, 10)
    
    // UUID v4 cho Profile id
    const newId = crypto.randomUUID()

    await prisma.user.create({
      data: {
        id: newId,
        email: data.email.toLowerCase(),
        name: data.displayName,
        passwordHash: hashedPassword,
        profile: {
          create: {
            displayName: data.displayName,
          }
        }
      },
    })

    return { success: true }
  } catch (error) {
    console.error("REGISTER ERROR:", error)
    if (error instanceof z.ZodError) {
      return { error: "Dữ liệu không hợp lệ" }
    }
    return { error: "Đã xảy ra lỗi trên server" }
  }
}
