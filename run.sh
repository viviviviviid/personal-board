#!/bin/bash

APP="personal-board"
DIR="$(cd "$(dirname "$0")" && pwd)"

cmd_start() {
  cd "$DIR"

  if ! command -v pm2 &>/dev/null; then
    echo "pm2 not found. Installing..."
    npm install -g pm2
  fi

  echo "Installing dependencies..."
  npm install

  echo "Running DB migrations..."
  npx prisma generate
  npx prisma db push

  echo "Building..."
  npm run build

  pm2 describe "$APP" &>/dev/null \
    && pm2 restart "$APP" \
    || pm2 start "npm start" --name "$APP"

  pm2 save
  echo "Started. Logs: ./run.sh logs"
}

cmd_stop() {
  pm2 stop "$APP" && echo "Stopped."
}

cmd_restart() {
  pm2 restart "$APP" && echo "Restarted."
}

cmd_logs() {
  pm2 logs "$APP"
}

cmd_status() {
  pm2 describe "$APP"
}

cmd_update() {
  cd "$DIR"
  git pull
  npm install
  npx prisma generate
  npx prisma db push
  npm run build
  pm2 restart "$APP"
  echo "Updated and restarted."
}

case "$1" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  logs)    cmd_logs ;;
  status)  cmd_status ;;
  update)  cmd_update ;;
  *)
    echo "Usage: ./run.sh {start|stop|restart|logs|status|update}"
    echo ""
    echo "  start   - install deps, build, and start"
    echo "  stop    - stop the server"
    echo "  restart - restart without rebuilding"
    echo "  logs    - tail logs"
    echo "  status  - show process status"
    echo "  update  - git pull, rebuild, restart"
    ;;
esac
