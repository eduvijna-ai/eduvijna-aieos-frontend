import {
  verifyBackendPin,
  waitForSharedBootstrap,
  spawnServeApp,
} from "./shared.mjs";

verifyBackendPin();
waitForSharedBootstrap();
spawnServeApp("serve_student_app.py", "STUDENT");
