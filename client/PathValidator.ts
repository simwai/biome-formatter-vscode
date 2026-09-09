/**
 * Returns false for binary paths that traverse directories or contain shell metacharacters.
 *
 * Binary paths reach the process spawn with a shell on Windows, so validation fails closed.
 */
export function validateSafeBinaryPath(binary: string): boolean {
  if (binary.includes('..') || binary.includes('.\\')) {
    return false
  }

  // why: no legitimate binary path contains shell metacharacters, so any hit means an injection attempt.
  const maliciousPatterns = [
    // linux/macOS
    '$',
    '&',
    ';',
    '|',
    '`',
    '>',
    '<',
    '!',
    // windows
    '%',
    '^',
  ]
  for (const pattern of maliciousPatterns) {
    if (binary.includes(pattern)) {
      return false
    }
  }

  return true
}
