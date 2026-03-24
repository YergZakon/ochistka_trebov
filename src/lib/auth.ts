import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "npa-expert-secret-2026";

export interface UserPayload {
  id: number;
  username: string;
  role: "admin" | "expert";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: UserPayload): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<UserPayload | null> {
  const result = await query(
    "SELECT id, username, password_hash, role FROM users WHERE username = $1 AND is_active = true",
    [username]
  );
  if (result.rows.length === 0) return null;

  const user = result.rows[0];
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  // Log activity
  await query(
    "INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)",
    [user.id, "login", JSON.stringify({ ip: "server" })]
  );

  return { id: user.id, username: user.username, role: user.role };
}
