#!/bin/sh
# Runs the pipeline in a clean environment: an nvm lazy-loader in the caller's shell recurses past FUNCNEST.
script_dir=$(cd "$(dirname "$0")" && pwd)
node_bin=${DIAGRAM_NODE:-}
if [ -z "$node_bin" ]; then
  node_bin=$(ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -n 1)
fi
for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
  [ -z "$node_bin" ] && [ -x "$candidate" ] && node_bin=$candidate
done
[ -z "$node_bin" ] && node_bin=$(command -v node 2>/dev/null)
if [ -z "$node_bin" ] || [ ! -x "$node_bin" ]; then
  echo "render.sh: no node found; set DIAGRAM_NODE to a node binary" >&2
  exit 1
fi
exec env -i HOME="$HOME" PATH="$(dirname "$node_bin"):/usr/bin:/bin" node "$script_dir/render.mjs" "$@"
