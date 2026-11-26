// The offline suite must not open a network or database connection. This is
// enforced here, not by convention: any outgoing socket fails the test.
import net from "node:net";

const blocked = (): never => {
  throw new Error("offline suite: network connections are blocked (tests/setup/offline.ts)");
};

if (process.env["NIGHTWELL_LIVE"] !== "1") {
  net.Socket.prototype.connect = blocked;
}
