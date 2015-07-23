#!/usr/bin/env bash

export FF_CRYPTO_PASSWORD='4front'
export FF_JWT_TOKEN_SECRET="4front"
export FF_VIRTUAL_HOST='4front.dev'
export FF_JWT_TOKEN_SECRET='token-secret'
export FF_DEPLOYED_ASSETS_PATH='/deployments'
export FF_S3_DEPLOYMENTS_BUCKET='fake-s3-bucket'
export FF_SESSION_SECRET='session-secret'
export FF_JWT_TOKEN_EXPIRE=1440
export DEBUG="4front:*,express-request-proxy"

echo $1

if [ $1 = "debug" ]
then
  node debug app.js
else
  nodemon app.js # | bunyan
fi
