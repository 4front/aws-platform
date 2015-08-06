#!/bin/bash
echo "This script will install 4Front and its dependencies"
echo "Make sure to run it in a directory where you would like 4Front installed."
echo "Hit enter to continue or CTRL-C to cancel."
read RIGHT_LOCATION

# Install pow
#curl get.pow.cx | sh

# create 4front.dev
#echo 1903 > ~/.pow/4front.dev

# Check for homebrew installed
if [[ `which brew` ]]; then
  echo 'The Homebrew package manager is already installed. Good.'
  BREW_INSTALLED=true
else
  echo 'The Mac Homebrew package maanger is not installed. You need to install it to get dependencies for 4front'
  echo 'open http://brew.sh? Hit enter or CTRL-C to cancel'
  read yesno
  if [ yesno ]; then
    open http://brew.sh
  fi
  exit 1
fi

if [ BREW_INSTALLED ]; then
  echo 'Installing 4front dependencies'
  brew install dynamodb-local
  brew install redis
fi

if [[ `which node` && `which npmx` ]]; then
  echo 'nodejs and npm are already installed. Good.'
  NODE_INSTALLED=true
else
  echo "You need NodeJS installed for 4front. If you don't have it we recommend Node Version Manager (NVM)"
  echo "run 'brew install nvm' to get it? Type YES to do it, or CTRL-C to cancel"
  read YES_GET_NVM
  if [ YES_GET_NVM == 'YES' ]; then
    brew install nvm
    echo "1. Restart your shell and run this command: nvm install 0.12"
    echo "2. Re-run this install script."
  else
    exit 1
  fi
fi

if [ NODE_INSTALLED ]; then
  git clone https://github.com/4front/aws-platform.git 4front
  cd 4front
  npm install
  node ./node_modules/4front-dynamodb/scripts/create-local-tables.js
  4FRONT_INSTALLED=true
fi

# Start the server?
# Install the CLI
if [ 4FRONT_INSTALLED ]; then
  npm install -g 4front/cli
fi
