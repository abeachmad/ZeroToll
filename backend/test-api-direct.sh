#!/bin/bash
curl -s -X POST http://localhost:3002/api/gasless/execute-direct \
  -H 'Content-Type: application/json' \
  -d '{
    "chainId": 80002,
    "privateKey": "0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04",
    "calls": [
      {
        "to": "0x5a87A3c738cf99DB95787D51B627217B6dE12F62",
        "data": "0x",
        "value": "0"
      }
    ]
  }'
