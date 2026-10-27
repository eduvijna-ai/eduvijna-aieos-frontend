import {
  verifyBackendPin,
  waitForSharedBootstrap,
  spawnServeApp,
} from "./shared.mjs";

verifyBackendPin();
waitForSharedBootstrap();
spawnServeApp("serve_principal_app.py", "PRINCIPAL");
