const fs = require('fs');

let app = fs.readFileSync('App.tsx', 'utf8');

const targetChatsState = "  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);";
const replacementChatsState = `  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const saved = localStorage.getItem('xitchat_chats');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_CHATS;
  });

  // Persist chats
  useEffect(() => {
    try {
      const toSave = chats.map(c => ({
        ...c,
        messages: c.messages.slice(-50)
      }));
      localStorage.setItem('xitchat_chats', JSON.stringify(toSave));
    } catch (e) {
      console.debug('Failed to persist chats:', e);
    }
  }, [chats]);`;

app = app.replace(targetChatsState, replacementChatsState).replace(targetChatsState.replace(/\n/g, '\r\n'), replacementChatsState.replace(/\n/g, '\r\n'));
fs.writeFileSync('App.tsx', app);


let nostr = fs.readFileSync('services/nostrService.ts', 'utf8');
const targetNostrKey = `      // Initialize keys
      if (privateKey) {
        this.privateKey = privateKey;
      } else {
        // Security hardening: do not persist private keys in localStorage.
        // Generate an in-memory session key unless an explicit key is provided.
        const secretKey = new Uint8Array(32);
        crypto.getRandomValues(secretKey);
        this.privateKey = Array.from(secretKey).map(b => b.toString(16).padStart(2, '0')).join('');
        console.log('🔑 Generated in-memory Nostr private key for this session');
      }`;

const replacementNostrKey = `      // Initialize keys
      if (privateKey) {
        this.privateKey = privateKey;
      } else {
        const savedKey = localStorage.getItem('xitchat_nostr_key');
        if (savedKey && savedKey.length === 64) {
          this.privateKey = savedKey;
          console.log('🔑 Restored saved Nostr identity');
        } else {
          const secretKey = new Uint8Array(32);
          crypto.getRandomValues(secretKey);
          this.privateKey = Array.from(secretKey).map(b => b.toString(16).padStart(2, '0')).join('');
          localStorage.setItem('xitchat_nostr_key', this.privateKey);
          console.log('🔑 Generated and saved new Nostr private key for this session');
        }
      }`;
nostr = nostr.replace(targetNostrKey, replacementNostrKey).replace(targetNostrKey.replace(/\n/g, '\r\n'), replacementNostrKey.replace(/\n/g, '\r\n'));
fs.writeFileSync('services/nostrService.ts', nostr);

console.log("Done persist fixes.");
