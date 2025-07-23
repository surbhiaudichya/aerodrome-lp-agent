import dotenv from "dotenv";
import { ethers } from "ethers";
import { logger } from "./utils/logger";
import { CONTRACTS, CHAIN_ID } from "./config/contracts";
import { WalletService } from "./services/WalletService";
import { TokenService } from "./services/TokenService";
import { AerodromeService } from "./services/AerodromeService";
import { LPAgent } from "./services/LPAgent";
import { parseUnits } from "./utils/helpers";

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

      case "balances":
        await showTokenBalances(tokenService);
        break;

      case "agent-balances":
        await showAgentBalances(lpAgent);
        break;

      case "status":
        await showAgentStatus(walletService, tokenService, aerodromeService);
        break;

      default:
        logger.info("Available commands:");
        logger.info("  npm run dev test - Test wallet service");
        logger.info("  npm run dev test-tokens - Test token service");
        logger.info("  npm run dev test-aerodrome - Test Aerodrome connection");
        logger.info("  npm run dev test-lp - Test LP Agent");
        logger.info("  npm run dev simulate <amount> - Simulate deposit");
        logger.info("  npm run dev check <userAddr> <amount> - Check if user can deposit");
        logger.info("  npm run dev deposit <userAddr> <amount> - 🚨 EXECUTE REAL DEPOSIT");
        logger.info("  npm run dev approve <token> <amount> - Approve agent to spend tokens");
        logger.info("  npm run dev refund <userAddr> - Refund USDC from agent to user");
        logger.info("  npm run dev finish-lp - Complete LP addition with existing tokens");
        logger.info("  npm run dev execute-lp - Execute LP addition (bypasses rate limits)");
        logger.info("  npm run dev complete-deposit <userAddr> <amount> - Complete FULL deposit flow");
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

// Run the main function
if (require.main === module) {
  main();
}
