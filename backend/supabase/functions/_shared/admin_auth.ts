// Admin secret check for the admin-actions function. Until the web console exists,
// admin calls carry the secret in the x-admin-secret header.

/// Compares two strings in time that depends only on their length.
export function sameSecret(presented: string, expected: string): boolean {
  if (presented.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
