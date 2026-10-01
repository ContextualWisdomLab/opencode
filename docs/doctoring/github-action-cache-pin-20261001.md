# GitHub Action cache dependency pin

## Problem and evidence

OpenCode publishes `github/action.yml` as a composite action. Exact-head SAST
run `36848110084`, job `110323025333`, reported its `actions/cache@v4`
dependency as mutable. The alias is resolved again inside every consumer
runner, so a later upstream tag movement could execute bytes that were never
reviewed with this source revision.

The predecessor production-file regression was RED: it observed `v4` where
the reviewed commit identity was required. No checksum or other immutable
binding existed at that execution edge.

## Constraints and decision

The repair must preserve cache behavior, add no dependency, and avoid copying
the upstream action. The selected change reuses the v4.3.0 commit already
pinned elsewhere in this repository:
`0057852bfaa89a56745cba8c7296529d2fc39830`.

A floating major tag was rejected because it preserves the original mutable
resolution. Removing the cache was rejected because provenance can be fixed
without discarding the established build optimization. A custom wrapper was
rejected because it would add code without strengthening the trust boundary.

## Executable contract and effects

The focused Bun test parses the published YAML structure and requires the
single executable `actions/cache` edge to equal the reviewed commit. It fails
if the edge returns to a tag, disappears, duplicates, or changes to a
different commit without an explicit test review. An adversarial fixture also
proves that cache-shaped text in an inert block scalar cannot satisfy the
oracle while an executable step remains mutable.

For a consumer invoking the composite action, cache execution is now bound to
the reviewed upstream tree instead of the tag value observed at run time.
Normal cache-key and path behavior is unchanged.

## Risks and follow-up

The fixed commit will not receive later upstream fixes automatically. A future
upgrade must review a new commit, update the executable contract, and obtain
fresh exact-head SAST evidence. This repair covers only the published
`actions/cache` edge; other scanner findings remain open in
`docs/product-technical-gap-baseline.md`.
