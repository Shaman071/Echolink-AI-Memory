#!/usr/bin/env bash
# Demo script: register, login, and upload sample WhatsApp file using curl
set -e
API="http://localhost:3001/api"
COOKIE_FILE="cookies.txt"

echo "Registering user..."
curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" -d '{"name":"Demo User","email":"demo+sh@example.com","password":"Demo12345"}' -c $COOKIE_FILE | jq .

echo "Logging in..."
curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"demo+sh@example.com","password":"Demo12345"}' -c $COOKIE_FILE | jq .

SAMPLE="../../sample_data/sample_whatsapp.txt"
if [ ! -f "$SAMPLE" ]; then
  echo "Sample file not found: $SAMPLE"
  exit 1
fi

echo "Uploading sample WhatsApp file..."
curl -s -X POST "$API/import/whatsapp" -F "file=@$SAMPLE" -b $COOKIE_FILE | jq .

echo "Demo completed. Cookies saved to $COOKIE_FILE. Open http://localhost:3000 to login and explore."