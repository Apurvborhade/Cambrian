const genomes = ["genesis-a", "genesis-b", "genesis-c", "genesis-d", "genesis-e"];

console.log(
  JSON.stringify(
    genomes.map((genomeId) => ({
      genomeId,
      command: `node dist/apps/agent/index.js ${genomeId}`
    })),
    null,
    2
  )
);
