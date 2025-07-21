export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
}

export interface TokenBalance {
  token: string;
  balance: string;
  balanceWei: bigint;
  decimals: number;
}

export interface SwapRoute {
  from: string;
  to: string;
  stable: boolean;
}

export interface DepositParams {
  userAddress: string;
  usdcAmount: string;
  slippageTolerance?: number;
  deadline?: number;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  gasUsed?: string;
}
