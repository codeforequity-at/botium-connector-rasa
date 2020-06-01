# Botium Connector for Rasa

[![NPM](https://nodei.co/npm/botium-connector-rasa.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/botium-connector-rasa/)

[![Codeship Status for codeforequity-at/botium-connector-rasa](https://app.codeship.com/projects/85c1e8b0-5ac7-0137-3809-76862924ef8c/status?branch=master)](https://app.codeship.com/projects/342527)
[![npm version](https://badge.fury.io/js/botium-connector-rasa.svg)](https://badge.fury.io/js/botium-connector-rasa)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()

This is a [Botium](https://github.com/codeforequity-at/botium-core) connector for testing your Rasa chatbot.

__Did you read the [Botium in a Nutshell](https://medium.com/@floriantreml/botium-in-a-nutshell-part-1-overview-f8d0ceaf8fb4) articles? Be warned, without prior knowledge of Botium you won't be able to properly use this library!__

## How it works
Botium connects to your Rasa chatbot either to [Rasa Core](https://rasa.com/docs/rasa/user-guide/connectors/your-own-website/) or to [Rasa NLU](https://rasa.com/docs/rasa/api/http-api/) directly.

When connecting to Rasa Core, Botium can test the conversational flow. When connecting to Rasa NLU, Botium can test the NLU functions only with the [Botium NLP Asserters](https://botium.atlassian.net/wiki/spaces/BOTIUM/pages/17334319/NLP+Asserter+Intents+Entities+Confidence)

It can be used as any other Botium connector with all Botium Stack components:
* [Botium CLI](https://github.com/codeforequity-at/botium-cli/)
* [Botium Bindings](https://github.com/codeforequity-at/botium-bindings/)
* [Botium Box](https://www.botium.at)

## Requirements
* **Node.js and NPM**
* a **Rasa bot**
* a **project directory** on your workstation to hold test cases and Botium configuration

## Install Botium and Rasa Connector

When using __Botium CLI__:

```
> npm install -g botium-cli
> npm install -g botium-connector-rasa
> botium-cli init
> botium-cli run
```

When using __Botium Bindings__:

```
> npm install -g botium-bindings
> npm install -g botium-connector-rasa
> botium-bindings init mocha
> npm install && npm run mocha
```

When using __Botium Box__:

_Already integrated into Botium Box, no setup required_

## Connecting Rasa chatbot to Botium

### Setting up Rasa

When using _REST\_INPUT_ (Rasa Core), you have to add the [RestInput channel](https://rasa.com/docs/rasa/user-guide/connectors/your-own-website/) to your Rasa configuration.

When using _NLU\_INPUT_ (Rasa Core), you have to add the _--enable-api_ [command line switch](https://rasa.com/docs/rasa/user-guide/command-line-interface/) when starting your Rasa server.

### Setting up Botium

Create a botium.json with the the URL of your Rasa installation in your project directory:

```
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "<whatever>",
      "CONTAINERMODE": "rasa",
      "RASA_MODE": "REST_INPUT",
      "RASA_ENDPOINT_URL": "https://box.botium.at/rasa-demo/"
    }
  }
}
```

To check the configuration, run the emulator (Botium CLI required) to bring up a chat interface in your terminal window:

```
> botium-cli emulator
```

Botium setup is ready, you can begin to write your test cases with [BotiumScript](https://botium.atlassian.net/wiki/spaces/BOTIUM/pages/491664/Botium+Scripting+-+BotiumScript).

## Using the botium-connector-rasa-cli

This connector provides a CLI interface for importing convos and utterances from your Rasa model and convert it to BotiumScript.

You can either run the CLI with botium-cli (it is integrated there), or directly from this connector (see samples/nlu/package.json for an example):

    > botium-connector-rasa-cli import --nlufile path-to-my-nlu.md

_Please note that a botium-core installation is required_

For getting help on the available CLI options and switches, run:

    > botium-connector-rasa-cli --help

## How to start sample

There are two samples available in the [samples](./samples) folder. Both of them are based on [Sara - the Rasa Demo Bot](https://github.com/RasaHQ/rasa-demo). Adapt the botium.json in these directories with your own Rasa Demo installation.

You can start the samples with these commands:

```
> cd ./samples/core
> npm install && npm test
```

## Supported Capabilities

Set the capability __CONTAINERMODE__ to __rasa__ to activate this connector.

### RASA_ENDPOINT_URL
Rasa endpoint URL.

### RASA_MODE
_Default: REST\_INPUT_

**REST_INPUT for using Rasa Core**
The Rasa endpoint URL is extended with /webhooks/rest/webhook for posting the Botium requests.

**NLU_INPUT for using Rasa NLU**
The Rasa endpoint URL is extended with /model/parse for posting the Botium requests.

### RASA_ENDPOINT_PING_URL
_Default: endpoint URL/version_

URL to ping for checking availability of Rasa. By default, the _version_-endpoint is contacted.

### RASA_ENDPOINT_TOKEN
If your Rasa endpoint is protected with token authentication, you have to specify the token to use here.

### RASA_ENDPOINT_JWT
If your Rasa endpoint is protected with JWT Auth, you have to specify the JWT Token here.
