/**
 * Formatting for customers who may have a second property owner on the record.
 *
 * Properties are frequently owned jointly, and insurance carriers expect every
 * owner named on the agreement. These helpers keep that formatting identical
 * across the quote, the contingency agreement and the app, so a document never
 * names one owner while another names both.
 *
 * Mirrors src/lib/customerName.ts in the iOS app — the two surfaces render the
 * same agreements from the same records, so they must agree on the wording.
 */

interface NameParts {
  first_name?: string | null;
  last_name?: string | null;
  second_first_name?: string | null;
  second_last_name?: string | null;
  email?: string | null;
}

interface PhoneParts {
  phone?: string | null;
  second_phone?: string | null;
}

interface EmailParts {
  email?: string | null;
  second_email?: string | null;
}

const clean = (v: string | null | undefined) => (v ?? '').trim();

const join = (first: string | null | undefined, last: string | null | undefined) =>
  [clean(first), clean(last)].filter(Boolean).join(' ');

/** The primary owner alone, e.g. "Cynthia Fields". */
export const primaryName = (c: NameParts): string => join(c.first_name, c.last_name);

/** The second owner alone, or '' when there isn't one. */
export const secondName = (c: NameParts): string =>
  join(c.second_first_name, c.second_last_name);

/** True when a usable second owner name is on the record. */
export const hasSecondOwner = (c: NameParts): boolean => secondName(c).length > 0;

/**
 * Both owners for display, e.g. "Cynthia Fields & Robert Fields".
 *
 * Shared surnames collapse to "Cynthia & Robert Fields", which is how people
 * write it and how it reads on a contract. Different surnames stay written
 * out in full so neither owner is misnamed.
 */
export const ownerNames = (c: NameParts): string => {
  const primary = primaryName(c);
  const second = secondName(c);
  if (!second) return primary;
  if (!primary) return second;

  const lastA = clean(c.last_name);
  const lastB = clean(c.second_last_name);
  const firstA = clean(c.first_name);
  const firstB = clean(c.second_first_name);

  if (lastA && lastB && lastA.toLowerCase() === lastB.toLowerCase() && firstA && firstB) {
    return `${firstA} & ${firstB} ${lastA}`;
  }
  return `${primary} & ${second}`;
};

/**
 * Every phone on the record, de-duplicated. A co-owner's number is often the
 * one that actually gets answered, so both belong on the document.
 */
export const ownerPhones = (c: PhoneParts): string[] => {
  const seen = new Set<string>();
  return [c.phone, c.second_phone]
    .map(clean)
    .filter(p => {
      if (!p) return false;
      // Compare on digits so "(614) 555-0134" and "6145550134" count as one.
      const key = p.replace(/\D/g, '') || p;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

/**
 * Every email on the record, de-duplicated. A co-owner's inbox is often the
 * one that's actually watched, so both belong on the document.
 */
export const ownerEmails = (c: EmailParts): string[] => {
  const seen = new Set<string>();
  return [c.email, c.second_email]
    .map(clean)
    .filter(e => {
      if (!e) return false;
      const key = e.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

/**
 * True when nobody has supplied a name yet — the record exists only so the
 * homeowner can be emailed and fill in their own details.
 */
export const awaitingHomeownerDetails = (
  c: NameParts & {email?: string | null},
): boolean => primaryName(c).length === 0 && !!clean(c.email);

/**
 * What to show wherever a customer is listed. Falls back to the email, and
 * then to a plain statement that the details are still to come — never an
 * empty row that looks like a broken record.
 */
export const customerDisplayName = (
  c: NameParts & {email?: string | null},
): string => {
  const names = ownerNames(c);
  if (names) return names;
  const email = clean(c.email);
  return email || 'Awaiting homeowner details';
};

/**
 * Splices a quote's own contact_* columns over its joined customer, so every
 * downstream reader that already does `quote.customer.first_name` (there are
 * dozens, across PDFs, invoices, receipts, certificates) sees the correct
 * per-quote value without having to change.
 *
 * Quotes carry their own copy of contact info once they exist — editing a
 * name/phone/address from inside one quote must never change what a
 * different quote for the same customer shows (most visibly: duplicating a
 * quote and then correcting the duplicate must never touch the original it
 * was duplicated from). A quote's contact_* is null only for rows that
 * predate this — those fall through to the live customer, same as always.
 *
 * Call this ONCE at each place a quote+customer row is actually fetched
 * (a `.select()`, not each place a field is read) — see the fetch sites this
 * wraps for the pattern. Pure and side-effect free; safe to call on a quote
 * that has no `customer`/`contact` at all.
 */
export const withQuoteContact = <
  Q extends {
    contact_first_name?: string | null;
    contact_last_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    contact_address?: string | null;
    contact_city?: string | null;
    contact_state?: string | null;
    contact_zip?: string | null;
    contact_second_first_name?: string | null;
    contact_second_last_name?: string | null;
    contact_second_phone?: string | null;
    contact_second_email?: string | null;
    customer?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
  },
>(
  quote: Q | null | undefined,
): Q | null | undefined => {
  if (!quote) return quote;
  const joined = quote.customer ?? quote.contact;
  if (!joined) return quote;

  const pick = (override: string | null | undefined, joinedKey: string) =>
    override != null && override !== '' ? override : (joined as Record<string, unknown>)[joinedKey];

  const mergedCustomer = {
    ...joined,
    first_name: pick(quote.contact_first_name, 'first_name'),
    last_name: pick(quote.contact_last_name, 'last_name'),
    email: pick(quote.contact_email, 'email'),
    phone: pick(quote.contact_phone, 'phone'),
    address: pick(quote.contact_address, 'address'),
    city: pick(quote.contact_city, 'city'),
    state: pick(quote.contact_state, 'state'),
    zip: pick(quote.contact_zip, 'zip'),
    second_first_name: pick(quote.contact_second_first_name, 'second_first_name'),
    second_last_name: pick(quote.contact_second_last_name, 'second_last_name'),
    second_phone: pick(quote.contact_second_phone, 'second_phone'),
    second_email: pick(quote.contact_second_email, 'second_email'),
  };

  return {
    ...quote,
    ...(quote.customer !== undefined ? {customer: mergedCustomer} : {}),
    ...(quote.contact !== undefined ? {contact: mergedCustomer} : {}),
  };
};

/**
 * Same idea as withQuoteContact, applied to a whole list at once — for the
 * dashboard's quotes table, which fetches many rows in one query.
 */
export const withQuoteContactList = <
  Q extends Parameters<typeof withQuoteContact>[0],
>(
  quotes: Q[] | null | undefined,
): Q[] =>
  (quotes ?? []).map(q => withQuoteContact(q) as NonNullable<Q>);
