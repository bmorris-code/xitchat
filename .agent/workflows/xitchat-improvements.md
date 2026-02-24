---
description: XitChat improvement implementation workflow
---

# XitChat Improvement Workflow

## Rules
- Keep ALL existing styles, fonts, colors, CRT aesthetic
- Keep radar view exactly as-is (peer grid, not a map)
- Keep all existing routing and component structure
- Only ADD and FIX — never redesign
- Every change must look like it was always part of the app

## Phase 1 — Foundation (Make It Solid)
1. Chat persistence — save/restore messages from localStorage
2. Custom terminal-style Modal system (replace all alert()/confirm())
3. Unread message badge on sidebar/bottom nav
4. Message timestamps + delivery tick indicators
5. React ErrorBoundary for crash protection

## Phase 2 — Real Features
6. Real SOS broadcast (mesh packet with GPS + relay forward)
7. Real typing indicator (broadcast over mesh, show in chat)
8. Message delivery ACK ticks (sent → delivered UI)
9. Enhanced Buzz board (categories + 24h expiry)
10. Contacts list from handshake history

## Phase 3 — Community
11. Store-and-forward multi-hop routing
12. Disappearing messages toggle per chat
13. Voice notes (compressed audio over mesh)
14. Community reputation display on profile
15. Neighborhood auto-join rooms by geohash
