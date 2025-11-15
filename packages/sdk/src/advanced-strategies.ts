/**
 * Advanced Economic Strategies SDK Extension
 * Provides TypeScript interfaces for Patronage and Auction strategies
 */

import { ethers } from 'ethers';
import type { Signer } from 'ethers';

// ============================================================================
// Patronage Strategy
// ============================================================================

export interface PatronageConfig {
  songId: string;
  artist: string;
  monthlyFee: string;  // In FLOW tokens (e.g., "10.0")
  minimumDuration: number;  // In seconds
  allowCancellation: boolean;
  tierBonuses: number[];  // Bonus percentages for each tier
}

export interface Subscription {
  monthlyFee: string;
  startTime: number;
  lastPayment: number;
  active: boolean;
}

export interface PatronStats {
  subscriptionTier: number;
  totalPaid: string;
  durationDays: number;
  active: boolean;
}

export class PatronageStrategy {
  private contract: ethers.Contract;
  private signer: Signer;

  constructor(contractAddress: string, signer: Signer) {
    this.signer = signer;

    const abi = [
      'function configurePatronage(string calldata songId, address artist, uint256 monthlyFee, uint256 minimumDuration, bool allowCancellation, uint256[] calldata tierBonuses)',
      'function subscribe(address artist, uint256 monthlyFee)',
      'function renewSubscription(address artist)',
      'function cancelSubscription(address artist, string calldata songId)',
      'function hasActiveSubscription(address patron, address artist) view returns (bool)',
      'function getSubscriptionTier(address patron, address artist) view returns (uint256)',
      'function subscriptions(address patron, address artist) view returns (uint256 monthlyFee, uint256 startTime, uint256 lastPayment, bool active)',
      'function getPatronStats(address patron, address artist) view returns (uint256 tier, uint256 totalPaid, uint256 durationDays, bool active)',
      'function getArtistStats(address artist) view returns (uint256 activePatrons, uint256 totalRevenue, uint256 monthlyRecurring)',
    ];

    this.contract = new ethers.Contract(contractAddress, abi, signer);
  }

  /**
   * Configure patronage settings for a song
   */
  async configurePatronage(config: PatronageConfig): Promise<ethers.ContractTransaction> {
    const monthlyFee = ethers.utils.parseEther(config.monthlyFee);

    return await this.contract.configurePatronage(
      config.songId,
      config.artist,
      monthlyFee,
      config.minimumDuration,
      config.allowCancellation,
      config.tierBonuses
    );
  }

  /**
   * Subscribe to an artist's catalog
   */
  async subscribe(artist: string, monthlyFee: string): Promise<ethers.ContractTransaction> {
    const fee = ethers.utils.parseEther(monthlyFee);
    return await this.contract.subscribe(artist, fee);
  }

  /**
   * Renew subscription (pay for next month)
   */
  async renewSubscription(artist: string): Promise<ethers.ContractTransaction> {
    return await this.contract.renewSubscription(artist);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    artist: string,
    songId: string
  ): Promise<ethers.ContractTransaction> {
    return await this.contract.cancelSubscription(artist, songId);
  }

  /**
   * Check if patron has active subscription
   */
  async hasActiveSubscription(patron: string, artist: string): Promise<boolean> {
    return await this.contract.hasActiveSubscription(patron, artist);
  }

  /**
   * Get subscription tier (1-4 based on duration)
   */
  async getSubscriptionTier(patron: string, artist: string): Promise<number> {
    return await this.contract.getSubscriptionTier(patron, artist);
  }

  /**
   * Get subscription details
   */
  async getSubscription(patron: string, artist: string): Promise<Subscription> {
    const [monthlyFee, startTime, lastPayment, active] = await this.contract.subscriptions(
      patron,
      artist
    );

    return {
      monthlyFee: ethers.utils.formatEther(monthlyFee),
      startTime: startTime.toNumber(),
      lastPayment: lastPayment.toNumber(),
      active,
    };
  }

  /**
   * Get patron statistics
   */
  async getPatronStats(patron: string, artist: string): Promise<PatronStats> {
    const [tier, totalPaid, durationDays, active] = await this.contract.getPatronStats(
      patron,
      artist
    );

    return {
      subscriptionTier: tier.toNumber(),
      totalPaid: ethers.utils.formatEther(totalPaid),
      durationDays: durationDays.toNumber(),
      active,
    };
  }

  /**
   * Get artist statistics
   */
  async getArtistStats(artist: string): Promise<{
    activePatrons: number;
    totalRevenue: string;
    monthlyRecurring: string;
  }> {
    const [activePatrons, totalRevenue, monthlyRecurring] =
      await this.contract.getArtistStats(artist);

    return {
      activePatrons: activePatrons.toNumber(),
      totalRevenue: ethers.utils.formatEther(totalRevenue),
      monthlyRecurring: ethers.utils.formatEther(monthlyRecurring),
    };
  }
}

// ============================================================================
// Auction Strategy
// ============================================================================

export enum AuctionType {
  DUTCH = 0,
  ENGLISH = 1,
  SEALED_BID = 2,
}

export interface DutchAuctionConfig {
  songId: string;
  artist: string;
  startPrice: string;  // In FLOW tokens
  endPrice: string;    // Reserve price
  duration: number;    // In seconds
  totalSupply: number;
  priceDecrement: string;
}

export interface AuctionInfo {
  artist: string;
  startPrice: string;
  endPrice: string;
  startTime: number;
  endTime: number;
  totalSupply: number;
  sold: number;
  auctionType: AuctionType;
  active: boolean;
}

export interface AuctionStats {
  currentPrice: string;
  sold: number;
  remaining: number;
  totalRevenue: string;
  avgPrice: string;
  active: boolean;
}

export interface Purchase {
  buyer: string;
  pricePaid: string;
  timestamp: number;
  accessExpiry: number;
}

export class AuctionStrategySDK {
  private contract: ethers.Contract;
  private signer: Signer;

  constructor(contractAddress: string, signer: Signer) {
    this.signer = signer;

    const abi = [
      'function createDutchAuction(string calldata songId, address artist, uint256 startPrice, uint256 endPrice, uint256 duration, uint256 totalSupply, uint256 priceDecrement)',
      'function getCurrentPrice(string calldata songId) view returns (uint256)',
      'function purchaseAccess(string calldata songId, uint256 maxPrice) returns (uint256 pricePaid)',
      'function endAuction(string calldata songId)',
      'function hasAccess(string calldata songId, address buyer) view returns (bool)',
      'function getAuctionStats(string calldata songId) view returns (uint256 currentPrice, uint256 sold, uint256 remaining, uint256 totalRevenue, uint256 avgPrice, bool active)',
      'function getPurchaseHistory(string calldata songId, uint256 offset, uint256 limit) view returns (tuple(address buyer, uint256 pricePaid, uint256 timestamp, uint256 accessExpiry)[])',
      'function auctions(string calldata songId) view returns (address artist, uint256 startPrice, uint256 endPrice, uint256 startTime, uint256 endTime, uint256 totalSupply, uint256 sold, uint8 auctionType, bool active, uint256 priceDecrement)',
    ];

    this.contract = new ethers.Contract(contractAddress, abi, signer);
  }

  /**
   * Create a Dutch auction
   */
  async createDutchAuction(
    config: DutchAuctionConfig
  ): Promise<ethers.ContractTransaction> {
    const startPrice = ethers.utils.parseEther(config.startPrice);
    const endPrice = ethers.utils.parseEther(config.endPrice);
    const priceDecrement = ethers.utils.parseEther(config.priceDecrement);

    return await this.contract.createDutchAuction(
      config.songId,
      config.artist,
      startPrice,
      endPrice,
      config.duration,
      config.totalSupply,
      priceDecrement
    );
  }

  /**
   * Get current auction price
   */
  async getCurrentPrice(songId: string): Promise<string> {
    const price = await this.contract.getCurrentPrice(songId);
    return ethers.utils.formatEther(price);
  }

  /**
   * Purchase access to auctioned song
   */
  async purchaseAccess(
    songId: string,
    maxPrice: string
  ): Promise<ethers.ContractTransaction> {
    const maxPriceWei = ethers.utils.parseEther(maxPrice);
    return await this.contract.purchaseAccess(songId, maxPriceWei);
  }

  /**
   * End auction (artist only)
   */
  async endAuction(songId: string): Promise<ethers.ContractTransaction> {
    return await this.contract.endAuction(songId);
  }

  /**
   * Check if buyer has access
   */
  async hasAccess(songId: string, buyer: string): Promise<boolean> {
    return await this.contract.hasAccess(songId, buyer);
  }

  /**
   * Get auction statistics
   */
  async getAuctionStats(songId: string): Promise<AuctionStats> {
    const [currentPrice, sold, remaining, totalRevenue, avgPrice, active] =
      await this.contract.getAuctionStats(songId);

    return {
      currentPrice: ethers.utils.formatEther(currentPrice),
      sold: sold.toNumber(),
      remaining: remaining.toNumber(),
      totalRevenue: ethers.utils.formatEther(totalRevenue),
      avgPrice: ethers.utils.formatEther(avgPrice),
      active,
    };
  }

  /**
   * Get auction information
   */
  async getAuctionInfo(songId: string): Promise<AuctionInfo> {
    const [
      artist,
      startPrice,
      endPrice,
      startTime,
      endTime,
      totalSupply,
      sold,
      auctionType,
      active,
    ] = await this.contract.auctions(songId);

    return {
      artist,
      startPrice: ethers.utils.formatEther(startPrice),
      endPrice: ethers.utils.formatEther(endPrice),
      startTime: startTime.toNumber(),
      endTime: endTime.toNumber(),
      totalSupply: totalSupply.toNumber(),
      sold: sold.toNumber(),
      auctionType,
      active,
    };
  }

  /**
   * Get purchase history
   */
  async getPurchaseHistory(
    songId: string,
    offset: number = 0,
    limit: number = 100
  ): Promise<Purchase[]> {
    const purchases = await this.contract.getPurchaseHistory(songId, offset, limit);

    return purchases.map((p: any) => ({
      buyer: p.buyer,
      pricePaid: ethers.utils.formatEther(p.pricePaid),
      timestamp: p.timestamp.toNumber(),
      accessExpiry: p.accessExpiry.toNumber(),
    }));
  }

  /**
   * Calculate time until auction ends
   */
  async getTimeRemaining(songId: string): Promise<number> {
    const info = await this.getAuctionInfo(songId);
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, info.endTime - now);
  }

  /**
   * Calculate price at specific time
   */
  async calculatePriceAtTime(songId: string, timestamp: number): Promise<string> {
    const info = await this.getAuctionInfo(songId);

    if (timestamp >= info.endTime) {
      return info.endPrice;
    }

    const elapsed = timestamp - info.startTime;
    const duration = info.endTime - info.startTime;
    const priceRange =
      parseFloat(info.startPrice) - parseFloat(info.endPrice);
    const priceDecrease = (priceRange * elapsed) / duration;

    return (parseFloat(info.startPrice) - priceDecrease).toFixed(18);
  }
}

// ============================================================================
// Preset Configurations
// ============================================================================

export const PatronagePresets = {
  /**
   * Basic monthly subscription - $10/month, cancel anytime
   */
  basic: (songId: string, artist: string): PatronageConfig => ({
    songId,
    artist,
    monthlyFee: '10.0',
    minimumDuration: 0,
    allowCancellation: true,
    tierBonuses: [0, 500, 1000, 2000],  // 0%, 5%, 10%, 20%
  }),

  /**
   * Premium subscription - $20/month, 3 month minimum
   */
  premium: (songId: string, artist: string): PatronageConfig => ({
    songId,
    artist,
    monthlyFee: '20.0',
    minimumDuration: 7776000,  // 90 days
    allowCancellation: false,
    tierBonuses: [0, 1000, 2000, 5000],  // 0%, 10%, 20%, 50%
  }),

  /**
   * Supporter tier - $5/month, flexible
   */
  supporter: (songId: string, artist: string): PatronageConfig => ({
    songId,
    artist,
    monthlyFee: '5.0',
    minimumDuration: 0,
    allowCancellation: true,
    tierBonuses: [0, 200, 500, 1000],  // 0%, 2%, 5%, 10%
  }),
};

export const AuctionPresets = {
  /**
   * 7-day Dutch auction for exclusive release
   */
  weekLongExclusive: (songId: string, artist: string): DutchAuctionConfig => ({
    songId,
    artist,
    startPrice: '100.0',
    endPrice: '10.0',
    duration: 604800,  // 7 days
    totalSupply: 100,
    priceDecrement: '0',
  }),

  /**
   * 24-hour flash auction
   */
  flashAuction: (songId: string, artist: string): DutchAuctionConfig => ({
    songId,
    artist,
    startPrice: '50.0',
    endPrice: '5.0',
    duration: 86400,  // 24 hours
    totalSupply: 50,
    priceDecrement: '0',
  }),

  /**
   * Limited edition - high price, few copies
   */
  limitedEdition: (songId: string, artist: string): DutchAuctionConfig => ({
    songId,
    artist,
    startPrice: '500.0',
    endPrice: '100.0',
    duration: 259200,  // 3 days
    totalSupply: 10,
    priceDecrement: '0',
  }),
};
