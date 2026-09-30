# Product and technical Gap baseline

| Context | Verified Gap | Evidence | Action | Status |
| --- | --- | --- | --- | --- |
| OpenCode runtime image supply chain | Alpine package installation retains the downloaded apk index in an image layer. | PR #1 Security Scan `36358142730`, job `109060466385`, Trivy `DS-0025` at `packages/opencode/Dockerfile:7`. | Use apk's native `--no-cache`, retain an executable package-install policy regression, then require fresh exact-head Security Scan evidence. | Proposed |
| OpenCode runtime image least privilege | Multiple runtime/container Dockerfiles have no non-root `USER`; the OpenCode image also uses a mutable Alpine base reference. | Same exact-head Trivy job: `DS-0002` and `DS-0001`. | Design and verify compatible non-root homes, file ownership, and immutable base digests in a separate test-first owner repair. | Open |
| OpenCode inherited dependency security | The exact-head scan reports vulnerable locks in `github/bun.lock` and the GLM 5.2 video artifact. | Same exact-head Trivy job; exact CVE and path inventory retained in workflow logs. | Repair each canonical dependency input, regenerate locks with the repository toolchain, and retain exact scanner receipts. | Open |
