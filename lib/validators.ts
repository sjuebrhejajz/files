import { z } from "zod"
import { containsBannedTerm } from "@/lib/username-filter"

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.")

export const usernameSchema = z
  .string()
  .trim()
  .min(5, "Username must be over 4 characters.")
  .max(20, "Username must be at most 20 characters.")
  .regex(/^[a-zA-Z0-9]+$/, "Username can only contain letters and numbers, no special characters.")
  .refine((val) => !containsBannedTerm(val), "That username isn't allowed.")

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[a-z]/, "Password needs a lowercase letter.")
  .regex(/[A-Z]/, "Password needs an uppercase letter.")
  .regex(/[0-9]/, "Password needs a number.")

export const codeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code.")

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter phone number in E.164 format, e.g. +14155552671.")

// Rough-and-ready link detector: catches "http(s)://", "www.", and bare
// "word.tld" patterns. Not bulletproof (nothing regex-based ever is), but it
// stops the common cases without needing a full link-parsing library.
const LINK_PATTERN =
  /(https?:\/\/|www\.)|(\b[a-z0-9-]+\.(com|net|org|io|co|uk|gg|me|dev|app|xyz|info|biz|tv|link|us|ca|de|fr|ru|top|shop|club|store|online|live|tk|ml|cc|gov|edu)\b)/i

export const bioSchema = z
  .string()
  .trim()
  .max(280, "Bio must be at most 280 characters.")
  .refine((val) => !LINK_PATTERN.test(val), "Bio can't contain links.")
  .refine((val) => !containsBannedTerm(val), "That bio isn't allowed.")

export const blacklistTypeSchema = z.enum(["ip", "username", "email"])
