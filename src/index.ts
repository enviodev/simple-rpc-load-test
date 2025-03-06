const config = require("./config");

interface EthGetLogsParams {
  fromBlock: string;
  toBlock: string;
  address?: string[];
  topics?: string[];
}

async function fetchLogs(params: EthGetLogsParams): Promise<number> {
  // Build standard JSON RPC payload
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getLogs",
    params: [params],
  };

  // Time the request
  const start = performance.now();
  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const end = performance.now();

  if (!response.ok) {
    throw new Error(`RPC request failed with status ${response.status}`);
  }

  // Return the duration for stats
  return end - start;
}

function createBlocksList(
  startBlock: number,
  endBlock: number,
  chunkSize: number
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let currentStart = startBlock;
  while (currentStart <= endBlock) {
    const currentEnd = Math.min(currentStart + chunkSize - 1, endBlock);
    ranges.push([currentStart, currentEnd]);
    currentStart = currentEnd + 1;
  }
  return ranges;
}

function updateProgressBar(completed: number, total: number, barWidth = 100): void {
  const percent = completed / total;
  const filledLength = Math.round(percent * barWidth);
  const bar = "=".repeat(filledLength) + "-".repeat(barWidth - filledLength);

  // Clear the current line and move cursor to start of it
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);

  // Write out the bar plus a percentage, e.g. [=====-----] 42.00%
  process.stdout.write(`[${bar}] ${(percent * 100).toFixed(2)}% (${completed}/${total})`);

  // If completed, move to a new line
  if (completed === total) {
    process.stdout.write("\n");
  }
}

async function runTest() {
  const { addresses, topics, concurrency, startBlock, endBlock, chunkSize } =
    config;

  const blockRanges = createBlocksList(startBlock, endBlock, chunkSize);

  const durations: number[] = [];
  let activeRequests = 0;
  let index = 0;

  const startTime = performance.now();

  return new Promise<void>((resolve, reject) => {
    // Dispatch function that processes the next chunk if available
    const dispatch = async () => {
      // While there are ranges left and we can spawn more requests:
      while (activeRequests < concurrency && index < blockRanges.length) {
        activeRequests++;
        const [fromBlock, toBlock] = blockRanges[index++];
        const hexFrom = "0x" + fromBlock.toString(16);
        const hexTo = "0x" + toBlock.toString(16);

        fetchLogs({
          fromBlock: hexFrom,
          toBlock: hexTo,
          address: addresses,
          topics: topics,
        })

          .then((duration) => {
            activeRequests--;
            dispatch(); // Attempt to queue up next chunk
            durations.push(duration);
            updateProgressBar(index, blockRanges.length);
          })
          .catch((err) => reject(err));
      }

      // If no more chunks remain and all requests are done, finish up
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
        console.log(`Min request time (ms):  ${minTime.toFixed(2)}`);
        console.log(`Max request time (ms):  ${maxTime.toFixed(2)}`);
        console.log(`Avg request time (ms):  ${avgTime.toFixed(2)}`);
        console.log(`Total time (ms):        ${totalTimeMs.toFixed(2)}`);
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
