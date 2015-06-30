#!/usr/bin/env bash

export FF_CRYPTO_PASSWORD='4front'
export FF_JWT_TOKEN_SECRET="4front"
export FF_VIRTUAL_HOST='4front.dev'
export FF_JWT_TOKEN_SECRET='token-secret'
export FF_DEPLOYED_ASSETS_PATH='/deployments'
export FF_S3_DEPLOYMENTS_BUCKET='fake-s3-bucket'
export FF_SESSION_SECRET='session-secret'
export FF_LDAP_URL='ldap://LDAP0319.nordstrom.net'
export FF_LDAP_BASE_DN='dc=nordstrom,dc=net'
export DEBUG="4front:*"
export FF_ADDONS="lodash"
export FF_INSTALL_ADDONS="0"

echo $1

if [ $1 = "debug" ]
then
  node debug app.js
else
  nodemon app.js # | bunyan
fi
