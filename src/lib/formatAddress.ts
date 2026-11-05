// Address lines for display. Contacts, companies and jobs often have only some
// of street / city / state / zip filled in (a new lead is usually just a name and
// a phone number), and joining the fields with fixed ", " separators showed a lone
// "," or ", ," wherever the address was empty. These skip the missing parts.

type AddressParts = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

const clean = (v: string | null | undefined) => (typeof v === 'string' ? v.trim() : '');

/** "City, ST 12345", leaving out whatever is missing. Empty string if all are. */
export function formatCityStateZip(parts: Omit<AddressParts, 'address'>): string {
  const stateZip = [clean(parts.state), clean(parts.zip)].filter(Boolean).join(' ');
  return [clean(parts.city), stateZip].filter(Boolean).join(', ');
}

/** "City, ST" without the zip — for compact cards and list rows. */
export function formatCityState(parts: Pick<AddressParts, 'city' | 'state'>): string {
  return formatCityStateZip({ city: parts.city, state: parts.state });
}

/** "123 Main St, City, ST 12345", leaving out whatever is missing. */
export function formatFullAddress(parts: AddressParts): string {
  return [clean(parts.address), formatCityStateZip(parts)].filter(Boolean).join(', ');
}
