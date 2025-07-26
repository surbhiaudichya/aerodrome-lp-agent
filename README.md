# DeFi Agent Assignment: Aerodrome WETH-VIRTUAL LP Automation

## 🎯 Objective

A fully automated liquidity provision agent that handles the complete LP lifecycle from USDC deposit to staked LP tokens in the Aerodrome WETH-VIRTUAL pool on Base chain.

## ✅ Assignment Status: COMPLETE

**All 6 core steps implemented and successfully executed on Base mainnet with real transactions.**

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- TypeScript
- Base mainnet access

### Installation
```bash
git clone <your-repository>
cd aerodrome-lp-agent
npm install
```

### Environment Setup
Create `.env` file:
```env
BASE_RPC_URL=https://mainnet.base.org/YOUR_API_KEY
AGENT_PRIVATE_KEY=your_agent_private_key_here
```

### Agent Wallet Setup
The agent uses its own dedicated wallet for executing all transactions:
- **Agent Address:** `0x747Dc4A00d0eFDA9053a29e691c60D0BfC9fc180`
- **Network:** Base Mainnet (Chain ID: 8453)
- **Requirements:** Minimum 0.01 ETH for gas fees

## 🎯 Core Functionality

### Single Command Execution
```bash
npm run dev deposit <userAddress> <usdcAmount>
```

**Example:**
```bash
npm run dev deposit 0x65655D5d18F41775156CdFb53cC5710E13380070 4
```

This executes the complete 6-step automation:

## 📋 Complete LP Deposit Flow

### Input
- **User deposits:** USDC tokens
- **User must approve:** Agent to spend their USDC first

### Output
- **Staked LP tokens** in Aerodrome gauge earning AERO rewards
- **Position receipt** with complete details

### 6-Step Process

1. **Accept USDC from user**
   - Transfers USDC from user to agent wallet
   - Validates sufficient balance and approvals

2. **Swap 50% USDC → WETH**
   - Uses Aerodrome Router for optimal pricing
   - Applies 0.5% slippage protection

3. **Swap 50% USDC → VIRTUAL**
   - Converts remaining USDC to VIRTUAL tokens
   - Balances portfolio for LP provision

4. **Add liquidity to WETH-VIRTUAL pool**
   - Deposits tokens into volatile pool
   - Receives LP tokens representing position

5. **Stake LP tokens in Aerodrome gauge**
   - Stakes LP tokens to earn AERO rewards
   - Maximizes yield for user position

6. **Return position receipt to user**
   - Generates detailed receipt with all addresses
   - Includes staking status and BaseScan links

## 🏆 Successful Transaction Hashes

### Production Execution (Base Mainnet)

**Complete 6-Step Deposit Flow:**
- **USDC Transfer:** [0xb384ec14b4ecd9509e2752d96c8d356a21fe767c8c37ba27c7c67d73c9be036b](https://basescan.org/tx/0xb384ec14b4ecd9509e2752d96c8d356a21fe767c8c37ba27c7c67d73c9be036b)
- **USDC→WETH Swap:** [0x13a2454eddc2dd0a74a3a42e4b05300e6de684f927df96fe5f419e9c4392acb1](https://basescan.org/tx/0x13a2454eddc2dd0a74a3a42e4b05300e6de684f927df96fe5f419e9c4392acb1)
- **USDC→VIRTUAL Swap:** [0x3d977ce3ca18809effc50abb3dc26bd61a2ae9351e5d45b9805b9daefedc2d1d](https://basescan.org/tx/0x3d977ce3ca18809effc50abb3dc26bd61a2ae9351e5d45b9805b9daefedc2d1d)
- **Add Liquidity:** [0x39425a1832706dccb5107715771dd91a69d1d210a4e229d6a553e1ef90f9973b](https://basescan.org/tx/0x39425a1832706dccb5107715771dd91a69d1d210a4e229d6a553e1ef90f9973b)
- **Stake LP Tokens:** [0x8b5839d4821544246cca10e5f873ed54abef326c869779d2cd9386b9700158cf](https://basescan.org/tx/0x8b5839d4821544246cca10e5f873ed54abef326c869779d2cd9386b9700158cf)

**Result:** Successfully created and staked `0.000664620810979036` LP tokens from 4 USDC deposit.

## 🏗️ Architecture

### Core Services

**WalletService**
- Manages agent wallet and gas balance
- Ensures sufficient ETH for all operations

**TokenService** 
- Handles ERC20 token operations
- Manages approvals and transfers

**AerodromeService**
- Integrates with Aerodrome DEX
- Handles swaps and liquidity provision

**GaugeService**
- Manages LP token staking
- Interfaces with Aerodrome gauges

**LPAgent**
- Orchestrates complete workflow
- Provides single command interface

### Smart Contracts Used

| Contract | Address | Purpose |
|----------|---------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Input token |
| WETH | `0x4200000000000000000000000000000000000006` | LP component |
| VIRTUAL | `0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b` | LP component |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | Swaps & liquidity |
| Aerodrome Factory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | Pool discovery |
| WETH-VIRTUAL Pool | `0x21594b992F68495dD28d605834b58889d0a727c7` | LP token contract |
| Staking Gauge | `0xBD62Cad65b49b4Ad9C7aa9b8bDB89d63221F7af5` | Reward staking |

## ✅ Essential Features Implemented

### ✅ Agent Wallet Requirements
- **Dedicated Wallet:** Agent has its own wallet (`0x747Dc4A00d0eFDA9053a29e691c60D0BfC9fc180`)
- **Gas Management:** Automatically maintains ETH balance for transaction fees
- **Transaction Signing:** Agent signs all transactions with its own private keys

### ✅ Core Features
- **Slippage Protection:** Configurable tolerance (default 0.5%)
- **Gas Optimization:** Efficient approval management
- **Error Handling:** Comprehensive error catching and reporting
- **Rate Limit Protection:** Built-in delays to avoid RPC issues

### ✅ Technical Implementation
- **Language:** TypeScript with ethers.js v6
- **Aerodrome Integration:** Router for swaps, Factory for pools, Gauges for staking
- **Token Approvals:** Efficient approval handling with reset logic
- **Real-time Balance:** Accurate LP token calculation from contracts

## 🎯 Core Requirements Achieved

### ✅ LP Deposit Flow
- **Input:** User deposits USDC
- **Output:** Staked LP tokens in Aerodrome gauge
- **Automation:** Complete 6-step process in single command
- **Proof:** Successful mainnet transactions

### ✅ Agent Wallet System
- **Dedicated wallet** for all agent operations
- **Gas management** ensures sufficient ETH
- **Transaction signing** with agent's own keys
- **Separation of concerns** between user and agent

### ✅ Error Handling Foundation
- **Transaction validation** before execution
- **Balance verification** at each step
- **Comprehensive logging** for debugging
- **Future-ready** for refund implementation

## 📊 Example Execution

```bash
$ npm run dev deposit 0x65655D5d18F41775156CdFb53cC5710E13380070 4

🚀 EXECUTING COMPLETE 6-STEP DEPOSIT AUTOMATION
===============================================
User: 0x65655D5d18F41775156CdFb53cC5710E13380070
Amount: 4 USDC

✅ Step 1: Transferring USDC from user to agent...
✅ Step 2: Approving USDC for Aerodrome router...
✅ Step 3: Swapping USDC → WETH...
✅ Step 4: Swapping USDC → VIRTUAL...
✅ Step 5: Adding liquidity to WETH-VIRTUAL pool...
✅ Step 6: Staking LP tokens in Aerodrome gauge...

🎉 COMPLETE AUTOMATION SUCCESS!
✅ Staked LP Amount: 0.000664620810979036
📄 Position receipt generated with all details
```

## 🔮 Future Enhancements

### Phase 2: Withdrawal Flow
- **LP Unstaking:** Remove tokens from gauge
- **Liquidity Removal:** Extract WETH and VIRTUAL
- **Token Swaps:** Convert back to USDC
- **User Refund:** Return consolidated USDC

### Phase 3: Advanced Features
- **Error Recovery:** Automatic USDC refund on failures
- **Smart Wallet Integration:** Account abstraction support
- **Concentrated Liquidity:** Active range management
- **Multi-user Support:** Internal accounting system

## 🛠️ Development Commands

```bash
# Execute complete deposit flow
npm run dev deposit <userAddress> <usdcAmount>

# View help
npm run dev

# Build project
npm run build

# Start production
npm start
```

## ⚠️ Important Notes

### User Prerequisites
1. **USDC Balance:** User must have sufficient USDC
2. **Approval Required:** User must approve agent to spend USDC
3. **Base Network:** Transactions execute on Base mainnet

### Security Considerations
- **Agent Wallet:** Keep private key secure
- **Gas Requirements:** Ensure agent has sufficient ETH
- **Rate Limiting:** Built-in delays prevent RPC issues

### Current Limitations
- **Single Asset Input:** Currently supports USDC only
- **Fixed Pool:** WETH-VIRTUAL pool only
- **Manual Approval:** Users must approve agent manually

## 📝 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- **Aerodrome Finance** for the DEX infrastructure
- **Base** for the L2 blockchain platform
- **OpenZeppelin** for smart contract standards

---

**🎯 Assignment Status: COMPLETE**  
**📊 Mainnet Proof: 5 Successful Transactions**  
**🏆 All Core Requirements: Implemented and Tested**