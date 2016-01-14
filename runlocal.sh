#!/usr/bin/env bash
# source ./localenv.sh
export FF_S3_BUCKET="fake-s3-bucket"
export DEBUG="4front:*,express-request-proxy,express-session,s3-proxy"
export FAKE_S3_PORT=4658
export DYNAMO_LOCAL_PORT=8000

echo $1

# Start the fakeS3 server
ps -ef | grep bin/s3rver | awk '{print $2}' | xargs kill
./node_modules/.bin/s3rver --port $FAKE_S3_PORT -d ./ --silent &

if [ $1 = "debug" ]
then
  node debug app.js
else
  nodemon app.js # | bunyan
fi
