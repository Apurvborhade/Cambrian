/** Short display label for a genome id (matches lineage node labels). */
export function shortGenomeLabel(genomeId: string): string {
  const raw = genomeId.replace(/^0x/, "");
  const tail = raw.slice(-6).toUpperCase();
  const [first = "", second = ""] = tail.split("_");
  return second ? `${first}-${second}` : tail.length > 2 ? `${tail.slice(0, -2)}-${tail.slice(-2)}` : tail;
}
