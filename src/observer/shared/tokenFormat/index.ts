/** Size of the observer token in bytes; the one place the format is decided. */
export const TOKEN_BYTES = 32;

/** Matches exactly what `mintToken` produces: the token's bytes as lowercase hex. */
export const TOKEN_PATTERN = new RegExp(`^[0-9a-f]{${TOKEN_BYTES * 2}}$`);
