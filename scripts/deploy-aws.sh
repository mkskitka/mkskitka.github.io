#!/bin/sh
# Builds the site on this machine (where all the media in src/assets lives) and
# uploads it to AWS: a private S3 bucket served through CloudFront.
#   npm run deploy
# Needs the AWS CLI signed in (`aws login`).
set -e

BUCKET=mk-skitka-site
DISTRIBUTION=E2L55K784TVBE6 # https://mkskitka.com (also https://d2vfx0f1xojaxw.cloudfront.net)

npm run build

# Vite names everything in dist/assets after its contents, so those files can be
# cached for a year. Everything else (index.html, public/ files) is rechecked often.
aws s3 sync dist/assets "s3://$BUCKET/assets" --delete --cache-control 'public, max-age=31536000, immutable'
aws s3 sync dist "s3://$BUCKET" --delete --exclude 'assets/*' --exclude '.DS_Store' --exclude '*/.DS_Store' --cache-control 'public, max-age=300'
aws s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control 'no-cache'

# Tell CloudFront to drop its copy of the pages that keep the same name.
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths '/*' --query 'Invalidation.Status' --output text
echo "Deployed: https://mkskitka.com"
