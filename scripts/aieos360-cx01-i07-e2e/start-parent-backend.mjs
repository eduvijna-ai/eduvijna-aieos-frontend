import {
  verifyBackendPin,
  waitForSharedBootstrap,
  spawnServeApp,
} from "./shared.mjs";

verifyBackendPin();
waitForSharedBootstrap();
spawnServeApp("serve_parent_app.py", "PARENT");
