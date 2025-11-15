/**
 * SDK Tests: Economic Strategies
 * Comprehensive test suite for SDK economic strategy functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ethers } from 'ethers';
import { MycelixSDK } from '../src/index';

describe('MycelixSDK - Economic Strategies', () => {
  let sdk: MycelixSDK;
  let mockProvider: ethers.Provider;
  let mockSigner: ethers.Signer;
  let artistAddress: string;
  let listenerAddress: string;

  beforeEach(() => {
    // Create mock provider and signer
    mock Provider = {
      getNetwork: vi.fn().mockResolvedValue({ chainId: 100 }),
      getBlockNumber: vi.fn().mockResolvedValue(1000),
    } as any;

    artistAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    listenerAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

    mockSigner = {
      getAddress: vi.fn().mockResolvedValue(artistAddress),
      provider: mockProvider,
    } as any;

    sdk = new MycelixSDK({
      provider: mockProvider,
      signer: mockSigner,
      routerAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      flowTokenAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      apiUrl: 'http://localhost:3100',
    });
  });

  describe('Pay-Per-Stream Strategy', () => {
    const songId = '0x' + '1'.repeat(64);

    it('should configure royalty split correctly', async () => {
      const recipients = [artistAddress];
      const basisPoints = [10000];
      const roles = ['artist'];

      const mockContract = {
        configureRoyaltySplit: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({ status: 1 }),
        }),
      };

      // Mock contract creation
      vi.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);

      await sdk.configurePayPerStream(songId, recipients, basisPoints, roles);

      expect(mockContract.configureRoyaltySplit).toHaveBeenCalledWith(
        songId,
        recipients,
        basisPoints,
        roles
      );
    });

    it('should reject invalid basis points', async () => {
      const recipients = [artistAddress];
      const basisPoints = [9000]; // Invalid, must sum to 10000
      const roles = ['artist'];

      await expect(
        sdk.configurePayPerStream(songId, recipients, basisPoints, roles)
      ).rejects.toThrow('Basis points must sum to 10000');
    });

    it('should reject mismatched arrays', async () => {
      const recipients = [artistAddress, listenerAddress];
      const basisPoints = [10000]; // Mismatched length
      const roles = ['artist', 'listener'];

      await expect(
        sdk.configurePayPerStream(songId, recipients, basisPoints, roles)
      ).rejects.toThrow('Array lengths must match');
    });

    it('should handle complex revenue splits', async () => {
      const recipients = [
        artistAddress,
        listenerAddress,
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      ];
      const basisPoints = [6000, 3000, 1000];
      const roles = ['artist', 'producer', 'platform'];

      const mockContract = {
        configureRoyaltySplit: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({ status: 1 }),
        }),
      };

      vi.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);

      await sdk.configurePayPerStream(songId, recipients, basisPoints, roles);

      expect(mockContract.configureRoyaltySplit).toHaveBeenCalledWith(
        songId,
        recipients,
        basisPoints,
        roles
      );
    });

    it('should get splits preview', async () => {
      const amount = ethers.parseEther('1');

      const mockContract = {
        calculateSplits: vi.fn().mockResolvedValue([
          {
            recipient: artistAddress,
            basisPoints: 10000,
            role: 'artist',
          },
        ]),
      };

      vi.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);

      const splits = await sdk.previewSplits(songId, amount);

      expect(splits).toHaveLength(1);
      expect(splits[0].recipient).toBe(artistAddress);
      expect(splits[0].basisPoints).toBe(10000);
    });
  });

  describe('Gift Economy Strategy', () => {
    const songId = '0x' + '2'.repeat(64);

    it('should configure gift economy correctly', async () => {
      const cgcPerListen = ethers.parseEther('1');
      const earlyBonus = ethers.parseEther('5');
      const threshold = 100;
      const multiplier = 15000; // 1.5x

      const mockContract = {
        configureGiftEconomy: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({ status: 1 }),
        }),
      };

      vi.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);

      await sdk.configureGiftEconomy(
        songId,
        artistAddress,
        cgcPerListen,
        earlyBonus,
        threshold,
        multiplier
      );

      expect(mockContract.configureGiftEconomy).toHaveBeenCalledWith(
        songId,
        artistAddress,
        cgcPerListen,
        earlyBonus,
        threshold,
        multiplier
      );
    });

    it('should reject invalid multiplier', async () => {
      const cgcPerListen = ethers.parseEther('1');
      const earlyBonus = ethers.parseEther('5');
      const threshold = 100;
      const multiplier = 9000; // Invalid, must be >= 10000

      await expect(
        sdk.configureGiftEconomy(
          songId,
          artistAddress,
          cgcPerListen,
          earlyBonus,
          threshold,
          multiplier
        )
      ).rejects.toThrow('Multiplier must be >= 10000');
    });

    it('should get listener profile', async () => {
      const mockContract = {
        getListenerProfile: vi.fn().mockResolvedValue([
          10, // totalStreams
          Math.floor(Date.now() / 1000), // lastStreamTime
          ethers.parseEther('15'), // cgcBalance
          true, // isEarly
        ]),
      };

      vi.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);

      const profile = await sdk.getListenerProfile(songId, listenerAddress);

      expect(profile.totalStreams).toBe(10);
      expect(profile.cgcBalance).toBe(ethers.parseEther('15'));
      expect(profile.isEarly).toBe(true);
    });

    it('should handle zero CGC configuration', async () => {
      const cgcPerListen = ethers.parseEther('0');
      const earlyBonus = ethers.parseEther('100');
      const threshold = 50;
      const multiplier = 10000;

      const mockContract = {
        configureGiftEconomy: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({ status: 1 }),
        }),
      };

      vi.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);

      await sdk.configureGiftEconomy(
        songId,
        artistAddress,
        cgcPerListen,
        earlyBonus,
        threshold,
        multiplier
      );

      expect(mockContract.configureGiftEconomy).toHaveBeenCalled();
    });
  });

  describe('Song Processing', () => {
    const songId = '0x' + '3'.repeat(64);

    it('should process stream payment', async () => {
      const amount = ethers.parseEther('0.01');

      const mockRouterContract = {
        processPayment: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({
            status: 1,
            gasUsed: BigInt(125000),
          }),
        }),
      };

      const mockTokenContract = {
        approve: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({ status: 1 }),
        }),
      };

      vi.spyOn(ethers, 'Contract')
        .mockReturnValueOnce(mockRouterContract as any)
        .mockReturnValueOnce(mockTokenContract as any);

      const result = await sdk.playSong(songId, amount);

      expect(result.txHash).toBeDefined();
      expect(result.gasUsed).toBe(BigInt(125000));
      expect(mockTokenContract.approve).toHaveBeenCalled();
      expect(mockRouterContract.processPayment).toHaveBeenCalled();
    });

    it('should process tip', async () => {
      const amount = ethers.parseEther('5');

      const mockRouterContract = {
        processPayment: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({
            status: 1,
            gasUsed: BigInt(150000),
          }),
        }),
      };

      const mockTokenContract = {
        approve: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({ status: 1 }),
        }),
      };

      vi.spyOn(ethers, 'Contract')
        .mockReturnValueOnce(mockRouterContract as any)
        .mockReturnValueOnce(mockTokenContract as any);

      const result = await sdk.tipArtist(songId, amount);

      expect(result.txHash).toBeDefined();
      expect(mockRouterContract.processPayment).toHaveBeenCalledWith(
        songId,
        amount,
        expect.any(Number) // PaymentType.TIP
      );
    });

    it('should reject zero payment', async () => {
      await expect(
        sdk.playSong(songId, ethers.parseEther('0'))
      ).rejects.toThrow('Amount must be greater than 0');
    });

    it('should handle insufficient balance', async () => {
      const amount = ethers.parseEther('1000000');

      const mockTokenContract = {
        balanceOf: vi.fn().mockResolvedValue(ethers.parseEther('1')),
      };

      vi.spyOn(ethers, 'Contract').mockReturnValue(mockTokenContract as any);

      await expect(sdk.playSong(songId, amount)).rejects.toThrow(
        'Insufficient balance'
      );
    });
  });

  describe('Song Registration', () => {
    it('should register song with pay-per-stream', async () => {
      const songId = '0x' + '4'.repeat(64);
      const strategyId = '0x' + '5'.repeat(64);

      const mockContract = {
        registerSong: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({ status: 1 }),
        }),
      };

      vi.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);

      await sdk.registerSong(songId, strategyId, artistAddress);

      expect(mockContract.registerSong).toHaveBeenCalledWith(
        songId,
        strategyId,
        artistAddress
      );
    });

    it('should reject registration with zero address', async () => {
      const songId = '0x' + '4'.repeat(64);
      const strategyId = '0x' + '5'.repeat(64);

      await expect(
        sdk.registerSong(songId, strategyId, ethers.ZeroAddress)
      ).rejects.toThrow('Artist address cannot be zero');
    });

    it('should reject invalid song ID', async () => {
      const invalidSongId = 'not-a-valid-bytes32';
      const strategyId = '0x' + '5'.repeat(64);

      await expect(
        sdk.registerSong(invalidSongId, strategyId, artistAddress)
      ).rejects.toThrow('Invalid song ID format');
    });
  });

  describe('Error Handling', () => {
    it('should handle contract revert', async () => {
      const songId = '0x' + '6'.repeat(64);

      const mockContract = {
        calculateSplits: vi.fn().mockRejectedValue(
          new Error('Royalty split not configured')
        ),
      };

      vi.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);

      await expect(
        sdk.previewSplits(songId, ethers.parseEther('1'))
      ).rejects.toThrow('Royalty split not configured');
    });

    it('should handle network errors', async () => {
      const songId = '0x' + '7'.repeat(64);

      const mockContract = {
        calculateSplits: vi.fn().mockRejectedValue(
          new Error('Network error')
        ),
      };

      vi.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);

      await expect(
        sdk.previewSplits(songId, ethers.parseEther('1'))
      ).rejects.toThrow('Network error');
    });

    it('should handle gas estimation failures', async () => {
      const songId = '0x' + '8'.repeat(64);
      const amount = ethers.parseEther('0.01');

      const mockContract = {
        processPayment: {
          estimateGas: vi.fn().mockRejectedValue(
            new Error('Gas estimation failed')
          ),
        },
      };

      vi.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);

      await expect(sdk.playSong(songId, amount)).rejects.toThrow(
        'Gas estimation failed'
      );
    });
  });

  describe('Integration Tests', () => {
    it('should complete full artist upload flow', async () => {
      const songId = '0x' + '9'.repeat(64);
      const strategyId = ethers.keccak256(ethers.toUtf8Bytes('pay-per-stream-v1'));

      const mockRouterContract = {
        registerSong: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({ status: 1 }),
        }),
      };

      const mockStrategyContract = {
        configureRoyaltySplit: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({ status: 1 }),
        }),
      };

      vi.spyOn(ethers, 'Contract')
        .mockReturnValueOnce(mockRouterContract as any)
        .mockReturnValueOnce(mockStrategyContract as any);

      // Register song
      await sdk.registerSong(songId, strategyId, artistAddress);

      // Configure splits
      await sdk.configurePayPerStream(
        songId,
        [artistAddress],
        [10000],
        ['artist']
      );

      expect(mockRouterContract.registerSong).toHaveBeenCalled();
      expect(mockStrategyContract.configureRoyaltySplit).toHaveBeenCalled();
    });

    it('should complete full listener playback flow', async () => {
      const songId = '0x' + 'a'.repeat(64);
      const amount = ethers.parseEther('0.01');

      const mockTokenContract = {
        approve: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({ status: 1 }),
        }),
        balanceOf: vi.fn().mockResolvedValue(ethers.parseEther('100')),
      };

      const mockRouterContract = {
        processPayment: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({
            status: 1,
            gasUsed: BigInt(125000),
            transactionHash: '0x' + 'b'.repeat(64),
          }),
        }),
      };

      vi.spyOn(ethers, 'Contract')
        .mockReturnValueOnce(mockTokenContract as any)
        .mockReturnValueOnce(mockRouterContract as any);

      const result = await sdk.playSong(songId, amount);

      expect(result.txHash).toBeDefined();
      expect(result.gasUsed).toBe(BigInt(125000));
      expect(mockTokenContract.approve).toHaveBeenCalled();
      expect(mockRouterContract.processPayment).toHaveBeenCalled();
    });
  });
});
