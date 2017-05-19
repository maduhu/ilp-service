#!/bin/bash -ex

publishNpm() {
  # Push NPM package if not yet published
  if [ "$(npm info $(npm ls --depth=-1 2>/dev/null | head -1 | cut -f 1 -d " ") 2>/dev/null)" = "undefined" ]; then
    npm publish
  fi
}

pushDocker() {
  # Push Docker image tagged latest and tagged with commit descriptor
  local REGISTRY="modusbox-level1-docker-release.jfrog.io/"
  local REPO=$(basename $PWD)
  # rm is false because on Circle the process doesn't have permissions to delete the intermediate container
  docker build -t $REGISTRY$REPO --rm=false .
  docker login -u $DOCKER_USER -p $DOCKER_PASS -e $DOCKER_EMAIL $REGISTRY
  docker tag $REGISTRY$REPO":latest" $REGISTRY$REPO":$(git describe --tags)"
  docker push $REGISTRY$REPO":latest"
  docker push $REGISTRY$REPO":$(git describe --tags)"
}

publishNpm
pushDocker

