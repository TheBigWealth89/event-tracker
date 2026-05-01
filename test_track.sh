#!/bin/bash

HOST="http://localhost:5000/track"
URL="https://track.com"
USER_A="user-123"
USER_B="user-442"
USER_C="user-1233"
API_KEYS="test-api-key"

# Send a LOGIN event for User A
echo "User A login event..."
curl -X POST "$HOST" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_A" \
  -H "x-api-key: $API_KEYS" \
  -d "{\"eventName\": \"login\", \"url\": \"$URL\", \"metadata\": { \"device\": \"desktop\", \"browser\": \"chrome\" }}"
echo ""

# Send a LOGIN event for User A
echo "User C login event..."
curl -X POST "$HOST" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_C" \
  -H "x-api-key: $API_KEYS" \
  -d "{\"eventName\": \"login\", \"url\": \"$URL\", \"metadata\": { \"device\": \"desktop\", \"browser\": \"chrome\" }}"
echo ""

# Send a LOGIN event for User A
echo "User A login event..."
curl -X POST "$HOST" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_A" \
  -H "x-api-key: $API_KEYS" \
  -d "{\"eventName\": \"login\", \"url\": \"$URL\", \"metadata\": { \"device\": \"desktop\", \"browser\": \"chrome\" }}"
echo ""

# Send a PURCHASE event for User B
echo "User B purchase event..."
curl -X POST "$HOST" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_B" \
  -H "x-api-key: $API_KEYS" \
  -d "{\"eventName\": \"purchase\", \"url\": \"$URL\", \"metadata\": { \"itemId\": \"sku-443\", \"price\": 49.99 }}"
echo ""

# Send a LOGOUT event for User A
echo "User A logout event..."
curl -X POST "$HOST" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_A" \
  -H "x-api-key: $API_KEYS" \
  -d "{\"eventName\": \"logout\", \"url\": \"$URL\", \"metadata\": { \"duration\": \"15m\" }}"
echo ""
