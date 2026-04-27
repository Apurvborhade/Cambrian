import { arenaExists, createArena, runArena } from "../core/arena/arena";

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const main = async (): Promise<void> => {
  const arenaId = process.argv[2] ?? "default-arena";
  const size = Number.parseInt(process.argv[3] ?? "5", 10);
  const generations = Number.parseInt(process.argv[4] ?? "1", 10);

  const exists = await arenaExists(arenaId);
  if (!exists) {
    const created = await createArena(arenaId, size);
    console.log(
      JSON.stringify(
        {
          arenaId,
          created: created.map((genome) => ({
            genome_id: genome.genome_id,
            token_id: genome.token_id,
            nft_contract: genome.nft_contract,
            fitness: genome.fitness
          }))
        },
        null,
        2
      )
    );
  } else {
    console.log(JSON.stringify({ arenaId, message: "Arena already exists, reusing stored roster." }, null, 2));
  }

  const evolved = await runArena(arenaId, generations);
  console.log(
    JSON.stringify(
      {
        arenaId,
        generations,
        evolved: evolved.map((genome) => ({
          genome_id: genome.genome_id,
          token_id: genome.token_id,
          nft_contract: genome.nft_contract,
          fitness: genome.fitness
        }))
      },
      null,
      2
    )
  );
};

void main().catch((error: unknown) => {
  console.error(`Arena runner failed: ${formatError(error)}`);
  process.exitCode = 1;
});
