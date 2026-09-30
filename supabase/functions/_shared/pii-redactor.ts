/**
 * PII Redactor for LLM Analytics
 *
 * Regex-based scrubber that redacts personal information from LLM event payloads
 * before sending to PostHog. Designed to be lightweight (no NLP, no external deps)
 * and directly translatable to Python re.sub() for backend implementations.
 *
 * Usage:
 *   import { redactPII, redactAIContent } from '../_shared/pii-redactor.ts';
 *   const cleaned = redactPII("Contact John Smith at john@example.com");
 *   // => "Contact [REDACTED] at [REDACTED]"
 */

export interface RedactorOptions {
  redactNames?: boolean;
  redactEmails?: boolean;
  redactPhones?: boolean;
  stripUrlParams?: boolean;
  placeholder?: string;
  /** Collects every name that was redacted, so a conversation can mask the same names everywhere. */
  seenNames?: Set<string>;
}

const DEFAULT_OPTIONS: Required<Omit<RedactorOptions, 'seenNames'>> = {
  redactNames: true,
  redactEmails: true,
  redactPhones: true,
  stripUrlParams: true,
  placeholder: '[REDACTED]',
};

// Words that look like names (Capitalized) but aren't — extend as needed
const SAFE_WORDS = new Set([
  // Common English words that start sentences
  'The', 'This', 'That', 'These', 'Those', 'There', 'Here', 'What', 'When',
  'Where', 'Which', 'Who', 'How', 'Why', 'Yes', 'No', 'Not', 'But', 'And',
  'Also', 'Just', 'Only', 'Some', 'Any', 'All', 'Each', 'Every', 'Most',
  // Days / months
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December',
  // Genres / categories
  'Action', 'Comedy', 'Drama', 'Horror', 'Thriller', 'Romance', 'Fantasy',
  'Animation', 'Documentary', 'Mystery', 'Adventure', 'Science', 'Fiction',
  // Hogflix-specific
  'FlixBuddy', 'HogFlix', 'PostHog', 'Premium', 'Standard', 'Basic',
  // Tech / common nouns
  'Internet', 'Google', 'Apple', 'Netflix', 'YouTube', 'Amazon',
  // Legal terms (relevant for AnyCase)
  'Supreme', 'Court', 'Attorney', 'General', 'District', 'Federal',
  'Circuit', 'Appeal', 'Appeals', 'Justice', 'Republic', 'Philippines',
  'Section', 'Article', 'Chapter', 'Rule', 'Order', 'Motion',
]);

/**
 * Check if a capitalized word sequence is likely a safe (non-name) phrase.
 */
// Hogflix catalog titles are hedgehog puns ("Prickly Blinders", "Hulk Hog"). Any word
// containing one of these stems marks the phrase as a title, not a person.
const CATALOG_STEM = /hog|hedge|spine|prickl|quill|burrow|flix/i;

function isSafeWord(word: string): boolean {
  return SAFE_WORDS.has(word) || CATALOG_STEM.test(word);
}

function isSafePhrase(phrase: string): boolean {
  const words = phrase.split(/\s+/);
  // If the first word is a known safe word, or any word is a catalog word, skip redaction
  if (isSafeWord(words[0])) return true;
  if (words.some(w => CATALOG_STEM.test(w))) return true;
  // If ALL words are safe, skip
  if (words.every(w => SAFE_WORDS.has(w))) return true;
  return false;
}

/**
 * Redact PII from a plain text string.
 */
export function redactPII(text: string, options?: RedactorOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const remember = (name: string) => { if (opts.seenNames) name.split(/[\s-]+/).filter(w => w.length >= 3).forEach(w => opts.seenNames!.add(w)); };
  let result = text;

  // 1. Emails (high precision, run first)
  if (opts.redactEmails) {
    result = result.replace(
      /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
      opts.placeholder
    );
  }

  // 2. Phone numbers and long digit sequences (bank numbers, IDs, SSNs)
  if (opts.redactPhones) {
    // Phone formats (US/intl, min 7 digits)
    result = result.replace(
      /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,9}\b/g,
      (match) => {
        const digits = match.replace(/\D/g, '');
        return digits.length >= 7 ? opts.placeholder : match;
      }
    );
    // A country code split off by the match above leaves a stray '+' in front
    result = result.split('+' + opts.placeholder).join(opts.placeholder);
    // Standalone long number sequences (bank accounts, IDs, etc — 6+ digits)
    result = result.replace(/\b\d{6,}\b/g, opts.placeholder);
  }

  // 3. URL query parameter stripping
  if (opts.stripUrlParams) {
    result = result.replace(
      /(https?:\/\/[^\s]+?)\?[^\s]*/g,
      '$1?[PARAMS_REDACTED]'
    );
  }

  // 4. Street addresses (street name + number patterns)
  // Catches: "Uferstr. 15", "123 Main Street", "Baker Street 221B"
  result = result.replace(
    /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Place|Pl|Strasse|Straße|Str|Gasse|Weg|Platz|Cesta|Ulica))\b\.?\s*\d{0,5}[A-Za-z]?\b/gi,
    opts.placeholder
  );
  // Reverse format: "Streetname 123" or "Streetname. 123"
  result = result.replace(
    /\b[A-Z][a-z]+(?:str|straße|strasse|gasse|weg|cesta|ulica)\.?\s+\d{1,5}[A-Za-z]?\b/gi,
    opts.placeholder
  );
  // General "word(s) + house number" after "live at/in/on", "address is"
  result = result.replace(
    /(?:live[sd]?\s+(?:at|in|on)|address\s+is)\s+[^,.]{2,40}?\s+\d{1,5}[A-Za-z]?\b/gi,
    (match) => {
      const prefix = match.match(/^(live[sd]?\s+(?:at|in|on)|address\s+is)\s+/i)?.[0] || '';
      return prefix + opts.placeholder;
    }
  );

  // 5. Person names
  if (opts.redactNames) {
    const P = opts.placeholder;
    // Trigger phrases match any case, but the name itself must be Capitalized.
    // (A case-insensitive name pattern turns "I'm looking" into "I'm [REDACTED]".)
    const NAME = '([A-Z][a-z]+(?:[ -][A-Z][a-z]+)?)';
    const redactName = (match: string, name: string) => {
      if (isSafePhrase(name)) return match;
      remember(name);
      return match.replace(name, P);
    };

    // Protect markdown bold (**Title**) and quoted titles: recommendations live there.
    const kept: string[] = [];
    result = result.replace(/\*\*[^*\n]+\*\*|"[^"\n]{2,80}"/g, (m) => { kept.push(m); return `\u0000${kept.length - 1}\u0000`; });

    // 5a. "my name is X", "I am X", "I'm X", "call me X", "this is X"
    result = result.replace(new RegExp(`(?:[Mm]y\\s+[Nn]ame\\s+[Ii]s|I\\s+am|I'm|[Cc]all\\s+me|[Tt]his\\s+[Ii]s)\\s+${NAME}`, 'g'), redactName);

    // 5b. "my husband/wife/friend/... X"
    result = result.replace(new RegExp(`[Mm]y\\s+(?:husband|wife|partner|boyfriend|girlfriend|friend|colleague|boss|kid|child|son|daughter|brother|sister|mom|mum|dad|mother|father|grandma|grandpa)\\s+${NAME}`, 'g'), redactName);

    // 5c. Title prefixes (high confidence — always redact)
    result = result.replace(/\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Judge|Atty|Attorney|Sen|Gov|Rep)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, P);

    // 5d. Greetings and people-verbs: "Hi Anna", "Thanks, Priya", "with Maria", "tell Sam"
    result = result.replace(new RegExp(`\\b(?:[Hh]i|[Hh]ey|[Hh]ello|[Dd]ear|[Tt]hanks|[Tt]hank\\s+you|[Bb]ye|[Ww]ith|[Tt]ell|[Aa]sk|[Ii]nvite|[Mm]eet),?\\s+([A-Z][a-z]+)\\b(?!\\s+[A-Z])`, 'g'), redactName);

    // 5e. Runs of 2-3 Capitalized words ("John Smith"). A run that starts a sentence
    //     loses its first word ("Contact John Smith" -> "Contact [REDACTED]").
    result = result.replace(/(^|[.!?:\n]\s*|[^A-Za-z\s]?\s*)?\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b/g, (match, lead, run, offset, full) => {
      const before = full.slice(0, offset + (lead ? lead.length : 0));
      const sentenceStart = /(^|[.!?\n]\s*|\u0000\s*)$/.test(before);
      let words = run.split(/\s+/);
      let prefix = '';
      if (sentenceStart) { prefix = words[0] + (words.length > 1 ? ' ' : ''); words = words.slice(1); }
      if (words.length < 2 || words.length > 3) return match;
      const phrase = words.join(' ');
      if (isSafePhrase(phrase) || words.some(isSafeWord)) return match;
      remember(phrase);
      return (lead || '') + prefix + P;
    });

    // 5f. Names joined to an already-redacted name: "[REDACTED] and Michael", "[REDACTED], Jonas"
    const joined = new RegExp(`(${P.replace(/[[\]]/g, '\\$&')}\\s*(?:,|and|&|or|und)\\s+)([A-Z][a-z]+)\\b`, 'g');
    for (let i = 0; i < 3; i++) result = result.replace(joined, (m, head, name) => { if (isSafeWord(name)) return m; remember(name); return head + P; });

    result = result.replace(/\u0000(\d+)\u0000/g, (_m, i) => kept[Number(i)]);
  }

  return result;
}

/**
 * Redact PII from PostHog $ai_input / $ai_output_choices message arrays.
 * Preserves the role field and array structure, only scrubs content.
 */
export function redactAIContent(
  content: Array<{ role: string; content: string }> | string,
  options?: RedactorOptions
): Array<{ role: string; content: string }> | string {
  if (typeof content === 'string') {
    return redactPII(content, options);
  }

  // Pass 1: redact each message and remember every name found anywhere in the conversation.
  const seenNames = options?.seenNames ?? new Set<string>();
  const first = content.map(msg => ({ ...msg, content: redactPII(msg.content, { ...options, seenNames }) }));
  if (seenNames.size === 0) return first;

  // Pass 2: a name the user gave once ("my husband Michael") is masked wherever it reappears,
  // e.g. in the assistant's reply ("you and Michael"). Bold titles are left alone.
  const placeholder = options?.placeholder ?? DEFAULT_OPTIONS.placeholder;
  const names = [...seenNames].filter(n => !isSafeWord(n)).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (names.length === 0) return first;
  const re = new RegExp(`\\b(?:${names.join('|')})\\b`, 'g');
  return first.map(msg => ({
    ...msg,
    content: msg.content.split(/(\*\*[^*\n]+\*\*)/).map(part => (part.startsWith('**') ? part : part.replace(re, placeholder))).join(''),
  }));
}
