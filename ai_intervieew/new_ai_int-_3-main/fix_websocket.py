#!/usr/bin/env python3
import re

# Read the file
with open('azure_realtime_handler.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all remaining websocket.send(json.dumps(...)) with websocket.send_str(json.dumps(...))
content = re.sub(r'await self\.websocket\.send\(json\.dumps\(', 'await self.websocket.send_str(json.dumps(', content)

# Write back
with open('azure_realtime_handler.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ Fixed all remaining websocket.send operations to use aiohttp send_str')