import { performance } from 'perf_hooks';
import { BaseConfig } from './config';

/**
 * Updates a progress bar in the console
 */
export function updateProgressBar(completed: number, total: number, additionalInfo: string = "", barWidth = 100): void {
  // Check if progress bar is disabled via environment variable
  const showProgressBar = process.env.SHOW_PROGRESS_BAR !== 'false';

  // If progress bar is disabled, just return
  if (!showProgressBar) {
    return;
  }

  const percent = completed / total;
  const filledLength = Math.round(percent * barWidth);
  const bar = "=".repeat(filledLength) + "-".repeat(barWidth - filledLength);

  try {
    // Clear the current line and move cursor to start of it
    process.stdout.write('\r');  // Move to the beginning of the line

    // Write out the bar plus a percentage - make sure to pad with spaces to overwrite previous content
    const output = `[${bar}] ${(percent * 100).toFixed(2)}% (${completed}/${total}) ${additionalInfo}`;
    process.stdout.write(output.padEnd(process.stdout.columns || 120, ' '));

    // If completed, move to a new line
    if (completed === total) {
      process.stdout.write("\n");
    }
  } catch (error) {
    // Fallback for environments where process.stdout methods might not be available
    console.log(`Progress: ${(percent * 100).toFixed(2)}% (${completed}/${total}) ${additionalInfo}`);
  }
}

/**
 * Creates a list of block ranges for processing
 */
export function createBlocksList(
  startBlock: number,
  endBlock: number,
  blockRange: number = 1000,
  batchSize: number = 100
): Array<number[]> {
  const blocks: Array<number[]> = [];

  if (blockRange <= 1) {
    // Return individual blocks
    for (let i = startBlock; i <= endBlock; i++) {
      blocks.push([i]);
    }
  } else {
    // Return chunks of blocks
    for (let i = startBlock; i <= endBlock; i += blockRange) {
      const chunk = [];
      for (let j = 0; j < blockRange && i + j <= endBlock; j++) {
        chunk.push(i + j);
      }
      blocks.push(chunk);
    }
  }

  return blocks;
}


/**
 * Creates a list of block ranges for log processing
 * Returns a 2D array:
 * - Outer array: Each HTTP request batch
 * - Inner array: Each RPC method call within the batch (block range)
 */
export function createBlocksListLogs(
  startBlock: number,
  endBlock: number,
  blockRange: number = 1000,
  batchSize: number = 1
): Array<Array<[number, number]>> {
  // First create all the individual block ranges
  const ranges: Array<[number, number]> = [];
  let currentStart = startBlock;

  while (currentStart <= endBlock) {
    const currentEnd = Math.min(currentStart + blockRange - 1, endBlock);
    ranges.push([currentStart, currentEnd]);
    currentStart = currentEnd + 1;
  }

  // Now group these ranges into batches
  const batches: Array<Array<[number, number]>> = [];

  for (let i = 0; i < ranges.length; i += batchSize) {
    batches.push(ranges.slice(i, i + batchSize));
  }

  return batches;
}


/**
 * Calculates and displays statistics for request durations
 */
export function displayStats(durations: number[], totalTimeMs: number, totalBlocks: number): void {
  const minTime = Math.min(...durations);
  const maxTime = Math.max(...durations);
  const avgTime = durations.reduce((acc, val) => acc + val, 0) / durations.length;

  console.log("=== STATS ===");
  console.log(`Total requests:         ${durations.length}`);
  console.log(`Total blocks processed: ${totalBlocks}`);
  console.log(`Min request time (ms):  ${minTime.toFixed(2)}`);
  console.log(`Max request time (ms):  ${maxTime.toFixed(2)}`);
  console.log(`Avg request time (ms):  ${avgTime.toFixed(2)}`);
  console.log(`Total time (ms):        ${totalTimeMs.toFixed(2)}`);
  console.log(`Requests per second:    ${(durations.length / (totalTimeMs / 1000)).toFixed(2)}`);
  console.log(`Blocks per second:      ${(totalBlocks / (totalTimeMs / 1000)).toFixed(2)}`);
}

/**
 * Makes a batch RPC request
 */
export async function makeBatchRequest(
  rpcUrl: string,
  method: string,
  blockNumbers: number[],
  paramsTransformer: (blockNum: number) => any[]
): Promise<number> {
  // Build batch request payload
  const batchPayload = blockNumbers.map((blockNum, index) => ({
    jsonrpc: "2.0",
    id: index + 1,
    method,
    params: paramsTransformer(blockNum)
  }));

  // Time the request
  const start = performance.now();
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batchPayload),
  });
  const end = performance.now();

  if (!response.ok) {
    throw new Error(`RPC request failed with status ${response.status}`);
  }

  // Return the duration for stats
  return end - start;
}

/**
 * Generic function to run an RPC test
 */
export async function runRpcTest(
  config: BaseConfig,
  method: string,
  paramsTransformer: (blockNum: number) => any[],
  description: string
): Promise<void> {
  console.log(`Starting ${description} test with:
- RPC URL: ${config.rpcUrl}
- Start Block: ${config.startBlock}
- End Block: ${config.endBlock}
- Concurrency: ${config.concurrency}
- Chunk Size: ${config.batchSize}
`);

  const blockChunks = createBlocksList(config.startBlock, config.endBlock, config.batchSize);
  const totalBlocks = config.endBlock - config.startBlock + 1;

  const durations: number[] = [];
  let activeRequests = 0;
  let index = 0;
  let processedChunks = 0;

  const startTime = performance.now();

  return new Promise<void>((resolve, reject) => {
    // Dispatch function that processes the next chunk if available
    const dispatch = () => {
      // While there are chunks left and we can spawn more requests:
      while (activeRequests < config.concurrency && index < blockChunks.length) {
        activeRequests++;
        const blockNumbers = blockChunks[index++];

        makeBatchRequest(config.rpcUrl, method, blockNumbers, paramsTransformer)
          .then((duration) => {
            activeRequests--;
            dispatch(); // Attempt to queue up next chunk
            durations.push(duration);
            processedChunks++;
            updateProgressBar(processedChunks, blockChunks.length, `Latest Request End Block: ${blockNumbers[blockNumbers.length - 1]}`);
          })
          .catch((err) => {
            console.error(`Error processing blocks ${blockNumbers.join(',')}:`, err);
            activeRequests--;
            dispatch(); // Continue despite error
          });
      }

      // If no more chunks remain and all requests are done, finish up
      if (index >= blockChunks.length && activeRequests === 0) {
        const endTime = performance.now();
        const totalTimeMs = endTime - startTime;
        displayStats(durations, totalTimeMs, totalBlocks);
        resolve();
      }
    };

    // Kick off initial dispatch
    dispatch();
  });
} 
