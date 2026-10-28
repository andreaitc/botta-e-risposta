#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

lsof -ti:3000 | xargs kill -9 2>/dev/null
pkill -f localtunnel 2>/dev/null
sleep 1

osascript << APPLESCRIPT
tell application "Terminal"
    activate
    do script "cd '$DIR' && npm run build && NODE_ENV=production node --env-file-if-exists=.env.local dist/server.cjs"
    delay 25
    do script "npx localtunnel --port 3000"
end tell
APPLESCRIPT
