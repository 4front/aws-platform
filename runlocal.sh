#!/usr/bin/env bash
source ./localenv.sh
export DEBUG="4front:*,express-request-proxy,express-session"

echo $1

if [ $1 = "debug" ]
then
  node debug app.js
else
  nodemon app.js # | bunyan
fi
