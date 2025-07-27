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

  // NEW: Unstake LP tokens
  async unstakeLPTokens(lpAmount: bigint): Promise<string> {
    if (!this.gaugeContract) {
      throw new Error("Gauge service not initialized");
    }

    try {
      logger.info(`🔓 Unstaking ${ethers.formatEther(lpAmount)} LP tokens...`);

      const tx = await this.gaugeContract.withdraw(lpAmount);
      const receipt = await tx.wait();

      logger.info(`✅ LP tokens unstaked successfully: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      logger.error("❌ LP token unstaking failed:", error);
      throw error;
    }
  }

  async getStakedBalance(): Promise<bigint> {
    if (!this.gaugeContract) {
      throw new Error("Gauge service not initialized");
    }

    try {
      const address = this.walletService.getAgentWallet().address;
      return await this.gaugeContract.balanceOf(address);
    } catch (error) {
      logger.error("Failed to get staked balance:", error);
      return 0n;
    }
  }

  getGaugeAddress(): string {
    return CONTRACTS.WETH_VIRTUAL_GAUGE;
  }
}
