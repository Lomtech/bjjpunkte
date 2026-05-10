/**
 * Osss Icon-Library — Single Entry Point.
 *
 * Usage:
 *   import { OsssLogo, WhatsAppIcon, InstagramIcon } from '@/components/icons'
 *
 * Was hier liegt:
 *   - brand.tsx  → Osss Marks (Logo, Mark, Wordmark, Avatar, Brand-Konstanten)
 *   - social.tsx → Social-Brand-Icons (WhatsApp, Instagram, LinkedIn, X, etc.)
 *
 * Was nicht hier liegt:
 *   - Lucide-Icons (Calendar, ArrowRight, etc.) — direkt aus 'lucide-react'.
 *     Lucide ist sauber für UI-Icons; wir kapseln nur Brand-spezifische
 *     SVGs die wir selbst kontrollieren wollen.
 */

export {
  // Re-exports aus Logo.tsx (backwards-compat)
  LogoMark,
  OsssLogo,
  // Neue Variationen
  OsssMark,
  OsssMarkInverse,
  OsssWordmark,
  OsssAvatarFallback,
  BRAND,
} from './brand'

export {
  WhatsAppIcon,
  InstagramIcon,
  LinkedInIcon,
  YouTubeIcon,
  TikTokIcon,
  XIcon,
  FacebookIcon,
  MailIcon,
} from './social'
