import { ethers } from "ethers";
import { WalletService } from "./WalletService";
import { TokenService } from "./TokenService";
import { AerodromeService } from "./AerodromeService";
import { GaugeService } from "./GaugeService";
import { CONTRACTS } from "../config/contracts";
import { DepositParams, DepositResult, PositionReceipt, SwapRoute, WithdrawParams, WithdrawResult } from "../types";
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

  async executeWithdraw(params: WithdrawParams): Promise<WithdrawResult> {
    const { userAddress, lpAmount, slippageTolerance = 0.5 } = params;

    logger.info(`🔄 Executing withdrawal: ${lpAmount} LP tokens for ${userAddress}`);

    const txHashes: string[] = [];

    try {
      const lpAmountWei = parseUnits(lpAmount, 18);

      // Step 1: Unstake LP tokens from gauge
      logger.info("🔓 Step 1: Unstaking LP tokens from gauge...");
      const unstakeTx = await this.gaugeService.unstakeLPTokens(lpAmountWei);
      txHashes.push(unstakeTx);

      // Wait for unstaking to settle
      await sleep(1000);

      // Step 2: Approve LP tokens for router (for liquidity removal)
      logger.info("🔓 Step 2: Approving LP tokens for router...");
      const lpApprovalTx = await this.tokenService.approve(
        this.aerodromeService.getPoolAddress(),
        CONTRACTS.AERODROME_ROUTER,
        lpAmountWei,
      );
      if (lpApprovalTx !== "no-tx-needed") {
        txHashes.push(lpApprovalTx);
      }

      // Wait longer for approval to settle completely
      await sleep(2000);

      // Step 3: Remove liquidity from pool
      logger.info("🏊 Step 3: Removing liquidity from WETH-VIRTUAL pool...");
      const {
        txHash: removeLiquidityTx,
        amountA,
        amountB,
      } = await this.aerodromeService.removeLiquidity(
        CONTRACTS.WETH,
        CONTRACTS.VIRTUAL,
        lpAmountWei,
        this.walletService.getAgentWallet().address,
        slippageTolerance,
      );
      txHashes.push(removeLiquidityTx);

      // Wait for liquidity removal to settle
      await sleep(1000);

      // Get actual balances (WETH and VIRTUAL)
      const wethBalance = await this.getTokenBalance(CONTRACTS.WETH);
      const virtualBalance = await this.getTokenBalance(CONTRACTS.VIRTUAL);

      logger.info(
        `Received from LP removal: ${formatUnits(wethBalance, 18)} WETH, ${formatUnits(virtualBalance, 18)} VIRTUAL`,
      );

      // Step 4: Approve tokens for swapping back to USDC
      logger.info("🔓 Step 4a: Approving WETH for swapping...");
      await sleep(2000); // Add delay before approval
      await this.tokenService.approve(CONTRACTS.WETH, CONTRACTS.AERODROME_ROUTER, wethBalance);

      logger.info("🔓 Step 4b: Approving VIRTUAL for swapping...");
      await sleep(2000); // Add delay before approval
      await this.tokenService.approve(CONTRACTS.VIRTUAL, CONTRACTS.AERODROME_ROUTER, virtualBalance);

      // Step 5: Swap WETH → USDC
      logger.info("🔄 Step 5: Swapping WETH → USDC...");
      await sleep(1000); // Add delay before swap
      const wethToUsdcRoute: SwapRoute[] = [
        {
          from: CONTRACTS.WETH,
          to: CONTRACTS.USDC,
          stable: false,
          factory: CONTRACTS.AERODROME_FACTORY,
        },
      ];
      const swapWethTx = await this.aerodromeService.swapTokens(
        wethBalance,
        wethToUsdcRoute,
        this.walletService.getAgentWallet().address,
        slippageTolerance,
      );
      txHashes.push(swapWethTx);

      // Step 6: Swap VIRTUAL → USDC
      logger.info("🔄 Step 6: Swapping VIRTUAL → USDC...");
      await sleep(1000); // Add delay before swap
      const virtualToUsdcRoute: SwapRoute[] = [
        {
          from: CONTRACTS.VIRTUAL,
          to: CONTRACTS.USDC,
          stable: false,
          factory: CONTRACTS.AERODROME_FACTORY,
        },
      ];

      const swapVirtualTx = await this.aerodromeService.swapTokens(
        virtualBalance,
        virtualToUsdcRoute,
        this.walletService.getAgentWallet().address,
        slippageTolerance,
      );
      txHashes.push(swapVirtualTx);

      // Step 7: Get final USDC balance and send to user
      await sleep(1000);
      const finalUsdcBalance = await this.getTokenBalance(CONTRACTS.USDC);

      logger.info("💰 Step 7: Sending consolidated USDC to user...");
      const transferTx = await this.tokenService.transfer(CONTRACTS.USDC, userAddress, finalUsdcBalance);
      txHashes.push(transferTx);

      const usdcReturned = formatUnits(finalUsdcBalance, 6);

      logger.info(`✅ Withdrawal completed successfully!`);
      logger.info(`USDC returned to user: ${usdcReturned}`);

      return {
        success: true,
        txHashes,
        usdcReturned,
      };
    } catch (error) {
      logger.error("❌ Withdrawal execution failed:", error);

      return {
        success: false,
        txHashes,
        usdcReturned: "0",
        error: String(error),
      };
    }
  }

  // Helper method to check agent's current staked LP position
  async getWithdrawableAmount(): Promise<{
    stakedLP: string;
    canWithdraw: boolean;
    message: string;
  }> {
    try {
      const stakedLPWei = await this.gaugeService.getStakedBalance();
      const stakedLP = formatUnits(stakedLPWei, 18);

      const canWithdraw = parseFloat(stakedLP) > 0;
      const message = canWithdraw
        ? `Agent has ${stakedLP} LP tokens available for withdrawal`
        : "No LP tokens staked - nothing to withdraw";

      return {
        stakedLP,
        canWithdraw,
        message,
      };
    } catch (error) {
      logger.error("Failed to get withdrawable amount:", error);
      return {
        stakedLP: "Error",
        canWithdraw: false,
        message: "Error checking staked balance",
      };
    }
  }

  // Method to withdraw ALL staked LP tokens
  async withdrawAll(userAddress: string): Promise<WithdrawResult> {
    try {
      const withdrawable = await this.getWithdrawableAmount();

      if (!withdrawable.canWithdraw) {
        return {
          success: false,
          txHashes: [],
          usdcReturned: "0",
          error: withdrawable.message,
        };
      }

      logger.info(`🔄 Withdrawing ALL staked LP tokens: ${withdrawable.stakedLP}`);

      return await this.executeWithdraw({
        userAddress,
        lpAmount: withdrawable.stakedLP,
        slippageTolerance: 0.5,
      });
    } catch (error) {
      logger.error("❌ Withdraw all failed:", error);
      return {
        success: false,
        txHashes: [],
        usdcReturned: "0",
        error: String(error),
      };
    }
  }
}
