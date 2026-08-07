import { Orbitron } from "next/font/google"

// A cooler, more "neon sign" display font for prominent headings — usernames,
// the site title, dashboard greetings. Not applied to body text or anything
// dense, since Orbitron is a display face (reads poorly at small sizes /
// long strings).
export const neonFont = Orbitron({ subsets: ["latin"], weight: ["500", "700", "800"] })
