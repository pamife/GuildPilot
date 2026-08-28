#!/usr/bin/env bash

# Manual update trigger for GuildPilot

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_DIR}"

echo "========================================="
echo " GuildPilot Manual Update & Build Script "
echo "========================================="

chmod +x "${SCRIPT_DIR}/auto-update.sh"
if [ $# -eq 0 ]; then
  "${SCRIPT_DIR}/auto-update.sh" --force
else
  "${SCRIPT_DIR}/auto-update.sh" "$@"
fi
