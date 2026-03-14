const fs = require('fs');

let nostr = fs.readFileSync('services/nostrService.ts', 'utf8');
const target = `      this.presenceSubscription = this.pool!.subscribeMany(activeRelays, [{
        kinds: [this.PRESENCE_KIND],
        '#d': ['xitchat-presence'], // Filter only our D-tag
        limit: 10
      }, {
        onevent: async (event: any) => {`;
const replace = `      this.presenceSubscription = this.pool!.subscribeMany(activeRelays, [{
        kinds: [this.PRESENCE_KIND],
        '#d': ['xitchat-presence'], // Filter only our D-tag
        limit: 10
      }], {
        onevent: async (event: any) => {`;

nostr = nostr.replace(target, replace).replace(target.replace(/\n/g, '\r\n'), replace.replace(/\n/g, '\r\n'));
fs.writeFileSync('services/nostrService.ts', nostr);
console.log('Fixed presence sub array syntax');
