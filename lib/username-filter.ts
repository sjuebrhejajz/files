// Blocks a set of well-known slurs from being used as usernames. This is a
// starting list, not an exhaustive one — extend BANNED_TERMS as new evasions
// show up. Matching is done after normalizing common leetspeak substitutions
// and collapsing repeated letters, so simple evasion ("n1gger", "niggerr")
// doesn't slip through — but no static list ever catches everything, and
// this should be treated as one layer of defense, not the only one.
const BANNED_TERMS = [
  "nigger",
  "nigga",
  "chink",
  "spic",
  "kike",
  "gook",
  "wetback",
  "coon",
  "tranny",
  "faggot",
  "fag",
  "retard",
  "raghead",
  "beaner",
  "paki",
  "cracker",
  "gypsy",
  "negro",
]

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/[^a-z]/g, "") // strip anything left over (digits, symbols, underscores)
    .replace(/(.)\1+/g, "$1") // collapse repeated letters: "niggerr" -> "niger"
}

const NORMALIZED_BANNED_TERMS = BANNED_TERMS.map(normalize)

export function containsBannedTerm(value: string): boolean {
  const normalized = normalize(value)
  if (!normalized) return false
  return NORMALIZED_BANNED_TERMS.some((term) => normalized.includes(term))
}
