import { runOracle } from "./keeperReader";

void runOracle().then((result) => {
  console.log(JSON.stringify(result, null, 2));
});
