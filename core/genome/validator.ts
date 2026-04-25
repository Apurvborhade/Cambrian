import type { AgentGenome } from "../types/genome";
import { genomeSchema } from "./schema";

const inRange = (value: number, min: number, max: number): boolean =>
  Number.isFinite(value) && value >= min && value <= max;

export const validateGenome = (genome: AgentGenome): string[] => {
  const issues: string[] = [];

  for (const field of genomeSchema.requiredFields) {
    if (genome[field] === undefined || genome[field] === null) {
      issues.push(`Missing required genome field: ${field}`);
    }
  }

  if (!genome.reasoning_strategy || genome.reasoning_strategy.length < 20) {
    issues.push("Genome reasoning_strategy must be at least 20 characters.");
  }

  if (!Number.isInteger(genome.memory_window) || genome.memory_window <= 0) {
    issues.push("Genome memory_window must be a positive integer.");
  }

  if (!inRange(genome.risk_threshold, 0, 1)) {
    issues.push("Genome risk_threshold must be between 0 and 1.");
  }

  if (!inRange(genome.mutation_rate_at_birth, 0, 1)) {
    issues.push("Genome mutation_rate_at_birth must be between 0 and 1.");
  }

  for (const key of genomeSchema.numericWeightKeys) {
    if (!inRange(genome.tool_weights[key], 0, 1)) {
      issues.push(`Genome tool weight ${key} must be between 0 and 1.`);
    }
  }

  return issues;
};

export const assertValidGenome = (genome: AgentGenome): AgentGenome => {
  const issues = validateGenome(genome);
  if (issues.length > 0) {
    throw new Error(`Invalid genome:\n${issues.join("\n")}`);
  }
  return genome;
};
