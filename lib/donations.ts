import type { PublicUser } from "@/lib/auth"

/** Gates donator perks (music widget, custom site theme): testers get them
 * free, admin/owner get them free too (see the role check below), everyone
 * else needs is_donator. */
export function hasDonatorPerks(user: Pick<PublicUser, "role" | "is_donator">): boolean {
  return user.role === "tester" || user.role === "admin" || user.role === "owner" || user.is_donator === true
}
