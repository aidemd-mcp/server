import { randomBytes } from "node:crypto";
import { TOKEN_BYTES } from "../shared/tokenFormat/index.js";

/** Mints the per-observer secret: 32 CSPRNG bytes as 64 lowercase hex characters. */
export default function mintToken(): string {
	return randomBytes(TOKEN_BYTES).toString("hex");
}
