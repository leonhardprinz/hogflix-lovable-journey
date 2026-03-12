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
}

const DEFAULT_OPTIONS: Required<RedactorOptions> = {
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
function isSafePhrase(phrase: string): boolean {
  const words = phrase.split(/\s+/);
  // If the first word is a known safe word, skip redaction
  if (SAFE_WORDS.has(words[0])) return true;
  // If ALL words are safe, skip
  if (words.every(w => SAFE_WORDS.has(w))) return true;
  return false;
}

/**
 * Redact PII from a plain text string.
 */
export function redactPII(text: string, options?: RedactorOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
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
    // 5a. "my name is X", "I am X", "I'm X" — catches single first names in context
    result = result.replace(
      /(?:(?:my\s+name\s+is|I\s+am|I'm|call\s+me|this\s+is)\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      (match, name) => match.replace(name, opts.placeholder)
    );

    // 5b. "my husband/wife/friend/colleague/kid/son/daughter X"
    result = result.replace(
      /(?:my\s+(?:husband|wife|partner|friend|colleague|kid|child|son|daughter|brother|sister|mom|dad|mother|father)\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      (match, name) => match.replace(name, opts.placeholder)
    );

    // 5c. Title prefixes (high confidence — always redact)
    result = result.replace(
      /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Judge|Atty|Attorney|Sen|Gov|Rep)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g,
      opts.placeholder
    );

    // 5d. Capitalized word sequences (2-4 words) — likely names
    result = result.replace(
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g,
      (match) => isSafePhrase(match) ? match : opts.placeholder
    );
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

  return content.map(msg => ({
    ...msg,
    content: redactPII(msg.content, options),
  }));
}
