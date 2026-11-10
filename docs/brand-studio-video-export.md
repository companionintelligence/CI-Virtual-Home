# Brand Studio video export

`story:brand-studio` is the release hand-off from CI-Virtual-Home's audited 3D home video output to CI-Brand-Studio.

The command discovers MP4/report pairs under `video/ads/`, rejects a cut whose video gate has errors, fingerprints each file, and prepares a Brand Studio campaign, asset record, social topic, and drafted social rows. It carries the story copy and the required fictional/stylised disclosure into the social draft. The generated manifest records the source path, SHA-256, Brand Studio asset/topic/post IDs, and duplicate upload response so a rerun is idempotent.

It is read-only unless `--apply` is present. It never calls a social network or Metricool publish endpoint; Brand Studio's export-only publishing boundary remains in force.

```sh
# inspect the current audited video inventory
pnpm run story:brand-studio -- --dry-run --brand-id CI0 --campaign "Companion Home Tours 2026"

# preview only one family or cut
pnpm run story:brand-studio -- --dry-run --family brennan --cut brennan-steve

# explicitly upload and create Brand Studio drafts
BRAND_STUDIO_BASE_URL=http://127.0.0.1:3858 \
pnpm run story:brand-studio -- --apply --brand-id CI0 \
  --platforms Instagram,Facebook,LinkedIn
```

The API key is optional in Brand Studio test mode and can be supplied as `BRAND_STUDIO_API_KEY` or `--api-key` in standalone mode. The default output is `video/brand-studio/export-manifest.json`, which is generated locally and remains under the ignored `video/` tree.

The release gate is intentionally upstream of this integration: render with `story:ads`, review the generated report, then export. A report warning is carried into the Brand Studio topic notes; a report error is not exportable.
