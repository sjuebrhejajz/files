import type { PublicUser } from "@/lib/auth"

/** Gates donator perks (music widget, custom site theme): testers get them free, everyone else needs is_donator. */
export function hasDonatorPerks(user: Pick<PublicUser, "role" | "is_donator">): boolean {
  return user.role === "tester" || user.is_donator === true
}
