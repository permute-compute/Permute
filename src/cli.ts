#!/usr/bin/env node
import { startWorker } from "./index.js";

startWorker().catch((e) => {
  console.error(e);
  process.exit(1);
});
