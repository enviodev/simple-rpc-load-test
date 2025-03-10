import { performance } from 'perf_hooks';
import { updateProgressBar, createBlocksListLogs, displayStats } from '../lib/utils';

// Get command line arguments
const args = process.argv.slice(2);
const rpcUrl = args[0];
const { createScenario } = require("../lib/config");
const config = createScenario();

interface BlockRange {
  fromBlock: string;
  toBlock: string;
}

interface EthGetLogsParams {
  address?: string[];
  topics?: string[];
  blockRange?: BlockRange;  // For single requests
}

interface LogsResult {
  duration: number;
  logsCount: number;
  fromBlock: number;
  toBlock: number;
}

async function fetchLogs(blockRanges: Array<[number, number]>, addresses: string[], topics: string[]): Promise<LogsResult> {
  // Build batch JSON RPC payload
  const batchPayload = blockRanges.map((range, index) => {
    const [fromBlock, toBlock] = range;
    return {
      jsonrpc: "2.0",
      id: index + 1,
      method: "eth_getLogs",
      params: [{
        fromBlock: "0x" + fromBlock.toString(16),
        toBlock: "0x" + toBlock.toString(16),
        address: addresses,
        topics: topics
      }]
    };
  });

  // Time the request
  const start = performance.now();
  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batchPayload),
  });
  const end = performance.now();

  if (!response.ok) {
    throw new Error(`RPC request failed with status ${response.status}`);
  }

  // Parse the response to get the logs
  const responseData = await response.json();

  // Calculate total logs and block range
  let totalLogs = 0;
  let minBlock = Number.MAX_SAFE_INTEGER;
  let maxBlock = 0;

  // Handle both array response and single response
  const results = Array.isArray(responseData) ? responseData : [responseData];

  results.forEach(data => {
    const logs = data.result || [];
    totalLogs += logs.length;

    // Update min/max blocks
    const range = blockRanges[data.id - 1];
    if (range) {
      minBlock = Math.min(minBlock, range[0]);
      maxBlock = Math.max(maxBlock, range[1]);
    }
  });

  // Return the duration, logs count, and block range
  return {
    duration: end - start,
    logsCount: totalLogs,
    fromBlock: minBlock === Number.MAX_SAFE_INTEGER ? 0 : minBlock,
    toBlock: maxBlock
  };
}

async function runTest() {
  const { addresses, topics, concurrency, startBlock, endBlock, batchSize, blockRange } = config;

  console.log(`Starting eth_getLogs test with:
- RPC URL: ${config.rpcUrl}
- Start Block: ${startBlock}
- End Block: ${endBlock}
- Concurrency: ${concurrency}
- Block Range: ${blockRange}
- Batch Size: ${batchSize}
`);

  const blockRanges = createBlocksListLogs(startBlock, endBlock, blockRange, batchSize);

  const durations: number[] = [];
  let activeRequests = 0;
  let index = 0;
  let totalLogs = 0;
  let totalBlocksScanned = 0;

  const startTime = performance.now();

  return new Promise<void>((resolve, reject) => {
    // Dispatch function that processes the next batch if available
    const dispatch = async () => {
      // While there are batches left and we can spawn more requests:
      while (activeRequests < concurrency && index < blockRanges.length) {
        activeRequests++;
        const batch = blockRanges[index++];

        fetchLogs(batch, addresses, topics)
          .then((result) => {
            activeRequests--;
            dispatch(); // Attempt to queue up next batch
            durations.push(result.duration);
            totalLogs += result.logsCount;
            totalBlocksScanned += (result.toBlock - result.fromBlock + 1);

            updateProgressBar(
              index,
              blockRanges.length,
              `Logs: ${totalLogs}, Blocks: ${totalBlocksScanned}` +
              `Batch ${index}/${blockRanges.length}: Blocks ${result.fromBlock}-${result.toBlock}, totalLogsFound ${totalLogs}` +
              `Latest request found ${result.logsCount} logs - Took ${result.duration.toFixed(2)}ms`
            );
          })
          .catch((err) => {
            console.error(`Error fetching batch ${index - 1}:`, err);
            activeRequests--;
            dispatch(); // Continue despite error
          });
      }

      // If no more batches remain and all requests are done, finish up
      if (index >= blockRanges.length && activeRequests === 0) {
        const endTime = performance.now();
        // Compute stats
        const totalTimeMs = endTime - startTime;
        const minTime = Math.min(...durations);
        const maxTime = Math.max(...durations);
        const avgTime =
          durations.reduce((acc, val) => acc + val, 0) / durations.length;

        console.log("=== STATS ===");
        console.log(`Total requests:         ${durations.length}`);
        console.log(`Total logs found:       ${totalLogs}`);
        console.log(`Total blocks scanned:   ${totalBlocksScanned}`);
        console.log(`Min request time (ms):  ${minTime.toFixed(2)}`);
        console.log(`Max request time (ms):  ${maxTime.toFixed(2)}`);
        console.log(`Avg request time (ms):  ${avgTime.toFixed(2)}`);
        console.log(`Total time (ms):        ${totalTimeMs.toFixed(2)}`);
        console.log(`Logs per second:        ${(totalLogs / (totalTimeMs / 1000)).toFixed(2)}`);
        console.log(`Blocks per second:      ${(totalBlocksScanned / (totalTimeMs / 1000)).toFixed(2)}`);
        resolve();
      }
    };

    // Kick off initial dispatch
    dispatch();
  });
}

runTest().catch((err) => {
  console.error("Error running test:", err);
  process.exit(1);
});
