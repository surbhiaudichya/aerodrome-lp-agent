import { ethers } from "ethers";
import { WalletService } from "./WalletService";
import { ABIS } from "../config/abis";
import { logger } from "../utils/logger";
import { sleep } from "../utils/helpers";

export class TokenService {
  private walletService: WalletService;

  constructor(walletService: WalletService) {
    this.walletService = walletService;
  }

  private getTokenContract(tokenAddress: string): ethers.Contract {
    return new ethers.Contract(tokenAddress, ABIS.ERC20, this.walletService.getAgentWallet());
  }

  async approve(tokenAddress: string, spender: string, amount: bigint): Promise<string> {
    const contract = this.getTokenContract(tokenAddress);
    logger.info(`Approving ${amount.toString()} tokens for ${spender}`);

    try {
      // Add delay to avoid rate limits
      await sleep(200);

      const currentAllowance = await contract.allowance(this.walletService.getAgentWallet().address, spender);

      if (currentAllowance >= amount) {
        logger.info("Sufficient allowance already exists");
        return "no-tx-needed";
      }

      // Reset allowance to 0 first if needed (for some tokens like USDT)
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

  async transferFrom(tokenAddress: string, from: string, to: string, amount: bigint): Promise<string> {
    const contract = this.getTokenContract(tokenAddress);
    logger.info(`Transferring ${amount.toString()} tokens from ${from} to ${to}`);

    try {
      const tx = await contract.transferFrom(from, to, amount);
      const receipt = await tx.wait();

      logger.info(`Token transferFrom successful: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      logger.error(`Token transferFrom failed:`, error);
      throw error;
    }
  }
}
