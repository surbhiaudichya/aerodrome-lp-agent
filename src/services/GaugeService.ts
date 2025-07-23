import { ethers } from "ethers";
import { WalletService } from "./WalletService";
import { CONTRACTS } from "../config/contracts";
import { ABIS } from "../config/abis";
import { logger } from "../utils/logger";

export class GaugeService {
  private walletService: WalletService;
  private gaugeContract: ethers.Contract | null = null;
  private voterContract: ethers.Contract;

  constructor(walletService: WalletService) {
    this.walletService = walletService;

    this.voterContract = new ethers.Contract(
      CONTRACTS.AERODROME_VOTER,
      ABIS.AERODROME_VOTER,
      walletService.getProvider(),
    );
  }

  async initialize(poolAddress: string): Promise<void> {
    logger.info("🔄 Initializing Gauge service...");

    try {
      // Get gauge address for the pool
      const gaugeAddress = await this.voterContract.gauges(poolAddress);

      if (gaugeAddress === ethers.ZeroAddress) {
        throw new Error("No gauge found for this pool");
      }

      logger.info(`✅ Gauge found: ${gaugeAddress}`);

      // Update contracts config
      CONTRACTS.WETH_VIRTUAL_GAUGE = gaugeAddress;

      // Initialize gauge contract
      this.gaugeContract = new ethers.Contract(gaugeAddress, ABIS.AERODROME_GAUGE, this.walletService.getAgentWallet());

      logger.info("✅ Gauge service initialized successfully");
    } catch (error) {
      logger.error("❌ Failed to initialize Gauge service:", error);
      throw error;
    }
  }

  async stakeLPTokens(lpAmount: bigint): Promise<string> {
    if (!this.gaugeContract) {
      throw new Error("Gauge service not initialized");
    }

    try {
      logger.info(`🥩 Staking ${ethers.formatEther(lpAmount)} LP tokens...`);

      const tx = await this.gaugeContract.deposit(lpAmount);
      const receipt = await tx.wait();

      logger.info(`✅ LP tokens staked successfully: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      logger.error("❌ LP token staking failed:", error);
      throw error;
    }
  }

  async getStakedBalance(account?: string): Promise<bigint> {
    if (!this.gaugeContract) {
      throw new Error("Gauge service not initialized");
    }

    try {
      // Add delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));

      const address = account || this.walletService.getAgentWallet().address;
      return await this.gaugeContract.balanceOf(address);
    } catch (error: any) {
      if (error?.info?.error?.message?.includes("rate limit")) {
        logger.warn("Rate limit hit for staked balance, returning 0");
        return 0n;
      }
      throw error;
    }
  }

  getGaugeAddress(): string {
    return CONTRACTS.WETH_VIRTUAL_GAUGE;
  }

  async testGaugeConnection(): Promise<boolean> {
    try {
      if (!this.gaugeContract) {
        logger.warn("Gauge not initialized");
        return false;
      }

      const totalSupply = await this.gaugeContract.totalSupply();
      logger.info(`✅ Gauge total supply: ${ethers.formatEther(totalSupply)} LP tokens`);

      return true;
    } catch (error) {
      logger.error("❌ Gauge connection test failed:", error);
      return false;
    }
  }
}
