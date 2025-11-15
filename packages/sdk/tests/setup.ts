/**
 * Test setup and utilities
 */

import { vi } from 'vitest';

// Mock ethers.js
vi.mock('ethers', () => ({
  ethers: {
    Contract: vi.fn(),
    JsonRpcProvider: vi.fn(),
    Wallet: vi.fn(),
    parseEther: (value: string) => BigInt(parseFloat(value) * 1e18),
    formatEther: (value: bigint) => (Number(value) / 1e18).toString(),
    keccak256: vi.fn((data: Uint8Array) => '0x' + '1'.repeat(64)),
    toUtf8Bytes: vi.fn((str: string) => new Uint8Array()),
    ZeroAddress: '0x0000000000000000000000000000000000000000',
  },
}));

// Test utilities
export const createMockProvider = () => ({
  getNetwork: vi.fn().mockResolvedValue({ chainId: 100 }),
  getBlockNumber: vi.fn().mockResolvedValue(1000),
  getBlock: vi.fn().mockResolvedValue({ timestamp: Date.now() / 1000 }),
});

export const createMockSigner = (address: string) => ({
  getAddress: vi.fn().mockResolvedValue(address),
  signMessage: vi.fn(),
  signTransaction: vi.fn(),
});

export const createMockContract = (methods: Record<string, any>) => {
  const mock = {} as any;
  for (const [name, impl] of Object.entries(methods)) {
    mock[name] = vi.fn(impl);
  }
  return mock;
};

// Common test addresses
export const TEST_ADDRESSES = {
  artist: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  listener: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  producer: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  platform: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  router: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  flowToken: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
};

// Common test song IDs
export const TEST_SONG_IDS = {
  payPerStream: '0x' + '1'.repeat(64),
  giftEconomy: '0x' + '2'.repeat(64),
  custom: '0x' + '3'.repeat(64),
};
