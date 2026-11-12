#!/bin/bash
# usage: .sim.sh "command"
python3 -c "import json,sys; open('/tmp/sim-shell-args.json','w').write(json.dumps({'command': sys.argv[1]}))" "$1"
python3 ~/workspace/custom-connectors/custom.simular/bin/client.py call-tool --name shell --arguments-file /tmp/sim-shell-args.json 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(c.get('text','') for c in d.get('content',[])))"
