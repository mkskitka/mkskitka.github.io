#!/bin/sh
# Builds the site on this machine (where all the media in src/assets lives) and
# uploads it to AWS: a private S3 bucket served through CloudFront.
#   npm run deploy
# Needs the AWS CLI signed in (`aws login`).
set -e

BUCKET=mk-skitka-site
DISTRIBUTION=E2L55K784TVBE6 # https://mkskitka.com (also https://d2vfx0f1xojaxw.cloudfront.net)

# The PDF behind the "PDF ->" link on /resume, made from resume/resume.html.
node scripts/resume-build.mjs
sh scripts/resume-pdf.sh public/resume.pdf

npm run build

# Vite names everything in dist/assets after its contents, so those files can be
# cached for a year. Everything else (index.html, public/ files) is rechecked often.
# The new assets go up first and the old ones are left in place for now: a visitor
# who still has the previous index.html (cached, or a tab left open) keeps loading
# the files it names. They are pruned below once they are a week out of date.
aws s3 sync dist/assets "s3://$BUCKET/assets" --cache-control 'public, max-age=31536000, immutable'
aws s3 sync dist "s3://$BUCKET" --delete --exclude 'assets/*' --exclude '.DS_Store' --exclude '*/.DS_Store' --cache-control 'public, max-age=300'
aws s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control 'no-cache'

# Tell CloudFront to drop its copy of the pages that keep the same name.
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths '/*' --query 'Invalidation.Status' --output text

# Prune: assets no longer in this build and last uploaded over a week ago (so any
# page still naming them is long gone).
CUTOFF=$(date -u -v-7d +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S)
aws s3api list-objects-v2 --bucket "$BUCKET" --prefix assets/ \
  --query "Contents[?LastModified<'$CUTOFF'].Key" --output text |
  tr '\t' '\n' | while read -r key; do
    [ -n "$key" ] && [ "$key" != None ] && [ ! -e "dist/$key" ] && aws s3 rm "s3://$BUCKET/$key" --only-show-errors || true
  done

echo "Deployed: https://mkskitka.com"
