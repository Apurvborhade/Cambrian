import { randomUUID } from "crypto";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

type ManagedProcess = {
  name: string;
  child: ChildProcess;
};

type AgentResult = {
  id: string;
  timestamp: string;
  genomeId: string;
  taskId: string;
  taskRound: number;
  senderPeerId?: string;
};

const repoRoot = path.resolve(__dirname, "..", "..");
const axlRoot = path.join(repoRoot, "axl");
const axlBinary = path.join(axlRoot, "node");
const nodesRoot = path.join(axlRoot, "nodes");
const backendNodeDir = path.join(nodesRoot, "backend");
const backendNodeConfig = path.join(backendNodeDir, "node-config.json");
const backendAxlPort = 9002;
const backendApiPort = Number.parseInt(process.env.BACKEND_PORT ?? "3001", 10);
const agentCount = 5;
const agentNodeBasePort = 9003;

const managedProcesses: ManagedProcess[] = [];

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const checkExists = (filePath: string): void => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}. Run npm run spawn:axl-nodes -- 5 9002 first.`);
  }
};

const startProcess = (name: string, command: string, args: string[], env: NodeJS.ProcessEnv, cwd: string): ChildProcess => {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit"
  });

  managedProcesses.push({ name, child });

  child.on("exit", (code, signal) => {
    console.log(`[E2E] ${name} exited with code=${code ?? "null"} signal=${signal ?? "null"}`);
  });

  child.on("error", (error) => {
    console.error(`[E2E] ${name} failed to start:`, error);
  });

  return child;
};

const startWindowsCommand = (name: string, commandLine: string, cwd: string, env: NodeJS.ProcessEnv = {}): ChildProcess => {
  return startProcess(
    name,
    process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", commandLine],
    env,
    cwd
  );
};

const toWslPath = (inputPath: string): string => {
  const resolved = path.resolve(inputPath);
  const driveMatch = resolved.match(/^([A-Za-z]):\\(.*)$/);

  if (!driveMatch) {
    return resolved.replace(/\\/g, "/");
  }

  const driveLetter = driveMatch[1]!.toLowerCase();
  const rest = driveMatch[2]!.replace(/\\/g, "/");
  return `/mnt/${driveLetter}/${rest}`;
};

const startAxlNode = (name: string, cwd: string): ChildProcess => {
  if (process.platform === "win32") {
    const wslCwd = toWslPath(cwd);
    const wslBinary = toWslPath(axlBinary);
    const command = `cd '${wslCwd}' && '${wslBinary}' -config node-config.json`;
    return startProcess(name, "wsl.exe", ["bash", "-lc", command], {}, cwd);
  }

  return startProcess(name, axlBinary, ["-config", "node-config.json"], {}, cwd);
};

const killProcessOnPort = async (port: number): Promise<void> => {
  if (process.platform !== "win32") {
    return; // only needed on Windows
  }

  try {
    const { execSync } = await import("child_process");
    
    // Kill any process on the port using PowerShell Get-NetTCPConnection
    try {
      const psCmd = `(Get-NetTCPConnection -LocalPort ${port} -State Established,Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess) -join ','`;
      const pids = execSync(`powershell.exe -NoProfile -Command "${psCmd}"`, { encoding: "utf-8" }).trim();
      if (pids) {
        for (const pid of pids.split(",").filter(Boolean)) {
          try {
            execSync(`taskkill /PID ${pid} /F 2>nul`, { stdio: "ignore" });
            console.log(`[E2E] killed process on port ${port} (PID ${pid})`);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // PowerShell approach failed, try netstat
      try {
        const result = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf-8" }).trim();
        if (result) {
          for (const line of result.split("\n").filter(Boolean)) {
            const parts = line.split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== "PID") {
              try {
                execSync(`taskkill /PID ${pid} /F 2>nul`, { stdio: "ignore" });
                console.log(`[E2E] killed process on port ${port} (PID ${pid})`);
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
    
    // Force-close connections using netsh (Windows only)
    try {
      execSync(`netsh int ipv4 set dynamicportrange tcp start=49152 num=16384 2>nul`, { stdio: "ignore" });
    } catch {
      // ignore
    }
    
    // Wait for TIME_WAIT sockets to clear (longer delay needed on Windows)
    console.log(`[E2E] waiting for port ${port} to become available...`);
    await sleep(5000);
  } catch {
    // port likely not in use
  }
};

const stopAll = (): void => {
  for (let index = managedProcesses.length - 1; index >= 0; index -= 1) {
    const { name, child } = managedProcesses[index]!;
    if (!child.killed) {
      try {
        child.kill();
      } catch (error) {
        console.warn(`[E2E] failed to stop ${name}:`, error);
      }
    }
  }
};

const waitForHttpOk = async (url: string, label: string, timeoutMs: number): Promise<void> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}`);
};

const waitForAgentRegistry = async (expectedCount: number, timeoutMs: number): Promise<void> => {
  const url = `http://127.0.0.1:${backendApiPort}/api/agents`;
  const deadline = Date.now() + timeoutMs;
  let lastLoggedCount = 0;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = (await response.json()) as { agents?: Array<{ peerId: string }> };
        const agents = data.agents || [];
        const uniquePeerIds = new Set(agents.map((agent) => agent.peerId));
        
        // Log whenever count changes
        if (uniquePeerIds.size !== lastLoggedCount) {
          const elapsed = Math.floor((Date.now() - (deadline - timeoutMs)) / 1000);
          console.log(`[E2E] agent registry: ${uniquePeerIds.size}/${expectedCount} at ${elapsed}s`);
          if (uniquePeerIds.size > 0) {
            for (const peerId of Array.from(uniquePeerIds).slice(0, 3)) {
              console.log(`[E2E]   - ${peerId.slice(0, 16)}...`);
            }
          }
          lastLoggedCount = uniquePeerIds.size;
        }
        
        if (uniquePeerIds.size >= expectedCount) {
          const elapsed = Math.floor((Date.now() - (deadline - timeoutMs)) / 1000);
          console.log(`[E2E] SUCCESS: all ${expectedCount} agents registered in ${elapsed}s`);
          return;
        }
      } else {
        console.warn(`[E2E] /api/agents returned ${response.status}`);
      }
    } catch (error) {
      // keep polling silently
    }

    await sleep(250); // Poll more frequently
  }

  throw new Error(`Timed out waiting for ${expectedCount} registered agents (only ${lastLoggedCount} registered)`);
};

const waitForTopology = async (port: number, label: string, timeoutMs: number): Promise<{ our_public_key: string }> => {
  const deadline = Date.now() + timeoutMs;
  const url = `http://127.0.0.1:${port}/topology`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return (await response.json()) as { our_public_key: string };
      }
    } catch {
      // keep polling
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${label} topology at ${url}`);
};

const collectResults = async (expectedCount: number, taskId: string, timeoutMs: number): Promise<AgentResult[]> => {
  const deadline = Date.now() + timeoutMs;
  const results: AgentResult[] = [];
  const seenGenomeIds = new Set<string>();

  while (Date.now() < deadline && results.length < expectedCount) {
    try {
      const response = await fetch(`http://127.0.0.1:${backendAxlPort}/recv`);

      if (response.status === 204) {
        await sleep(250);
        continue;
      }

      if (!response.ok) {
        throw new Error(`AXL recv returned ${response.status}`);
      }

      const raw = await response.text();
      const parsed = JSON.parse(raw) as Partial<AgentResult>;

      if (parsed.taskId !== taskId || typeof parsed.genomeId !== "string") {
        console.log("[E2E] ignored non-matching inbound AXL message", raw);
        continue;
      }

      if (seenGenomeIds.has(parsed.genomeId)) {
        continue;
      }

      results.push(parsed as AgentResult);
      seenGenomeIds.add(parsed.genomeId);
      console.log(`[E2E] received result ${results.length}/${expectedCount} from ${parsed.genomeId}`);
    } catch (error) {
      console.warn("[E2E] result collector retrying after error:", error);
      await sleep(500);
    }
  }

  if (results.length < expectedCount) {
    throw new Error(`Timed out waiting for ${expectedCount} agent results; only received ${results.length}`);
  }

  return results;
};

const main = async (): Promise<void> => {
  checkExists(backendNodeConfig);
  checkExists(axlBinary);

  for (const suffix of ["agent-1", "agent-2", "agent-3", "agent-4", "agent-5"]) {
    checkExists(path.join(nodesRoot, suffix, "node-config.json"));
  }

  // Clean up any lingering processes from previous runs
  console.log("[E2E] cleaning up leftover processes from previous runs");
  await killProcessOnPort(backendAxlPort);
  for (let i = 0; i < agentCount; i++) {
    await killProcessOnPort(agentNodeBasePort + i);
  }
  
  // Wait for TCP TIME_WAIT sockets to clear (important on Windows)
  console.log("[E2E] waiting for sockets to fully close...");
  await sleep(10000);

  console.log("[E2E] starting backend AXL node first");
  startAxlNode("backend-axl-node", backendNodeDir);

  const backendTopology = await waitForTopology(backendAxlPort, "backend AXL node", 60_000);
  console.log(`[E2E] backend peer id: ${backendTopology.our_public_key}`);

  console.log("[E2E] starting backend API server");
  startProcess(
    "backend-api",
    process.execPath,
    [path.join(repoRoot, "dist", "backend", "server.js")],
    {
      BACKEND_PORT: String(backendApiPort),
      BACKEND_PEER_ID: backendTopology.our_public_key
    },
    repoRoot
  );

  await waitForHttpOk(`http://127.0.0.1:${backendApiPort}/api/agents`, "backend API", 60_000);

  const agentNodes = Array.from({ length: agentCount }, (_, index) => ({
    name: `agent-${index + 1}`,
    dir: path.join(nodesRoot, `agent-${index + 1}`),
    port: agentNodeBasePort + index
  }));

  console.log("[E2E] starting 5 agent AXL nodes");
  for (const agentNode of agentNodes) {
    startAxlNode(`${agentNode.name}-axl-node`, agentNode.dir);
  }

  await Promise.all(agentNodes.map((agentNode) => waitForTopology(agentNode.port, agentNode.name, 60_000)));

  console.log("[E2E] starting 5 agent application loops");
  for (const [index, agentNode] of agentNodes.entries()) {
    startProcess(
      `${agentNode.name}-app`,
      process.execPath,
      [path.join(repoRoot, "dist", "apps", "agent", "index.js"), `genesis-${index + 1}`],
      {
        AXL_NODE_URL: `http://127.0.0.1:${agentNode.port}`,
        BACKEND_URL: `http://127.0.0.1:${backendApiPort}`,
        BACKEND_PEER_ID: backendTopology.our_public_key,
        TARGET_POOL_ADDRESS: "demo-pool"
      },
      repoRoot
    );
  }

  // Increased timeout: 0G KV operations are slow under parallel load
  await waitForAgentRegistry(agentCount, 120_000);

  const taskId = `e2e-task-${randomUUID().slice(0, 8)}`;
  const resultCollector = collectResults(agentCount, taskId, 300_000); // 5 minutes for rate limit recovery

  console.log(`[E2E] posting task ${taskId}`);
  const taskResponse = await fetch(`http://127.0.0.1:${backendApiPort}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: taskId,
      generation: 1,
      round: 1,
      topic: "darwin/task",
      context: {
        poolAddress: "demo-pool",
        roundWindowBlocks: 20,
        notes: "AXL 5-way broadcast e2e smoke test"
      }
    })
  });

  if (!taskResponse.ok) {
    throw new Error(`Task post failed with status ${taskResponse.status}`);
  }

  const taskPayload = (await taskResponse.json()) as { broadcastedTo?: string[] };
  console.log(`[E2E] task broadcasted to ${taskPayload.broadcastedTo?.length ?? 0} registered agents`);

  const results = await resultCollector;
  const uniqueGenomeIds = new Set(results.map((result) => result.genomeId));
  const taskIds = new Set(results.map((result) => result.taskId));

  if (uniqueGenomeIds.size !== agentCount) {
    throw new Error(`Expected ${agentCount} unique genomes, received ${uniqueGenomeIds.size}`);
  }

  if (taskIds.size !== 1 || !taskIds.has(taskId)) {
    throw new Error(`Expected all results to reference task ${taskId}`);
  }

  console.log(`[E2E] success: one task was processed by ${results.length} agents via AXL`);
};

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error("[E2E] broadcast smoke test failed:", message);
    process.exitCode = 1;
  })
  .finally(() => {
    stopAll();
  });