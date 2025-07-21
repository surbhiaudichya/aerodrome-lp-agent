import { ethers } from "ethers";

export function parseUnits(value: string, decimals: number): bigint {
  return ethers.parseUnits(value, decimals);
}

export function formatUnits(value: bigint, decimals: number): string {
  return ethers.formatUnits(value, decimals);
}

export function calculateDeadline(minutes: number = 20): number {
  return Math.floor(Date.now() / 1000) + minutes * 60;
}

export function calculateMinAmount(amount: bigint, slippage: number): bigint {
  const slippageBps = BigInt(Math.floor(slippage * 100));
  return (amount * (10000n - slippageBps)) / 10000n;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
