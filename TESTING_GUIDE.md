# XitChat Testing Guide 🚀

This guide explains how to test the real-time mesh functions of XitChat, both locally and globally.

## 1. Local Mesh Testing (Same Device / Same Network)

Local mesh uses **Bluetooth**, **WiFi P2P (Simulated)**, and **BroadcastChannel**.

### Same Device (Easiest)
1. Open XitChat in your main browser (e.g., Chrome).
2. Open XitChat in an **Incognito Window** or a **different browser** (e.g., Edge/Firefox).
3. You should see the other "peer" appear in the **Radar** or **Peers List** almost immediately.
4. Send a message from one window; it should appear in the other via the `BroadcastChannel` layer.

### Different Devices (Same WiFi)
1. Open XitChat on two different phones or laptops on the same WiFi.
2. Ensure both have Bluetooth enabled if you want to test the Bluetooth layer.
3. The apps will use **Nostr** to "find" each other and then attempt to establish a direct **WebRTC** connection.

---

## 2. Global Mesh Testing (Remote Users)

Global mesh uses **Nostr** and **Ably WebRTC** to connect users across the world.

### How to Test with Others
1. **Share the Link**: Send your Vercel URL (e.g., `https://xitchat.vercel.app`) to a friend.
2. **Wait for Discovery**: It may take 5-10 seconds for Nostr relays to sync and show your friend in the list.
3. **Check Connection Type**: In the chat window, look for the connection icon. It should say **"Nostr"** or **"WebRTC"**.
4. **Real-time Chat**: Once connected, messages are sent directly P2P via WebRTC (if possible) or relayed via Nostr.

---

## 3. Verifying Network Health

XitChat now includes a **Network State Manager** that monitors all layers.

1. Open the **Browser Console** (F12).
2. Look for logs starting with `📊 Registered network service`.
3. You can check the overall health by typing `networkStateManager.getStatus()` in the console.
4. **Simulate Offline**: Turn off your WiFi. The app should show "Offline" status and attempt to reconnect automatically once you turn WiFi back on.

---

## 4. Troubleshooting

| Issue | Solution |
|-------|----------|
| **No peers appearing** | Ensure `VITE_ABLY_API_KEY` is set in Vercel. Check if Nostr relays are reachable. |
| **Bluetooth not working** | Web Bluetooth requires HTTPS and a user gesture (click "Scan" button). |
| **Messages delayed** | Nostr can sometimes have latency. WebRTC is much faster once the connection is established. |

---

**Happy Testing!** If you find any bugs, please report them to the dev team. 🛠️
