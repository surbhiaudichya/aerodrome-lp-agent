import { ethers } from "ethers";
import { WalletService } from "./WalletService";
import { ABIS } from "../config/abis";
import { TokenInfo, TokenBalance } from "../types";
import { logger } from "../utils/logger";
import { formatUnits } from "../utils/helpers";

export class TokenService {
  private walletService: WalletService;

  constructor(walletService: WalletService) {
    this.walletService = walletService;
  }

  private getTokenContract(tokenAddress: string): ethers.Contract {
    return new ethers.Contract(tokenAddress, ABIS.ERC20, this.walletService.getAgentWallet());
  }

  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    const contract = this.getTokenContract(tokenAddress);

    try {
      const [name, symbol, decimals] = await Promise.all([contract.name(), contract.symbol(), contract.decimals()]);

      return {
        name,
        symbol,
        decimals: Number(decimals),
        address: tokenAddress,
      };
    } catch (error) {
      logger.error(`Failed to get token info for ${tokenAddress}:`, error);
      throw error;
    }
  }

  async getBalance(tokenAddress: string, account?: string): Promise<TokenBalance> {
    const contract = this.getTokenContract(tokenAddress);
    const address = account || this.walletService.getAgentWallet().address;

    try {
      const [balanceWei, decimals] = await Promise.all([contract.balanceOf(address), contract.decimals()]);

      const balance = formatUnits(balanceWei, decimals);

      return {
        token: tokenAddress,
        balance,
        balanceWei,
        decimals: Number(decimals),
      };
    } catch (error) {
      logger.error(`Failed to get balance for ${tokenAddress}:`, error);
      throw error;
    }
  }

  async approve(tokenAddress: string, spender: string, amount: bigint): Promise<string> {
    const contract = this.getTokenContract(tokenAddress);

    logger.info(`Approving ${amount.toString()} tokens for ${spender}`);

    try {
      // Check current allowance
      const currentAllowance = await contract.allowance(this.walletService.getAgentWallet().address, spender);

      if (currentAllowance >= amount) {
        logger.info("Sufficient allowance already exists");
        return "no-tx-needed";
      }

      // If there's existing allowance, reset to 0 first (for some tokens like USDT)
      if (currentAllowance > 0n) {
        const resetTx = await contract.approve(spender, 0n);
        await resetTx.wait();
        logger.info("Reset existing allowance to 0");
      }

      const tx = await contract.approve(spender, amount);
      const receipt = await tx.wait();

      logger.info(`Token approval successful: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      logger.error(`Token approval failed:`, error);
      throw error;
    }
  }

  async transfer(tokenAddress: string, to: string, amount: bigint): Promise<string> {
    const contract = this.getTokenContract(tokenAddress);

    logger.info(`Transferring ${amount.toString()} tokens to ${to}`);

    try {
      const tx = await contract.transfer(to, amount);
      const receipt = await tx.wait();

      logger.info(`Token transfer successful: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      logger.error(`Token transfer failed:`, error);
      throw error;
    }
  }
}
