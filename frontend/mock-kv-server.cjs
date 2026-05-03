const http = require("http");

const server = http.createServer((req, res) => {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    let id = 1;

    try {
      const parsed = JSON.parse(body);
      id = parsed.id ?? 1;
    } catch {
      // Ignore parse errors and return a null result.
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id, result: { data: "", size: 0, version: 0 } }));
  });
});

server.listen(6789, "127.0.0.1", () => {
  console.log("mock kv rpc listening on 6789");
});
