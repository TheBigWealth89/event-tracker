#!/bin/bash

HOST="http://localhost:5000/track"
URL="https://track.com"
USER_A="user-123"
USER_B="user-442"

# Send a LOGIN event for User A
echo "User A login event..."
curl -X POST "$HOST" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_A" \
  -d "{\"eventName\": \"login\", \"url\": \"$URL\", \"metadata\": { \"device\": \"desktop\", \"browser\": \"chrome\" }}"
echo ""

# Send a PURCHASE event for User B
echo "User B purchase event..."
curl -X POST "$HOST" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_B" \
  -d "{\"eventName\": \"purchase\", \"url\": \"$URL\", \"metadata\": { \"itemId\": \"sku-443\", \"price\": 49.99 }}"
echo ""

# Send a LOGOUT event for User A
echo "User A logout event..."
curl -X POST "$HOST" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_A" \
  -d "{\"eventName\": \"logout\", \"url\": \"$URL\", \"metadata\": { \"duration\": \"15m\" }}"
echo ""
