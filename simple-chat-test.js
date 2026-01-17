// Simple Chat Test Script
// Run this in browser console when Xitchat is loaded

console.log('🧪 Starting Xitchat Chat Test...');

// Test 1: Check if app is loaded
function testAppLoaded() {
    const appElement = document.querySelector('#root');
    if (appElement && appElement.children.length > 0) {
        console.log('✅ App loaded successfully');
        return true;
    } else {
        console.log('❌ App not loaded');
        return false;
    }
}

// Test 2: Check if chat components exist
function testChatComponents() {
    const chatWindow = document.querySelector('[data-testid="chat-window"]') || 
                      document.querySelector('.chat-window') ||
                      document.querySelector('div[class*="ChatWindow"]');
    
    const chatList = document.querySelector('[data-testid="chat-list"]') ||
                    document.querySelector('.chat-list') ||
                    document.querySelector('div[class*="ChatList"]');
    
    console.log('📊 Chat Components Check:');
    console.log('Chat Window:', chatWindow ? '✅ Found' : '❌ Not found');
    console.log('Chat List:', chatList ? '✅ Found' : '❌ Not found');
    
    return { chatWindow, chatList };
}

// Test 3: Try to send a test message
function testSendMessage() {
    console.log('📝 Testing message send...');
    
    // Look for input field
    const inputField = document.querySelector('input[type="text"]') ||
                      document.querySelector('textarea') ||
                      document.querySelector('[contenteditable="true"]') ||
                      document.querySelector('input[placeholder*="message" i]');
    
    if (!inputField) {
        console.log('❌ No input field found');
        return false;
    }
    
    console.log('✅ Input field found:', inputField);
    
    // Try to type a test message
    const testMessage = 'Test message from automated test - ' + new Date().toISOString();
    
    try {
        inputField.focus();
        inputField.value = testMessage;
        
        // Trigger input event
        const event = new Event('input', { bubbles: true });
        inputField.dispatchEvent(event);
        
        console.log('✅ Test message typed:', testMessage);
        
        // Look for send button
        const sendButton = document.querySelector('button[type="submit"]') ||
                          document.querySelector('button[title*="send" i]') ||
                          document.querySelector('button:contains("Send")') ||
                          document.querySelector('button[class*="send"]');
        
        if (sendButton) {
            console.log('✅ Send button found, clicking...');
            sendButton.click();
            return true;
        } else {
            console.log('⚠️ Send button not found, trying Enter key...');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
            inputField.dispatchEvent(enterEvent);
            return true;
        }
    } catch (error) {
        console.log('❌ Error sending message:', error);
        return false;
    }
}

// Test 4: Check network status
function testNetworkStatus() {
    console.log('🌐 Checking network status...');
    
    // Check if we can access the app's internal state
    const app = window.app || window.React?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentOwner?.current?.element;
    
    if (app && app.state) {
        console.log('📊 App State:', {
            nostrConnected: app.state.nostrConnected,
            meshStatus: app.state.meshStatus,
            discoveredPeers: app.state.discoveredPeers?.length || 0
        });
    } else {
        console.log('⚠️ Cannot access app state');
    }
    
    // Check browser network status
    console.log('📡 Network Status:', {
        online: navigator.onLine,
        bluetooth: 'bluetooth' in navigator,
        geolocation: 'geolocation' in navigator,
        userAgent: navigator.userAgent
    });
}

// Run all tests
function runAllTests() {
    console.log('🚀 Running all chat tests...');
    
    const results = {
        appLoaded: testAppLoaded(),
        components: testChatComponents(),
        messageSent: testSendMessage(),
        networkStatus: testNetworkStatus()
    };
    
    console.log('📊 Test Results:', results);
    return results;
}

// Auto-run after 2 seconds
setTimeout(runAllTests, 2000);

// Also make it available globally
window.testXitchatChat = runAllTests;
