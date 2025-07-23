import { ethers } from "ethers";
import { WalletService } from "./WalletService";
import { TokenService } from "./TokenService";
import { AerodromeService } from "./AerodromeService";
import { CONTRACTS } from "../config/contracts";
import { DepositParams, SwapRoute } from "../types";
import { parseUnits, formatUnits } from "../utils/helpers";
import { logger } from "../utils/logger";
import { GaugeService } from "./GaugeService";

export class LPAgent {
  private walletService: WalletService;
  private tokenService: TokenService;
  private aerodromeService: AerodromeService;
  private gaugeService: GaugeService;

  constructor(walletService: WalletService, tokenService: TokenService, aerodromeService: AerodromeService) {
    this.walletService = walletService;
    this.tokenService = tokenService;
    this.aerodromeService = aerodromeService;
    this.gaugeService = new GaugeService(walletService);
  }

  async getAgentBalances(): Promise<{
    eth: string;
    usdc: string;
    weth: string;
    lpTokens: string;
    stakedLP: string; // ADD THIS LINE
  }> {
    try {
      const [eth, usdcBalance, wethBalance, lpBalance, stakedLPWei] = await Promise.all([
        this.walletService.getAgentBalance(),
        this.tokenService.getBalance(CONTRACTS.USDC),
        this.tokenService.getBalance(CONTRACTS.WETH),
        this.tokenService.getBalance(this.aerodromeService.getPoolAddress()),
        this.gaugeService.getStakedBalance(), // ADD THIS LINE
      ]);

      return {
        eth,
        usdc: usdcBalance.balance,
        weth: wethBalance.balance,
        lpTokens: lpBalance.balance,
        stakedLP: formatUnits(stakedLPWei, 18), // ADD THIS LINE
      };
    } catch (error) {
      logger.error("Failed to get agent balances:", error);
      return {
        eth: "Error",
        usdc: "Error",
        weth: "Error",
        lpTokens: "Error",
        stakedLP: "Error", // ADD THIS LINE
      };
    }
  }

  async initialize(): Promise<void> {
    logger.info("🔄 Initializing LP Agent...");

    await this.aerodromeService.initialize();
    await this.gaugeService.initialize(this.aerodromeService.getPoolAddress());
    await this.walletService.ensureGasBalance("0.005");

    logger.info("✅ LP Agent initialized successfully");
  }

  async simulateDeposit(params: DepositParams): Promise<{
    usdcAmount: string;
    estimatedWethAmount: string;
    estimatedVirtualAmount: string;
    slippageTolerance: number;
    canExecute: boolean;
    message: string;
  }> {
    const { usdcAmount, slippageTolerance = 0.5 } = params;

    logger.info(`🧮 Simulating deposit of ${usdcAmount} USDC...`);

    try {
      const usdcAmountBigInt = parseUnits(usdcAmount, 6);
      const halfUsdc = usdcAmountBigInt / 2n;

      let estimatedWethAmount = "~0.0015";
      let estimatedVirtualAmount = "~25.0";
      let canExecute = true;
      let message = "Simulation complete";

      // Try to get real quotes, but don't fail if we can't
      try {
        const usdcToWethRoute: SwapRoute[] = [
          {
            from: CONTRACTS.USDC,
            to: CONTRACTS.WETH,
            stable: false,
          },
        ];

        const estimatedWethAmountWei = await this.aerodromeService.getSwapAmountOut(halfUsdc, usdcToWethRoute);
        estimatedWethAmount = formatUnits(estimatedWethAmountWei, 18);

        logger.info(`Real quote: ${formatUnits(halfUsdc, 6)} USDC → ${estimatedWethAmount} WETH`);
      } catch (error) {
        logger.warn("Using estimated WETH amount due to quote error");
      }

      try {
        const usdcToVirtualRoute: SwapRoute[] = [
          {
            from: CONTRACTS.USDC,
            to: CONTRACTS.VIRTUAL,
            stable: false,
          },
        ];

        const estimatedVirtualAmountWei = await this.aerodromeService.getSwapAmountOut(halfUsdc, usdcToVirtualRoute);
        estimatedVirtualAmount = formatUnits(estimatedVirtualAmountWei, 18);

        logger.info(`Real quote: ${formatUnits(halfUsdc, 6)} USDC → ${estimatedVirtualAmount} VIRTUAL`);
      } catch (error) {
        logger.warn("Using estimated VIRTUAL amount due to quote error");
      }

      const result = {
        usdcAmount,
        estimatedWethAmount,
        estimatedVirtualAmount,
        slippageTolerance,
        canExecute,
        message,
      };

      logger.info(`Simulation results:`);
      logger.info(`  ${usdcAmount} USDC will be split:`);
      logger.info(`  → ${estimatedWethAmount} WETH`);
      logger.info(`  → ${estimatedVirtualAmount} VIRTUAL`);

      return result;
    } catch (error) {
      logger.error("❌ Deposit simulation failed:", error);

      return {
        usdcAmount,
        estimatedWethAmount: "Error",
        estimatedVirtualAmount: "Error",
        slippageTolerance,
        canExecute: false,
        message: `Simulation failed: ${error}`,
      };
    }
  }

  async checkDepositPrerequisites(
    userAddress: string,
    usdcAmount: string,
  ): Promise<{
    canDeposit: boolean;
    checks: {
      userHasUsdc: boolean;
      agentHasGas: boolean;
      poolExists: boolean;
    };
    balances: {
      userUsdc: string;
      agentEth: string;
    };
  }> {
    logger.info("🔍 Checking deposit prerequisites...");

    try {
      // Check user USDC balance
      const userUsdcBalance = await this.tokenService.getBalance(CONTRACTS.USDC, userAddress);
      const requiredUsdc = parseFloat(usdcAmount);
      const userHasUsdc = parseFloat(userUsdcBalance.balance) >= requiredUsdc;

      // Check agent ETH balance
      const agentEthBalance = await this.walletService.getAgentBalance();
      const agentHasGas = parseFloat(agentEthBalance) >= 0.005;

      // Check pool exists
      const poolAddress = this.aerodromeService.getPoolAddress();
      const poolExists = poolAddress !== "" && poolAddress !== ethers.ZeroAddress;

      const canDeposit = userHasUsdc && agentHasGas && poolExists;

      const result = {
        canDeposit,
        checks: {
          userHasUsdc,
          agentHasGas,
          poolExists,
        },
        balances: {
          userUsdc: userUsdcBalance.balance,
          agentEth: agentEthBalance,
        },
      };

      logger.info(`Prerequisites check:`);
      logger.info(`  User USDC: ${userHasUsdc ? "✅" : "❌"} (${userUsdcBalance.balance})`);
      logger.info(`  Agent Gas: ${agentHasGas ? "✅" : "❌"} (${agentEthBalance} ETH)`);
      logger.info(`  Pool Exists: ${poolExists ? "✅" : "❌"}`);
      logger.info(`  Can Deposit: ${canDeposit ? "✅" : "❌"}`);

      return result;
    } catch (error) {
      logger.error("❌ Prerequisites check failed:", error);

      return {
        canDeposit: false,
        checks: {
          userHasUsdc: false,
          agentHasGas: false,
          poolExists: false,
        },
        balances: {
          userUsdc: "Error",
          agentEth: "Error",
        },
      };
    }
  }

  async executeDeposit(params: DepositParams): Promise<{
    success: boolean;
    txHashes: string[];
    lpAmount: string;
    error?: string;
  }> {
    const { userAddress, usdcAmount, slippageTolerance = 0.5 } = params;

    logger.info(`🚀 Executing deposit of ${usdcAmount} USDC from ${userAddress}...`);

    const txHashes: string[] = [];

    try {
      // Step 1: Check prerequisites
      const prerequisites = await this.checkDepositPrerequisites(userAddress, usdcAmount);
      if (!prerequisites.canDeposit) {
        throw new Error("Prerequisites not met for deposit");
      }

      const usdcAmountBigInt = parseUnits(usdcAmount, 6);
      const halfUsdc = usdcAmountBigInt / 2n;

      // Step 2: Transfer USDC from user to agent (would need approval first)
      logger.info("💰 Transferring USDC from user to agent...");
      const transferTx = await this.tokenService.transferFrom(
        CONTRACTS.USDC,
        userAddress,
        this.walletService.getAgentWallet().address,
        usdcAmountBigInt,
      );
      txHashes.push(transferTx);

      // Step 3: Approve USDC for router
      logger.info("🔓 Approving USDC for Aerodrome router...");
      const approveTx = await this.tokenService.approve(CONTRACTS.USDC, CONTRACTS.AERODROME_ROUTER, usdcAmountBigInt);
      if (approveTx !== "no-tx-needed") {
        txHashes.push(approveTx);
      }

      // Step 4: Swap 50% USDC → WETH
      logger.info("🔄 Swapping USDC → WETH...");
      const usdcToWethRoute: SwapRoute[] = [
        {
          from: CONTRACTS.USDC,
          to: CONTRACTS.WETH,
          stable: false,
        },
      ];

      const swapWethTx = await this.aerodromeService.swapTokens(
        halfUsdc,
        usdcToWethRoute,
        this.walletService.getAgentWallet().address,
        slippageTolerance,
      );
      txHashes.push(swapWethTx);

      // Step 5: Swap 50% USDC → VIRTUAL
      logger.info("🔄 Swapping USDC → VIRTUAL...");
      const usdcToVirtualRoute: SwapRoute[] = [
        {
          from: CONTRACTS.USDC,
          to: CONTRACTS.VIRTUAL,
          stable: false,
        },
      ];

      const swapVirtualTx = await this.aerodromeService.swapTokens(
        halfUsdc,
        usdcToVirtualRoute,
        this.walletService.getAgentWallet().address,
        slippageTolerance,
      );
      txHashes.push(swapVirtualTx);

      // Step 6: Get actual balances after swaps
      const wethBalance = await this.tokenService.getBalance(CONTRACTS.WETH);
      const virtualBalance = await this.tokenService.getBalance(CONTRACTS.VIRTUAL);

      logger.info(`Balances after swaps: ${wethBalance.balance} WETH, ${virtualBalance.balance} VIRTUAL`);

      // Step 7: Approve tokens for liquidity addition
      await this.tokenService.approve(CONTRACTS.WETH, CONTRACTS.AERODROME_ROUTER, wethBalance.balanceWei);

      await this.tokenService.approve(CONTRACTS.VIRTUAL, CONTRACTS.AERODROME_ROUTER, virtualBalance.balanceWei);

      // Step 8: Add liquidity
      logger.info("🏊 Adding liquidity to WETH-VIRTUAL pool...");
      const { txHash: liquidityTx, liquidity } = await this.aerodromeService.addLiquidity(
        CONTRACTS.WETH,
        CONTRACTS.VIRTUAL,
        wethBalance.balanceWei,
        virtualBalance.balanceWei,
        this.walletService.getAgentWallet().address,
        slippageTolerance,
      );
      txHashes.push(liquidityTx);

      const lpAmount = formatUnits(liquidity, 18);

      logger.info(`✅ Deposit completed successfully!`);
      logger.info(`LP tokens received: ${lpAmount}`);
      logger.info(`Transaction hashes: ${txHashes.join(", ")}`);

      return {
        success: true,
        txHashes,
        lpAmount,
      };
    } catch (error) {
      logger.error("❌ Deposit execution failed:", error);

      // TODO: Implement refund logic here
      logger.warn("⚠️  Manual intervention may be required to refund user");

      return {
        success: false,
        txHashes,
        lpAmount: "0",
        error: String(error),
      };
    }
  }

  async stakeExistingLP(): Promise<{
    success: boolean;
    txHash?: string;
    stakedAmount: string;
    error?: string;
  }> {
    try {
      logger.info("🥩 Staking existing LP tokens...");

      // Get current LP token balance
      const lpBalance = await this.tokenService.getBalance(this.aerodromeService.getPoolAddress());

      if (parseFloat(lpBalance.balance) === 0) {
        return {
          success: false,
          stakedAmount: "0",
          error: "No LP tokens to stake",
        };
      }

      logger.info(`Found ${lpBalance.balance} LP tokens to stake`);

      // Step 1: Approve LP tokens for gauge
      logger.info("🔓 Approving LP tokens for gauge...");
      const approvalTx = await this.tokenService.approve(
        this.aerodromeService.getPoolAddress(),
        this.gaugeService.getGaugeAddress(),
        lpBalance.balanceWei,
      );

      // Step 2: Stake LP tokens
      logger.info("🥩 Staking LP tokens in gauge...");
      const stakingTx = await this.gaugeService.stakeLPTokens(lpBalance.balanceWei);

      logger.info(`✅ Successfully staked ${lpBalance.balance} LP tokens!`);

      return {
        success: true,
        txHash: stakingTx,
        stakedAmount: lpBalance.balance,
      };
    } catch (error) {
      logger.error("❌ LP staking failed:", error);
      return {
        success: false,
        stakedAmount: "0",
        error: String(error),
      };
    }
  }

  async getPositionReceipt(userAddress: string): Promise<{
    userAddress: string;
    agentAddress: string;
    poolAddress: string;
    gaugeAddress: string;
    stakedLPAmount: string;
    unstakedLPAmount: string;
    totalLPValue: string;
    timestamp: string;
  }> {
    try {
      const [stakedLPWei, unstakedLPBalance] = await Promise.all([
        this.gaugeService.getStakedBalance(),
        this.tokenService.getBalance(this.aerodromeService.getPoolAddress()),
      ]);

      const stakedLPAmount = formatUnits(stakedLPWei, 18);
      const unstakedLPAmount = unstakedLPBalance.balance;
      const totalLPValue = (parseFloat(stakedLPAmount) + parseFloat(unstakedLPAmount)).toString();

      return {
        userAddress,
        agentAddress: this.walletService.getAgentWallet().address,
        poolAddress: this.aerodromeService.getPoolAddress(),
        gaugeAddress: this.gaugeService.getGaugeAddress(),
        stakedLPAmount,
        unstakedLPAmount,
        totalLPValue,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to get position receipt:", error);
      throw error;
    }
  }
}
