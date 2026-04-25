import { KeeperHubAuditClient } from "../../integrations/keeperhub/audit";
import { computeRoundFitness } from "./scoring";

export const runOracle = async () => {
  const audit = new KeeperHubAuditClient();
  const receipts = await audit.getAuditLog("genesis-a");
  const latest = receipts.at(-1);

  return computeRoundFitness("genesis-a", 0, 1, latest);
};
