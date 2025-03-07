// Get command line arguments
const args = process.argv.slice(2);

console.log("args", args)
const rpcUrl = args[0];
const scenarioName = args[1] || 'default';

console.log("rpcUrl", rpcUrl)
console.log("scenarioName", scenarioName)

import dotenv from 'dotenv';
dotenv.config();

// Base configuration for all RPC tests
export type BaseConfig = {
  rpcUrl: string;
  concurrency: number;
  startBlock: number;
  endBlock: number;
  chunkSize: number;
}

// Specific configuration for getLogs
export type LogsConfig = BaseConfig & {
  addresses: string[];
  topics: string[];
}

// Parse environment variables with validation
export function parseBaseConfig(defaultStartBlock = 0, defaultEndBlock = 1000, defaultChunkSize = 100): BaseConfig {

  if (!rpcUrl) {
    console.error('Error: RPC URL is required as the first argument');
    console.error('Usage: ts-node src/<script> <rpc-url>');
    process.exit(1);
  }

  // Get concurrency from environment variable
  const fetchConcurrencyEnv = process.env.FETCH_CONCURRENCY || '5';
  if (isNaN(Number(fetchConcurrencyEnv)) || Number(fetchConcurrencyEnv) > 100000 || Number(fetchConcurrencyEnv) < 0) {
    throw new Error("FETCH_CONCURRENCY environment variable must be a number less than 100000");
  }
  const concurrency = Number(fetchConcurrencyEnv);

  // Get start block from environment variable or use default
  const startBlockEnv = process.env.START_BLOCK;
  const startBlock = startBlockEnv ?
    (isNaN(Number(startBlockEnv)) ?
      (console.error("START_BLOCK environment variable must be a number"), process.exit(1), 0) :
      Number(startBlockEnv)) :
    defaultStartBlock;

  // Get end block from environment variable or use default
  const endBlockEnv = process.env.END_BLOCK;
  const endBlock = endBlockEnv ?
    (isNaN(Number(endBlockEnv)) ?
      (console.error("END_BLOCK environment variable must be a number"), process.exit(1), 0) :
      Number(endBlockEnv)) :
    defaultEndBlock;

  // Get chunk size from environment variable or use default
  const chunkSizeEnv = process.env.CHUNK_SIZE;
  const chunkSize = chunkSizeEnv ?
    (isNaN(Number(chunkSizeEnv)) || Number(chunkSizeEnv) < 1 ?
      (console.error("CHUNK_SIZE environment variable must be a positive number"), process.exit(1), 0) :
      Number(chunkSizeEnv)) :
    defaultChunkSize;

  return {
    rpcUrl,
    concurrency,
    startBlock,
    endBlock,
    chunkSize
  };
}

type scenario = {
  rpcUrl: string;
  addresses: string[];
  topics: string[];
  concurrency: number;
  startBlock: number;
  endBlock: number;
  chunkSize: number;
}

// Define scenario configurations with RPC URL as a parameter
export const createScenario = () => {
  // Get environment variables for optional overrides
  const startBlockEnv = process.env.START_BLOCK ? Number(process.env.START_BLOCK) : undefined;
  const endBlockEnv = process.env.END_BLOCK ? Number(process.env.END_BLOCK) : undefined;
  const chunkSizeEnv = process.env.CHUNK_SIZE ? Number(process.env.CHUNK_SIZE) : undefined;

  const { concurrency, startBlock, endBlock, chunkSize } = parseBaseConfig(0, 27241550, 1_000)
  switch (scenarioName) {
    case "usdc-approvals":
      return {
        rpcUrl,
        addresses: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
        topics: [
          "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
        ],
        concurrency,
        startBlock,
        endBlock,
        chunkSize,
      };
    case "usdc-aave-withdrawals":
      return {
        rpcUrl,
        addresses: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x00000000000000000000000055b33c314560016688d4764f1eae288ad49576ac"
        ],
        concurrency,
        startBlock,
        endBlock,
        chunkSize,
      };
    case "usdc-user-transfers":
      return {
        rpcUrl,
        addresses: [
          "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
          "0x53983F31E8E0D0c3Fd0b8d85654989A1336317d7",
          "0xE3B53AF74a4BF62Ae5511055290838050bf764Df",
          "0x8B8AfE27885eF024C053Fa831190c86FD56ae596",
          "0x904EfBBaAB6CF3e4499968af1B68aa54D5b586DF",
          "0x9704d2adBc02C085ff526a37ac64872027AC8a50",
          "0x623cD3a3EdF080057892aaF8D773Bbb7A5C9b6e9",
          "0x8e5C04F82d6464b420E2018362E7e7aB813cF190",
          "0x13aFd522018bdc5Da9Cce2f2Cb50B14621Aa99b7",
          "0x07c3233263063D0e9dF5F18719bf59Ea1465E0F5",
          "0x65F8609BEc7455a70248EdBA8884BA68Ca07f2A7",
          "0x5447C43A9869135E3840AdB4cB6243901eabb24d",
          "0x458AD5B487F4442245E4C5eA7249009E607A5583",
          "0xd09600475435CaB0E40DabDb161Fb5A3311EFcB3",
          "0x59dca05b6c26dbd64b5381374aAaC5CD05644C28",
          "0xEB466342C4d449BC9f53A865D5Cb90586f405215",
        ],
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x0000000000000000000000Lol, should we ban0014c5Ca9F70dFc36Ce5919A460CF2E48D7e933cEE"
        ],
        concurrency,
        startBlock,
        endBlock,
        chunkSize,
      };
      break;
    case "basenames-discounts":
      return {
        rpcUrl,
        addresses: ["0x2B7704f1cb9324cD8586B33C6c540CbD64E58237"],
        topics: [
          "0xfe82878a5987cea7129c337d7aaa6a49585236fc104b066223bc5b5e49510e2b"
        ],
        concurrency,
        startBlock,
        endBlock,
        chunkSize,
      };
    default:
      throw new Error(`Scenario "${scenarioName}" not found. Check spelling.`);
      return {
        rpcUrl,
        addresses: ["0xYourContractAddress1", "0xYourContractAddress2"],
        topics: [
          "0xTopic1",
        ],
        concurrency,
        startBlock,
        endBlock,
        chunkSize,
      };
  }
};

// Default export that requires RPC URL to be passed
const finalConfig: scenario = createScenario();
console.log("finalConfig", finalConfig)
module.exports = finalConfig;
