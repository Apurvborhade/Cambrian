import { createSeedGenomes } from "../core/genome/generator";

const genomes = createSeedGenomes();
console.log(JSON.stringify(genomes, null, 2));
