// src/app/client.ts
import { createThirdwebClient } from "thirdweb";
import { sepolia } from "thirdweb/chains"; // Import Sepolia from thirdweb/chains

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!;

export const client = createThirdwebClient({
  clientId: clientId,
});

// Use Sepolia testnet (Proof of Stake)
export { sepolia };
