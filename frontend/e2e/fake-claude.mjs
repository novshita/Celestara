// A stand-in for the Anthropic Messages API, so the browser tests exercise the
// real SDK over real HTTP without a key, a cost, or a model's moods.
//
// A marker word in the question picks a failure:
//   [[AUTH]]   -> 401 (the SDK does not retry this one, so it is quick)
//   [[REFUSE]] -> the model declines (stop_reason "refusal")
// Anything else gets an ordinary answer.
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 8201);

createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const send = (status, payload) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    };
    if (request.method !== "POST" || request.url !== "/v1/messages") {
      return send(404, { type: "error", error: { type: "not_found_error", message: "no such route" } });
    }
    const text = body;
    if (text.includes("[[AUTH]]")) {
      return send(401, { type: "error", error: { type: "authentication_error", message: "invalid key" } });
    }
    const refused = text.includes("[[REFUSE]]");
    send(200, {
      id: "msg_fake",
      type: "message",
      role: "assistant",
      model: "fake",
      content: refused
        ? []
        : [{ type: "text", text: "Fake guide: your chart's placements are themes to reflect on, not predictions." }],
      stop_reason: refused ? "refusal" : "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 20 },
    });
  });
}).listen(port, "127.0.0.1");
