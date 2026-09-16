FROM docker.io/cloudflare/sandbox:0.12.1@sha256:ea9b35e61c800eddbc4450fad333e5dd26033a06f7d36624388b0711bef9f8c5

RUN npm install -g pnpm@11.13.1

# The sandbox runtime runs commands as uid 1000 but the base image leaves
# /workspace root-owned. Allow the unprivileged user to create files there
# (including the .sqsh backup archive mksquashfs writes to /workspace).
RUN chgrp 0 /workspace && chmod 2775 /workspace

# CI sandbox only: do not run the installed toolchain as root.
USER 1000
