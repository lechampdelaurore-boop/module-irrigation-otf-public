export async function verifyWeatherSyncToken(
  provided: string | null,
  expected: string | undefined,
) {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return fixedLengthEqual(new Uint8Array(providedHash), new Uint8Array(expectedHash));
}

function fixedLengthEqual(provided: Uint8Array, expected: Uint8Array) {
  let difference = provided.length ^ expected.length;
  for (let index = 0; index < Math.max(provided.length, expected.length); index += 1) {
    difference |= (provided[index] ?? 0) ^ (expected[index] ?? 0);
  }
  return difference === 0;
}
