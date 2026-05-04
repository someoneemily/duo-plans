const SQL_PATTERN = /('|;|--|\/\*|\*\/|\b(DROP|INSERT|UPDATE|DELETE|SELECT|TRUNCATE|ALTER|EXEC|UNION|CREATE)\b)/i;

export function validateActivityName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Name is required.';
  if (trimmed.length > 120) return 'Name must be 120 characters or fewer.';
  if (SQL_PATTERN.test(trimmed)) return 'Name contains invalid characters.';
  return null;
}

export function validateHandle(handle: string): string | null {
  const trimmed = handle.replace(/^@/, '').trim();
  if (trimmed.length > 50) return 'Handle must be 50 characters or fewer.';
  if (SQL_PATTERN.test(trimmed)) return 'Handle contains invalid characters.';
  return null;
}

export function validatePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (trimmed.length > 20) return 'Phone must be 20 characters or fewer.';
  if (SQL_PATTERN.test(trimmed)) return 'Phone contains invalid characters.';
  return null;
}
