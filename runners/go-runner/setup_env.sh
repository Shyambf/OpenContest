#!/bin/bash
set -e

# Устанавливаем jq для парсинга JSON, если его нет
if ! command -v jq &> /dev/null; then
    apt-get update && apt-get install -y jq
fi

echo "Scanning languages for dependencies..."

# Собираем все пакеты из всех JSON файлов в папке languages
PACKAGES=$(jq -r '.packages[]?' languages/*.json | sort -u | xargs)

if [ -n "$PACKAGES" ]; then
    echo "Installing detected packages: $PACKAGES"
    apt-get update
    apt-get install -y --no-install-recommends $PACKAGES
    rm -rf /var/lib/apt/lists/*
else
    echo "No extra packages found in JSON files."
fi
