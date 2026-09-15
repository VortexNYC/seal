FROM docker.io/cloudflare/sandbox:0.12.1@sha256:ea9b35e61c800eddbc4450fad333e5dd26033a06f7d36624388b0711bef9f8c5

RUN npm install -g pnpm@11.13.1

# CI sandbox only: do not run the installed toolchain as root.
USER 1000
