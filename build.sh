#!/usr/bin/env bash

set -e

pushd chat
node build.js
popd
sam build