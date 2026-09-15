import { CiSandbox } from "@cloudflare/ci/worker";

import { CI } from "./ci";

export { CiSandbox, CI };

export default {
  fetch(_request: Request, _env: Env) {
    return new Response("vortex-sign-ci", { status: 200 });
  },
};
