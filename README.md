# Botium Connector for Rasa

[![NPM](https://nodei.co/npm/botium-connector-rasa.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/botium-connector-rasa/)

[![Codeship Status for codeforequity-at/botium-connector-rasa](https://app.codeship.com/projects/c947b780-0daa-0137-4acf-3a9e8715cbf8/status?branch=master)](https://app.codeship.com/projects/326745)
[![npm version](https://badge.fury.io/js/botium-connector-rasa.svg)](https://badge.fury.io/js/botium-connector-rasa)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()

This is a [Botium](https://github.com/codeforequity-at/botium-core) connector for testing your Rasa chatbot.

__Did you read the [Botium in a Nutshell](https://medium.com/@floriantreml/botium-in-a-nutshell-part-1-overview-f8d0ceaf8fb4) articles? Be warned, without prior knowledge of Botium you won't be able to properly use this library!__

## How it works
Botium connects to your Rasa chatbot. 

This connector works just with the [Rasa RestInput channel](https://rasa.com/docs/core/connectors/#restinput) together.

Be aware, if Rasa does not understand the request, and it has no fallback intent, then the response will be empty ([see this test case](./samples/spec/convo/noanswer.convo.txt)).

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

Process is very simple, you have to know just the endpoint URL for your chatbot, for example http://localhost/webhooks/rest/webhook.
  
Create a botium.json with this URL in your project directory: 

```
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "<whatever>",
      "CONTAINERMODE": "rasa",
      "RASA_REST_INPUT_URL": "..."
    }
  }
}
```

To check the configuration, run the emulator (Botium CLI required) to bring up a chat interface in your terminal window:

```
> botium-cli emulator
```

Botium setup is ready, you can begin to write your [BotiumScript](https://github.com/codeforequity-at/botium-core/wiki/Botium-Scripting) files.

## How to start sample

There is a small demo in [samples](./samples) with Botium Bindings. This tests the Rasa moodbot. You can create it using a Rasa tutorial, or
you can start it using our [dockerized version](./samples/rasa_docker)

```
> cd ./samples/rasa_docker/
> docker-compose up
```
* Adapt botium.json in the sample directory (change URL)
* Run the sample

```
> cd ./samples/
> npm install && npm test
```

## Supported Capabilities

Set the capability __CONTAINERMODE__ to __rasa__ to activate this connector.

Rasa connector is a wrapper around [Generic HTTP(S)/JSON Connector](https://botium.atlassian.net/wiki/spaces/BOTIUM/pages/24510469/Generic+HTTP+S+JSON+Connector). Just sets some capabilities with defaults to simplify configuration.

You can use all capabilities of _Generic HTTP(S)/JSON Connector_ with Rasa connector. For example RASA_REST_INPUT_URL is SIMPLEREST_URL. See the description of capabilities there.

### RASA_REST_INPUT_URL
Rasa endpoint URL. This is the only required capability.

### RASA_REST_INPUT_PING_URL
Default:

Same URL as _RASA_REST_INPUT_URL_, just the path is _/version_

### RASA_REST_INPUT_METHOD
Default:

```POST```

### RASA_REST_INPUT_BODY_TEMPLATE
Default:

```{ "message": "{{msg.messageText}}", "sender": "{{botium.conversationId}}" }```

### RASA_REST_INPUT_RESPONSE_JSONPATH
Default: 

```$.*.text```

### RASA_REST_INPUT_MEDIA_JSONPATH
Default:

```$.*.image```

### RASA_REST_INPUT_BUTTONS_JSONPATH
Default:

```$.*.buttons.*.payload```

### RASA_REST_INPUT_...
You can use all other _Generic HTTP(S)/JSON Connector_ capabilities. Rasa connector does not set default value to them.

