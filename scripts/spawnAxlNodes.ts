import fs from "fs";
import path from "path";
import { generateKeyPairSync } from "crypto";

type AxlNodePlan = {
  name: string;
  role: "backend" | "agent";
  configDir: string;
  privateKeyPath: string;
  configPath: string;
  apiPort: number;
  peerPort: number;
  isBootstrap: boolean;
  startCommandWsl: string;
  startCommandPowerShell: string;
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

const ensureNodeMaterial = (node: AxlNodePlan, nodeConfig: string): void => {
  fs.mkdirSync(node.configDir, { recursive: true });

  if (!fs.existsSync(node.privateKeyPath)) {
    const { privateKey } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" }
    });

    fs.writeFileSync(node.privateKeyPath, privateKey, { encoding: "utf8", flag: "wx" });
  }

  fs.writeFileSync(node.configPath, `${nodeConfig}\n`, { encoding: "utf8" });
};

const main = (): void => {
  const nodeCount = parsePositiveInt(process.argv[2], 3);
  const startingPort = parsePositiveInt(process.argv[3], 9002);
  const rootDir = process.argv[4] ? path.resolve(process.argv[4]) : path.resolve(process.cwd(), "axl", "nodes");
  const startingPeerPort = parsePositiveInt(process.argv[5], 9001);

  const backendNode: AxlNodePlan = {
    name: "backend",
    role: "backend" as const,
    configDir: path.join(rootDir, "backend"),
    privateKeyPath: path.join(rootDir, "backend", "private.pem"),
    configPath: path.join(rootDir, "backend", "node-config.json"),
    apiPort: startingPort,
    peerPort: startingPeerPort,
    isBootstrap: true,
    startCommandWsl: `cd ${toWslPath(path.join(rootDir, "backend"))} && ../../node -config node-config.json`,
    startCommandPowerShell: `Set-Location ${path.join(rootDir, "backend")} ; ..\\..\\node -config node-config.json`
  };

  const nodes: AxlNodePlan[] = [backendNode, ...Array.from({ length: nodeCount }, (_, index) => {
    const nodeNumber = index + 1;
    const name = `agent-${nodeNumber}`;
    const configDir = path.join(rootDir, name);
    const privateKeyPath = path.join(configDir, "private.pem");
    const configPath = path.join(configDir, "node-config.json");
    const apiPort = startingPort + index + 1;
    const peerPort = startingPeerPort + index + 1;

    return {
      name,
      role: "agent" as const,
      configDir,
      privateKeyPath,
      configPath,
      apiPort,
      peerPort,
      isBootstrap: false,
      startCommandWsl: `cd ${toWslPath(configDir)} && ../../node -config node-config.json`,
      startCommandPowerShell: `Set-Location ${configDir} ; ..\\..\\node -config node-config.json`
    };
  })];

  const bootstrapPeerAddr = `tls://127.0.0.1:${backendNode.peerPort}`;

  const configTemplate = (node: AxlNodePlan) => {
    const peerField = node.isBootstrap
      ? `  "Listen": ["${bootstrapPeerAddr}"]`
      : `  "Peers": ["${bootstrapPeerAddr}"]`;

    return `{
  "PrivateKeyPath": "${toWslPath(node.privateKeyPath)}",
  "api_port": ${node.apiPort},
  "bridge_addr": "127.0.0.1",
${peerField}
}`;
  };

  console.log(
    JSON.stringify(
      {
        rootDir,
        backendIncluded: true,
        agentCount: nodeCount,
        note: "Each node needs its own private.pem and config directory so it gets a unique our_public_key.",
        bootstrapPeerAddr,
        nodes: nodes.map((node) => ({
          ...node,
          nodeConfig: configTemplate(node)
        }))
      },
      null,
      2
    )
  );

  for (const node of nodes) {
    ensureNodeMaterial(node, configTemplate(node));
  }

  console.log("");
  console.log("PowerShell / WSL launch outline:");
  for (const node of nodes) {
    console.log(`\n# ${node.name}`);
    console.log(`# PowerShell`);
    console.log(`Set-Location ${node.configDir}`);
    console.log(`.\\..\\..\\node -config node-config.json`);
    console.log(`# WSL`);
    console.log(`cd ${toWslPath(node.configDir)} && ../../node -config node-config.json`);
  }
};

main();