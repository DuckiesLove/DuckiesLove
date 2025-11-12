// Utility for shortening verbose kink or subcategory labels

// Map of specific long-form labels to their shortened versions
export const shortenedLabelsMap = {
  'Embarrassment Play': 'Embarrassment',
  "Choosing my partner's outfit for the day or a scene": 'Choosing outfit',
  "Selecting their underwear, lingerie or base layers": 'Picking underwear',
  "Styling their hair (braiding, brushing, tying, etc.)": 'Styling hair',
  "Picking head coverings (veils, hoods, hats)": 'Headwear',
  "Offering makeup, polish, or accessories": 'Makeup/accessories',
  "Creating themed looks (slutty, innocent, etc)": 'Themed looks',
  "Dressing them in role-specific costumes": 'Roleplay outfits',
  "Curating time-period or historical outfits": 'Historical outfits',
  "Helping them present more femme/masc": 'Femme/masc styling',
  "Coordinating their look with mine": 'Matching outfits',
  "Implementing a 'dress ritual' or aesthetic preparation": 'Dress ritual',
  "Enforcing a visual protocol (e.g. no bra, pigtails)": 'Visual protocol',
  "Having my outfit selected for me by partner": 'Partner-picked outfit',
  "Wearing chosen lingerie/underwear": 'Chosen lingerie',
  "Having my hair brushed, braided, styled": 'Hair styled by partner',
};

const MAX_LABEL_LENGTH = 48;

function truncateWithEllipsis(text, limit = MAX_LABEL_LENGTH) {
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit - 1).trimEnd();
  return `${slice}…`;
}

/**
 * Shorten a label for use in compact layouts.
 * Falls back to the first four words of the label when no mapping exists.
 * @param {string} text
 * @returns {string}
 */
export function shortenLabel(text = '') {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (!trimmed) return '';
  const direct = shortenedLabelsMap[trimmed];
  if (direct) return direct;

  if (trimmed.length <= MAX_LABEL_LENGTH) return trimmed;

  const words = trimmed.split(/\s+/);
  let result = '';
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > MAX_LABEL_LENGTH) break;
    result = next;
  }
  if (!result) {
    result = trimmed.slice(0, MAX_LABEL_LENGTH);
  }
  return truncateWithEllipsis(result);
}

export default shortenLabel;

