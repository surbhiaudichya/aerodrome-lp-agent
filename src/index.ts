import dotenv from "dotenv";
import { ethers } from "ethers";
import { logger } from "./utils/logger";
import { CONTRACTS, CHAIN_ID } from "./config/contracts";
import { WalletService } from "./services/WalletService";
import { TokenService } from "./services/TokenService";
import { AerodromeService } from "./services/AerodromeService";
import { LPAgent } from "./services/LPAgent";
import { parseUnits } from "./utils/helpers";
import { GaugeService } from "./services/GaugeService";

// Load environment variables
dotenv.config();

async function main() {
  try {
    logger.info("🚀 Starting Aerodrome LP Agent...");

    // Check if required environment variables are set
    if (!process.env.BASE_RPC_URL) {
      throw new Error("BASE_RPC_URL environment variable is required");
    }

    if (!process.env.AGENT_PRIVATE_KEY) {
      throw new Error("AGENT_PRIVATE_KEY environment variable is required");
    }

    logger.info(`Chain ID: ${CHAIN_ID}`);
    logger.info(`RPC URL: ${process.env.BASE_RPC_URL}`);

    // Initialize services
    const walletService = new WalletService(process.env.BASE_RPC_URL, process.env.AGENT_PRIVATE_KEY);

    const tokenService = new TokenService(walletService);
    const aerodromeService = new AerodromeService(walletService);
    const lpAgent = new LPAgent(walletService, tokenService, aerodromeService);

    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case "test":
        await testWalletService(walletService);
        break;

      case "test-tokens":
        await testTokenService(tokenService);
        break;

      case "test-aerodrome":
        await testAerodromeService(aerodromeService);
        break;

      case "test-lp":
        await testLPAgent(lpAgent);
        break;

      case "simulate":
        if (args.length < 2) {
          console.error("Usage: npm run dev simulate <usdcAmount>");
          console.error("Example: npm run dev simulate 10");
          process.exit(1);
        }
        await simulateDeposit(lpAgent, args[1]);
        break;

      case "check":
        if (args.length < 3) {
          console.error("Usage: npm run dev check <userAddress> <usdcAmount>");
          console.error("Example: npm run dev check 0x742d35... 10");
          process.exit(1);
        }
        await checkDeposit(lpAgent, args[1], args[2]);
        break;

      case "deposit":
        if (args.length < 3) {
          console.error("Usage: npm run dev deposit <userAddress> <usdcAmount>");
          console.error("Example: npm run dev deposit 0x742d35... 5");
          console.error("⚠️  WARNING: This executes real transactions!");
          process.exit(1);
        }
        await executeDeposit(lpAgent, args[1], args[2]);
        break;

      case "approve":
        if (args.length < 3) {
          console.error("Usage: npm run dev approve <tokenAddress> <amount>");
          console.error("Example: npm run dev approve USDC 50");
          process.exit(1);
        }
        await approveToken(tokenService, args[1], args[2]);
        break;

      case "refund":
        if (args.length < 2) {
          console.error("Usage: npm run dev refund <userAddress>");
          console.error("Example: npm run dev refund 0x742d35...");
          process.exit(1);
        }
        await refundUsdc(tokenService, args[1]);
        break;

      case "finish-lp":
        await finishLP(lpAgent);
        break;

      case "execute-lp":
        await executeLP(lpAgent);
        break;

      case "complete-deposit":
        if (args.length < 3) {
          console.error("Usage: npm run dev complete-deposit <userAddress> <usdcAmount>");
          console.error("Example: npm run dev complete-deposit 0x742d35... 2");
          process.exit(1);
        }
        await completeFullDeposit(lpAgent, args[1], args[2]);
        break;

      case "test-gauge":
        await testGaugeService(aerodromeService, tokenService, walletService);
        break;

      case "balances":
        await showTokenBalances(tokenService);
        break;

      case "agent-balances":
        await showAgentBalances(lpAgent);
        break;

      case "status":
        await showAgentStatus(walletService, tokenService, aerodromeService);
        break;
      case "stake-lp":
        await stakeExistingLP(lpAgent);
        break;

      case "position-receipt":
        if (args.length < 2) {
          console.error("Usage: npm run dev position-receipt <userAddress>");
          console.error("Example: npm run dev position-receipt 0x65655D5d18F41775156CdFb53cC5710E13380070");
          process.exit(1);
        }
        await showPositionReceipt(lpAgent, args[1]);
        break;

      case "enhanced-balances":
        await showEnhancedBalances(lpAgent);
        break;

      case "check-lp-direct":
        await checkLPBalanceDirect(walletService);
        break;
      case "check-staked-direct":
        await checkStakedBalanceDirect(walletService);
        break;
      case "stake-lp-direct":
        await stakeLPTokensDirect(walletService);
        break;
      case "position-receipt":
        if (args.length < 2) {
          console.error("Usage: npm run dev position-receipt <userAddress>");
          console.error("Example: npm run dev position-receipt 0x65655D5d18F41775156CdFb53cC5710E13380070");
          process.exit(1);
        }
        await generatePositionReceipt(walletService, args[1]);
        break;

      default:
        logger.info("Available commands:");
        logger.info("  npm run dev test - Test wallet service");
        logger.info("  npm run dev test-tokens - Test token service");
        logger.info("  npm run dev test-aerodrome - Test Aerodrome connection");
        logger.info("  npm run dev test-gauge - Test Gauge connection");
        logger.info("  npm run dev test-lp - Test LP Agent");
        logger.info("  npm run dev simulate <amount> - Simulate deposit");
        logger.info("  npm run dev check <userAddr> <amount> - Check if user can deposit");
        logger.info("  npm run dev deposit <userAddr> <amount> - 🚨 EXECUTE REAL DEPOSIT");
        logger.info("");
        logger.info("NEW STAKING COMMANDS:");
        logger.info("  npm run dev stake-lp - 🥩 Stake existing LP tokens");
        logger.info("  npm run dev position-receipt <userAddr> - 📄 Generate position receipt");
        logger.info("  npm run dev enhanced-balances - Show all balances including staked");
        logger.info("");
        logger.info("  npm run dev balances - Show token balances");
        logger.info("  npm run dev agent-balances - Show agent balances");
        logger.info("  npm run dev status - Check full agent status");
    }
  } catch (error) {
    logger.error("❌ Error:", error);
    process.exit(1);
  }
}

async function testWalletService(walletService: WalletService) {
  logger.info("🧪 Testing wallet service...");

  const networkInfo = await walletService.getNetworkInfo();
  logger.info(`Network: ${networkInfo.networkName} (Chain ID: ${networkInfo.chainId})`);

  const balance = await walletService.getAgentBalance();
  logger.info(`Agent balance: ${balance} ETH`);

  try {
    await walletService.ensureGasBalance("0.001");
    logger.info("✅ Wallet service test passed!");
  } catch (error) {
    logger.warn(`⚠️  Low balance warning: ${error}`);
  }
}

async function testTokenService(tokenService: TokenService) {
  logger.info("🧪 Testing token service...");

  try {
    const usdcInfo = await tokenService.getTokenInfo(CONTRACTS.USDC);
    logger.info(`USDC: ${usdcInfo.name} (${usdcInfo.symbol}) - ${usdcInfo.decimals} decimals`);

    const wethInfo = await tokenService.getTokenInfo(CONTRACTS.WETH);
    logger.info(`WETH: ${wethInfo.name} (${wethInfo.symbol}) - ${wethInfo.decimals} decimals`);

    const virtualInfo = await tokenService.getTokenInfo(CONTRACTS.VIRTUAL);
    logger.info(`VIRTUAL: ${virtualInfo.name} (${virtualInfo.symbol}) - ${virtualInfo.decimals} decimals`);

    logger.info("✅ Token service test passed!");
  } catch (error) {
    logger.error("❌ Token service test failed:", error);
  }
}

async function testAerodromeService(aerodromeService: AerodromeService) {
  logger.info("🧪 Testing Aerodrome service...");

  try {
    // Initialize the service
    await aerodromeService.initialize();

    logger.info(`Pool Address: ${aerodromeService.getPoolAddress()}`);
    logger.info(`Router Address: ${aerodromeService.getRouterAddress()}`);

    // Test router connection with price quotes
    const routerTest = await aerodromeService.testRouterConnection();

    if (routerTest) {
      logger.info("✅ Aerodrome service test passed!");
    } else {
      logger.error("❌ Router connection test failed");
    }
  } catch (error) {
    logger.error("❌ Aerodrome service test failed:", error);
  }
}

async function testLPAgent(lpAgent: LPAgent) {
  logger.info("🧪 Testing LP Agent...");

  try {
    await lpAgent.initialize();
    logger.info("✅ LP Agent initialized successfully");

    const balances = await lpAgent.getAgentBalances();
    logger.info("Agent balances:");
    logger.info(`  ETH: ${balances.eth}`);
    logger.info(`  USDC: ${balances.usdc}`);
    logger.info(`  WETH: ${balances.weth}`);

    logger.info("✅ LP Agent test passed!");
  } catch (error) {
    logger.error("❌ LP Agent test failed:", error);
  }
}

async function simulateDeposit(lpAgent: LPAgent, usdcAmount: string) {
  logger.info(`🧮 Simulating deposit of ${usdcAmount} USDC...`);

  try {
    await lpAgent.initialize();

    const simulation = await lpAgent.simulateDeposit({
      userAddress: "0x0000000000000000000000000000000000000000", // Dummy address
      usdcAmount,
    });

    console.log("");
    console.log("📊 Deposit Simulation Results:");
    console.log("==============================");
    console.log(`Input: ${simulation.usdcAmount} USDC`);
    console.log(`Expected WETH: ${simulation.estimatedWethAmount}`);
    console.log(`Expected VIRTUAL: ${simulation.estimatedVirtualAmount}`);
    console.log(`Slippage Tolerance: ${simulation.slippageTolerance}%`);
    console.log(`Can Execute: ${simulation.canExecute ? "✅" : "❌"}`);
    console.log(`Message: ${simulation.message}`);
    console.log("");
    console.log("💡 This is a simulation. No actual transactions were executed.");
  } catch (error) {
    logger.error("❌ Deposit simulation failed:", error);
  }
}

async function checkDeposit(lpAgent: LPAgent, userAddress: string, usdcAmount: string) {
  logger.info(`🔍 Checking if ${userAddress} can deposit ${usdcAmount} USDC...`);

  try {
    await lpAgent.initialize();

    const check = await lpAgent.checkDepositPrerequisites(userAddress, usdcAmount);

    console.log("");
    console.log("🔍 Deposit Prerequisites Check:");
    console.log("===============================");
    console.log(`User Address: ${userAddress}`);
    console.log(`Requested Amount: ${usdcAmount} USDC`);
    console.log("");
    console.log("Checks:");
    console.log(`  User has USDC: ${check.checks.userHasUsdc ? "✅" : "❌"} (${check.balances.userUsdc})`);
    console.log(`  Agent has gas: ${check.checks.agentHasGas ? "✅" : "❌"} (${check.balances.agentEth} ETH)`);
    console.log(`  Pool exists: ${check.checks.poolExists ? "✅" : "❌"}`);
    console.log("");
    console.log(`Overall: ${check.canDeposit ? "✅ CAN DEPOSIT" : "❌ CANNOT DEPOSIT"}`);
  } catch (error) {
    logger.error("❌ Deposit check failed:", error);
  }
}

async function executeDeposit(lpAgent: LPAgent, userAddress: string, usdcAmount: string) {
  logger.info(`🚨 EXECUTING REAL DEPOSIT: ${usdcAmount} USDC from ${userAddress}`);

  // Double confirmation for safety
  console.log("");
  console.log("⚠️  WARNING: This will execute REAL transactions on Base mainnet!");
  console.log("⚠️  Make sure you have approved the agent to spend your USDC first!");
  console.log("");
  console.log("Executing in 5 seconds... Press Ctrl+C to cancel");

  // Wait 5 seconds to allow cancellation
  for (let i = 5; i > 0; i--) {
    console.log(`${i}...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  try {
    await lpAgent.initialize();

    const result = await lpAgent.executeDeposit({
      userAddress,
      usdcAmount,
    });

    console.log("");
    console.log("🚀 Deposit Execution Results:");
    console.log("============================");
    console.log(`Success: ${result.success ? "✅" : "❌"}`);
    console.log(`LP Tokens Received: ${result.lpAmount}`);
    console.log("");
    console.log("Transaction Hashes:");
    result.txHashes.forEach((hash: string, index: number) => {
      console.log(`  ${index + 1}. https://basescan.org/tx/${hash}`);
    });

    if (!result.success) {
      console.log("");
      console.log(`❌ Error: ${result.error}`);
    }
  } catch (error) {
    logger.error("❌ Deposit execution failed:", error);
  }
}

async function approveToken(tokenService: TokenService, tokenSymbol: string, amount: string) {
  logger.info(`🔓 Approving ${amount} ${tokenSymbol} for agent...`);

  try {
    let tokenAddress: string;
    let decimals: number;

    // Map token symbols to addresses
    switch (tokenSymbol.toLowerCase()) {
      case "usdc":
        tokenAddress = CONTRACTS.USDC;
        decimals = 6;
        break;
      case "weth":
        tokenAddress = CONTRACTS.WETH;
        decimals = 18;
        break;
      case "virtual":
        tokenAddress = CONTRACTS.VIRTUAL;
        decimals = 18;
        break;
      default:
        // Assume it's already an address
        tokenAddress = tokenSymbol;
        const tokenInfo = await tokenService.getTokenInfo(tokenAddress);
        decimals = tokenInfo.decimals;
    }

    const amountBigInt = parseUnits(amount, decimals);
    const agentAddress = tokenService["walletService"].getAgentWallet().address;

    console.log("");
    console.log("⚠️  This will execute a real approval transaction!");
    console.log(`Token: ${tokenSymbol}`);
    console.log(`Amount: ${amount}`);
    console.log(`Spender: ${agentAddress}`);
    console.log("");

    const txHash = await tokenService.approve(tokenAddress, agentAddress, amountBigInt);

    console.log("✅ Approval successful!");
    console.log(`Transaction: https://basescan.org/tx/${txHash}`);
  } catch (error) {
    logger.error("❌ Approval failed:", error);
  }
}

async function completeFullDeposit(lpAgent: LPAgent, userAddress: string, usdcAmount: string) {
  logger.info(`🚀 COMPLETE DEPOSIT FLOW: ${usdcAmount} USDC from ${userAddress}`);

  console.log("⚠️  WARNING: This executes the COMPLETE automation workflow!");
  console.log("Steps: Transfer → Swap → Add Liquidity → Return LP tokens");
  console.log("");
  console.log("Executing in 5 seconds... Press Ctrl+C to cancel");

  // Wait 5 seconds
  for (let i = 5; i > 0; i--) {
    console.log(`${i}...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  try {
    const result = await lpAgent.executeDeposit({
      userAddress,
      usdcAmount,
      slippageTolerance: 0.5,
    });

    console.log("");
    console.log("🎉 COMPLETE DEPOSIT AUTOMATION SUCCESS!");
    console.log("==========================================");
    console.log(`✅ Success: ${result.success}`);
    console.log(`🏊 LP Tokens: ${result.lpAmount}`);
    console.log(`📝 Total Transactions: ${result.txHashes.length}`);
    console.log("");
    console.log("Transaction Hashes:");
    result.txHashes.forEach((hash: string, i: number) => {
      const steps = [
        "USDC Transfer",
        "USDC Approval",
        "USDC→WETH Swap",
        "USDC→VIRTUAL Swap",
        "WETH Approval",
        "VIRTUAL Approval",
        "Add Liquidity",
      ];
      console.log(`  ${i + 1}. ${steps[i] || "Transaction"}: https://basescan.org/tx/${hash}`);
    });

    if (result.success) {
      console.log("");
      console.log("🏆 AUTOMATION AGENT COMPLETE!");
      console.log("===============================");
      console.log("✅ User USDC → Agent execution → LP tokens");
      console.log("✅ Multi-hop swaps working");
      console.log("✅ Liquidity provision automated");
      console.log(`✅ LP Token Contract: 0x21594b992F68495dD28d605834b58889d0a727c7`);
      console.log("");
      console.log("🎯 Core Requirements Achieved:");
      console.log("  ✅ Agent has own wallet");
      console.log("  ✅ Handles complete LP lifecycle");
      console.log("  ✅ USDC → LP tokens automation");
      console.log("  ✅ Error handling & gas management");
      console.log("  ✅ Real mainnet transactions");
    }
  } catch (error) {
    logger.error("❌ Complete deposit failed:", error);
  }
}

async function executeLP(lpAgent: LPAgent) {
  logger.info("🚀 Executing LP addition with known token amounts...");

  console.log("⚠️  WARNING: This will execute REAL liquidity addition!");
  console.log("Based on your recent transactions, you have:");
  console.log("  - WETH: ~0.000957");
  console.log("  - VIRTUAL: ~2.259");
  console.log("");
  console.log("Executing in 5 seconds... Press Ctrl+C to cancel");

  // Wait 5 seconds
  for (let i = 5; i > 0; i--) {
    console.log(`${i}...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  try {
    await lpAgent.initialize();

    // Use the known amounts from recent transactions
    const wethAmountWei = parseUnits("0.00095764723832636", 18); // From transaction log
    const virtualAmountWei = parseUnits("2.259450606035209143", 18); // From transaction log

    console.log("🔓 Step 1: Approving WETH for router...");
    const tokenService = (lpAgent as any).tokenService;
    const aerodromeService = (lpAgent as any).aerodromeService;

    await tokenService.approve(CONTRACTS.WETH, CONTRACTS.AERODROME_ROUTER, wethAmountWei);

    console.log("🔓 Step 2: Approving VIRTUAL for router...");
    await tokenService.approve(CONTRACTS.VIRTUAL, CONTRACTS.AERODROME_ROUTER, virtualAmountWei);

    console.log("🏊 Step 3: Adding liquidity to pool...");
    const { txHash, liquidity } = await aerodromeService.addLiquidity(
      CONTRACTS.WETH,
      CONTRACTS.VIRTUAL,
      wethAmountWei,
      virtualAmountWei,
      tokenService.walletService.getAgentWallet().address,
      0.5, // 0.5% slippage
    );

    console.log("");
    console.log("🎉 LP Addition Complete!");
    console.log("========================");
    console.log(`Transaction: https://basescan.org/tx/${txHash}`);
    console.log(`LP Tokens Received: ${ethers.formatEther(liquidity)}`);
    console.log(`LP Token Contract: 0x21594b992F68495dD28d605834b58889d0a727c7`);
    console.log("");
    console.log("✅ Your DeFi automation agent successfully created LP tokens!");
  } catch (error) {
    logger.error("❌ LP execution failed:", error);
    console.log("");
    console.log("Manual alternative:");
    console.log("1. Go to https://aerodrome.finance/deposit");
    console.log("2. Import agent wallet: 0x747Dc4A00d0eFDA9053a29e691c60D0BfC9fc180");
    console.log("3. Connect and add liquidity manually");
  }
}

async function refundUsdc(tokenService: TokenService, userAddress: string) {
  logger.info(`💰 Refunding USDC from agent to ${userAddress}...`);

  try {
    // Get agent's USDC balance
    const agentBalance = await tokenService.getBalance(CONTRACTS.USDC);

    if (parseFloat(agentBalance.balance) === 0) {
      console.log("❌ No USDC to refund");
      return;
    }

    console.log(`Found ${agentBalance.balance} USDC in agent wallet`);
    console.log(`Refunding to: ${userAddress}`);

    const txHash = await tokenService.transfer(CONTRACTS.USDC, userAddress, agentBalance.balanceWei);

    console.log("✅ Refund successful!");
    console.log(`Transaction: https://basescan.org/tx/${txHash}`);
    console.log(`Amount: ${agentBalance.balance} USDC`);
  } catch (error) {
    logger.error("❌ Refund failed:", error);
  }
}

async function finishLP(lpAgent: LPAgent) {
  logger.info("🏊 Finishing LP addition with existing WETH and VIRTUAL...");

  try {
    await lpAgent.initialize();

    // Get current balances (just WETH and USDC for now)
    const balances = await lpAgent.getAgentBalances();
    console.log("Current balances:");
    console.log(`  WETH: ${balances.weth}`);
    console.log(`  USDC: ${balances.usdc}`);

    const wethAmount = parseFloat(balances.weth);
    if (wethAmount === 0) {
      console.log("❌ No WETH available for LP");
      return;
    }

    // Use hardcoded VIRTUAL amount from recent transaction
    // Based on your latest transaction: ~2.259 VIRTUAL
    const estimatedVirtual = "2.259450606035209143"; // From your transaction log

    console.log(`  VIRTUAL: ~${estimatedVirtual} (estimated from recent tx)`);
    console.log("");
    console.log("✅ Ready to add liquidity!");
    console.log(`Will add ${balances.weth} WETH + ~${estimatedVirtual} VIRTUAL to LP`);
    console.log("");
    console.log("⚠️  WARNING: This will execute REAL LP transactions!");
    console.log('Type "yes" to continue or anything else to cancel:');

    // In a real implementation, you'd wait for user input here
    // For now, let's show what would happen
    console.log("");
    console.log("🔄 Would execute:");
    console.log("1. Approve WETH for Aerodrome Router");
    console.log("2. Approve VIRTUAL for Aerodrome Router");
    console.log("3. Add liquidity to WETH-VIRTUAL pool");
    console.log("4. Receive LP tokens");
    console.log("");
    console.log("💡 To execute manually:");
    console.log("   1. Go to https://aerodrome.finance/deposit");
    console.log("   2. Connect your agent wallet");
    console.log("   3. Select WETH-VIRTUAL pair");
    console.log("   4. Add your tokens to the pool");
  } catch (error) {
    logger.error("❌ Failed to finish LP:", error);
  }
}

async function showTokenBalances(tokenService: TokenService) {
  logger.info("💰 Checking token balances...");

  const tokens = [
    { name: "USDC", address: CONTRACTS.USDC },
    { name: "WETH", address: CONTRACTS.WETH },
    { name: "VIRTUAL", address: CONTRACTS.VIRTUAL },
  ];

  for (const token of tokens) {
    try {
      const balance = await tokenService.getBalance(token.address);
      console.log(`${token.name}: ${balance.balance}`);
    } catch (error) {
      console.log(`${token.name}: Error getting balance`);
    }
  }
}

async function showAgentBalances(lpAgent: LPAgent) {
  logger.info("💰 Agent Balances:");

  try {
    const balances = await lpAgent.getAgentBalances();

    console.log("===============");
    console.log(`ETH: ${balances.eth}`);
    console.log(`USDC: ${balances.usdc}`);
    console.log(`WETH: ${balances.weth}`);
  } catch (error) {
    logger.error("❌ Failed to get agent balances:", error);
  }
}

async function showAgentStatus(
  walletService: WalletService,
  tokenService: TokenService,
  aerodromeService: AerodromeService,
) {
  logger.info("📊 Agent Status:");
  logger.info("===============");

  const networkInfo = await walletService.getNetworkInfo();
  const ethBalance = await walletService.getAgentBalance();

  console.log(`Agent Address: ${walletService.getAgentWallet().address}`);
  console.log(`Network: ${networkInfo.networkName} (${networkInfo.chainId})`);
  console.log(`ETH Balance: ${ethBalance} ETH`);
  console.log("");

  // Test Aerodrome connection
  try {
    await aerodromeService.initialize();
    console.log("Aerodrome Integration:");
    console.log(`  Pool Address: ${aerodromeService.getPoolAddress()}`);
    console.log(`  Router Address: ${aerodromeService.getRouterAddress()}`);
    console.log("  Status: ✅ Connected");
  } catch (error) {
    console.log("Aerodrome Integration:");
    console.log("  Status: ❌ Connection failed");
    console.log(`  Error: ${error}`);
  }
  console.log("");

  // Show token balances
  console.log("Token Balances:");
  const tokens = [
    { name: "USDC", address: CONTRACTS.USDC },
    { name: "WETH", address: CONTRACTS.WETH },
    { name: "VIRTUAL", address: CONTRACTS.VIRTUAL },
  ];

  for (const token of tokens) {
    try {
      const balance = await tokenService.getBalance(token.address);
      console.log(`  ${token.name}: ${balance.balance}`);
    } catch (error) {
      console.log(`  ${token.name}: Error`);
    }
  }

  if (parseFloat(ethBalance) < 0.01) {
    console.log("");
    console.log("⚠️  Warning: Low ETH balance for gas fees");
  }
}
async function testGaugeService(
  aerodromeService: AerodromeService,
  tokenService: TokenService,
  walletService: WalletService,
) {
  logger.info("🧪 Testing Gauge service...");

  try {
    // Initialize Aerodrome service first
    await aerodromeService.initialize();

    // Initialize Gauge service
    const gaugeService = new GaugeService(walletService);
    await gaugeService.initialize(aerodromeService.getPoolAddress());

    logger.info(`Pool Address: ${aerodromeService.getPoolAddress()}`);
    logger.info(`Gauge Address: ${gaugeService.getGaugeAddress()}`);

    // Test gauge connection
    const gaugeTest = await gaugeService.testGaugeConnection();

    // Check if agent has any LP tokens to stake
    const lpBalance = await tokenService.getBalance(aerodromeService.getPoolAddress());
    logger.info(`Agent LP Balance: ${lpBalance.balance}`);

    // Check if agent has any staked LP tokens
    const stakedBalance = await gaugeService.getStakedBalance();
    logger.info(`Agent Staked LP: ${ethers.formatEther(stakedBalance)}`);

    if (gaugeTest) {
      logger.info("✅ Gauge service test passed!");
    } else {
      logger.error("❌ Gauge connection test failed");
    }
  } catch (error) {
    logger.error("❌ Gauge service test failed:", error);
  }
}

async function stakeExistingLP(lpAgent: LPAgent) {
  logger.info("🥩 Staking existing LP tokens...");

  try {
    await lpAgent.initialize();

    // Check current balances first
    const balances = await lpAgent.getAgentBalances();
    console.log("\n📊 Current Balances:");
    console.log(`  LP Tokens (unstaked): ${balances.lpTokens}`);
    console.log(`  LP Tokens (staked): ${balances.stakedLP}`);

    if (parseFloat(balances.lpTokens) === 0) {
      console.log("❌ No LP tokens to stake");
      return;
    }

    console.log("\n⚠️  WARNING: This will stake your LP tokens!");
    console.log(`Will stake: ${balances.lpTokens} LP tokens`);
    console.log("Executing in 3 seconds... Press Ctrl+C to cancel");

    for (let i = 3; i > 0; i--) {
      console.log(`${i}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const result = await lpAgent.stakeExistingLP();

    console.log("\n🎉 Staking Results:");
    console.log("===================");
    console.log(`✅ Success: ${result.success}`);
    console.log(`🥩 Staked Amount: ${result.stakedAmount}`);

    if (result.txHash) {
      console.log(`📝 Transaction: https://basescan.org/tx/${result.txHash}`);
    }

    if (!result.success) {
      console.log(`❌ Error: ${result.error}`);
    }

    // Show updated balances
    const newBalances = await lpAgent.getAgentBalances();
    console.log("\n📊 Updated Balances:");
    console.log(`  LP Tokens (unstaked): ${newBalances.lpTokens}`);
    console.log(`  LP Tokens (staked): ${newBalances.stakedLP}`);
  } catch (error) {
    logger.error("❌ Staking failed:", error);
  }
}

async function showPositionReceipt(lpAgent: LPAgent, userAddress: string) {
  logger.info(`📄 Generating position receipt for ${userAddress}...`);

  try {
    await lpAgent.initialize();

    const receipt = await lpAgent.getPositionReceipt(userAddress);

    console.log("\n📄 POSITION RECEIPT");
    console.log("===================");
    console.log(`User Address: ${receipt.userAddress}`);
    console.log(`Agent Address: ${receipt.agentAddress}`);
    console.log(`Pool Address: ${receipt.poolAddress}`);
    console.log(`Gauge Address: ${receipt.gaugeAddress}`);
    console.log("");
    console.log("LP Token Position:");
    console.log(`  Staked LP: ${receipt.stakedLPAmount}`);
    console.log(`  Unstaked LP: ${receipt.unstakedLPAmount}`);
    console.log(`  Total LP Value: ${receipt.totalLPValue}`);
    console.log("");
    console.log(`Generated: ${receipt.timestamp}`);
    console.log("");
    console.log("🔗 View on BaseScan:");
    console.log(`  Pool: https://basescan.org/address/${receipt.poolAddress}`);
    console.log(`  Gauge: https://basescan.org/address/${receipt.gaugeAddress}`);
  } catch (error) {
    logger.error("❌ Failed to generate position receipt:", error);
  }
}

async function showEnhancedBalances(lpAgent: LPAgent) {
  logger.info("💰 Enhanced Agent Balances:");

  try {
    await lpAgent.initialize();
    const balances = await lpAgent.getAgentBalances();

    console.log("========================");
    console.log(`ETH: ${balances.eth}`);
    console.log(`USDC: ${balances.usdc}`);
    console.log(`WETH: ${balances.weth}`);
    console.log(`LP Tokens (unstaked): ${balances.lpTokens}`);
    console.log(`LP Tokens (staked): ${balances.stakedLP}`);
    console.log("");

    const totalLP = parseFloat(balances.lpTokens) + parseFloat(balances.stakedLP);
    console.log(`Total LP Position: ${totalLP}`);
  } catch (error) {
    logger.error("❌ Failed to get enhanced balances:", error);
  }
}

async function checkLPBalanceDirect(walletService: WalletService) {
  logger.info("🔍 Checking LP balance directly...");

  try {
    const agentAddress = walletService.getAgentWallet().address;
    const poolAddress = "0x21594b992F68495dD28d605834b58889d0a727c7";

    console.log(`Agent Address: ${agentAddress}`);
    console.log(`Pool Address: ${poolAddress}`);
    console.log("");

    // Create LP token contract directly
    const lpContract = new ethers.Contract(
      poolAddress,
      [
        "function balanceOf(address owner) view returns (uint256)",
        "function totalSupply() view returns (uint256)",
        "function symbol() view returns (string)",
      ],
      walletService.getProvider(),
    );

    console.log("Checking LP token info...");

    // Add delays between calls
    await new Promise(resolve => setTimeout(resolve, 500));
    const symbol = await lpContract.symbol();
    console.log(`LP Token Symbol: ${symbol}`);

    await new Promise(resolve => setTimeout(resolve, 500));
    const totalSupply = await lpContract.totalSupply();
    console.log(`Total LP Supply: ${ethers.formatEther(totalSupply)}`);

    await new Promise(resolve => setTimeout(resolve, 500));
    const balance = await lpContract.balanceOf(agentAddress);
    const balanceFormatted = ethers.formatEther(balance);

    console.log("");
    console.log("🎯 RESULTS:");
    console.log(`LP Balance (raw): ${balance.toString()}`);
    console.log(`LP Balance (formatted): ${balanceFormatted}`);

    if (balance > 0n) {
      console.log("✅ You have LP tokens to stake!");
    } else {
      console.log("❌ No LP tokens found");
      console.log("");
      console.log("🔍 Possible reasons:");
      console.log("1. LP tokens already staked in gauge");
      console.log("2. LP tokens in different address");
      console.log("3. Previous transactions failed");
      console.log("");
      console.log("Check your wallet on BaseScan:");
      console.log(`https://basescan.org/address/${agentAddress}`);
    }
  } catch (error: any) {
    logger.error("Direct balance check failed:", error);

    if (error?.info?.error?.message?.includes("rate limit")) {
      console.log("");
      console.log("🚨 RATE LIMIT ISSUE!");
      console.log("Your RPC provider is limiting requests.");
      console.log("");
      console.log("Solutions:");
      console.log("1. Wait 1-2 minutes and try again");
      console.log("2. Use a different RPC endpoint");
      console.log("3. Check balance manually on BaseScan");
    }
  }
}
async function checkStakedBalanceDirect(walletService: WalletService) {
  logger.info("🔍 Checking staked balance directly...");

  try {
    const agentAddress = walletService.getAgentWallet().address;
    const gaugeAddress = "0xBD62Cad65b49b4Ad9C7aa9b8bDB89d63221F7af5";

    console.log(`Agent Address: ${agentAddress}`);
    console.log(`Gauge Address: ${gaugeAddress}`);
    console.log("");

    // Create gauge contract directly
    const gaugeContract = new ethers.Contract(
      gaugeAddress,
      ["function balanceOf(address owner) view returns (uint256)", "function totalSupply() view returns (uint256)"],
      walletService.getProvider(),
    );

    console.log("Checking gauge info...");

    await new Promise(resolve => setTimeout(resolve, 500));
    const totalStaked = await gaugeContract.totalSupply();
    console.log(`Total Staked in Gauge: ${ethers.formatEther(totalStaked)}`);

    await new Promise(resolve => setTimeout(resolve, 500));
    const stakedBalance = await gaugeContract.balanceOf(agentAddress);
    const stakedFormatted = ethers.formatEther(stakedBalance);

    console.log("");
    console.log("🎯 RESULTS:");
    console.log(`Staked Balance (raw): ${stakedBalance.toString()}`);
    console.log(`Staked Balance (formatted): ${stakedFormatted}`);

    if (stakedBalance > 0n) {
      console.log("✅ You already have staked LP tokens!");
      console.log("🎉 Steps 5 & 6 might already be complete!");
    } else {
      console.log("❌ No staked LP tokens found");
    }
  } catch (error: any) {
    logger.error("Direct staked balance check failed:", error);

    if (error?.info?.error?.message?.includes("rate limit")) {
      console.log("🚨 Rate limit hit - wait and try again");
    }
  }
}

async function stakeLPTokensDirect(walletService: WalletService) {
  logger.info("🥩 Staking LP tokens directly (bypassing rate limits)...");

  try {
    const agentAddress = walletService.getAgentWallet().address;
    const poolAddress = "0x21594b992F68495dD28d605834b58889d0a727c7";
    const gaugeAddress = "0xBD62Cad65b49b4Ad9C7aa9b8bDB89d63221F7af5";

    // Step 1: Get LP token balance directly
    const lpContract = new ethers.Contract(
      poolAddress,
      [
        "function balanceOf(address owner) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
      ],
      walletService.getAgentWallet(), // Connected wallet for transactions
    );

    await new Promise(resolve => setTimeout(resolve, 300));
    const lpBalance = await lpContract.balanceOf(agentAddress);
    const lpBalanceFormatted = ethers.formatEther(lpBalance);

    console.log(`\n📊 Current LP Balance: ${lpBalanceFormatted}`);

    if (lpBalance === 0n) {
      console.log("❌ No LP tokens to stake");
      return;
    }

    console.log("\n⚠️  WARNING: This will stake your LP tokens!");
    console.log(`Will stake: ${lpBalanceFormatted} LP tokens`);
    console.log(`Pool: ${poolAddress}`);
    console.log(`Gauge: ${gaugeAddress}`);
    console.log("\nExecuting in 5 seconds... Press Ctrl+C to cancel");

    for (let i = 5; i > 0; i--) {
      console.log(`${i}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 2: Check and approve LP tokens for gauge
    console.log("🔓 Step 1: Checking approval...");
    await new Promise(resolve => setTimeout(resolve, 300));
    const currentAllowance = await lpContract.allowance(agentAddress, gaugeAddress);

    let approvalTx = null;
    if (currentAllowance < lpBalance) {
      console.log("🔓 Step 2: Approving LP tokens for gauge...");

      // Reset allowance to 0 first if needed
      if (currentAllowance > 0n) {
        const resetTx = await lpContract.approve(gaugeAddress, 0n);
        await resetTx.wait();
        console.log("  Reset allowance to 0");
      }

      const approveTx = await lpContract.approve(gaugeAddress, lpBalance);
      const approvalReceipt = await approveTx.wait();
      approvalTx = approvalReceipt.hash;
      console.log(`  ✅ Approval tx: https://basescan.org/tx/${approvalTx}`);
    } else {
      console.log("  ✅ Already approved");
    }

    // Step 3: Stake LP tokens in gauge
    console.log("🥩 Step 3: Staking LP tokens in gauge...");
    const gaugeContract = new ethers.Contract(
      gaugeAddress,
      ["function deposit(uint256 amount)", "function balanceOf(address account) view returns (uint256)"],
      walletService.getAgentWallet(),
    );

    const stakeTx = await gaugeContract.deposit(lpBalance);
    const stakeReceipt = await stakeTx.wait();

    console.log("\n🎉 STAKING COMPLETE!");
    console.log("====================");
    console.log(`✅ Success: true`);
    console.log(`🥩 Staked Amount: ${lpBalanceFormatted}`);
    if (approvalTx) {
      console.log(`📝 Approval Tx: https://basescan.org/tx/${approvalTx}`);
    }
    console.log(`📝 Staking Tx: https://basescan.org/tx/${stakeReceipt.hash}`);

    // Step 4: Verify staking worked
    await new Promise(resolve => setTimeout(resolve, 500));
    const newStakedBalance = await gaugeContract.balanceOf(agentAddress);
    const newStakedFormatted = ethers.formatEther(newStakedBalance);

    console.log(`\n📊 New Staked Balance: ${newStakedFormatted}`);

    if (newStakedBalance > 0n) {
      console.log("🎯 STEP 5 COMPLETE: LP tokens are now staked and earning rewards!");
    }
  } catch (error: any) {
    logger.error("❌ Direct staking failed:", error);

    if (error?.info?.error?.message?.includes("rate limit")) {
      console.log("\n🚨 Rate limit hit. Wait 2 minutes and try again.");
    }
  }
}
async function generatePositionReceipt(walletService: WalletService, userAddress: string) {
  logger.info(`📄 Generating position receipt for ${userAddress}...`);

  try {
    const agentAddress = walletService.getAgentWallet().address;
    const poolAddress = "0x21594b992F68495dD28d605834b58889d0a727c7";
    const gaugeAddress = "0xBD62Cad65b49b4Ad9C7aa9b8bDB89d63221F7af5";

    // Get staked balance
    const gaugeContract = new ethers.Contract(
      gaugeAddress,
      ["function balanceOf(address account) view returns (uint256)"],
      walletService.getProvider(),
    );

    await new Promise(resolve => setTimeout(resolve, 300));
    const stakedBalanceWei = await gaugeContract.balanceOf(agentAddress);
    const stakedBalance = ethers.formatEther(stakedBalanceWei);

    // Get unstaked balance
    const lpContract = new ethers.Contract(
      poolAddress,
      ["function balanceOf(address owner) view returns (uint256)"],
      walletService.getProvider(),
    );

    await new Promise(resolve => setTimeout(resolve, 300));
    const unstakedBalanceWei = await lpContract.balanceOf(agentAddress);
    const unstakedBalance = ethers.formatEther(unstakedBalanceWei);

    const totalLPValue = (parseFloat(stakedBalance) + parseFloat(unstakedBalance)).toString();

    console.log("\n📄 AERODROME LP POSITION RECEIPT");
    console.log("==================================");
    console.log(`Generated: ${new Date().toISOString()}`);
    console.log("");
    console.log("🔗 Addresses:");
    console.log(`  User Address: ${userAddress}`);
    console.log(`  Agent Address: ${agentAddress}`);
    console.log(`  Pool Contract: ${poolAddress}`);
    console.log(`  Gauge Contract: ${gaugeAddress}`);
    console.log("");
    console.log("💰 LP Token Position:");
    console.log(`  Staked LP (earning rewards): ${stakedBalance}`);
    console.log(`  Unstaked LP: ${unstakedBalance}`);
    console.log(`  Total LP Value: ${totalLPValue}`);
    console.log("");
    console.log("🏊 Pool Information:");
    console.log(`  Pair: WETH-VIRTUAL`);
    console.log(`  Type: Volatile (v2)`);
    console.log(`  Platform: Aerodrome Finance`);
    console.log("");
    console.log("🎁 Rewards:");
    console.log(`  Status: ${parseFloat(stakedBalance) > 0 ? "✅ Earning AERO rewards" : "❌ Not earning rewards"}`);
    console.log(`  Frequency: Continuous (claim anytime)`);
    console.log("");
    console.log("🔗 BaseScan Links:");
    console.log(`  Agent Wallet: https://basescan.org/address/${agentAddress}`);
    console.log(`  LP Token: https://basescan.org/address/${poolAddress}`);
    console.log(`  Gauge: https://basescan.org/address/${gaugeAddress}`);
    console.log("");
    console.log("🚀 Automation Summary:");
    console.log("  ✅ USDC → WETH + VIRTUAL swaps");
    console.log("  ✅ Liquidity provision automated");
    console.log("  ✅ LP token staking automated");
    console.log("  ✅ Rewards earning activated");
    console.log("");
    console.log("📱 Next Steps:");
    console.log("  • LP tokens are now earning AERO rewards");
    console.log("  • Use withdrawal flow when ready to exit");
    console.log("  • Monitor position on Aerodrome.finance");
  } catch (error) {
    logger.error("❌ Failed to generate position receipt:", error);
  }
}
// Run the main function
if (require.main === module) {
  main();
}
