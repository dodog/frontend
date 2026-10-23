import { createI18n, type PluralizationRule } from "vue-i18n";

export interface LocaleOption {
  value: string;
  label: string;
}

export function canonicalizeLocale(locale: string): string {
  const normalizedLocale = locale.trim().replaceAll("_", "-");
  try {
    return Intl.getCanonicalLocales(normalizedLocale)[0] ?? normalizedLocale;
  } catch {
    return normalizedLocale;
  }
}

export function getLocaleDisplayName(
  locale: string,
  displayLocale: string,
): string {
  const canonicalLocale = canonicalizeLocale(locale);
  if (typeof Intl.DisplayNames !== "function") return canonicalLocale;

  try {
    const displayNames = new Intl.DisplayNames(
      [canonicalizeLocale(displayLocale)],
      {
        type: "language",
        fallback: "code",
        languageDisplay: "dialect",
      },
    );
    return displayNames.of(canonicalLocale) ?? canonicalLocale;
  } catch {
    return canonicalLocale;
  }
}

export function getLocaleOptions(
  locales: readonly string[],
  displayLocale: string,
): LocaleOption[] {
  const options = locales.map((locale) => ({
    value: locale,
    label: getLocaleDisplayName(locale, displayLocale),
  }));

  try {
    const collator = new Intl.Collator(canonicalizeLocale(displayLocale), {
      sensitivity: "base",
    });
    return options.sort(
      (a, b) =>
        collator.compare(a.label, b.label) ||
        collator.compare(a.value, b.value),
    );
  } catch {
    return options.sort(
      (a, b) =>
        a.label.localeCompare(b.label) || a.value.localeCompare(b.value),
    );
  }
}

/*
 * All i18n resources specified in the plugin `include` option can be loaded
 * at once using the import syntax
 */
import messages from "@intlify/unplugin-vue-i18n/messages";

/**
 * Resolve an incoming locale string to the best available translation key.
 *
 * Accepts either separator (BCP-47 `en-AU` from `navigator.language`, or POSIX
 * `en_AU` as our files are named) and any number of subtags. It normalizes both
 * sides to a separator-agnostic, lowercased key, then walks the subtag chain from
 * most specific to least specific (`zh-Hans-CN` → `zh-Hans` → `zh`), returning the
 * real available key in its original casing. Falls back to `en` when nothing matches.
 */
export function resolveLocale(
  requestedLocale: string,
  availableLocales: readonly string[],
): string {
  // Collapse separator + casing so BCP-47 and POSIX compare equal: "en_AU"/"en-AU" → "en-au"
  const toComparableKey = (locale: string) =>
    locale.toLowerCase().replace(/[-_]/g, "-");

  // Map every available file back from its comparable key to its real name: "zh-cn" → "zh_CN"
  const localeByComparableKey = new Map(
    availableLocales.map((locale) => [toComparableKey(locale), locale]),
  );

  const subtags = toComparableKey(requestedLocale).split("-"); // "zh-Hans-CN" → ["zh","hans","cn"]

  // Candidate keys from most to least specific: ["zh-hans-cn", "zh-hans", "zh"]
  const candidateKeys = subtags.map((_, index) =>
    subtags.slice(0, subtags.length - index).join("-"),
  );

  // First candidate that maps to a shipped file, in its original casing, e.g. "zh_CN"
  const matchedLocale = candidateKeys
    .map((candidateKey) => localeByComparableKey.get(candidateKey))
    .find((locale) => locale !== undefined);

  return matchedLocale ?? "en"; // nothing shipped for this language → fall back to English
}

// Default plural
const defaultRule: PluralizationRule = (choice, choicesLength) => {
  choice = Math.abs(choice);
  if (choicesLength === 2) return choice ? (choice > 1 ? 1 : 0) : 1;
  return choice ? Math.min(choice, 2) : 0;
};

// Slovak plural - three forms "one | few | other"
export const slovakRule: PluralizationRule = (choice, choicesLength) => {
  if (choicesLength !== 3) return defaultRule(choice, choicesLength);
  const n = Math.abs(choice);
  if (n === 1) return 0;
  if (n >= 2 && n <= 4) return 1;
  return 2;
};

// Serbian plural, three forms "one | few | other":
export const serbianRule: PluralizationRule = (choice, choicesLength) => {
  if (choicesLength !== 3) return defaultRule(choice, choicesLength);
  const n = Math.abs(choice);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 0;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
  return 2;
};

const availableLocales = Object.keys(messages ?? {});

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveLocale(navigator.language, availableLocales),
  fallbackLocale: "en",
  pluralRules: {
    sk_SK: slovakRule,
    sk: slovakRule,
    sr_Latn: serbianRule,
    sr: serbianRule,
  },
  missingWarn: false,
  fallbackWarn: false,
  silentTranslationWarn: true,
  messages,
});

// @ts-ignore
const $t = i18n.global.t;

export { $t, i18n };
