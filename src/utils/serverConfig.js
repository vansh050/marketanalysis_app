const server = {
  ccxtServer: {
    baseUrl: `https://ccxtprod.alphaquark.in/`,
  },
  ccxtWs: {
    baseUrl: 'wss://ccxt.alphaquark.in',
    httpUrl: 'https://ccxt.alphaquark.in',
  },
  server: {
    baseUrl: `https://server.alphaquark.in/`,
  },
  websocket: {
    baseUrl: "https://websocket.alphaquark.in/",   //this will remain like this
  },
  brokerAuth: {
    callbackUrl: 'https://alphaquark.in/api/deploy/broker/callback',
    registerUrl: 'https://alphaquark.in/api/deploy/broker/register',
  },
  };

  export default server;
  
  // const server = {
  //   host: "localhost:8001",
  //   port: "5000",
  // };
  // server.baseUrl = `http://${server.host}/`;
  // export default server;
  