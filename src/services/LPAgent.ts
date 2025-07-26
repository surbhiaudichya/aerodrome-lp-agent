import { ethers } from "ethers";
import { WalletService } from "./WalletService";
import { TokenService } from "./TokenService";
import { AerodromeService } from "./AerodromeService";
import { GaugeService } from "./GaugeService";
import { CONTRACTS } from "../config/contracts";
import { DepositParams, DepositResult, PositionReceipt, SwapRoute } from "../types";
import { parseUnits, formatUnits, sleep } from "../utils/helpers";
import { logger } from "../utils/logger";

export class LPAgent {
  private walletService: WalletService;
  private tokenService: TokenService;
  private aerodromeService: AerodromeService;
  private gaugeService: GaugeService;

  constructor(walletService: WalletService) {
    this.walletService = walletService;
    this.tokenService = new TokenService(walletService);
    this.aerodromeService = new AerodromeService(walletService);
    this.gaugeService = new GaugeService(walletService);
  }

  async initialize(): Promise<void> {
    logger.info("🔄 Initializing LP Agent...");

    await this.aerodromeService.initialize();
    await this.gaugeService.initialize(this.aerodromeService.getPoolAddress());
    await this.walletService.ensureGasBalance("0.01");

    logger.info("✅ LP Agent initialized successfully");
  }

  async executeFullDeposit(params: DepositParams): Promise<DepositResult> {
    const { userAddress, usdcAmount, slippageTolerance = 0.5 } = params;

    logger.info(`🚀 Executing FULL deposit: ${usdcAmount} USDC from ${userAddress}`);

    const txHashes: string[] = [];

    try {
      const usdcAmountBigInt = parseUnits(usdcAmount, 6);
      const halfUsdc = usdcAmountBigInt / 2n;

      // Step 1: Transfer USDC from user to agent
      logger.info("💰 Step 1: Transferring USDC from user to agent...");
      const transferTx = await this.tokenService.transferFrom(
        CONTRACTS.USDC,
        userAddress,
        this.walletService.getAgentWallet().address,
        usdcAmountBigInt,
      );
      txHashes.push(transferTx);

      // Step 2: Approve USDC for router
      logger.info("🔓 Step 2: Approving USDC for Aerodrome router...");
      const approveTx = await this.tokenService.approve(CONTRACTS.USDC, CONTRACTS.AERODROME_ROUTER, usdcAmountBigInt);
      if (approveTx !== "no-tx-needed") {
        txHashes.push(approveTx);
      }

      // Step 3: Swap 50% USDC → WETH
      logger.info("🔄 Step 3: Swapping USDC → WETH...");
      const usdcToWethRoute: SwapRoute[] = [
        {
          from: CONTRACTS.USDC,
          to: CONTRACTS.WETH,
          stable: false,
          factory: CONTRACTS.AERODROME_FACTORY,
        },
      ];

      const swapWethTx = await this.aerodromeService.swapTokens(
        halfUsdc,
        usdcToWethRoute,
        this.walletService.getAgentWallet().address,
        slippageTolerance,
      );
      txHashes.push(swapWethTx);

      // Step 4: Swap 50% USDC → VIRTUAL
      logger.info("🔄 Step 4: Swapping USDC → VIRTUAL...");
      const usdcToVirtualRoute: SwapRoute[] = [
        {
          from: CONTRACTS.USDC,
          to: CONTRACTS.VIRTUAL,
          stable: false,
          factory: CONTRACTS.AERODROME_FACTORY,
        },
      ];

      const swapVirtualTx = await this.aerodromeService.swapTokens(
        halfUsdc,
        usdcToVirtualRoute,
        this.walletService.getAgentWallet().address,
        slippageTolerance,
      );
      txHashes.push(swapVirtualTx);

      // Get balances after swaps
      await sleep(1000); // Wait for transactions to settle

      const wethBalance = await this.getTokenBalance(CONTRACTS.WETH);
      const virtualBalance = await this.getTokenBalance(CONTRACTS.VIRTUAL);

      logger.info(
        `Balances after swaps: ${formatUnits(wethBalance, 18)} WETH, ${formatUnits(virtualBalance, 18)} VIRTUAL`,
      );

      // Step 5: Approve tokens for liquidity addition
      logger.info("🔓 Step 5a: Approving WETH for router...");
      await this.tokenService.approve(CONTRACTS.WETH, CONTRACTS.AERODROME_ROUTER, wethBalance);

      logger.info("🔓 Step 5b: Approving VIRTUAL for router...");
      await this.tokenService.approve(CONTRACTS.VIRTUAL, CONTRACTS.AERODROME_ROUTER, virtualBalance);

      // Step 6: Add liquidity
      logger.info("🏊 Step 6: Adding liquidity to WETH-VIRTUAL pool...");
      const { txHash: liquidityTx, liquidity } = await this.aerodromeService.addLiquidity(
        CONTRACTS.WETH,
        CONTRACTS.VIRTUAL,
        wethBalance,
        virtualBalance,
        this.walletService.getAgentWallet().address,
        slippageTolerance,
      );
      txHashes.push(liquidityTx);

      // Step 7: Approve LP tokens for gauge
      logger.info("🔓 Step 7: Approving LP tokens for gauge...");
      const lpApprovalTx = await this.tokenService.approve(
        this.aerodromeService.getPoolAddress(),
        this.gaugeService.getGaugeAddress(),
        liquidity,
      );
      if (lpApprovalTx !== "no-tx-needed") {
        txHashes.push(lpApprovalTx);
      }

      // Step 8: Stake LP tokens in gauge
      logger.info("🥩 Step 8: Staking LP tokens in Aerodrome gauge...");
      const stakingTx = await this.gaugeService.stakeLPTokens(liquidity);
      txHashes.push(stakingTx);

      const stakedLPAmount = formatUnits(liquidity, 18);

      logger.info(`✅ Full deposit completed successfully!`);
      logger.info(`Staked LP amount: ${stakedLPAmount}`);

      return {
        success: true,
        txHashes,
        stakedLPAmount,
      };
    } catch (error) {
      logger.error("❌ Full deposit execution failed:", error);

      return {
        success: false,
        txHashes,
        stakedLPAmount: "0",
        error: String(error),
      };
    }
  }

  async generatePositionReceipt(userAddress: string): Promise<PositionReceipt> {
    try {
      const stakedLPWei = await this.gaugeService.getStakedBalance();
      const stakedLPAmount = formatUnits(stakedLPWei, 18);

      return {
        userAddress,
        agentAddress: this.walletService.getAgentWallet().address,
        poolAddress: this.aerodromeService.getPoolAddress(),
        gaugeAddress: this.gaugeService.getGaugeAddress(),
        stakedLPAmount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to generate position receipt:", error);
      throw error;
    }
  }

  private async getTokenBalance(tokenAddress: string): Promise<bigint> {
    const contract = new ethers.Contract(
      tokenAddress,
      ["function balanceOf(address owner) view returns (uint256)"],
      this.walletService.getProvider(),
    );

    await sleep(200); // Rate limit protection
    return await contract.balanceOf(this.walletService.getAgentWallet().address);
  }
}
