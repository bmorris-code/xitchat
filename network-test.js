// XitChat Network Functionality Test
// Run this in browser console to test all 5 networks

async function testXitChatNetworks() {
  console.log('🧪 Starting XitChat Network Test...');
  
  const results = {
    bluetooth: false,
    webrtc: false,
    wifi: false,
    nostr: false,
    broadcast: false,
    overall: 'NOT_WORKING'
  };

  // Test 1: Check Hybrid Mesh Service
  try {
    if (window.hybridMesh) {
      const connectionInfo = window.hybridMesh.getConnectionInfo();
      console.log('📊 Hybrid Mesh Status:', connectionInfo);
      
      results.bluetooth = connectionInfo.activeServices?.bluetooth || false;
      results.webrtc = connectionInfo.activeServices?.webrtc || false;
      results.wifi = connectionInfo.activeServices?.wifi || false;
      results.broadcast = connectionInfo.activeServices?.broadcast || false;
      
      const peers = window.hybridMesh.getPeers();
      console.log(`👥 Found ${peers.length} hybrid peers:`, peers);
    } else {
      console.log('❌ Hybrid Mesh service not available');
    }
  } catch (error) {
    console.error('❌ Hybrid Mesh test failed:', error);
  }

  // Test 2: Check Nostr Service
  try {
    if (window.nostrService) {
      const nostrConnected = window.nostrService.getConnectionInfo();
      console.log('🌍 Nostr Status:', nostrConnected);
      
      results.nostr = nostrConnected.connected || false;
      
      if (nostrConnected.connected) {
        const publicKey = window.nostrService.getPublicKey();
        console.log(`🔑 Nostr Public Key: ${publicKey}`);
        
        // Test search functionality
        const searchResults = await window.nostrService.searchUsers('test');
        console.log(`🔍 Nostr Search Results: ${searchResults.length} users found`);
      }
    } else {
      console.log('❌ Nostr service not connected');
    }
  } catch (error) {
    console.error('❌ Nostr test failed:', error);
  }

  // Test 3: Check Message Sending
  try {
    const testMessage = `Network Test Message - ${new Date().toISOString()}`;
    console.log('📤 Sending test message...');
    
    if (window.hybridMesh) {
      await window.hybridMesh.sendMessage(testMessage, 'broadcast');
      console.log('✅ Test message sent via hybrid mesh');
    }
    
    if (window.nostrService && results.nostr) {
      await window.nostrService.sendDirectMessage('test-target', testMessage);
      console.log('✅ Test message sent via Nostr');
    }
  } catch (error) {
    console.error('❌ Message sending test failed:', error);
  }

  // Calculate overall status
  const activeNetworks = Object.values(results).filter(Boolean).length;
  if (activeNetworks >= 3) {
    results.overall = 'EXCELLENT';
  } else if (activeNetworks >= 2) {
    results.overall = 'GOOD';
  } else if (activeNetworks >= 1) {
    results.overall = 'PARTIAL';
  } else {
    results.overall = 'BROKEN';
  }

  console.log('\n🎯 XITCHAT NETWORK TEST RESULTS:');
  console.log('=====================================');
  console.log(`📱 Bluetooth: ${results.bluetooth ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  console.log(`🌐 WebRTC: ${results.webrtc ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  console.log(`📡 WiFi P2P: ${results.wifi ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  console.log(`🌍 Nostr: ${results.nostr ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  console.log(`📡 Broadcast: ${results.broadcast ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  console.log('=====================================');
  console.log(`🎊 OVERALL STATUS: ${results.overall}`);
  console.log(`📈 Active Networks: ${activeNetworks}/5`);
  
  return results;
}

// Auto-run test when script loads
console.log('🚀 XitChat Network Test Script Loaded');
console.log('📝 Run: testXitChatNetworks() to test all networks');

window.testXitChatNetworks = testXitChatNetworks;
