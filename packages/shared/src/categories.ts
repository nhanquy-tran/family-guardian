import { registrableDomain } from "./domain";

export const CATEGORIES = [
  "education",
  "entertainment",
  "social",
  "games",
  "news",
  "shopping",
  "communication",
  "productivity",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

const SEED_BY_CATEGORY: Readonly<Record<Category, readonly string[]>> = {
  education: [
    "khanacademy.org", "classroom.google.com", "coursera.org", "edx.org", "duolingo.com", "wikipedia.org",
    "quizlet.com", "kahoot.it", "scratch.mit.edu", "code.org",
    "hocmai.vn", "olm.vn", "vietjack.com", "violet.vn", "moet.gov.vn", "azota.vn",
  ],
  entertainment: [
    "youtube.com", "netflix.com", "spotify.com", "twitch.tv", "disneyplus.com", "hulu.com",
    "primevideo.com", "soundcloud.com", "vimeo.com", "imdb.com", "imgur.com", "youtu.be",
    "fptplay.vn", "vieon.vn", "zingmp3.vn", "nhaccuatui.com", "tv360.vn",
    "phimmoi.net", "kenh14.vn",
  ],
  social: [
    "facebook.com", "tiktok.com", "instagram.com", "twitter.com", "x.com", "snapchat.com",
    "pinterest.com", "reddit.com", "linkedin.com", "threads.net", "lotus.vn", "tinhte.vn",
    "voz.vn",
  ],
  games: [
    "roblox.com", "minecraft.net", "epicgames.com", "steampowered.com", "fortnite.com", "poki.com",
    "miniclip.com", "crazygames.com", "itch.io", "ea.com", "xbox.com",
    "playstation.com", "nintendo.com", "leagueoflegends.com", "riotgames.com", "blizzard.com", "chess.com",
    "lichess.org", "garena.vn", "playtogether.vn", "gosu.vn", "zing.vn",
  ],
  news: [
    "vnexpress.net", "dantri.com.vn", "tuoitre.vn", "thanhnien.vn", "vietnamnet.vn", "zingnews.vn",
    "nhandan.vn", "laodong.vn", "tienphong.vn", "baomoi.com", "cafef.vn", "vov.vn",
    "bbc.com", "cnn.com", "nytimes.com", "theguardian.com", "reuters.com", "apnews.com",
    "washingtonpost.com", "foxnews.com", "bloomberg.com", "forbes.com", "news.google.com", "vtv.vn",
  ],
  shopping: [
    "amazon.com", "ebay.com", "aliexpress.com", "shopee.vn", "lazada.vn", "tiki.vn",
    "sendo.vn", "thegioididong.com", "dienmayxanh.com", "fptshop.com.vn", "cellphones.com.vn", "etsy.com",
    "walmart.com", "target.com", "temu.com", "shein.com", "bestbuy.com", "alibaba.com",
    "zalora.vn", "nguyenkim.com", "hoanghamobile.com", "chotot.com", "batdongsan.com.vn",
  ],
  communication: [
    "zalo.me", "messenger.com", "whatsapp.com", "discord.com", "telegram.org", "web.telegram.org",
    "skype.com", "viber.com", "meet.google.com", "zoom.us", "teams.microsoft.com", "slack.com",
    "signal.org", "line.me", "mail.google.com", "outlook.com", "outlook.live.com", "mail.yahoo.com",
    "proton.me", "chat.zalo.me",
  ],
  productivity: [
    "docs.google.com", "drive.google.com", "sheets.google.com", "slides.google.com", "calendar.google.com", "notion.so",
    "office.com", "onedrive.live.com", "dropbox.com", "trello.com", "canva.com", "github.com",
    "figma.com", "evernote.com", "grammarly.com", "overleaf.com", "miro.com", "asana.com",
    "microsoft365.com", "icloud.com",
  ],
  other: [],
};

export const SEED_CATEGORIES: Readonly<Record<string, Category>> = Object.fromEntries(
  CATEGORIES.flatMap((category) => SEED_BY_CATEGORY[category].map((host) => [host, category] as const)),
);

function lookupPath(domain: string): string[] {
  const host = domain.trim().toLowerCase().replace(/\.$/, "");
  const registrable = registrableDomain(`https://${host}/`);
  if (!registrable || !host.endsWith(registrable)) return [];
  const labels = host.split(".");
  const path: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    const candidate = labels.slice(i).join(".");
    path.push(candidate);
    if (candidate === registrable) break;
  }
  return path;
}

function find(record: Readonly<Record<string, Category>>, path: readonly string[]): Category | undefined {
  for (const candidate of path) {
    if (Object.hasOwn(record, candidate)) return record[candidate];
  }
  return undefined;
}

/**
 * Resolves a domain to a category. Overrides (lowercase keys) beat the seed, even a more specific seed entry;
 * within each, the most specific host wins. Never throws.
 */
export function categorize(domain: string, overrides?: Readonly<Record<string, Category>>): Category {
  const path = lookupPath(domain);
  return (overrides && find(overrides, path)) ?? find(SEED_CATEGORIES, path) ?? "other";
}
