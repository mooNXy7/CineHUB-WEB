#!/bin/sh
# Execute este arquivo a cada 3 dias (Termux/Acode).
cd "$(dirname "$0")/.."
python3 tools/atualizar_listas.py
