const dgram = require('dgram');
const os = require('os');

class NetworkBroadcast {
  constructor() {
    this.server = null;
    this.clients = new Map();
    this.broadcastPort = 5555;
    this.broadcastAddress = '255.255.255.255';
  }

  startBroadcast(userId, username) {
    this.server = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    
    this.server.on('listening', () => {
      this.server.setBroadcast(true);
      console.log(`Broadcast server listening on port ${this.broadcastPort}`);
      
      // Start broadcasting presence
      setInterval(() => {
        const message = JSON.stringify({
          type: 'presence',
          userId,
          username,
          timestamp: Date.now()
        });
        
        this.server.send(message, 0, message.length, this.broadcastPort, this.broadcastAddress);
      }, 5000);
    });

    this.server.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        
        switch (data.type) {
          case 'presence':
            this.handlePresence(data, rinfo);
            break;
          case 'discovery':
            this.handleDiscovery(data, rinfo);
            break;
        }
      } catch (error) {
        console.error('Broadcast message error:', error);
      }
    });

    this.server.bind(this.broadcastPort);
  }

  handlePresence(data, rinfo) {
    this.clients.set(data.userId, {
      ...data,
      address: rinfo.address,
      port: rinfo.port,
      lastSeen: Date.now()
    });
  }

  handleDiscovery(data, rinfo) {
    const response = JSON.stringify({
      type: 'discovery-response',
      clients: Array.from(this.clients.values())
    });
    
    this.server.send(response, 0, response.length, rinfo.port, rinfo.address);
  }

  getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }

    return ips;
  }

  stopBroadcast() {
    if (this.server) {
      this.server.close();
      this.clients.clear();
    }
  }
}

module.exports = new NetworkBroadcast();
