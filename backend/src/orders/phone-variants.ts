/** One Bangladesh number can be saved as 017..., 88017... or +88017..., so look for all three. */
export function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/^\+/, '');
  const local = digits.startsWith('880') ? digits.slice(2) : digits;
  if (!/^01\d{9}$/.test(local)) return [phone];
  return [local, `88${local}`, `+88${local}`];
}
