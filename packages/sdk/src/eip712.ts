import { ethers } from 'ethers';

const DOMAIN_VERSION = '1';

export function buildDomain(chainId: number, verifyingContract: string) {
  return {
    name: 'MycelixMusic',
    version: DOMAIN_VERSION,
    chainId,
    verifyingContract,
  };
}

export const songType = {
  Song: [
    { name: 'id', type: 'string' },
    { name: 'artistAddress', type: 'address' },
    { name: 'ipfsHash', type: 'string' },
    { name: 'paymentModel', type: 'string' },
    { name: 'nonce', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
};

export const playType = {
  Play: [
    { name: 'songId', type: 'string' },
    { name: 'listener', type: 'address' },
    { name: 'amount', type: 'string' },
    { name: 'paymentType', type: 'string' },
    { name: 'nonce', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
};

export const claimType = {
  Claim: [
    { name: 'songId', type: 'string' },
    { name: 'artistAddress', type: 'address' },
    { name: 'ipfsHash', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'nonce', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
};

export async function signTypedData(
  signer: ethers.Signer,
  domain: Record<string, any>,
  types: Record<string, Array<{ name: string; type: string }>>,
  value: Record<string, any>,
) {
  // ethers v6 uses signTypedData directly on the signer
  const signature = await signer.signTypedData(domain, types, value);
  return signature;
}
