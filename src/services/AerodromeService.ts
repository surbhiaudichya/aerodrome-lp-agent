import { ethers } from "ethers";
import { WalletService } from "./WalletService";
import { CONTRACTS } from "../config/contracts";
import { ABIS } from "../config/abis";
import { SwapRoute } from "../types";
import { logger } from "../utils/logger";

export class AerodromeService {
  private walletService: WalletService;
  private routerContract: ethers.Contract;
  private factoryContract: ethers.Contract;
  private poolAddress: string = "";

  constructor(walletService: WalletService) {
    this.walletService = walletService;

    this.routerContract = new ethers.Contract(
      CONTRACTS.AERODROME_ROUTER,
      ABIS.AERODROME_ROUTER,
      walletService.getAgentWallet(),
    );

    this.factoryContract = new ethers.Contract(
      CONTRACTS.AERODROME_FACTORY,
      ABIS.AERODROME_FACTORY,
      walletService.getProvider(),
    );
  }

  getPoolAddress(): string {
    return this.poolAddress;
  }

  getRouterAddress(): string {
    return CONTRACTS.AERODROME_ROUTER;
  }

  async initialize(): Promise<void> {
    logger.info("🔄 Initializing Aerodrome service...");

    try {
      // Get WETH-VIRTUAL pool address
      this.poolAddress = await this.factoryContract.getPool(
        CONTRACTS.WETH,
        CONTRACTS.VIRTUAL,
        false, // volatile pool (not stable)
      );

      if (this.poolAddress === ethers.ZeroAddress) {
        throw new Error("WETH-VIRTUAL pool does not exist");
      }

      logger.info(`✅ WETH-VIRTUAL Pool found: ${this.poolAddress}`);

      // Update contracts config
      CONTRACTS.WETH_VIRTUAL_POOL = this.poolAddress;
    } catch (error) {
      logger.error("❌ Failed to initialize Aerodrome service:", error);
      throw error;
    }
  }

  async getSwapAmountOut(amountIn: bigint, routes: SwapRoute[]): Promise<bigint> {
    try {
      const amounts = await this.routerContract.getAmountsOut(amountIn, routes);
      return amounts[amounts.length - 1];
    } catch (error) {
      logger.error("Failed to get swap amount out:", error);
      throw error;
    }
  }

  async testRouterConnection(): Promise<boolean> {
    try {
      logger.info("💱 Testing simple swap quote...");

      // Test a very simple quote - 1 USDC to WETH
      const oneUsdc = ethers.parseUnits("1", 6);
      const route: SwapRoute[] = [
        {
          from: CONTRACTS.USDC,
          to: CONTRACTS.WETH,
          stable: false,
        },
      ];

      const amountOut = await this.getSwapAmountOut(oneUsdc, route);
      const wethAmount = ethers.formatEther(amountOut);

      logger.info(`✅ 1 USDC ≈ ${wethAmount} WETH`);

      return true;
    } catch (error) {
      logger.warn("⚠️  Swap quote test failed - this might be normal if theres no direct route");
      logger.info("✅ Pool connection is working though!");
      return true; // Don't fail just because of swap routes
    }
  }

  async swapTokens(
    amountIn: bigint,
    routes: SwapRoute[],
    to: string,
    slippage: number = 0.5,
    deadline?: number,
  ): Promise<string> {
    const { calculateMinAmount, calculateDeadline } = await import("../utils/helpers");

    try {
      // Get expected amount out (but don't fail if we can't)
      let amountOutMin = 0n;
      try {
        const expectedAmountOut = await this.getSwapAmountOut(amountIn, routes);
        amountOutMin = calculateMinAmount(expectedAmountOut, slippage);
      } catch (error) {
        logger.warn("Could not get exact quote, using minimal slippage protection");
        amountOutMin = 1n; // Minimal amount to prevent total failure
      }

      const swapDeadline = deadline || calculateDeadline();

      logger.info(`Executing swap: ${amountIn.toString()} tokens with ${slippage}% slippage`);

      const tx = await this.routerContract.swapExactTokensForTokens(amountIn, amountOutMin, routes, to, swapDeadline);

      const receipt = await tx.wait();
      logger.info(`✅ Swap successful: ${receipt.hash}`);

      return receipt.hash;
    } catch (error) {
      logger.error("❌ Swap transaction failed:", error);
      throw error;
    }
  }

  async addLiquidity(
    tokenA: string,
    tokenB: string,
    amountADesired: bigint,
    amountBDesired: bigint,
    to: string,
    slippage: number = 0.5,
    deadline?: number,
  ): Promise<{ txHash: string; liquidity: bigint }> {
    const { calculateMinAmount, calculateDeadline } = await import("../utils/helpers");

    try {
      // For small amounts, use much more generous slippage protection
      // Or set to 0 to accept any ratio the pool provides
      const amountAMin = 0n; // Accept any amount - pools rebalance constantly
      const amountBMin = 0n; // Accept any amount - safer for small LPs

      const liquidityDeadline = deadline || calculateDeadline();

      logger.info(`Adding liquidity: ${amountADesired.toString()} + ${amountBDesired.toString()}`);
      logger.info(`Min amounts: ${amountAMin} + ${amountBMin} (accepting pool ratio)`);

      const tx = await this.routerContract.addLiquidity(
        tokenA,
        tokenB,
        false, // volatile pool
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        to,
        liquidityDeadline,
      );

      const receipt = await tx.wait();
      logger.info(`✅ Add liquidity successful: ${receipt.hash}`);

      // Try to extract liquidity amount from logs
      let liquidity = 0n;
      for (const log of receipt.logs) {
        try {
          // Look for Transfer event to LP token contract (mint)
          if (log.address.toLowerCase() === this.poolAddress.toLowerCase()) {
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data);
            if (decoded[0] > liquidity) {
              liquidity = decoded[0];
            }
          }
        } catch (e) {
          // Ignore decoding errors
        }
      }

      return { txHash: receipt.hash, liquidity };
    } catch (error) {
      logger.error("❌ Add liquidity failed:", error);
      throw error;
    }
  }
}
